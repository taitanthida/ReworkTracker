import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function GET() {
  try {
    const sql = `
      SELECT rl.*,
             po.material_id, po.description, po.line_post, po.prog_plan, po.qc_after_p, po.total_qty AS total, po.pack_wk,
             GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes,
             GROUP_CONCAT(CONCAT(ld.defect_code, ':', ld.defect_qty) ORDER BY ld.defect_code SEPARATOR ',') AS defect_details
      FROM rework_labels rl
      LEFT JOIN production_orders po ON po.order_id = rl.order_id
      LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
      WHERE rl.status IN ('ISSUED','IN_PROGRESS','RETURNED')
      GROUP BY rl.label_id
      ORDER BY rl.created_at DESC`;

    const [rows]: [any[], any] = await dbPool.execute(sql);

    // แมปฟอร์แมต defect_details ส่งให้หน้าบ้านใช้งาน
    const result = rows.map((row) => {
      const defectCodes = row.defect_codes ? row.defect_codes.split(",") : [];
      const defectDetailsStr = row.defect_details ? row.defect_details.split(",") : [];
      const defectDetails = defectDetailsStr.map((pair: string) => {
        const [code, qty] = pair.split(":");
        return { code, qty: parseInt(qty, 10) || 0 };
      });
      return { ...row, defect_codes: defectCodes, defect_details: defectDetails };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("❌ Error fetching labels queue:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}