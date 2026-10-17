CREATE TABLE IF NOT EXISTS leads (
 id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, dedupe_key TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 stage TEXT NOT NULL DEFAULT 'New enquiry', is_test INTEGER NOT NULL DEFAULT 0,
 registration TEXT NOT NULL, postcode TEXT NOT NULL, service TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL,
 contact TEXT NOT NULL, preferred_date TEXT, parts_preference TEXT NOT NULL, brands TEXT, callback TEXT, mileage TEXT,
 consent_json TEXT NOT NULL, attribution_json TEXT NOT NULL, vehicle_verified INTEGER DEFAULT 0, location_verified INTEGER DEFAULT 0,
 qualified INTEGER DEFAULT 0, quote_json TEXT, acceptance_evidence TEXT, booking_json TEXT, next_service_json TEXT,
 stopped INTEGER DEFAULT 0, followup_paused INTEGER DEFAULT 0, crm_contact_id TEXT, crm_opportunity_id TEXT, unsubscribe_hash TEXT
);
CREATE INDEX IF NOT EXISTS leads_dedupe ON leads(dedupe_key,created_at);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,lead_id TEXT NOT NULL,event_type TEXT NOT NULL,occurred_at TEXT NOT NULL,is_test INTEGER NOT NULL DEFAULT 0,payload_json TEXT NOT NULL DEFAULT '{}',UNIQUE(lead_id,event_type,id));
CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY,lead_id TEXT NOT NULL,event_type TEXT NOT NULL,due_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,payload_json TEXT NOT NULL,provider_ref TEXT,error_code TEXT,created_at TEXT NOT NULL,locked_at TEXT);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(status,due_at);
CREATE TABLE IF NOT EXISTS slots (resource TEXT NOT NULL,slot TEXT NOT NULL,lead_id TEXT NOT NULL,PRIMARY KEY(resource,slot));
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,n INTEGER NOT NULL,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ad_spend (day TEXT NOT NULL,campaign TEXT NOT NULL,amount DOUBLE PRECISION NOT NULL CHECK(amount>=0),PRIMARY KEY(day,campaign));
