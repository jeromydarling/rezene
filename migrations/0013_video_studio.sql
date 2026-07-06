-- Migration number: 0013        2026-07-06
-- Promo-video studio (per-shop). Each shop composes a promo in the free
-- in-app preview, then pays per render; the async render runs off-Worker
-- (GitHub Actions → R2). Charge-on-delivery: payment is authorized on
-- submit and only captured when the finished MP4 lands, so a failed render
-- never bills the customer.

CREATE TABLE video_jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'promo_cinematic',
  -- The full composition the preview rendered and the customer approved:
  -- brand bits, palette, chosen product image urls, per-scene lines,
  -- music prompt, requested formats. What renders == what they saw.
  spec_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','queued','rendering','ready','failed','cancelled')),
  progress INTEGER NOT NULL DEFAULT 0,        -- 0..100
  progress_label TEXT,                        -- 'Scene 4 of 7 — the module montage'
  formats TEXT NOT NULL DEFAULT '["16:9"]',   -- JSON: requested aspect ratios
  outputs TEXT,                               -- JSON: { "16:9": {fileId,url}, ... }
  poster_file_id TEXT,                        -- instant still, handed over at submit
  captions TEXT,                              -- JSON: brand-voice launch captions + schedule
  -- Money: charge-on-delivery via the platform Stripe account.
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  stripe_payment_intent_id TEXT,              -- authorized on submit
  paid_at TEXT,                               -- set when captured on delivery
  error TEXT,                                 -- last render error (for retry/refund)
  render_started_at TEXT,
  rendered_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_video_jobs_status ON video_jobs(status, created_at DESC);
