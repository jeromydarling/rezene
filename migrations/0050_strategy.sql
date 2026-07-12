-- Business Strategy documents — the R&D → Strategy room. Each row is one
-- generated strategy artifact (SWOT, business plan, OKRs, competitive analysis)
-- built with a chosen Claude persona and grounded in the shop's Brand Brain.
-- Per-shop data, so this migration embeds into every shop DO.

CREATE TABLE IF NOT EXISTS strategy_docs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('swot','business_plan','okrs','competitive')),
  variant TEXT,                                   -- 'lean' | 'full' for business_plan
  persona TEXT NOT NULL DEFAULT 'advisor',        -- advisor | investor | operator | coach
  title TEXT NOT NULL,
  brief TEXT,                                     -- the founder's free-text input
  content_json TEXT,                              -- StrategyContent (summary/sections/actions)
  scheduled_json TEXT NOT NULL DEFAULT '[]',      -- action indexes already pushed to the calendar
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  provider TEXT,                                  -- 'anthropic' | 'workers-ai'
  plain INTEGER NOT NULL DEFAULT 0,               -- plain-language mode was on
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_strategy_docs_kind ON strategy_docs(kind, status);
CREATE INDEX IF NOT EXISTS idx_strategy_docs_created ON strategy_docs(created_at DESC);
