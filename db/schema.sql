-- Reneal Warehouse System — Postgres schema
-- Replaces the Google Sheets tabs (Repairs, Spare Laptops, Warehouse, Schools,
-- Withdrawals, Deployments, Users, Deleted Log) previously served by
-- google-apps-script/Code.gs.
--
-- Every table keeps a `legacy_id` column mapping back to the old
-- Apps-Script-generated id, for migration traceability and safe re-runs.

CREATE EXTENSION IF NOT EXISTS citext;

-- ─── Schools ──────────────────────────────────────────────
CREATE TABLE schools (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_id           TEXT UNIQUE,
  name                TEXT NOT NULL UNIQUE,
  district            TEXT,
  region              TEXT,
  status              TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Deactivated')),
  laptop_count        INTEGER NOT NULL DEFAULT 0,
  activated_date      DATE,
  deactivated_date    DATE,
  deactivated_reason  TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Users ────────────────────────────────────────────────
CREATE TABLE users (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_id   TEXT UNIQUE,
  email       CITEXT NOT NULL UNIQUE,
  name        TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin','technician','viewer')),
  school_id   BIGINT REFERENCES schools(id) ON DELETE SET NULL,
  added_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Spare Laptops ────────────────────────────────────────
CREATE TABLE spare_laptops (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_id      TEXT UNIQUE,
  id_number      TEXT NOT NULL UNIQUE,
  manufacturer   TEXT,
  model          TEXT,
  cpu            TEXT,
  cpu_class      TEXT,
  mem_hd         TEXT,
  comments       TEXT,
  location       TEXT,
  donor          TEXT,
  -- Not always a real date in source data — some rows hold a shipment-batch
  -- label instead (e.g. '2022A', '2023B'), matching the "2025B/2026A Box
  -- Notes" shipment-batch naming used elsewhere in this project.
  date_label     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Repairs ──────────────────────────────────────────────
-- school_id is nullable on purpose: historical schoolName free text may not
-- cleanly match a schools row (typos, deactivated schools). Keeping a
-- snapshot instead of forcing a strict FK avoids the same exact-string
-- fragility that caused the warehouse box-name bug.
CREATE TABLE repairs (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_id                 TEXT UNIQUE,
  reference_number          TEXT NOT NULL,
  model                     TEXT,
  date_received             DATE,
  school_id                 BIGINT REFERENCES schools(id),
  school_name_snapshot      TEXT NOT NULL,
  received_by               TEXT,
  problem_identified        TEXT, -- nullable: a few legacy rows have this blank
  status                    TEXT NOT NULL DEFAULT 'Received',
  technician                TEXT,
  date_repaired             DATE,
  picked_up_by              TEXT,
  date_returned_to_school   DATE,
  remarks                   TEXT,
  laptop_id_number          TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON repairs (school_id);
CREATE INDEX ON repairs (status);

-- ─── Warehouse: boxes + items ─────────────────────────────
-- warehouse_boxes is the actual fix for the wrong-box corruption incident:
-- a canonical box entity instead of exact-string matching on boxName.
CREATE TABLE warehouse_boxes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deleted_at is a soft delete. Restore becomes a single idempotent
-- PK-addressed UPDATE with no string-matching step in the write path —
-- this is what makes "restore" safe under concurrent duplicate requests.
CREATE TABLE warehouse_items (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_id     TEXT UNIQUE,
  box_id        BIGINT NOT NULL REFERENCES warehouse_boxes(id) ON DELETE CASCADE,
  item          TEXT, -- nullable: one legacy row has this blank
  -- Nullable + a free-text note: real warehouse entries include values like
  -- '4pc', 'bunch', '6(BOX)' that aren't purely numeric. quantity holds the
  -- parsed leading number where one exists (for sums/low-stock queries);
  -- quantity_note preserves the original unit/qualifier text.
  quantity      NUMERIC(12,2) CHECK (quantity IS NULL OR quantity >= 0),
  quantity_note TEXT,
  description   TEXT,
  deleted_at    TIMESTAMPTZ,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON warehouse_items (box_id) WHERE deleted_at IS NULL;

-- ─── Withdrawals ──────────────────────────────────────────
-- box_name_snapshot/item_snapshot are denormalized on purpose: history must
-- survive a later box/item rename.
CREATE TABLE withdrawals (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_id          TEXT UNIQUE,
  date               DATE NOT NULL DEFAULT CURRENT_DATE,
  item_id            BIGINT NOT NULL REFERENCES warehouse_items(id),
  box_name_snapshot  TEXT NOT NULL,
  item_snapshot      TEXT NOT NULL,
  quantity_taken     NUMERIC(12,2) NOT NULL CHECK (quantity_taken > 0),
  remaining_qty      NUMERIC(12,2) NOT NULL,
  taken_by           TEXT NOT NULL,
  destination        TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON withdrawals (item_id);

-- ─── Deployments ──────────────────────────────────────────
CREATE TABLE deployments (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_id             TEXT UNIQUE,
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  laptop_id             BIGINT REFERENCES spare_laptops(id),
  id_number_snapshot    TEXT,
  action                TEXT NOT NULL CHECK (action IN ('Deployed','Returned')),
  school_id             BIGINT REFERENCES schools(id),
  school_name_snapshot  TEXT,
  taken_by              TEXT NOT NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON deployments (laptop_id);

-- ─── Deleted Log (append-only audit trail) ───────────────
-- Kept separate from warehouse_items.deleted_at, which is the operational
-- restore mechanism — this table is history and is never written to on restore.
CREATE TABLE deleted_log (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legacy_id    TEXT UNIQUE,
  "timestamp"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by   TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('item','box')),
  -- References the exact soft-deleted row so Restore is a precise PK lookup,
  -- never a re-match by box/item name text.
  item_id      BIGINT REFERENCES warehouse_items(id),
  box_name     TEXT,
  item         TEXT,
  quantity     NUMERIC(12,2),
  description  TEXT
);
