# Rework Tracker — Project Context

## Overview
ระบบติดตามการส่งงาน rework ในโรงงานผลิตเครื่องประดับ
- **QC** ตรวจสอบของ พบของเสีย → ออกใบ Rework Label → ส่งให้ Rework Station
- **Rework Station** รับงาน ซ่อม ส่งคืน QC
- **QC** ตรวจซ้ำ (re-inspection) → ปิดงาน หรือส่ง rework รอบใหม่

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
│   │   └── ReworkDashboard.tsx   ← /dashboard — ดูภาพรวม
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
```sql
CREATE TABLE production_orders (
  order_id    VARCHAR(20)   NOT NULL,
  material_id VARCHAR(20),
  description VARCHAR(255),
  line_post   VARCHAR(20),
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
```sql
CREATE TABLE rework_labels (
  label_id          VARCHAR(30)   NOT NULL,
  order_id          VARCHAR(20)   NOT NULL,
  round_no          INT           NOT NULL,
  rw_line           VARCHAR(20)   NOT NULL,
  prog_plan         VARCHAR(20)   NULL,
  qc_after_p        VARCHAR(20)   NULL,
  status            ENUM('ISSUED','IN_PROGRESS','RETURNED','CLOSED') NOT NULL DEFAULT 'ISSUED',
  input_qty         INT,
  result_good_qty   INT           NULL DEFAULT NULL,
  result_bad_qty    INT           NULL DEFAULT NULL,
  is_scrapped       BOOLEAN       NOT NULL DEFAULT FALSE,
  issued_by         INT           NULL DEFAULT NULL,
  qc_inspector_id   INT           NULL DEFAULT NULL,
  received_by_id    INT           NULL DEFAULT NULL,
  returned_by_id    INT           NULL DEFAULT NULL,
  remark            VARCHAR(255),
  issued_at         DATETIME      NULL DEFAULT NULL,
  received_at       DATETIME      NULL DEFAULT NULL,
  returned_at       DATETIME      NULL DEFAULT NULL,
  closed_at         DATETIME      NULL DEFAULT NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (label_id),
  UNIQUE KEY uq_order_round (order_id, round_no),
  CONSTRAINT fk_rl_order        FOREIGN KEY (order_id)        REFERENCES production_orders(order_id),
  CONSTRAINT fk_rl_issued_by    FOREIGN KEY (issued_by)       REFERENCES users(id),
  CONSTRAINT fk_rl_qc_inspector FOREIGN KEY (qc_inspector_id) REFERENCES users(id),
  CONSTRAINT fk_rl_received_by  FOREIGN KEY (received_by_id)  REFERENCES users(id),
  CONSTRAINT fk_rl_returned_by  FOREIGN KEY (returned_by_id)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_rl_order_id  ON rework_labels(order_id);
CREATE INDEX idx_rl_status    ON rework_labels(status);
CREATE INDEX idx_rl_issued_at ON rework_labels(issued_at);
```

### label_defects
```sql
CREATE TABLE label_defects (
  label_id      VARCHAR(30)   NOT NULL,
  defect_code   VARCHAR(10)   NOT NULL,
  PRIMARY KEY (label_id, defect_code),
  CONSTRAINT fk_ld_label FOREIGN KEY (label_id)    REFERENCES rework_labels(label_id) ON DELETE CASCADE,
  CONSTRAINT fk_ld_code  FOREIGN KEY (defect_code) REFERENCES defect_codes(defect_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

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

### Fields ที่ QC เลือกเองตอนออกใบ (ไม่ได้มาจาก production_orders)
- `prog_plan` — hardcode options: `[]`
- `qc_after_p` — hardcode options (ยังไม่ได้ extract จาก production system)
- `rw_line` — hardcode options: `[]`

### Rework Log Calculation
```
good (งานดี)   = total - input_qty ของ round 1  (first-pass good)
bad  (งานเสีย) = input_qty ของ round 1           (ส่งเข้า rework ทั้งหมด)
R1..R6         = result_good_qty ของแต่ละรอบ    (null = ยังไม่ปิดรอบ)
```

---

## API Routes (`localhost:4000`)

| Method | Path | Description |
|---|---|---|
| GET | `/labels` | ดึง labels ทั้งหมด |
| GET | `/labels/queue` | ISSUED + IN_PROGRESS + RETURNED |
| GET | `/labels/:id` | single label |
| POST | `/labels` | สร้าง label ใหม่ |
| PATCH | `/labels/:id` | อัปเดต status/dates/results |
| GET | `/orders/:id` | order info จาก production_orders + latest label |
| GET | `/defect-codes` | ดึง defect codes ทั้งหมด (is_active = true) |
| GET | `/users` | ดึง active users (สำหรับ QC Name dropdown) |
| GET | `/labels/next-id?date=YYYY-MM-DD` | generate label ID |

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
createLabel(data)               // POST /labels
updateLabel(id, updates)        // PATCH /labels/:id
formatDate(date?)               // → DD/MM/YY
formatDateFromISO(isoString)    // DATETIME string → DD/MM/YY
```

### `ApiLabel` (snake_case จาก MySQL)
```ts
type ApiLabel = {
  label_id:         string;
  order_id:         string;
  round_no:         number;
  rw_line:          string;
  prog_plan:        string | null;   // QC เลือก
  qc_after_p:       string | null;   // QC เลือก
  status:           "ISSUED" | "IN_PROGRESS" | "RETURNED" | "CLOSED";
  input_qty:        number;
  result_good_qty:  number | null;
  result_bad_qty:   number | null;
  is_scrapped:      number;
  qc_name:          string | null;
  defect_codes:     string[];
  remark:           string | null;
  issued_at:        string | null;
  received_at:      string | null;
  returned_at:      string | null;
  closed_at:        string | null;
  created_at:       string;
  // JOIN จาก production_orders
  material_id:      string | null;
  description:      string | null;
  line_post:        string | null;
  total:            number | null;
  // user FKs
  issued_by:        number | null;
  qc_inspector_id:  number | null;
  received_by_id:   number | null;
  returned_by_id:   number | null;
}
```

### `OrderInfo` (camelCase — normalized)
```ts
type OrderInfo = {
  materialId:      string;
  linePost:        string;
  description:     string;
  total:           number | null;
  latestLabelId:   string | null;
  latestRoundNo:   number | null;
  latestIssuedAt:  string | null;
  latestClosedAt:  string | null;
  latestProgPlan:  string | null;
  latestQcAfterP:  string | null;
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

## Planned (ยังไม่ได้ทำ)
- [ ] Guard check role ในแต่ละ screen (ตอนนี้ mock ที่ HomePage เท่านั้น)
- [ ] Login system จริง
- [ ] `qc_after_p` options — extract จาก production system
- [ ] `rw_line` options — extract จาก production system
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