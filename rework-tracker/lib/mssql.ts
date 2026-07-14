import sql from "mssql"

// ── SQL Server connection pool (Final QC / WIP_DATA) ──────────────────────────
// อ่านค่าจาก environment variables (.env.local) — ห้าม hardcode credential
// ใช้ pool เดียวแบบ cache ไว้ กัน connection leak ตอน Next.js hot-reload (dev)

// named instance (เช่น SVR1225\OCS) → ใส่แค่ชื่อ instance เช่น "OCS"
// ถ้ามี instanceName ให้ปล่อย port ว่าง เพื่อให้ SQL Browser (UDP 1434) หา dynamic port
const instanceName = process.env.MSSQL_INSTANCE?.trim() || undefined

const config: sql.config = {
  server:   process.env.MSSQL_SERVER   ?? "localhost",
  database: process.env.MSSQL_DATABASE ?? "",
  user:     process.env.MSSQL_USER     ?? "",
  password: process.env.MSSQL_PASSWORD ?? "",
  ...(instanceName ? {} : { port: Number(process.env.MSSQL_PORT ?? 1433) }),
  options: {
    // ถ้าใช้บน Windows Server ทั่วไป >> encrypt: false, ถ้ามี SSL >> true
    encrypt:                process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: true,
    ...(instanceName ? { instanceName } : {}),
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

// เก็บ pool/promise ไว้บน globalThis เพื่อ reuse ข้าม hot-reload ใน dev
type GlobalWithMssql = typeof globalThis & {
  _mssqlPoolPromise?: Promise<sql.ConnectionPool>
}
const g = globalThis as GlobalWithMssql

/** คืน connection pool ที่เชื่อมต่อแล้ว (สร้างครั้งเดียว แล้ว reuse) */
export function getPool(): Promise<sql.ConnectionPool> {
  if (!g._mssqlPoolPromise) {
    g._mssqlPoolPromise = new sql.ConnectionPool(config)
      .connect()
      .catch((err: unknown) => {
        // ล้าง cache เพื่อให้ครั้งถัดไปลองเชื่อมใหม่
        g._mssqlPoolPromise = undefined
        throw err
      })
  }
  return g._mssqlPoolPromise!
}

export { sql }
