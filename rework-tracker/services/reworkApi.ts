const API = "http://localhost:5007/api"

// ── Types ─────────────────────────────────────────────────────────────────────

export type User = {
  id:         number;
  username:   string;
  full_name:  string;
  role:       "qc" | "rw_station" | "admin"
}

export type ApiLabel = {
  label_id:         string
  order_id:         string
  round_no:         number
  status:           "ISSUED" | "IN_PROGRESS" | "RETURNED" | "CLOSED"
  input_qty:        number
  result_good_qty:  number | null
  result_bad_qty:   number | null
  is_scrapped:      number
  qc_name:          string | null
  defect_codes:     string[]
  defect_details:   { code: string; qty: number }[]
  remark:           string | null
  issued_at:        string | null
  received_at:      string | null
  returned_at:      string | null
  closed_at:        string | null
  created_at:       string
  // fields จาก production_orders (JOIN หรือ upsert ตอน create)
  material_id:      string | null
  description:      string | null
  line_post:        string | null
  prog_plan:        string | null
  qc_after_p:       string | null
  total:            number | null
  pack_wk:          string | null
  // user FKs — nullable จนกว่าจะมี login
  issued_by:        number | null
  qc_inspector_id:  number | null
  received_by_id:   number | null
  returned_by_id:   number | null
}

export type ApiOrder = {
  order_id:    string
  material_id: string | null
  description: string | null
  line_post:   string | null
  prog_plan:   string | null
  qc_after_p:  string | null
  total_qty:   number | null
  pack_wk:     string | null
  source:      "manual" | "erp"
  synced_at:   string | null
  created_at:  string
}


export type DefectCode = {
  defect_code:    string
  description_th: string
}
export type OrderInfo = {
  materialId:   string
  linePost:     string
  description:  string
  total:        number | null
  packWk:       string | null
  // latest label info (null ถ้ายังไม่เคย rework)
  latestLabelId:   string | null
  latestRoundNo:   number | null
  latestIssuedAt:  string | null
  latestClosedAt:  string | null
  latestProgPlan:  string | null 
  latestQcAfterP:  string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** format วันที่เป็น DD/MM/YY */
export function formatDate(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yy = String(date.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

/** แปลง DATETIME string จาก MySQL → DD/MM/YY สำหรับ display */
export function formatDateFromISO(isoStr: string | null): string {
  if (!isoStr) return ""
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ""
  return formatDate(d)
}

// ── Fetch functions ───────────────────────────────────────────────────────────

/** ดึง user เฉพาะ role "qc" (สำหรับ dropdown QC Name) */
export async function fetchQcUsers(): Promise<User[]> {
  const res = await fetch(`${API}/users/qc`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** ดึง user เฉพาะ role "rw_station" (สำหรับ dropdown RW Station) */
export async function fetchReworkUsers(): Promise<User[]> {
  const res = await fetch(`${API}/users/rework`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** ดึง user ทุก role ที่ active (สำหรับ resolve ชื่อจาก *_by_id) */
export async function fetchAllUsers(): Promise<User[]> {
  const res = await fetch(`${API}/users`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** ดึง labels ทั้งหมด */
export async function fetchAllLabels(): Promise<ApiLabel[]> {
  const res = await fetch(`${API}/labels`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** ดึงเฉพาะ ISSUED + IN_PROGRESS + RETURNED (active queue) */
export async function fetchQueue(): Promise<ApiLabel[]> {
  const res = await fetch(`${API}/labels/queue`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** ดึง label เดียวจาก labelId */
export async function fetchLabel(labelId: string): Promise<ApiLabel> {
  const res = await fetch(`${API}/labels/${labelId}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** ดึง returned labels (สำหรับ CreateReworkLabel re-inspect) */
export async function fetchReturnedLabels(): Promise<ApiLabel[]> {
  const all = await fetchAllLabels()
  return all.filter(l => l.status === "RETURNED")
}

/** ดึง order info แล้ว normalize เป็น OrderInfo */
export async function fetchOrderInfoNormalized(orderId: string): Promise<OrderInfo | null> {
  try {
    const res = await fetch(`${API}/orders/${orderId}`)
    if (!res.ok) return null
    const { order, latestLabel }: { order: ApiOrder; latestLabel: ApiLabel | null } = await res.json()
    return {
      materialId:      order.material_id   ?? "",
      description:     order.description   ?? "",
      total:           order.total_qty,
      linePost:        order.line_post     ?? "",
      latestProgPlan:  order.prog_plan  ?? null,
      latestQcAfterP:  order.qc_after_p ?? null,
      packWk:          order.pack_wk    ?? null,
      latestLabelId:   latestLabel?.label_id   ?? null,
      latestRoundNo:   latestLabel?.round_no   ?? null,
      latestIssuedAt:  latestLabel?.issued_at  ?? null,
      latestClosedAt:  latestLabel?.closed_at  ?? null,
    }
  } catch { return null }
}


/** ดึง defect codes ทั้งหมดที่ active */
export async function fetchDefectCodes(): Promise<DefectCode[]> {
  const res = await fetch(`${API}/defect-codes`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Mutation functions ────────────────────────────────────────────────────────

/** สร้าง label ใหม่ */
export async function createLabel(data: {
  labelId:      string
  orderId:      string
  materialId:   string
  description:  string
  linePost:     string
  total:        number | null
  round:        number
  status?:      string
  inputQty:     number
  defectCodes: { code: string; qty: number }[]
  remark:       string
  qcId?:        number   // ผู้ตรวจ (QC) — ใช้เป็น issued_by_id ด้วย
  qcName:       string
  issuedById?:  number   // = qcId (คนตรวจ = คนออกใบ)
  issuedBy?:    string   // = qcName
  issuedDate:   string   // DD/MM/YY — API แปลงให้เอง
}) {
  const res = await fetch(`${API}/labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** อัปเดต label */
export async function updateLabel(labelId: string, updates: {
  status?:        string
  receivedDate?:  string   // DD/MM/YY
  returnedDate?:  string   // DD/MM/YY
  closedDate?:    string   // DD/MM/YY
  resultGoodQty?: number | null
  resultBadQty?:  number | null
  isScrapped?:    boolean
  remark?:        string
  // users — ใส่ได้เมื่อมี login
  qcInspectorId?: number
  receivedById?:  number
  receivedBy?:    string   // username เก็บลงคอลัมน์ received_by
  returnedById?:  number
  closedById?:    number   // = qcId (คนตรวจ = คนปิดงาน)
  closedBy?:      string   // = qcName
}) {
  const res = await fetch(`${API}/labels/${labelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/**
 * สร้าง labelId ใหม่ — นับจาก DB ฝั่ง server เพื่อป้องกัน race condition
 * @param qcDateInput — format YYYY-MM-DD (จาก <input type="date">)
 */
export async function generateLabelId(qcDateInput: string): Promise<string> {
  const res = await fetch(`${API}/labels/next-id?date=${qcDateInput}`)
  if (!res.ok) throw new Error(await res.text())
  const { labelId } = await res.json()
  return labelId
}