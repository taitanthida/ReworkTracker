# Rework Tracker — Project Context

## Overview
ระบบติดตามการส่งงาน Rework ในโรงงานผลิตเครื่องประดับ โดยมีการเชื่อมโยงข้อมูลจากระบบ ERP หลักของบริษัท

QC: ตรวจสอบพบของเสีย → ออกใบ Rework Label (RW-YYYYMMDD-XX) → ส่งให้ Rework Station

Rework Station: รับงาน ซ่อมแซมเรียบร้อย → ส่งคืนให้ QC

QC (Re-inspection): ตรวจสอบซ้ำ → เลือกปิดงาน (CLOSED) หรือส่ง Rework รอบใหม่ (Round +1)

⚠️ สถาปัตยกรรมสำคัญเรื่องข้อมูลออเดอร์: ตาราง production_orders เป็นข้อมูลที่ถูกดูด (Sync) มาจาก SQL Server กลางของบริษัท แอปพลิเคชันนี้ทำหน้าที่อ่านอย่างเดียว (Read-Only) สำหรับข้อมูลออเดอร์หลัก เพื่อป้องกันความซ้ำซ้อนและลดภาระฐานข้อมูล ข้อมูลจะถูกดึงมาเฉพาะคอลลัมน์ที่จำเป็นต่อการเชื่อมโยงระบบ Rework เท่านั้น

Tech Stack & Architecture Change
ปรับปรุงสถาปัตยกรรมใหม่ โดยยกเลิก Express Backend แยกส่วน (Port 4000) และรวมศูนย์การประมวลผลทั้งหมดให้อยู่บน Next.js API Routes ภายในโปรเจกต์เดียวกันเพื่อความง่ายในการดูแลรักษาและการจัดการ Connection Pool
| Layer | Tech | Port |
|---|---|---|
| Frontend | Next.js 16 (Turbopack) | http://localhost:3000 |
| Backend | Next.js API Routes (App Router) | http://localhost:3000/api/... |
| Database 1 (Internal) | MySQL | 3306 |
| Database 2 (Corporate) | SQL Serever | รันบน Server ส่วนกลาง |

---

## Project Structure
```
app/
├── api/
│   ├── qc/
│   │   ├── materials/
│   │   │   └── route.ts         # GET /api/qc/materials (ดึงรายการ Material จาก SQL Server)
│   │   └── operation-qty/
│   │       └── route.ts         # GET /api/qc/operation-qty (ดูยอด WIP รายวัน/แยกตาม Material จาก SQL Server)
│   └── rework/
│       ├── defect-codes/
│       │   └── route.ts         # GET /api/rework/defect-codes (ดึงรหัสอาการเสีย)
│       ├── users/
│       │   └── route.ts         # GET /api/rework/users (รายชื่อพนักงาน)
│       ├── orders/
│       │   ├── route.ts         # GET /api/rework/orders (ค้นหาออเดอร์)
│       │   └── [id]/
│       │       └── route.ts     # GET /api/rework/orders/[id] (ประวัติของออเดอร์นั้น)
│       ├── sync/
│       │   └── orders/
│       │       └── route.ts     # GET /api/rework/sync/orders (ดึง SQL Server -> ลง MySQL เพื่อทำ Rework)
│       └── labels/
│           ├── route.ts         # GET /api/rework/labels (รายการป้าย) และ POST (สร้างป้ายใหม่)
│           ├── queue/
│           │   └── route.ts     # GET /api/rework/labels/queue (คิวงานค้าง)
│           └── [id]/
│               └── route.ts     # GET และ PATCH /api/rework/labels/[id] (จัดการสถานะงาน)
├── components/screens/
│   ├── CreateReworkLabel.tsx    # หน้าออกใบงาน Rework ใหม่
│   ├── FinalQcMonitoring.tsx    # หน้าจอ Monitor ยอด Final QC แยกตามเงื่อนไข
│   ├── HomePage.tsx             # หน้าแรกสำหรับเลือก Role เข้าใช้งาน
│   ├── ProjectMenu.tsx          # เมนูหลักสลับพาร์ททำงาน
│   ├── QcTable.jsx              # ตารางแสดงรายการข้อมูล QC
│   ├── ReworkDashboard.tsx      # แดชบอร์ดสรุปสถิติตัวเลขงานเสีย
│   └── ReworkStation.tsx        # หน้าจอรับงาน/คืนงานสำหรับช็อปซ่อม
```

---

## Role-based Access (Rework Mock)
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


---

## Business Logic

การจัดการ Connection Pool ของ SQL Server บน Next.js:

