const API = "/api/rework";

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
  qc_id:            number | null
  qc_name:          string | null
  defect_codes:     string[]
  defect_details:   { code: string; qty: number }[]
  remark:           string | null
  material_id:      string | null
  description:      string | null
  line_post:        string | null
  prog_plan:        string | null
  qc_after_p:       string | null
  total:            number | null
  pack_wk:          string | null
  issued_by_id:     number | null
  issued_by:        string | null
  received_by_id:   number | null
  received_by?:     string | null
  returned_by_id:   number | null
  returned_by?:     string | null
  issued_at:        string | null
  received_at:      string | null
  returned_at:      string | null
  closed_at:        string | null
  created_at:       string
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
  latestLabelId:   string | null
  latestRoundNo:   number | null
  latestIssuedAt:  string | null
  latestClosedAt:  string | null
  latestProgPlan:  string | null 
  latestQcAfterP:  string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatDate(dateInput?: string | Date | null): string {
  // 1. ถ้าเรียก formatDate() เปล่าๆ คืนค่า YYYY-MM-DD ไปเซฟหลังบ้าน
  if (!dateInput) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  if (dateInput === "-") return "–";

  let day = "";
  let month = "";
  let year = "";

  // 2. ดึงจาก DB มาโชว์หน้า UI จัดระเบียบเป็น DD/MM/YY
  if (typeof dateInput === "string") {
    if (dateInput.includes("-") && dateInput.length >= 10) {
      const parts = dateInput.split(" ")[0].split("T")[0].split("-");
      if (parts.length === 3 && parts[0].length === 4) {
        year = parts[0].slice(-2);  // กลับมาเอา 2 หลักท้ายเหมือนเดิม (เช่น "26")
        month = parts[1];
        day = parts[2];
        return `${day}/${month}/${year}`;
      }
    }
    
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "–";
    day = String(d.getDate()).padStart(2, "0");
    month = String(d.getMonth() + 1).padStart(2, "0");
    year = String(d.getFullYear()).slice(-2);
  } else {
    const d = dateInput;
    if (isNaN(d.getTime())) return "–";
    day = String(d.getDate()).padStart(2, "0");
    month = String(d.getMonth() + 1).padStart(2, "0");
    year = String(d.getFullYear()).slice(-2);
  }

  return `${day}/${month}/${year}`;
}

export function formatDateFromISO(isoStr: string | null): string {
  if (!isoStr || isoStr === "-") return "–";
  return formatDate(isoStr);
}

// ── Fetch functions ──────────────────

export async function fetchQcUsers(): Promise<User[]> {
  const res = await fetch(`${API}/users?role=qc`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load QC users");
  return res.json();
}

export async function fetchReworkUsers(): Promise<User[]> {
  const res = await fetch(`${API}/users?role=rw_station`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load Rework users");
  return res.json();
}

export async function fetchAllUsers(): Promise<User[]> {
  const res = await fetch(`${API}/users`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load all users");
  return res.json();
}

export async function fetchAllLabels(): Promise<ApiLabel[]> {
  const res = await fetch(`${API}/labels`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load all labels");
  return res.json();
}

export async function fetchQueue(): Promise<ApiLabel[]> {
  const res = await fetch(`${API}/labels/queue`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load queue");
  return res.json();
}

export async function fetchLabel(labelId: string): Promise<ApiLabel> {
  const res = await fetch(`${API}/labels/${labelId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load label");
  return res.json();
}

export async function fetchReturnedLabels(): Promise<ApiLabel[]> {
  const all = await fetchAllLabels();
  return all.filter((l) => l.status === "RETURNED");
}

export async function fetchOrderInfoNormalized(orderId: string): Promise<OrderInfo | null> {
  try {
    const res = await fetch(`${API}/orders/${orderId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    
    const { order, latestLabel }: { order: ApiOrder; latestLabel: ApiLabel | null } = await res.json();
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
    };
  } catch {
    return null;
  }
}

export async function fetchDefectCodes(): Promise<DefectCode[]> {
  const res = await fetch(`${API}/defect-codes`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load defect codes");
  return res.json();
}

// ── Mutation functions ────────────────────────────────────────────────────

export async function createLabel(data: any) {
  const res = await fetch(`${API}/labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create label");
  return res.json();
}

export async function updateLabel(labelId: string, updates: any) {
  const res = await fetch(`${API}/labels/${labelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update label");
  return res.json();
}

export async function generateLabelId(qcDateInput: string): Promise<string> {
  const res = await fetch(`${API}/labels/next-id?date=${qcDateInput}`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to generate label ID");
  const { labelId } = await res.json();
  return labelId;
}