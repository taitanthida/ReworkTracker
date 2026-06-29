const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function seed() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await pool.execute(`
      INSERT INTO defect_codes 
        (defect_code, description_th, description_eng, defect_cause, qa_defect_code, qa_defect_code_description, is_active)
      VALUES
        ('S508', 'สร้อยขาด', 'Broken Chain', 'POST PLATE', '4726', 'Wrong Dimension', TRUE),
        ('S509', 'กาวขาด, ใส่กาวไม่เรียบร้อย', 'Glue failure or improper glue application', 'POST PLATE', '4734', 'Defect in Caralun/gue/epoxy', TRUE),
        ('R510', 'พลอยหลุด', 'Detached stone', 'POST PLATE', '4720', 'Missing Crystal', TRUE),
        ('S511', 'พลอยด้าน,เป็นรอยปิ้น,ร้าว', 'Dull, chipped, or cracked stone', 'POST PLATE', '4712', 'Crystal/CZ defect', TRUE),
        ('R514', 'ห่วงผิดรูป', 'Deformed loop', 'POST PLATE', '4726', 'Wrong dimension', TRUE)
      ON DUPLICATE KEY UPDATE is_active = is_active;
    `);
    console.log('Done seeding defect codes');
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

seed();