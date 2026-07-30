import { NextResponse, NextRequest } from 'next/server';
import { getSqlServerPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const materials = searchParams.get('materials');
    const selectedDate = searchParams.get('selectedDate');

    // 1. ดึง Connection Pool หลักออกมา
    const pool = await getSqlServerPool();
    const dbRequest = pool.request();

    let materialCondition = "";
    let dateCondition = "";

    // 2. เงื่อนไข Material (ใช้การวนลูปผูกค่า Parameter แบบ Auto-detect string)
    if (materials && materials.toLowerCase() !== 'all') {
      const materialList = materials.split(',').map(m => m.trim()).filter(m => m !== "");
      if (materialList.length > 0) {
        const paramNames = materialList.map((val, i) => {
          // สั่ง input ส่งไปตรง ๆ ไม่ใส่ sql.VarChar ป้องกัน validation พัง
          dbRequest.input(`Material${i}`, val);
          return `@Material${i}`;
        });
        materialCondition = ` AND [Material] IN (${paramNames.join(',')})`;
      }
    }

    // 3. เงื่อนไขวันที่
    if (selectedDate && selectedDate.trim() !== "") {
      // ส่งค่ายอดฮิต selectedDate ไปเป็น string ตรง ๆ เลย
      dbRequest.input('SelectedDate', selectedDate.trim());
      dateCondition = ` AND CAST([ImportedAt] AS DATE) = CAST(@SelectedDate AS DATE)`;
    }

    // 4. ประกอบ SQL Statement แบบสมบูรณ์
    const baseSql = `
      WITH RankedWIP AS (
          SELECT [Order], [Material],
                 [ProgressPlanning], [StatusSTAR], [OpenQuantity], [ImportedAt],
                 ROW_NUMBER() OVER (
                     PARTITION BY [Order] 
                     ORDER BY [ImportedAt] DESC, (SELECT NULL)
                 ) as RowNum
          FROM [SMTKPIDASHBOARD].[dbo].[WIP_DATA]
          WHERE [OrderType] = 'M001'
          AND (
                 [ProgressPlanning] IN ('FINS6499', 'FINS6697', 'FINS6698', 'FINS6699')
              OR [ProgressPlanning] LIKE 'POSP%'
          )
          ${materialCondition}
          ${dateCondition}
      )
      SELECT [Order], [Material],
             [ProgressPlanning], [StatusSTAR], [OpenQuantity], [ImportedAt]
      FROM RankedWIP
    `;

    // สั่ง execute คิวรีผ่าน dbRequest ที่ผูก parameter ไว้ครบเรียบร้อยแล้ว
    const result = await dbRequest.query(baseSql);
    return NextResponse.json(result.recordset);
  } catch (error: any) {
    console.error('❌ Database error in open-qty API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}