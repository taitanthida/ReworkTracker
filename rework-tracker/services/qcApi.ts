// 1. โหลดรายชื่อ Material ทั้งหมด
export async function getMasterMaterials() {
  const res = await fetch('/api/qc/materials', { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load master materials");
  return res.json();
}

// โหลดข้อมูลตาราง ตาม material ที่เลือก
export async function getOpenQty(materialQuery: string, selectedDate?: string) {
  let url = `/api/qc/open-qty?materials=${encodeURIComponent(materialQuery)}`;
  
  if (selectedDate) {
    url += `&selectedDate=${selectedDate}`;
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error("Failed to load operation quantity data");
  return res.json();
}