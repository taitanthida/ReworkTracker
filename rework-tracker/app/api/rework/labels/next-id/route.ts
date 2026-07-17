import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db"; 

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl; // ใช้ NextRequest แกะ URL
    const date = searchParams.get("date"); // รับค่า ?date=YYYY-MM-DD

    if (!date) {
      return NextResponse.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
    }

    const compactDate = date.replace(/-/g, ""); // ลบขีดออก เช่น 2026-07-17 -> 20260717
    const todayPrefix = `RW-${compactDate}-%`;

    // เปลี่ยนมาหา ID ตัวล่าสุดที่มีเลขรันนิ่งมากที่สุดของวันนี้
    const sql = `
      SELECT label_id FROM rework_labels 
      WHERE label_id LIKE ? 
      ORDER BY label_id DESC 
      LIMIT 1
    `;
    
    const [rows]: [any[], any] = await dbPool.execute(sql, [todayPrefix]);

    let nextNumber = 1;
    if (rows.length > 0) {
      const lastLabelId = rows[0].label_id; // เช่น "RW-20260717-01"
      const parts = lastLabelId.split("-");
      const lastSeq = parseInt(parts[2], 10); // ดึงเลข "01" ออกมาแปลงเป็นตัวเลข 1
      if (!isNaN(lastSeq)) {
        nextNumber = lastSeq + 1; // บวกเพิ่มเป็น 2
      }
    }

    const seq = String(nextNumber).padStart(2, "0"); // แปลงกลับเป็น "02"

    return NextResponse.json({ labelId: `RW-${compactDate}-${seq}` });
  } catch (error: any) {
    console.error("❌ Error generating next label ID:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}