import { NextResponse, NextRequest } from "next/server";
import { dbPool } from "@/lib/db"; 
export async function PATCH(
  request: Request, 
  { params }: { params: Promise<{ id: string }> } // ปรับ Type ของ params ให้รองรับ Next.js 15+
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Mapping คีย์ตัวแปรที่รับมาให้ตรงกับคอลัมน์ในตาราง MySQL
    const allowedFields: Record<string, string> = {
      status: "status",
      receivedDate: "received_at",
      returnedDate: "returned_at",
      closedDate: "closed_at",
      resultGoodQty: "result_good_qty",
      resultBadQty: "result_bad_qty",
      isScrapped: "is_scrapped",
      remark: "remark",
      qcId: "qc_id",
      qcName: "qc_name",
      issuedById: "issued_by_id",
      issuedBy: "issued_by",
      receivedById: "received_by_id",
      receivedBy: "received_by",
      returnedById: "returned_by_id",
      returnedBy: "returned_by",
      closedById: "closed_by_id",
      closedBy: "closed_by"
    };

    const fields: string[] = [];
    const values: any[] = [];

    // วนลูปเช็คฟิลด์ที่ส่งเข้ามาเพื่อสร้าง Dynamic Update Command 
    for (const [incomingKey, dbColumn] of Object.entries(allowedFields)) {
      if (body[incomingKey] !== undefined && body[incomingKey] !== null) {
        fields.push(`${dbColumn} = ?`);
        
        // จัดการกรณีพิเศษ บูลีน หรือ วันที่
        if (incomingKey === "isScrapped") {
          values.push(body[incomingKey] ? 1 : 0);
        } else {
          values.push(body[incomingKey]);
        }
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const sql = `UPDATE rework_labels SET ${fields.join(", ")} WHERE label_id = ?`;
    values.push(id); // แปะ ID ต่อท้ายสุด

    // รันคิวรีผ่าน Connection Pool
    const [result]: any = await dbPool.execute(sql, values);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Label not found" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Error updating label:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  request: Request, 
  { params }: { params: Promise<{ id: string }> } // ปรับ Type ของ params ให้รองรับ Next.js 15+
) {
  try {
    const { id } = await params;

    // SQL ดึงครบทุกอย่างทั้งข้อมูลออเดอร์ และรวมข้อมูล defect จาก 3 ตาราง
    const sql = `
      SELECT rl.*,
             po.material_id, po.description, po.line_post, po.prog_plan, po.qc_after_p, po.total_qty AS total, po.pack_wk,
             GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes,
             GROUP_CONCAT(CONCAT(ld.defect_code, ':', ld.defect_qty) ORDER BY ld.defect_code SEPARATOR ',') AS defect_details
      FROM rework_labels rl
      LEFT JOIN production_orders po ON po.order_id = rl.order_id
      LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
      WHERE rl.label_id = ?
      GROUP BY rl.label_id
    `;

    const [rows]: any = await dbPool.execute(sql, [id]);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const row = rows[0];

    // ── แปลงข้อมูล String เป็น Array/Object ส่งให้ InfoCard หน้าบ้านใช้งานได้เลย ──
    const defect_codes = row.defect_codes ? row.defect_codes.split(",") : [];
    const defect_details = row.defect_details 
      ? row.defect_details.split(",").map((pair: string) => {
          const [code, qty] = pair.split(":");
          return { code, qty: parseInt(qty) || 0 };
        })
      : [];

    const formattedData = {
      ...row,
      defect_codes,
      defect_details
    };

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("❌ Error fetching label details:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}