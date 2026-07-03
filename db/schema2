-- Last Updated: 2026-07-03
-- Redesign: moved prog_plan/qc_after_p to production_orders, added po.pack_wk, ld.defect_qty
-- rw_line REMOVED ENTIRELY (superseded by production_orders.line_post) — see fix below:
--   the rework_labels FK `fk_rl_line` in the previous dump referenced a `rw_line` column
--   that no longer exists on this table (dropped earlier). That constraint would fail
--   to create on a fresh run. Removed here.

CREATE DATABASE IF NOT EXISTS ReworkTrackerDB;
USE ReworkTrackerDB;

-- ------------------------------------------------------------
-- 1. USERS
-- ------------------------------------------------------------
CREATE TABLE users (
  id          INT           NOT NULL AUTO_INCREMENT,
  username    VARCHAR(50)   NOT NULL,
  full_name   VARCHAR(100)  NOT NULL,
  role        ENUM('qc', 'rw_station', 'admin') NOT NULL,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 2. PRODUCTION ORDERS
--    prog_plan / qc_after_p / pack_wk live here (order-level, ERP-synced).
--    App is read-only for these — QC never sets them.
-- ------------------------------------------------------------
CREATE TABLE production_orders (
  order_id    VARCHAR(20)   NOT NULL,
  material_id VARCHAR(20),
  description VARCHAR(255),
  line_post   VARCHAR(20),
  prog_plan   VARCHAR(20)   NULL DEFAULT NULL,
  qc_after_p  VARCHAR(20)   NULL DEFAULT NULL,
  total_qty   INT,
  pack_wk     VARCHAR(20)   NULL DEFAULT NULL,
  source      ENUM('manual','erp') NOT NULL DEFAULT 'manual',
  synced_at   DATETIME      NULL DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3. DEFECT CODES
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- (production_lines table REMOVED — was only a FK target for rw_line,
--  which no longer exists anywhere. Nothing references it. Dropped.)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4. REWORK LABELS
--    prog_plan / qc_after_p / rw_line REMOVED — prog_plan & qc_after_p now
--    on production_orders; rw_line removed entirely (superseded by line_post).
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 5. LABEL DEFECTS
--    defect_qty stores qty per defect code (was silently dropped before —
--    frontend collected it but backend never inserted it).
-- ------------------------------------------------------------
CREATE TABLE label_defects (
  label_id      VARCHAR(30)   NOT NULL,
  defect_code   VARCHAR(10)   NOT NULL,
  defect_qty    INT           NOT NULL,
  PRIMARY KEY (label_id, defect_code),
  CONSTRAINT fk_ld_label FOREIGN KEY (label_id)    REFERENCES rework_labels(label_id) ON DELETE CASCADE,
  CONSTRAINT fk_ld_code  FOREIGN KEY (defect_code) REFERENCES defect_codes(defect_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;