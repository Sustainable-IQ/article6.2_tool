-- Article 6.2 corresponding adjustments workbench: D1 schema
-- Snapshot-versioned so a new data cutoff is an insert, not a redeploy.

DROP TABLE IF EXISTS credit_blocks;
DROP TABLE IF EXISTS table4_rows;
DROP TABLE IF EXISTS party_notes;
DROP TABLE IF EXISTS snapshots;

CREATE TABLE snapshots (
  id             TEXT PRIMARY KEY,   -- e.g. '2026-08-14'
  cutoff         TEXT NOT NULL,      -- data cutoff date the source states
  source         TEXT NOT NULL,      -- e.g. 'Gold Standard and Verra'
  source_version TEXT NOT NULL,      -- e.g. '1.0'
  published_at   TEXT NOT NULL,      -- date the source was published
  is_current     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE credit_blocks (
  snapshot_id          TEXT NOT NULL,
  idx                  INTEGER NOT NULL,
  programme            TEXT NOT NULL,
  project_id           TEXT NOT NULL,
  volume               INTEGER NOT NULL,
  serial               TEXT NOT NULL,
  vintage              INTEGER NOT NULL,
  party                TEXT NOT NULL,
  ft_definition        TEXT NOT NULL,   -- Authorisation | Issuance | First international transfer
  auth_year            INTEGER NOT NULL,
  issuance_date        TEXT NOT NULL,
  issuance_year        INTEGER NOT NULL,
  ndc                  INTEGER NOT NULL,  -- 1 = authorised for NDC use
  oimp                 INTEGER NOT NULL,  -- 1 = authorised for other international mitigation purposes
  cooperative_approach TEXT NOT NULL,
  on_carp              INTEGER NOT NULL,
  auth_url             TEXT,
  PRIMARY KEY (snapshot_id, idx)
);
CREATE INDEX idx_blocks_party   ON credit_blocks (snapshot_id, party);
CREATE INDEX idx_blocks_vintage ON credit_blocks (snapshot_id, party, vintage);

-- Table 4 of the annex to Decision 5/CMA.3, with the programmes' explanation text verbatim.
CREATE TABLE table4_rows (
  snapshot_id TEXT NOT NULL,
  row_no      INTEGER NOT NULL,   -- workbook sheet row, 3 to 14
  short       TEXT NOT NULL,
  src         TEXT NOT NULL,      -- 'Table 4 row N'
  full_label  TEXT NOT NULL,      -- verbatim decision text
  explanation TEXT,               -- verbatim column H
  PRIMARY KEY (snapshot_id, row_no)
);

CREATE TABLE party_notes (
  snapshot_id TEXT NOT NULL,
  party       TEXT NOT NULL,
  note        TEXT NOT NULL,
  sources     TEXT
);
CREATE INDEX idx_notes_party ON party_notes (snapshot_id, party);
