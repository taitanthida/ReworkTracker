const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

const orders = [
  { order_id: "921394733", material_id: "5751560", description: "UNA:NECKLACE SMALL MOTIF CRY/GOS",   line_post: "6305", total_qty: 20  },
  { order_id: "921395680", material_id: "5646735", description: "UNA:BRACELET EMRD/CRY/RHS M",         line_post: "6321", total_qty: 72  },
  { order_id: "921397186", material_id: "5734677", description: "SWA REMIX:STRAND CRY/GOS M",          line_post: "6321", total_qty: 72  },
  { order_id: "921399205", material_id: "5682279", description: "UNA:BRACELET CRY/RHS M",              line_post: "6321", total_qty: 140 },
  { order_id: "921398697", material_id: "5737402", description: "2026 CAPSULE:BANGLE OP DRGNFLY",      line_post: "6321", total_qty: 60  },
  { order_id: "921398832", material_id: "5657388", description: "RE GEMA:ALL ARD GRETC/GOS",           line_post: "6302", total_qty: 24  },
  { order_id: "921396504", material_id: "5682279", description: "UNA:RING SINGLE STONE CRY/RHS",       line_post: "6664", total_qty: 149 },
  { order_id: "921396774", material_id: "5657388", description: "SWA REMIX:BRACELET CRY/RHS M",        line_post: "6665", total_qty: 80  },
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
        INSERT INTO production_orders (order_id, material_id, description, line_post, total_qty, source)
        VALUES (?, ?, ?, ?, ?, 'manual')
        ON DUPLICATE KEY UPDATE
          material_id = VALUES(material_id),
          description = VALUES(description),
          line_post   = VALUES(line_post),
          total_qty   = VALUES(total_qty)
      `, [o.order_id, o.material_id, o.description, o.line_post, o.total_qty]);
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