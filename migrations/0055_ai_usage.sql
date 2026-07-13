-- AI usage ledger — PLATFORM-ONLY (lives in the bound D1, like activation_events
-- and the shop registry), so Verto HQ can read the whole fleet's AI spend in one
-- query. Excluded from the per-shop DO embed (scripts/embed-migrations.mjs).
--
-- One append row per AI/external-model call. High-volume, so no UNIQUE dedupe —
-- it's a ledger, aggregated by model / provider / operation / shop / day. Tokens
-- for text models; units for images (1 per image). cost_cents is an ESTIMATE
-- from a per-model price table (services/ai-usage.ts), rounded to cents as REAL;
-- 0 where the model's price isn't known (the token/unit counts are still exact).
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT,                                   -- null for platform/background calls
  provider TEXT NOT NULL,                         -- 'anthropic' | 'workers-ai' | 'perplexity' | 'fal' | ...
  model TEXT NOT NULL,
  operation TEXT,                                 -- e.g. 'marketing.campaign', 'strategy', 'fitting.tryon'
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  units INTEGER NOT NULL DEFAULT 0,               -- image/render count
  cost_cents REAL NOT NULL DEFAULT 0,             -- estimated USD cents
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider, model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_shop ON ai_usage(shop_id);
