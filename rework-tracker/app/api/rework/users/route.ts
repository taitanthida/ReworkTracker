import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role"); // รับ ?role=qc หรือ ?role=rw_station

    let sql = "SELECT id, username, full_name, role FROM users WHERE is_active = 1 AND role != 'admin'";
    const params: any[] = [];

    if (role) {
      sql += " AND role = ?";
      params.push(role);
    }

    const [rows] = await dbPool.execute(sql, params);

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("❌ Error fetching users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}