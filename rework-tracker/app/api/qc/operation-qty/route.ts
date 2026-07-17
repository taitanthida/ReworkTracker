import { NextResponse, NextRequest } from 'next/server';
import { getSqlServerPool, sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const materials = searchParams.get('materials');
    const selectedDate = searchParams.get('selectedDate');

    // 1. เรียกใช้ Pool
    const pool = await getSqlServerPool();
    const dbRequest = pool.request();

    let materialCondition = "";
    let dateCondition = "";

    // 2. เงื่อนไข Material 
    if (materials && materials.toLowerCase() !== 'all') {
      const materialList = materials.split(',').map(m => m.trim()).filter(m => m !== "");
      if (materialList.length > 0) {
        const paramNames = materialList.map((val, i) => {
          dbRequest.input(`Material${i}`, sql.VarChar, val);
          return `@Material${i}`;
        });
        materialCondition = ` AND [Material] IN (${paramNames.join(',')})`;
      }
    }

    // 3. เงื่อนไขวันที่ 
    if (selectedDate) {
      dbRequest.input('SelectedDate', sql.VarChar, selectedDate);
      
      // เปรียบเทียบข้อมูลด้วย CAST เป็น DATE เพื่อตัดเรื่องเวลาทิ้งไปเลย ทำให้เช็กครอบคลุมทั้งวันได้แม่นยำ
      dateCondition = ` AND CAST([ImportedAt] AS DATE) = CAST(@SelectedDate AS DATE)`;
    }

    // 4. ประกอบ SQL Statement
    const baseSql = `
      WITH RankedWIP AS (
          SELECT [Order], [OrderType], [Material],
                 [ProgressPlanning], [StatusSTAR], [OperationQuantity], [ImportedAt],
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
      SELECT [Order], [OrderType], [Material],
             [ProgressPlanning], [StatusSTAR], [OperationQuantity], [ImportedAt]
      FROM RankedWIP
      WHERE RowNum = 1
    `;

    const result = await dbRequest.query(baseSql);
    return NextResponse.json(result.recordset);
  } catch (error: any) {
    console.error('❌ Database error in operation-qty API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}