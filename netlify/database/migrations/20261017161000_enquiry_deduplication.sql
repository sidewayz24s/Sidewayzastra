-- A unique database claim prevents concurrent duplicate leads across processes.
CREATE TABLE enquiry_deduplication (
  key TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  expires BIGINT NOT NULL
);
CREATE INDEX enquiry_deduplication_expiry ON enquiry_deduplication(expires);
