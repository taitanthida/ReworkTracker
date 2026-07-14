import { NextResponse } from "next/server"
import { getPool } from "@/lib/mssql"

// GET /api/qc/materials
// พอร์ตจาก C# qc-api: ดึงรายชื่อ Material ทั้งหมด (ใช้ทำ filter dropdown)
// เดิม: SELECT DISTINCT [Material] FROM [SMTKPIDASHBOARD].[dbo].[WIP_DATA]
//       WHERE [OrderType] = 'M001' AND [Material] IS NOT NULL
export async function GET() {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT DISTINCT [Material]
      FROM [SMTKPIDASHBOARD].[dbo].[WIP_DATA]
      WHERE [OrderType] = 'M001' AND [Material] IS NOT NULL
    `)

    const materials: string[] = result.recordset.map(
      (r: { Material: unknown }) => (r.Material ?? "").toString()
    )

    return NextResponse.json(materials)
  } catch (err) {
    console.error("GET /api/qc/materials error:", err)
    // dev เท่านั้น: แนบสาเหตุจริงเพื่อ debug (ไม่เปิดเผยตอน production)
    const detail =
      process.env.NODE_ENV !== "production" && err instanceof Error
        ? err.message
        : undefined
    return NextResponse.json(
      { error: "Failed to load master materials", detail },
      { status: 500 }
    )
  }
}
