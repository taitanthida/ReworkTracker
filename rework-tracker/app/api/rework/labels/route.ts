import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

// ฟังก์ชันช่วยจัดรูปแบบข้อมูลผูกโค้ดแบบ DTO 
function formatLabelRow(row: any) {
  if (!row) return null;
  
  // แปลง String ที่เชื่อมด้วย Comma กลับเป็น Array/Object
  const defectCodes = row.defect_codes ? row.defect_codes.split(",") : [];
  const defectDetailsStr = row.defect_details ? row.defect_details.split(",") : [];
  
  const defectDetails = defectDetailsStr.map((pair: string) => {
    const [code, qty] = pair.split(":");
    return { code, qty: parseInt(qty, 10) || 0 };
  });

  return { ...row, defect_codes: defectCodes, defect_details: defectDetails };
}

// GET: ดึงข้อมูล Labels ทั้งหมด
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
      GROUP BY rl.label_id
      ORDER BY rl.created_at DESC`;

    // ดึงข้อมูลผ่าน Pool ปลอดภัยและเร็วขึ้นมาก
    const [rows]: [any[], any] = await dbPool.execute(sql);

    const result = rows.map(formatLabelRow);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("❌ Error fetching all labels:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: สร้าง Rework Label แบบครอบ Transaction 3 ตาราง
export async function POST(request: Request) {
  // 1. เรียกใช้ pool
  const connection = await dbPool.getConnection();
  
  try {
    await connection.beginTransaction(); // เริ่มต้น Transaction

    const body = await request.json();
    const { 
      labelId, orderId, round, materialId, description, linePost, total, 
      status, inputQty, remark, qcId, qcName, issuedById, issuedBy, issuedDate 
    } = body;

    if (!labelId || !orderId || !round) {
      // release connection คืนให้ pool ก่อนสั่ง return ออกไป
      connection.release();
      return NextResponse.json({ error: "labelId, orderId, round are required" }, { status: 400 });
    }

    // 1. Upsert ข้อมูลลงตาราง production_orders
    const upsertOrderSql = `
      INSERT INTO production_orders (order_id, material_id, description, line_post, total_qty, source)
      VALUES (?, ?, ?, ?, ?, 'manual')
      ON DUPLICATE KEY UPDATE
        material_id = COALESCE(VALUES(material_id), material_id),
        description = COALESCE(VALUES(description), description),
        line_post   = COALESCE(VALUES(line_post),   line_post),
        total_qty   = COALESCE(VALUES(total_qty),   total_qty)`;

    await connection.execute(upsertOrderSql, [orderId, materialId, description, linePost, total]);

    // 2. จัดเลข round แบบ atomic (SELECT ... FOR UPDATE)
    const nextRoundSql = `
      SELECT COALESCE(MAX(round_no), 0) + 1 AS next_round
      FROM rework_labels
      WHERE order_id = ?
      FOR UPDATE`;
    const [roundRows]: [any[], any] = await connection.execute(nextRoundSql, [orderId]);
    const nextRound = roundRows[0]?.next_round || 1;

    // 3. Insert ข้อมูลลงตาราง rework_labels
    const insertLabelSql = `
      INSERT INTO rework_labels (
        label_id, order_id, round_no, status, input_qty, remark, qc_id, qc_name, issued_by_id, issued_by, issued_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await connection.execute(insertLabelSql, [
      labelId, orderId, nextRound, status || "ISSUED", inputQty || 0, remark, qcId, qcName, issuedById, issuedBy, issuedDate || null
    ]);

    // 4. Insert / Update ตารางย่อย label_defects
    if (body.defectCodes && body.defectCodes.length > 0) {
      const insertDefectSql = `
        INSERT INTO label_defects (label_id, defect_code, defect_qty)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE defect_qty = VALUES(defect_qty)`;

      for (const defect of body.defectCodes) {
        await connection.execute(insertDefectSql, [labelId, defect.code, defect.qty !== 0 ? defect.qty : 1]);
      }
    }

    await connection.commit(); // ยืนยัน Transaction ทั้งหมดสำเร็จ
    connection.release(); // คืน Connection คืนกลับเข้า Pool

    return NextResponse.json({ success: true, labelId, round: nextRound });

  } catch (error: any) {
    console.error("❌ Transaction failed, rolling back:", error);
    try {
      await connection.rollback(); // ทำการยกเลิกคำสั่งทั้งหมดถ้าเกิดข้อผิดพลาด
    } catch (rollbackError) {
      console.error("❌ Rollback failed:", rollbackError);
    }
    connection.release(); // คืน Connection คืนกลับเข้า Pool 
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}