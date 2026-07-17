# Rework Tracker — Project Context

## Overview
ระบบติดตามการส่งงาน rework ในโรงงานผลิตเครื่องประดับ
- **QC** ตรวจสอบของ พบของเสีย → ออกใบ Rework Label → ส่งให้ Rework Station
- **Rework Station** รับงาน ซ่อม ส่งคืน QC
- **QC** ตรวจซ้ำ (re-inspection) → ปิดงาน หรือส่ง rework รอบใหม่

> ⚠️ **สถาปัตยกรรมสำคัญ (อัปเดต 03/07/26):** `production_orders` คือข้อมูลที่ sync มาจาก SQL server กลางของบริษัท (ERP) — แอปนี้เป็นแค่ผู้อ่าน (read-only) สำหรับข้อมูลออเดอร์ ไม่ใช่ผู้สร้าง/แก้ไข field พวก `prog_plan`, `qc_after_p`, `pack_wk`, `line_post` เอง หน้าที่ของ QC ในระบบนี้คือ **ออกใบส่งซ่อมและกรอกเฉพาะข้อมูลที่เกิดจากการตรวจสอบจริง**: จำนวน (qty), defect code + qty ต่อ code, remark, ชื่อ QC, วันที่ ไม่มีการเลือก dropdown ใดๆ ที่เกี่ยวกับตัวออเดอร์เองอีกต่อไป

---

## Tech Stack
| Layer | Tech | Port |
|---|---|---|
| Frontend | Next.js 16 (Turbopack) | 3000 |
| Backend | Node.js + Express | 4000 |
| Database | MySQL | 3306 |

---

