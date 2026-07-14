// Final QC Monitoring — เรียก Next.js API routes ภายใน (/api/qc/*)
// เดิมยิงไป C# qc-api (http://localhost:4001) ตอนนี้พอร์ตเป็น route ภายในแล้ว

export type WipRow = {
  Order:            string
  OrderType:        string
  Material:         string
  ProgressPlanning: string
  StatusSTAR:       string
  OpenQuantity:     number
}

// โหลดรายชื่อ Material ทั้งหมด
export async function getMasterMaterials(): Promise<string[]> {
  const res = await fetch(`/api/qc/materials`)
  if (!res.ok) throw new Error("Failed to load master materials")
  return res.json()
}

// โหลดข้อมูลตาราง ตาม material ที่เลือก
export async function getOpenQty(materialQuery: string): Promise<WipRow[]> {
  const res = await fetch(`/api/qc/open-qty?materials=${encodeURIComponent(materialQuery)}`)
  if (!res.ok) throw new Error("Failed to load open quantity data")
  return res.json()
}