การผูก parameter โดยใช้ node-mssql ร่วมกับ Next.js ยุคใหม่ ห้ามระบุ Data Type ตรง ๆ เช่น sql.VarChar เนื่องจากสถาปัตยกรรมของตัว Bundler จะทำให้เกิดข้อผิดพลาด parameter.type.validate is not a function

แนวทางแก้ไขที่ถูกต้อง: ให้ใช้ dbRequest.input('ParamName', value) ส่งค่าตัวแปรประเภทสตริงเข้าไปตรง ๆ เพื่อให้ไดรเวอร์จัดการเดาประเภทข้อมูลประเภทสตริงเองโดยอัตโนมัติ

ระบบการดึงข้อมูลเพื่อ Sync ข้อมูลประจำวัน:

คำสั่งคิวรีเพื่อ Sync ข้อมูลต้องรองรับงานในวันปัจจุบัน โดยเปิดการตรวจสอบสถานะฝั่ง SQL Server ให้ครอบคลุมทั้งกลุ่มที่เสร็จสิ้นแล้ว และกลุ่มที่กำลังวางแผนทำงานอยู่บนไลน์ผลิต เช่น [ProgressPlanning] IN ('FINS6499', 'FINS6697', 'FINS6698', 'FINS6699') OR [ProgressPlanning] LIKE 'POSP%' เพื่อไม่ให้ข้อมูลวันปัจจุบันตกหล่น

กฎเหล็กของ Rework Flow:

1 Label = 1 Round เสมอ ห้ามนำเลขป้ายเก่ามาเวียนเทียนใช้ใหม่

จะสร้าง Rework รอบใหม่ (Round + 1) ได้ก็ต่อเมื่อกดปิดงาน (CLOSED) ของรอบก่อนหน้าแล้วเท่านั้น โดยจำนวนของเสียที่ซ่อมไม่ได้ (result_bad_qty) ในรอบเดิม จะกลายเป็นยอดตั้งต้น (input_qty) ของการ Rework ในรอบถัดไป

รูปแบบการสร้าง Label ID ยึดตามโครงสร้างวันที่: RW-YYYYMMDD-XX

ISSUED → IN_PROGRESS → RETURNED → CLOSED


### Fields ที่มาจาก `production_orders` (ERP sync — read-only ในแอป)
- `prog_plan` — จาก `production_orders.prog_plan`
- `qc_after_p` — จาก `production_orders.qc_after_p`
- `pack_wk` — จาก `production_orders.pack_wk`
- `line_post` — จาก `production_orders.line_post`

### Fields ที่ QC กรอกเองตอนออกใบ (manual input จริง)
- `input_qty` (total / passed / failed) — จำนวนที่ตรวจ
- defect codes + `defect_qty` ต่อ code — อาการเสียและจำนวน
- `remark` — หมายเหตุ
- `qc_name` — ชื่อ QC ที่ตรวจ
- `issued_at` (วันที่) — วันที่ออกใบ

### Rework Log Calculation
```
good (งานดี)   = total - input_qty of round 1      (first-pass good)
bad  (งานเสีย) = input_qty of round 1              (ส่งเข้า rework ทั้งหมด)
R1..R6         = result_good_qty of each round    (null = ยังไม่ปิดรอบ)
date           = issued_at ของ round 1 (วันที่ออกใบครั้งแรก ไม่ใช่รอบล่าสุด)
packWk, linePost, progPlan, qcAfterP, total = ค่าจาก order/รอบล่าสุด (latest)
```

---

## `app/api/` — Key Functions & Types

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

---

## Planned (TODO)
- [ ] Sync 2 databases
- [ ] **`issued_by`, `received_by`, `returned_by`, `closed_by` flow** — ตอนนี้มีแค่ `qc_name` ที่ใช้งานจริง ฟิลด์อื่นเตรียม column ไว้รอ flow/UI ที่เกี่ยวข้อง (เช่นหน้า ReworkStation ต้องมีช่องกรอกชื่อคนรับ/คืนงาน)
- [ ] **`issued_at` เวลาแม่นยำ** — ถ้าต้องการ SLA tracking ในอนาคต เปลี่ยนฟอร์มจาก `<input type="date">` → `<input type="datetime-local">` และแก้ `parseDate()` ให้รับเวลาจริงแทน hardcode `00:00:00` (ไม่ใช่ด่วน เก็บไว้ทำทีหลังได้)
- [ ] Guard check role ในแต่ละ screen (ตอนนี้ mock ที่ HomePage เท่านั้น)
- [ ] Login system จริง — เมื่อมีแล้ว ใช้ `_id` columns (`qc_id`, `issued_by_id` ฯลฯ) ที่เตรียมไว้แล้วผูกกับ session user ได้ทันที
- [ ] Toast notifications แทน console.error

---

Browser: `http://localhost:3000`
