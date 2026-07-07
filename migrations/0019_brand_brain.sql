-- The Brand Brain: one structured record per shop that captures the decisions
-- behind the label (from the Launch Playbook, an imported plan, or AI). It
-- seeds and guides every module. Per-shop (embedded into every shop DO).

CREATE TABLE brand_brain (
  id TEXT PRIMARY KEY DEFAULT 'brain',
  mode TEXT,                                  -- 'established' | 'new' | NULL (not chosen)
  status TEXT NOT NULL DEFAULT 'draft',       -- 'draft' | 'compiled'
  answers_json TEXT NOT NULL DEFAULT '{}',    -- filled Playbook fields
  checklist_json TEXT NOT NULL DEFAULT '{}',  -- pre-launch checklist ticks
  brief_json TEXT,                            -- compiled structured brief (the "brain")
  plan_markdown TEXT,                         -- compiled, readable business plan
  onboarded INTEGER NOT NULL DEFAULT 0,       -- has the founder finished onboarding?
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log of what the Brain has seeded into the app, so we don't double-apply and
-- can show a "what I've set up" trail.
CREATE TABLE brand_brain_seeds (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,          -- 'settings' | 'costing' | 'studio' | ...
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
