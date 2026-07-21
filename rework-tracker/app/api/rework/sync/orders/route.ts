import { NextResponse } from "next/server";
import { getSqlServerPool, dbPool } from "@/lib/db"; 

export async function GET() {
  console.log("Starting Sync from SQL Server (WIP_DATA) to MySQL...");

  try {
    const mssqlPool = await getSqlServerPool();
    
    // Query ให้ดึงเฉพาะข้อมูลที่ Import เข้ามา "วันนี้" (GETDATE)
    const sqlServerQuery = `
      WITH RankedWIP AS (
          SELECT 
              [Order]                   AS order_id, 
              [Material]                AS material_id, 
              [MaterialDescription]     AS description,
              [OpenQuantity]            AS total_qty, 
              [PostPlatingLinePlanning] AS line_post, 
              [ProgressPlanning]        AS prog_plan,
              [ProgressPlanning]        AS qc_after_p, 
              [TargetPackingWK]         AS pack_wk,
              [ImportedAt],
              ROW_NUMBER() OVER (
                  PARTITION BY [Order] 
                  ORDER BY [ImportedAt] DESC
              ) as RowNum
          FROM [SMTKPIDASHBOARD].[dbo].[WIP_DATA]
          WHERE [OrderType] = 'M001'
          AND [ProgressPlanning] IN ('FINS6499', 'FINS6697', 'FINS6698', 'FINS6699')
          AND CAST([ImportedAt] AS DATE) = CAST(GETDATE() AS DATE)
      )
      SELECT order_id, material_id, description, total_qty, line_post, prog_plan, qc_after_p, pack_wk
      FROM RankedWIP
      WHERE RowNum = 1`; // เอาเฉพาะแถวล่าสุดของแต่ละ Order

    const sqlServerResult = await mssqlPool.request().query(sqlServerQuery);
    const rows = sqlServerResult.recordset;
    console.log(`Extracted ${rows.length} rows from SQL Server`);

    if (rows.length === 0) {
      return NextResponse.json({ 
        message: "No data imported today on SQL Server", 
        totalRows: 0 
      });
    }

    // จัดโครงสร้างส่งเข้า MySQL (ทำ Bulk Insert ต่อตามปกติ)
    const values = rows.map((row) => [
      row.order_id?.toString() || "",
      row.material_id?.toString() || "",
      row.description?.toString() || "",
      row.total_qty || 0,
      row.line_post?.toString() || "",
      row.prog_plan?.toString() || "",
      row.qc_after_p?.toString() || "",
      row.pack_wk?.toString() || "",
      "erp",
      new Date(),
    ]);

    const bulkInsertQuery = `
      INSERT INTO production_orders (order_id, material_id, description, total_qty, line_post, prog_plan, qc_after_p, pack_wk, source, synced_at)
      VALUES ?
      ON DUPLICATE KEY UPDATE 
          material_id = VALUES(material_id),
          description = VALUES(description),
          total_qty = VALUES(total_qty),
          line_post = VALUES(line_post),
          prog_plan = VALUES(prog_plan),
          qc_after_p = VALUES(qc_after_p),
          pack_wk   = VALUES(pack_wk),
          synced_at = NOW();`;

    await dbPool.query(bulkInsertQuery, [values]);

    console.log(`✅ Bulk Sync WIP_DATA completed! Total: ${rows.length} rows.`);
    return NextResponse.json({ 
      message: "Sync WIP_DATA complete!", 
      totalRows: rows.length
    });

  } catch (error: any) {
    console.error(`❌ An Error occurred during Sync: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}