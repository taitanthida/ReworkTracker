import { NextResponse } from 'next/server';
import { getSqlServerPool } from '@/lib/db'; 

export async function GET() {
  try {
    // 1. เรียกใช้ Pool 
    const pool = await getSqlServerPool();
    
    // 2. ยิง Query ผ่าน Pool ได้ทันที
    const result = await pool.request().query(`
      SELECT DISTINCT [Material] 
      FROM [SMTKPIDASHBOARD].[dbo].[WIP_DATA]
      WHERE [OrderType] = 'M001' AND [Material] IS NOT NULL
    `);

    const materials = result.recordset.map(row => row.Material);
    return NextResponse.json(materials);
  } catch (error: any) {
    console.error('Database error in /api/qc/materials:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}