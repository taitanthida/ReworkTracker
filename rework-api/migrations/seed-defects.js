const mysql = require('mysql2/promise');

async function seedDatabase() {
  const connection = await mysql.createConnection({
    host:     "localhost",
    user:     "root",
    password: "Tann1004",
    database: "ReworkTrackerDB",
  });

  const sql = `
    INSERT INTO defect_codes 
      (defect_code, description_th, description_eng, defect_cause, qa_defect_code, qa_defect_code_description, is_active)
    VALUES
      ('S508', 'สร้อยขาด', 'Broken Chain', 'POST PLATE', '4726', 'Wrong Dimension', TRUE),
      ('S509', 'กาวขาด, ใส่กาวไม่เรียบร้อย', 'Glue failure or improper glue application', 'POST PLATE', '4734', 'Defect in Caralun/gue/epoxy', TRUE),
      ('R510', 'พลอยหลุด', 'Detached stone', 'POST PLATE', '4720', 'Missing Crystal', TRUE),
      ('S511', 'พลอยด้าน,เป็นรอยปิ้น,ร้าว', 'Dull, chipped, or cracked stone', 'POST PLATE', '4712', 'Crystal/CZ defect', TRUE),
      ('R514', 'ห่วงผิดรูป', 'Deformed loop', 'POST PLATE', '4726', 'Wrong dimension', TRUE)
    ON DUPLICATE KEY UPDATE is_active = is_active;
  `;

  try {
    console.log('Migrating Defect...');
    await connection.execute(sql);
    console.log('\nDone seeding defect codes');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

seedDatabase();