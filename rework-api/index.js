const express = require("express")
const cors    = require("cors")
const mysql   = require("mysql2/promise")

const app = express()
app.use(cors())
app.use(express.json())

// ── MySQL connection pool ─────────────────────────────────────────────────────
require('dotenv').config()
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

// changes format DD/MM/YY → DATETIME string for MySQL
function parseDate(str) {
  if (!str) return null
  const [d, m, y] = str.split("/")
  if (!d || !m || !y) return null
  const fullYear = parseInt(y) + 2000
  return `${fullYear}-${m.padStart(2,"0")}-${d.padStart(2,"0")} 00:00:00`
}

// ดึง label พร้อม defect_codes + JOIN production_orders
async function fetchLabelWithDefects(conn, labelId) {
  const [rows] = await conn.execute(
    `SELECT rl.*,
            po.material_id, po.description, po.line_post, po.total_qty AS total,
            GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes
     FROM rework_labels rl
     LEFT JOIN production_orders po ON po.order_id = rl.order_id
     LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
     WHERE rl.label_id = ?
     GROUP BY rl.label_id`,
    [labelId]
  )
  if (rows.length === 0) return null
  const row = rows[0]
  row.defect_codes = row.defect_codes ? row.defect_codes.split(",") : []
  return row
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.json({ message: "Rework API is running" }))

// GET /labels — all labels (defect_codes เป็น array)
app.get("/labels", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT rl.*,
             po.material_id, po.description, po.line_post, po.total_qty AS total,
             GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes
      FROM rework_labels rl
      LEFT JOIN production_orders po ON po.order_id = rl.order_id
      LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
      GROUP BY rl.label_id
      ORDER BY rl.created_at DESC
    `)
    rows.forEach(r => {
      r.defect_codes = r.defect_codes ? r.defect_codes.split(",") : []
    })
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /labels/next-id?date=YYYY-MM-DD — generate label ID ฝั่ง server (atomic)
// ⚠️ ต้องอยู่ก่อน /labels/:id (Express match routes จากบนลงล่าง)
app.get("/labels/next-id", async (req, res) => {
  const { date } = req.query // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" })
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM rework_labels WHERE DATE(issued_at) = ?`,
      [date]
    )
    const seq     = String(rows[0].cnt + 1).padStart(2, "0")
    const compact = date.replace(/-/g, "")
    res.json({ labelId: `RW-${compact}-${seq}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /labels/queue — ISSUED + IN_PROGRESS + RETURNED
app.get("/labels/queue", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT rl.*,
             po.material_id, po.description, po.line_post, po.total_qty AS total,
             GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes
      FROM rework_labels rl
      LEFT JOIN production_orders po ON po.order_id = rl.order_id
      LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
      WHERE rl.status IN ('ISSUED','IN_PROGRESS','RETURNED')
      GROUP BY rl.label_id
      ORDER BY rl.created_at DESC
    `)
    rows.forEach(r => {
      r.defect_codes = r.defect_codes ? r.defect_codes.split(",") : []
    })
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /labels/:id — single label
app.get("/labels/:id", async (req, res) => {
  try {
    const label = await fetchLabelWithDefects(pool, req.params.id)
    if (!label) return res.status(404).json({ error: "Label not found" })
    res.json(label)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /labels — create new label
app.post("/labels", async (req, res) => {
  const {
    labelId, orderId, materialId, description, linePost, qcAfterP, total,
    round, progPlan, rwLine, status, inputQty, issuedDate, defectCodes, remark
  } = req.body

  if (!labelId || !orderId || !round || !rwLine) {
    return res.status(400).json({ error: "labelId, orderId, round, rwLine are required" })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // upsert production_orders (กรณียังไม่มี order นี้)
    await conn.execute(`
      INSERT INTO production_orders (order_id, material_id, description, line_post, total_qty, source)
      VALUES (?, ?, ?, ?, ?, 'manual')
      ON DUPLICATE KEY UPDATE
        material_id = COALESCE(VALUES(material_id), material_id),
        description = COALESCE(VALUES(description), description),
        line_post   = COALESCE(VALUES(line_post),   line_post),
        total_qty   = COALESCE(VALUES(total_qty),    total_qty)
    `, [
      orderId,
      materialId  ?? null,
      description ?? null,
      linePost    ?? null,
      total       ?? null,
    ])

    // insert rework_label
    await conn.execute(`
      INSERT INTO rework_labels (
        label_id, order_id, round_no, prog_plan, qc_after_p, rw_line,
        status, input_qty, remark, issued_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      labelId, orderId, round, progPlan, qcAfterP, rwLine,
      status    ?? "ISSUED",
      inputQty  ?? 0,
      remark    ?? null,
      parseDate(issuedDate),
    ])

    // insert label_defects
    const codes = Array.isArray(defectCodes) ? defectCodes : []
    for (const code of codes) {
      await conn.execute(
        "INSERT IGNORE INTO label_defects (label_id, defect_code) VALUES (?, ?)",
        [labelId, code]
      )
    }

    await conn.commit()
    res.json({ success: true, labelId })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

// PATCH /labels/:id — update label
app.patch("/labels/:id", async (req, res) => {
  const allowed = {
    status:         "status",
    receivedDate:   "received_at",
    returnedDate:   "returned_at",
    closedDate:     "closed_at",
    resultGoodQty:  "result_good_qty",
    resultBadQty:   "result_bad_qty",
    isScrapped:     "is_scrapped",
    remark:         "remark",
    // users — nullable จนกว่าจะมี login
    qcInspectorId:  "qc_inspector_id",
    receivedById:   "received_by_id",
    returnedById:   "returned_by_id",
  }

  const dateFields = new Set(["receivedDate", "returnedDate", "closedDate"])

  const fields = []
  const values = []

  for (const [key, col] of Object.entries(allowed)) {
    if (req.body[key] === undefined) continue
    fields.push(`${col} = ?`)
    if (key === "isScrapped")       values.push(req.body[key] ? 1 : 0)
    else if (dateFields.has(key))   values.push(parseDate(req.body[key]))
    else                            values.push(req.body[key])
  }

  if (fields.length === 0) return res.status(400).json({ error: "No valid fields to update" })

  values.push(req.params.id)
  try {
    const [result] = await pool.execute(
      `UPDATE rework_labels SET ${fields.join(", ")} WHERE label_id = ?`,
      values
    )
    if (result.affectedRows === 0) return res.status(404).json({ error: "Label not found" })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /orders/:id — order info from production_orders
app.get("/orders/:id", async (req, res) => {
  try {
    const [orderRows] = await pool.execute(
      "SELECT * FROM production_orders WHERE order_id = ?",
      [req.params.id]
    )

    if (orderRows.length === 0) {
      return res.status(404).json({ error: "Order not found" })
    }

    const [labelRows] = await pool.execute(
      "SELECT * FROM rework_labels WHERE order_id = ? ORDER BY round_no DESC LIMIT 1",
      [req.params.id]
    )

    res.json({
      order: orderRows[0],
      latestLabel: labelRows[0] ?? null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// GET /defect-codes — ดึง active defect codes ทั้งหมด
app.get("/defect-codes", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT defect_code, description_th FROM defect_codes WHERE is_active = 1 ORDER BY defect_code ASC"
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /users — ดึง active users ทั้งหมด (for dropdown QC Name / RW Station)
app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, username, full_name, role FROM users WHERE is_active = 1"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(4000, () => console.log("Server running on http://localhost:4000"))