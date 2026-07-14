-- Migration 003
-- Add qc_id + qc_name to rework_labels.
-- These exist in the reference schema and are used by the API (CreateLabel INSERT,
-- UpdateLabelDto QcId->qc_id / QcName->qc_name) and the frontend, but were missing
-- from the live DB — causing "Unknown column 'qc_name'" when creating a label.
-- Additive / non-destructive (nullable columns). Safe for existing data.

USE ReworkTrackerDB;

START TRANSACTION;

ALTER TABLE rework_labels
  ADD COLUMN qc_id   INT         NULL DEFAULT NULL AFTER remark,
  ADD COLUMN qc_name VARCHAR(50) NULL DEFAULT NULL AFTER qc_id;

ALTER TABLE rework_labels
  ADD CONSTRAINT fk_rl_qc FOREIGN KEY (qc_id) REFERENCES users(id);

COMMIT;

-- ------------------------------------------------------------
-- Rollback (run manually if needed):
-- ------------------------------------------------------------
-- ALTER TABLE rework_labels DROP FOREIGN KEY fk_rl_qc;
-- ALTER TABLE rework_labels DROP COLUMN qc_name, DROP COLUMN qc_id;
