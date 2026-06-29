// ── db.tsx ────────────────────────────────────────────────────────────────────
// Type definitions only — ข้อมูลทั้งหมดอยู่ใน MySQL
// Frontend ดึงข้อมูลผ่าน app/lib/api.ts

export type Status = "ISSUED" | "IN_PROGRESS" | "RETURNED" | "CLOSED";
