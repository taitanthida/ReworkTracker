import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db"; 

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // ปรับ Type ของ params ให้รองรับ Next.js 15+
) {
  try {
    const { id } = await params; // ดึง Order ID จาก Dynamic Route URL

    // 1. คิวรีหาข้อมูลออเดอร์ชิ้นนี้ผ่าน Pool
    const orderSql = "SELECT * FROM production_orders WHERE order_id = ?";
    const [orderRows]: [any[], any] = await dbPool.execute(orderSql, [id]);
    const order = orderRows[0] || null;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 2. คิวรีหา Rework Label ล่าสุดของออเดอร์นี้ เพื่อดูรอบ (round_no)
    const labelSql = "SELECT * FROM rework_labels WHERE order_id = ? ORDER BY round_no DESC LIMIT 1";
    const [labelRows]: [any[], any] = await dbPool.execute(labelSql, [id]);
    const latestLabel = labelRows[0] || null;

    // ส่งกลับไปเป็น Object คู่
    return NextResponse.json({ order, latestLabel });
  } catch (error: any) {
    console.error("❌ Error fetching order details:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}