const mssql = require('mssql');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function syncDatabase() {
  console.log('Starting Sync...');

  // SQL Server Config
  const mssqlConfig = {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER,
    database: process.env.MSSQL_DATABASE,
    port: parseInt(process.env.MSSQL_PORT || '1433'),
    options: {
      encrypt: false, // ถ้าใช้บน Windows Server ทั่วไป >> false, ถ้ามี SSL >> true
      trustServerCertificate: true
    }
  };

  let mssqlPool, mysqlConnection;

  try {
    // Connects 2 Database
    mssqlPool = await mssql.connect(mssqlConfig);
    mysqlConnection = await mysql.createConnection({
      host: process.env.NEXT_PUBLIC_DB_HOST,
      user: process.env.NEXT_PUBLIC_DB_USER,
      password: process.env.NEXT_PUBLIC_DB_PASSWORD,
      database: process.env.NEXT_PUBLIC_DB_NAME
    });

    console.log('Connected 2 Database Successfully!');

    // Extract SQL Server
    const srcResult = await mssqlPool.request().query('SELECT * FROM ชื่อตารางต้นทาง');
    const rows = srcResult.recordset;
    console.log(`Extracted ${rows.length} rows`);

    // Looping and Sending requests to MySQL
    for (const row of rows) {
      // ex: Match คอลัมน์: เอาคอลัมน์จาก SQL Server (ด้านขวา) มาใส่ MySQL (ด้านซ้าย)
      const query = `
        INSERT INTO ชื่อตารางปลายทาง_mysql (id, name, updated_at) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = VALUES(updated_at)
      `;
      
      // ดึงค่าตามชื่อ Column จริงของ SQL Server
      await mysqlConnection.execute(query, [row.ID, row.NAME, row.UPDATED_AT]);
    }

    console.log('Saved to MySQL Successfully!');

  } catch (error) {
    console.error('An Error occurred druing Sync:', error);
  } finally {
    // Close Connection
    if (mssqlPool) await mssql.close();
    if (mysqlConnection) await mysqlConnection.end();
    console.log('Done.');
  }
}

// runs function
syncDatabase();