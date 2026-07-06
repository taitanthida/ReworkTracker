require("dotenv").config()
const mysql = require("mysql2/promise")

const users = [
  
  { username: "qc01",     full_name: "Somchai",     role: "qc",         is_active: true },
  { username: "qc02",     full_name: "Jaidee",      role: "qc",         is_active: true },
  { username: "rw01",     full_name: "POSP6305",    role: "rw_station", is_active: true },
  { username: "admin01",  full_name: "Sumhiran P",  role: "admin",      is_active: true },
]

async function seed() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })

  const conn = await pool.getConnection()
  try {
    for (const u of users) {
      await conn.execute(
        `INSERT INTO users (username, full_name, role, is_active)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           role      = VALUES(role),
           is_active = VALUES(is_active)`,
        [u.username, u.full_name, u.role, u.is_active ? 1 : 0]
      )
      console.log(`✓ ${u.username} (${u.role})`)
    }
    console.log(`Done seeding ${users.length} users.`)
  } catch (err) {
    console.error("Error:", err.message)
    process.exitCode = 1
  } finally {
    conn.release()
    await pool.end()
  }
}

seed()