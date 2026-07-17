import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function GET() {
  try {
    const sql = "SELECT defect_code, description_th FROM defect_codes WHERE is_active = 1 ORDER BY defect_code ASC";
    
    const [rows] = await dbPool.execute(sql);

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("❌ Error fetching defect codes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}