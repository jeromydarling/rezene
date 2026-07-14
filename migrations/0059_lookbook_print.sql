-- Lookbook print & mail orders (per-shop). A print job renders the lookbook to
-- interior + cover PDFs, then submits one Lulu print job per recipient (Lulu
-- prints and drop-ships each copy). Charge-on-delivery: the shop's card is
-- authorized up front and captured only once the jobs are submitted to Lulu.
CREATE TABLE IF NOT EXISTS lookbook_print_jobs (
  id TEXT PRIMARY KEY,
  lookbook_id TEXT NOT NULL,
  title TEXT NOT NULL,
  -- draft -> authorized -> rendering -> rendered -> submitted -> shipped
  --        -> failed / cancelled
  status TEXT NOT NULL DEFAULT 'draft',
  page_count INTEGER NOT NULL DEFAULT 0,
  copies_per_recipient INTEGER NOT NULL DEFAULT 1,
  shipping_level TEXT NOT NULL DEFAULT 'GROUND',
  pod_package_id TEXT,
  interior_file_id TEXT,
  cover_file_id TEXT,
  wholesale_cents INTEGER NOT NULL DEFAULT 0,  -- Lulu print + shipping (all recipients)
  retail_cents INTEGER NOT NULL DEFAULT 0,     -- what the shop pays Verto (marked up)
  currency TEXT NOT NULL DEFAULT 'USD',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TEXT,
  error TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lookbook_print_jobs_lookbook ON lookbook_print_jobs(lookbook_id);
CREATE INDEX idx_lookbook_print_jobs_status ON lookbook_print_jobs(status);

CREATE TABLE IF NOT EXISTS lookbook_print_recipients (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES lookbook_print_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  street1 TEXT NOT NULL,
  street2 TEXT,
  city TEXT NOT NULL,
  state_code TEXT,
  postcode TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  phone_number TEXT,
  email TEXT,
  lulu_job_id TEXT,          -- Lulu's print-job id once submitted
  lulu_status TEXT,          -- CREATED / IN_PRODUCTION / SHIPPED / …
  tracking_id TEXT,
  tracking_url TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0,  -- Lulu wholesale for this recipient
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lookbook_print_recipients_job ON lookbook_print_recipients(job_id);
CREATE INDEX idx_lookbook_print_recipients_lulu ON lookbook_print_recipients(lulu_job_id);
