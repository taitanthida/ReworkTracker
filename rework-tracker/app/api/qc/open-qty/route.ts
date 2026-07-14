import { NextRequest, NextResponse } from "next/server"
import { getPool, sql } from "@/lib/mssql"

// GET /api/qc/open-qty?materials=<all|m1,m2,...>
// พอร์ตจาก C# qc-api: ดึง WIP data จาก SQL Server ตาม material ที่เลือก
// filter: OrderType='M001' และ ProgressPlanning เป็น FINS(4 รหัส) หรือ POSP%
export async function GET(req: NextRequest) {
  try {
    const materials = req.nextUrl.searchParams.get("materials")

    const pool = await getPool()
    const request = pool.request()

    let query = `
      SELECT [Order], [OrderType], [Material],
             [ProgressPlanning], [StatusSTAR], [OpenQuantity]
      FROM [SMTKPIDASHBOARD].[dbo].[WIP_DATA]
      WHERE [OrderType] = 'M001'
      AND (
             [ProgressPlanning] IN ('FINS6499', 'FINS6697', 'FINS6698', 'FINS6699')
          OR [ProgressPlanning] LIKE 'POSP%'
      )
    `

    // ถ้าไม่ใช่ "all" ให้กรองตามรายการ material แบบ parameterized (กัน SQL injection)
    if (materials && materials.toLowerCase() !== "all") {
      const materialList = materials
        .split(",")
        .map(m => m.trim())
        .filter(m => m.length > 0)

      if (materialList.length > 0) {
        const paramNames = materialList.map((_, i) => `@Material${i}`)
        query += ` AND [Material] IN (${paramNames.join(",")})`
        materialList.forEach((m, i) => {
          request.input(`Material${i}`, sql.NVarChar, m)
        })
      }
    }

    const result = await request.query(query)
    return NextResponse.json(result.recordset)
  } catch (err) {
    console.error("GET /api/qc/open-qty error:", err)
    // dev เท่านั้น: แนบสาเหตุจริงเพื่อ debug (ไม่เปิดเผยตอน production)
    const detail =
      process.env.NODE_ENV !== "production" && err instanceof Error
        ? err.message
        : undefined
    return NextResponse.json(
      { error: "Failed to load open quantity data", detail },
      { status: 500 }
    )
  }
}
