const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

const orders = [
  { order_id: "921394733", material_id: "5751560", description: "UNA:NECKLACE SMALL MOTIF CRY/GOS", line_post: "POSP6305", prog_plan: "FINS6697", qc_after_p: "QCAP5690", total_qty: 20,  pack_wk: "23" },
  { order_id: "921395680", material_id: "5646735", description: "UNA:BRACELET EMRD/CRY/RHS M",      line_post: "POSP6321", prog_plan: "FINS6698", qc_after_p: "QCAP4691", total_qty: 72,  pack_wk: "23" },
  { order_id: "921397186", material_id: "5734677", description: "SWA REMIX:STRAND CRY/GOS M",       line_post: "POSP6321", prog_plan: "FINS6698", qc_after_p: "QCAP5692", total_qty: 72,  pack_wk: "24" },
  { order_id: "921399205", material_id: "5682279", description: "UNA:BRACELET CRY/RHS M",           line_post: "POSP6321", prog_plan: "FINS6698", qc_after_p: "QCAP5692", total_qty: 140, pack_wk: "24" },
  { order_id: "921398697", material_id: "5737402", description: "2026 CAPSULE:BANGLE OP DRGNFLY",   line_post: "POSP6321", prog_plan: "FINS6698", qc_after_p: "QCAP5692", total_qty: 60,  pack_wk: "24" },
  { order_id: "921398832", material_id: "5657388", description: "RE GEMA:ALL ARD GRETC/GOS",        line_post: "POSP6302", prog_plan: "FINS6697", qc_after_p: "QCAP5691", total_qty: 24,  pack_wk: "24" },
  { order_id: "921396504", material_id: "5682279", description: "UNA:RING SINGLE STONE CRY/RHS",    line_post: "POSP6215", prog_plan: "FINS6699", qc_after_p: "QCAP4490", total_qty: 149, pack_wk: "24" },
  { order_id: "921396774", material_id: "5657388", description: "SWA REMIX:BRACELET CRY/RHS M",     line_post: "POSP6207", prog_plan: "FINS6699", qc_after_p: "QCAP4491", total_qty: 80,  pack_wk: "24" },
];

async function seed() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    for (const o of orders) {
      await pool.execute(`
        INSERT INTO production_orders (order_id, material_id, description, line_post, prog_plan, qc_after_p, total_qty, pack_wk, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')
        ON DUPLICATE KEY UPDATE
          material_id = VALUES(material_id),
          description = VALUES(description),
          line_post   = VALUES(line_post),
          prog_plan   = VALUES(prog_plan),
          qc_after_p   = VALUES(qc_after_p),
          total_qty   = VALUES(total_qty),
          pack_wk   = VALUES(pack_wk)
      `, [o.order_id, o.material_id, o.description, o.line_post, o.prog_plan, o.qc_after_p, o.total_qty, o.pack_wk]);
      console.log(`✓ ${o.order_id} — ${o.description}`);
    }
    console.log("\nDone seeding production_orders");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

seed();