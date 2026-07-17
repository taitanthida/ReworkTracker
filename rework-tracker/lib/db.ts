import mysql from "mysql2/promise";
import sql from "mssql";

// =========================================================================
// 1. MYSQL CONFIG & POOL (Main DB ของ Rework Tracker)
// =========================================================================
export const dbPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// =========================================================================
// 2. SQL SERVER CONFIG & POOL (SAP Connection สำหรับ Sync และ QC Dashboard)
// =========================================================================
const instanceName = process.env.MSSQL_INSTANCE?.trim();

const mssqlConfig: sql.config = {
  server:   process.env.MSSQL_SERVER   ?? "localhost",
  user:     process.env.MSSQL_USER     ?? "",
  password: process.env.MSSQL_PASSWORD ?? "",
  database: process.env.MSSQL_DATABASE ?? "",
  options: {
    encrypt:                process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

if (instanceName) {
  mssqlConfig.options!.instanceName = instanceName;
} else {
  mssqlConfig.port = Number(process.env.MSSQL_PORT ?? 1433);
}

type GlobalWithMssql = typeof globalThis & {
  _mssqlPoolPromise?: Promise<sql.ConnectionPool>;
};
const g = globalThis as GlobalWithMssql;

/** คืน connection pool สำหรับเชื่อมต่อ SQL Server (SAP) */
export function getSqlServerPool(): Promise<sql.ConnectionPool> {
  if (!g._mssqlPoolPromise) {
    const pool = new sql.ConnectionPool(mssqlConfig);
    g._mssqlPoolPromise = pool.connect().catch((err: unknown) => {
      g._mssqlPoolPromise = undefined;
      throw err;
    });
  }
  return g._mssqlPoolPromise;
}

export { sql };