## Project Structure
```
Rework Tracker Demo/
└── rework-tracker/
├── app/
│   ├── components/screens/
│   │   ├── HomePage.tsx          ← หน้าแรก navigation + mock role selector
│   │   ├── CreateReworkLabel.tsx ← /inspect — QC ออกใบ + re-inspect
│   │   ├── ReworkStation.tsx     ← /station — รับงาน/ส่งคืน
│   │   └── ReworkDashboard.tsx   ← /dashboard — ดูภาพรวม + re-print
│   ├── lib/
│   │   └── api.ts                ← fetch functions ทั้งหมด
│   └── db.tsx                    ← type Status เท่านั้น (ไม่มีข้อมูล)
└── rework-api/
    ├── index.js                  ← API server
└── migrations/
    ├── seed-defects.js
    └── seed_production_orders.js

Routes:
  /           → HomePage
  /inspect    → CreateReworkLabel
  /station    → ReworkStation
  /dashboard  → ReworkDashboard

---

## Role-based Access (Mock)
role เก็บใน localStorage — เลือกที่ HomePage ก่อนเข้าใช้งาน

| Role | Screens |
|---|---|
| qc | /inspect, /dashboard |
| rw_station | /station |
| admin | /inspect, /station, /dashboard |

---

## Database Schema

### users
```sql
CREATE TABLE users (
  id          INT           NOT NULL AUTO_INCREMENT,
  username    VARCHAR(50)   NOT NULL,
  full_name   VARCHAR(100)  NOT NULL,
  role        ENUM('qc','rw_station','admin') NOT NULL DEFAULT 'qc',
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### production_orders
> ⚠️ **อัปเดต 03/07/26** — เพิ่ม `prog_plan`, `qc_after_p`, `pack_wk` เข้ามาที่ตารางนี้ (ย้ายมาจาก `rework_labels` เดิม) เพราะ field พวกนี้เป็นคุณสมบัติของ **order** ไม่ใช่ของ **รอบ rework** — มาจาก ERP sync (`source = 'erp'`), แอปอ่านอย่างเดียว

```sql
CREATE TABLE production_orders (
  order_id    VARCHAR(20)   NOT NULL,
  material_id VARCHAR(20),
  description VARCHAR(255),
  line_post   VARCHAR(20),
  prog_plan   VARCHAR(20),
  qc_after_p  VARCHAR(20),
  pack_wk     VARCHAR(20),
  total_qty   INT,
  source      ENUM('manual','erp') NOT NULL DEFAULT 'manual',
  synced_at   DATETIME      NULL DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### defect_codes
```sql
CREATE TABLE defect_codes (
  defect_code                 VARCHAR(10)   NOT NULL,
  description_th              VARCHAR(255),
  description_eng             VARCHAR(255),
  defect_cause                VARCHAR(255),
  qa_defect_code              VARCHAR(10),
  qa_defect_code_description  VARCHAR(255),
  is_active                   BOOLEAN       NOT NULL DEFAULT TRUE,
  PRIMARY KEY (defect_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### rework_labels
> ⚠️ **อัปเดต 30/06/26** — เปลี่ยน design จาก FK-only เป็น **เก็บคู่ id + name** สำหรับทุกฟิลด์ "ใครทำอะไร" เหตุผล: หน้างานต้องพิมพ์ label ออกมาเป็น **ชื่อคน** (username) ไม่ใช่เลข user id ที่อ่านไม่รู้เรื่อง แต่ก็ยังเก็บ `_id` คู่กันไว้เผื่อใช้ query/join/permission check ตอนมี login ระบบจริงในอนาคต — `_name` คือ snapshot ของชื่อ ณ ตอนนั้น (กันปัญหาถ้า user เปลี่ยน username ทีหลัง ใบเก่าที่พิมพ์ไปแล้วยังถูกต้อง), `_id` ไว้สำหรับ business logic ที่ผูกกับ users ในอนาคต
>
> ⚠️ **อัปเดต 03/07/26** — ลบ `rw_line`, `prog_plan`, `qc_after_p` ออกจากตารางนี้ทั้งหมด:
> - `rw_line` **ถูกลบทิ้งถาวร** ไม่ได้ย้ายไปไหน — concept ซ้ำซ้อนกับ `production_orders.line_post` ที่มีอยู่แล้ว (คือ line ที่ตีกลับไปให้ฝ่ายผลิต) เลยไม่จำเป็นต้องมี field แยก
> - `prog_plan`, `qc_after_p` ย้ายไปอยู่ที่ `production_orders` แล้ว (ดูด้านบน) เพราะเป็นข้อมูลของ order ไม่ใช่ของรอบ rework

```sql
CREATE TABLE rework_labels (
  label_id          VARCHAR(30)   NOT NULL,
  order_id          VARCHAR(20)   NOT NULL,
  round_no          INT           NOT NULL,
  status            ENUM('ISSUED','IN_PROGRESS','RETURNED','CLOSED') NOT NULL DEFAULT 'ISSUED',
  input_qty         INT,
  result_good_qty   INT           NULL DEFAULT NULL,
  result_bad_qty    INT           NULL DEFAULT NULL,
  is_scrapped       BOOLEAN       NOT NULL DEFAULT FALSE,

  remark            VARCHAR(255),

  -- คนตรวจ (QC)
  qc_id             INT           NULL DEFAULT NULL,
  qc_name           VARCHAR(50)   NULL DEFAULT NULL,

  -- คนกด issue / สร้างใบ
  issued_by_id      INT           NULL DEFAULT NULL,
  issued_by         VARCHAR(50)   NULL DEFAULT NULL,

  -- คนรับงานที่ rework station
  received_by_id    INT           NULL DEFAULT NULL,
  received_by       VARCHAR(50)   NULL DEFAULT NULL,

  -- คนส่งคืนจาก rework station
  returned_by_id    INT           NULL DEFAULT NULL,
  returned_by       VARCHAR(50)   NULL DEFAULT NULL,

  -- คนปิดงาน
  closed_by_id      INT           NULL DEFAULT NULL,
  closed_by         VARCHAR(50)   NULL DEFAULT NULL,

  issued_at         DATETIME      NULL DEFAULT NULL,
  received_at       DATETIME      NULL DEFAULT NULL,
  returned_at       DATETIME      NULL DEFAULT NULL,
  closed_at         DATETIME      NULL DEFAULT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (label_id),
  UNIQUE KEY uq_order_round (order_id, round_no),
  CONSTRAINT fk_rl_order        FOREIGN KEY (order_id)        REFERENCES production_orders(order_id),
  CONSTRAINT fk_rl_qc           FOREIGN KEY (qc_id)           REFERENCES users(id),
  CONSTRAINT fk_rl_issued_by    FOREIGN KEY (issued_by_id)    REFERENCES users(id),
  CONSTRAINT fk_rl_received_by  FOREIGN KEY (received_by_id)  REFERENCES users(id),
  CONSTRAINT fk_rl_returned_by  FOREIGN KEY (returned_by_id)  REFERENCES users(id),
  CONSTRAINT fk_rl_closed_by    FOREIGN KEY (closed_by_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_rl_order_id  ON rework_labels(order_id);
CREATE INDEX idx_rl_status    ON rework_labels(status);
CREATE INDEX idx_rl_issued_at ON rework_labels(issued_at);
```

> ⚠️ **`issued_at` เก็บแค่วันที่ (เวลาเป็น `00:00:00` เสมอ)** — มาจาก `<input type="date">` ในฟอร์ม สนใจแค่ "วันที่ออกใบ" (label ID generate ตามวันด้วย `RW-YYYYMMDD-XX`) ถ้าต้องการ track เวลาแม่นยำระดับนาที (เช่นทำ SLA) ค่อยเปลี่ยนเป็น `datetime-local`

### label_defects
> ⚠️ **อัปเดต 03/07/26** — เพิ่ม `defect_qty` เก็บจำนวนของเสียแยกตาม defect code (ก่อนหน้านี้ frontend เก็บ qty ต่อ code ใน state อยู่แล้วแต่ backend ไม่เคย insert ค่านี้ลง DB เลย ข้อมูลหายไปเงียบๆ ทุกใบที่ผ่านมา)

```sql
CREATE TABLE label_defects (
  label_id      VARCHAR(30)   NOT NULL,
  defect_code   VARCHAR(10)   NOT NULL,
  defect_qty    INT           NOT NULL DEFAULT 1,
  PRIMARY KEY (label_id, defect_code),
  CONSTRAINT fk_ld_label FOREIGN KEY (label_id)    REFERENCES rework_labels(label_id) ON DELETE CASCADE,
  CONSTRAINT fk_ld_code  FOREIGN KEY (defect_code) REFERENCES defect_codes(defect_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> ⚠️ **`production_lines` table ถูกลบแล้ว (03/07/26)** — เดิมมีไว้เป็น FK target ของ `rework_labels.rw_line` ตอนนี้ `rw_line` ถูกลบออกจาก schema ทั้งหมด ไม่มีจุดไหนอ้างถึงตารางนี้อีกแล้ว จึง `DROP TABLE` ทิ้งไปด้วย (ดู `drop_production_lines.sql`)

---

## Business Logic

### Label ID Format
```
RW-YYYYMMDD-XX
RW-20260616-01  ← วันที่ 16/06/26, ลำดับที่ 1 ของวันนั้น
```

### กฎสำคัญ
1. **1 label = 1 round เสมอ** — ห้าม reuse label ข้ามรอบ
2. **ปิด round เดิมก่อนถึงสร้างรอบใหม่ได้** — `result_bad_qty` ของรอบเดิมคือ `input_qty` ของรอบใหม่
3. **`result_good_qty` / `result_bad_qty` เป็น null** จนกว่า status = CLOSED
4. **Status flow:** ISSUED → IN_PROGRESS → RETURNED → CLOSED

### Fields ที่มาจาก `production_orders` (ERP sync — read-only ในแอป)
> ⚠️ **กลับด้านจากเดิมทั้งหมด (อัปเดต 03/07/26)** — ก่อนหน้านี้ context เขียนไว้ผิดว่า QC เป็นคนเลือกฟิลด์พวกนี้เอง จริงๆ แล้วมันมาจาก order/ERP sync ทั้งหมด แอปแค่ดึงมาแสดง ไม่ให้แก้ไข:
- `prog_plan` — จาก `production_orders.prog_plan`
- `qc_after_p` — จาก `production_orders.qc_after_p`
- `pack_wk` — จาก `production_orders.pack_wk`
- `line_post` — จาก `production_orders.line_post` (แทนที่ concept `rw_line` เดิมที่ถูกลบไปแล้ว)

### Fields ที่ QC กรอกเองตอนออกใบ (manual input จริง)
- `input_qty` (total / passed / failed) — จำนวนที่ตรวจ
- defect codes + `defect_qty` ต่อ code — อาการเสียและจำนวน
- `remark` — หมายเหตุ
- `qc_name` — ชื่อ QC ที่ตรวจ
- `issued_at` (วันที่) — วันที่ออกใบ

ไม่มี dropdown ใดๆ ที่เกี่ยวกับตัวออเดอร์ (line, prog plan, qc after p) ให้ QC เลือกเองอีกต่อไป

### Rework Log Calculation
```
good (งานดี)   = total - input_qty of round 1      (first-pass good)
bad  (งานเสีย) = input_qty of round 1              (ส่งเข้า rework ทั้งหมด)
R1..R6         = result_good_qty of each round    (null = ยังไม่ปิดรอบ)
date           = issued_at ของ round 1 (วันที่ออกใบครั้งแรก ไม่ใช่รอบล่าสุด)
packWk, linePost, progPlan, qcAfterP, total = ค่าจาก order/รอบล่าสุด (latest)
```

---

## API Routes (`localhost:4000`)

| Method | Path | Description |
|---|---|---|
| GET | `/labels` | ดึง labels ทั้งหมด (join production_orders + defect_codes/defect_qty) |
| GET | `/labels/queue` | ISSUED + IN_PROGRESS + RETURNED |
| GET | `/labels/:id` | single label |
| POST | `/labels` | สร้าง label ใหม่ (ไม่รับ `progPlan`/`qcAfterP`/`rwLine` อีกต่อไป) |
| PATCH | `/labels/:id` | อัปเดต status/dates/results |
| GET | `/orders/:id` | order info จาก production_orders (รวม prog_plan/qc_after_p/pack_wk) + latest label |
| GET | `/defect-codes` | ดึง defect codes ทั้งหมด (is_active = true) |
| GET | `/users` | ดึง active users (สำหรับ QC Name dropdown) |
| GET | `/labels/next-id?date=YYYY-MM-DD` | generate label ID |

### `GET /labels`, `/labels/queue`, `/labels/:id` — query shape
```sql
SELECT rl.*,
       po.material_id, po.description, po.line_post, po.prog_plan, po.qc_after_p, po.total_qty AS total, po.pack_wk,
       GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes,
       GROUP_CONCAT(CONCAT(ld.defect_code, ':', ld.defect_qty) ORDER BY ld.defect_code SEPARATOR ',') AS defect_details
FROM rework_labels rl
LEFT JOIN production_orders po ON po.order_id = rl.order_id
LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
GROUP BY rl.label_id
```
`defect_codes` → split เป็น `string[]`. `defect_details` → parse เป็น `{code, qty}[]` ผ่าน `parseDefectDetails()` (helper ใน `index.js`)

> ⚠️ **จุดที่เคยพังมาแล้ว — ห้ามสลับ alias:** ต้องเป็น `po.total_qty AS total, po.pack_wk` เท่านั้น ถ้าสลับเป็น `po.total_qty, po.pack_wk AS total` ค่า `total` ในหน้าเว็บจะกลายเป็นค่า pack_wk แทน (ดู "Recent fixes / gotchas" ด้านล่าง)

### `POST /labels` body
รับเฉพาะ: `labelId, orderId, materialId, description, linePost, total, round, status, inputQty, defectCodes ({code, qty}[]), remark, qcName, issuedBy, issuedDate`
ไม่รับ `progPlan`, `qcAfterP`, `rwLine` แล้ว (มาจาก production_orders ERP sync ไม่ใช่ input ตอนสร้าง label)

INSERT เข้า `rework_labels` เฉพาะ column: `label_id, order_id, round_no, status, input_qty, remark, qc_name, issued_by, issued_at`
INSERT เข้า `label_defects` วนลูปทีละ `{code, qty}` → `(label_id, defect_code, defect_qty)` พร้อม `ON DUPLICATE KEY UPDATE defect_qty = VALUES(defect_qty)`

### PATCH `/labels/:id` fields
```json
{
  "status": "IN_PROGRESS",
  "receivedDate": "23/06/26",
  "returnedDate": "23/06/26",
  "closedDate": "23/06/26",
  "resultGoodQty": 19,
  "resultBadQty": 9,
  "isScrapped": false
}
```

---

## `app/lib/api.ts` — Key Functions & Types

### Functions
```ts
fetchAllLabels()                // GET /labels → ApiLabel[]
fetchQueue()                    // GET /labels/queue → ApiLabel[]
fetchLabel(id)                  // GET /labels/:id → ApiLabel
fetchReturnedLabels()           // filter RETURNED from fetchAllLabels
fetchOrderInfoNormalized(id)    // GET /orders/:id → OrderInfo (camelCase)
fetchDefectCodes()              // GET /defect-codes → DefectCode[]
fetchUsers()                    // GET /users → User[]
generateLabelId(qcDate)         // async — นับจาก DB แล้ว return RW-YYYYMMDD-XX
createLabel(data)               // POST /labels — ต้องมี qcName (string) ใน payload
updateLabel(id, updates)        // PATCH /labels/:id
formatDate(date?)               // → DD/MM/YY
formatDateFromISO(isoString)    // DATETIME string → DD/MM/YY
```

### `ApiLabel` (snake_case จาก MySQL)
```ts
type ApiLabel = {
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
  issued_at:        string | null   // เก็บแค่ date (time = 00:00:00)
  received_at:      string | null
  returned_at:      string | null
  closed_at:        string | null
  created_at:       string
  // fields จาก production_orders (JOIN) — ERP sync, read-only
  material_id:      string | null
  description:      string | null
  line_post:        string | null
  prog_plan:        string | null
  qc_after_p:       string | null
  total:            number | null   // aliased จาก po.total_qty
  pack_wk:          string | null
  // user FKs — nullable จนกว่าจะมี login
  issued_by:        number | null
  qc_inspector_id:  number | null
  received_by_id:   number | null
  returned_by_id:   number | null
}
```
> ⚠️ **`rw_line` ไม่มีอีกแล้ว** — ทุกจุดใน frontend ที่เคยอ้าง `label.rw_line` เปลี่ยนเป็น `label.line_post` หมดแล้ว (พร้อม `?? "–"` fallback เพราะ nullable)

### `ApiOrder`
```ts
type ApiOrder = {
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
```

### `OrderInfo` (camelCase — normalized)
```ts
type OrderInfo = {
  materialId:      string
  linePost:        string
  description:     string
  total:           number | null
  packWk:          string | null
  // latest label info (null ถ้ายังไม่เคย rework)
  latestLabelId:   string | null
  latestRoundNo:   number | null
  latestIssuedAt:  string | null
  latestClosedAt:  string | null
  latestProgPlan:  string | null
  latestQcAfterP:  string | null
}
```

### `User`
```ts
type User = {
  id:        number;
  username:  string;
  full_name: string;
  role:      "qc" | "rw_station" | "admin";
}
```

### `DefectCode`
```ts
type DefectCode = {
  defect_code:    string;
  description_th: string;
}
```

---

## Recent fixes / gotchas (session 03/07/26)

จดไว้กันลืม เพราะทั้งสองบั๊กนี้ทำให้ค่าตัวเลขใน UI ผิดแบบเงียบๆ (ไม่ error แต่ค่าโชว์ผิด) หาสาเหตุยากกว่าปกติ:

1. **SQL alias สลับตำแหน่ง → ค่า field ไปโผล่ผิดชื่อ** — เดิม `index.js` เขียน `po.total_qty, po.pack_wk AS total` (ไม่ได้ตั้งใจ) ทำให้ `total` ที่ frontend อ่านได้กลายเป็นค่า `pack_wk` แทนที่จะเป็น `total_qty` จริง ส่งผลให้ Rework Log table โชว์ `good qty` ติดลบ วิธีเช็ค: เทียบ query column-by-column กับชื่อ alias จริงๆ ไม่ใช่เดาจากตำแหน่ง — ต้องเป็น `po.total_qty AS total, po.pack_wk` เท่านั้น
2. **Insert ทั้ง object ลง column ที่ต้องการแค่ string** — เดิม loop `for (const code of codes) { ... [labelId, code] }` แต่ `codes` คือ `{code, qty}[]` ทำให้ `code` ในลูปคือทั้ง object ไม่ใช่ string เพียว ถูก insert ลง `defect_code` VARCHAR ตรงๆ (JS แปลง object เป็น `"[object Object]"` แบบเงียบๆ) แก้โดย destructure ให้ถูก: `for (const { code, qty } of codes)`
3. **Data corruption แยกจากบั๊กโค้ด** — พบว่า `production_orders.total_qty` ในฐานข้อมูลจริงถูกเขียนทับด้วยค่า `pack_wk` (จาก seed script ที่ column/param สลับกัน) ต้องรัน UPDATE แก้ค่าคืนทีละ order (ดู `fix_total_qty.sql`) — นี่เป็นปัญหาที่ข้อมูล ไม่ใช่ query ถึงจะแก้ query (ข้อ 1) แล้วก็ยังต้องแก้ข้อมูลเดิมด้วยเพราะมันเขียนทับไปแล้วจริง
4. **Input number ล้าง/พิมพ์เลขใหม่ไม่ได้** — `Math.max(min, Number(e.target.value))` clamp ทุก keystroke ทำให้ลบเลขเดิมให้ว่างเพื่อพิมพ์เลขใหม่หลายหลักไม่ได้ (มันเด้งกลับ min ทันที) แก้โดยยอมให้ state ว่าง/เป็น 0 ชั่วคราวระหว่างพิมพ์ แล้วค่อย clamp ตอน `onBlur` เท่านั้น

---

## Planned (TODO)
- [ ] Sync 2 databases

- [ ] **`issued_by`, `received_by`, `returned_by`, `closed_by` flow** — ตอนนี้มีแค่ `qc_name` ที่ใช้งานจริง ฟิลด์อื่นเตรียม column ไว้รอ flow/UI ที่เกี่ยวข้อง (เช่นหน้า ReworkStation ต้องมีช่องกรอกชื่อคนรับ/คืนงาน)
- [ ] **`issued_at` เวลาแม่นยำ** — ถ้าต้องการ SLA tracking ในอนาคต เปลี่ยนฟอร์มจาก `<input type="date">` → `<input type="datetime-local">` และแก้ `parseDate()` ให้รับเวลาจริงแทน hardcode `00:00:00` (ไม่ใช่ด่วน เก็บไว้ทำทีหลังได้)
- [ ] Guard check role ในแต่ละ screen (ตอนนี้ mock ที่ HomePage เท่านั้น)
- [ ] Login system จริง — เมื่อมีแล้ว ใช้ `_id` columns (`qc_id`, `issued_by_id` ฯลฯ) ที่เตรียมไว้แล้วผูกกับ session user ได้ทันที
- [ ] Toast notifications แทน console.error

---

## How to Start

```bash
# Terminal 1 — Backend
cd ~/Documents/"Rework Tracker Demo"/rework-tracker/rework-api
node index.js
# ถ้า port ค้าง: lsof -i :4000 → kill <PID>

# Terminal 2 — Frontend
cd ~/Documents/"Rework Tracker Demo"/rework-tracker
npm run dev
```

Browser: `http://localhost:3000`

app/
└── api/
    └── rework/
        ├── defect-codes/
        │   └── route.ts         # เส้นที่ 1: GET /api/rework/defect-codes
        ├── users/
        │   └── route.ts         # เส้นที่ 2-4: GET /api/rework/users (รับ ?role=qc หรือ rw_station ได้ในไฟล์เดียว)
        ├── orders/
        │   ├── route.ts         # เส้นที่ 5: GET /api/rework/orders (Search ออเดอร์)
        │   └── [id]/
        │       └── route.ts     # เส้นที่ 6: GET /api/rework/orders/[id] (ดูยอดรีเวิร์คล่าสุดของออเดอร์นั้น)
        ├── sync/
        │   └── orders/
        │       └── route.ts     # เส้นที่ 7: GET /api/rework/sync/orders (ดึง SQL Server -> ลง MySQL)
        └── labels/
            ├── route.ts         # เส้นที่ 8-9: GET /api/rework/labels และ POST /api/rework/labels (สร้างป้าย)
            ├── queue/
            │   └── route.ts     # เส้นที่ 10: GET /api/rework/labels/queue (คิวงานค้าง)
            └── [id]/
                └── route.ts     # เส้นที่ 11: GET และ PATCH /api/rework/labels/[id] (ดูรายใบ/อัปเดตงาน)