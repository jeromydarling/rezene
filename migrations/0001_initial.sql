-- Migration number: 0001        2026-07-05
-- Maison Atlantique — initial schema.
--
-- Conventions:
--   * TEXT primary keys (UUIDs or readable seed ids), generated app-side.
--   * Timestamps are ISO-8601 TEXT, UTC, defaulting to datetime('now').
--   * Money is INTEGER minor units (cents) + a currency TEXT column.
--   * Soft business states are TEXT with CHECK constraints, not magic ints.
--   * `settings` holds brand-level config (brand name is intentionally
--     changeable there, not hardcoded).
--   * SaaS-readiness: workspace_id columns are OMITTED for now, but every
--     table keys off opaque TEXT ids so a tenant column can be added by
--     migration without rewriting identity.

-- ============================================================
-- Settings / brand config
-- ============================================================
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,             -- JSON or scalar
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Identity / auth
-- ============================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,              -- PBKDF2 (see worker/services/auth.ts); NULL if SSO/Access-only
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,             -- e.g. 'admin', 'ops', 'viewer'
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,             -- random token id; token itself stored hashed
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,            -- e.g. 'style.update', 'order.refund'
  entity_type TEXT,
  entity_id TEXT,
  detail TEXT,                     -- JSON diff/summary
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ============================================================
-- Brand / content
-- ============================================================
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  season TEXT,                     -- e.g. 'SS27'
  description TEXT,
  editorial_copy TEXT,
  hero_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lookbooks (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  season TEXT,
  intro_copy TEXT,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lookbook_images (
  id TEXT PRIMARY KEY,
  lookbook_id TEXT NOT NULL REFERENCES lookbooks(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  credit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE journal_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_md TEXT,                    -- markdown; sanitized at render
  hero_image_url TEXT,
  author TEXT,
  published_at TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,       -- 'size-guide', 'shipping-returns', 'privacy', 'terms', 'story', 'atelier'
  title TEXT NOT NULL,
  body_md TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'image',   -- image | video | document
  url TEXT NOT NULL,
  r2_key TEXT,
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Email capture / lightweight CRM
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('newsletter','waitlist','drop_notification','wholesale_inquiry','contact')),
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  message TEXT,
  product_id TEXT,                 -- for drop notifications
  source_path TEXT,
  consent INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_leads_kind ON leads(kind);
CREATE INDEX idx_leads_email ON leads(email);

-- ============================================================
-- Product development: styles, SKUs, specs
-- ============================================================
CREATE TABLE styles (
  id TEXT PRIMARY KEY,
  style_code TEXT NOT NULL UNIQUE, -- e.g. 'MA-M-TRS-001'
  name TEXT NOT NULL,
  category TEXT NOT NULL,          -- trouser | polo | overshirt | dress | top | set | coverup | accessory
  gender TEXT NOT NULL CHECK (gender IN ('mens','womens','unisex')),
  season TEXT,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'concept'
    CHECK (status IN ('concept','design','tech_pack','sampling','approved','production','discontinued')),
  description TEXT,
  fit_notes TEXT,
  fabric_summary TEXT,
  designer TEXT,
  target_cost_cents INTEGER,
  target_retail_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_styles_status ON styles(status);
CREATE INDEX idx_styles_collection ON styles(collection_id);

CREATE TABLE style_versions (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  change_summary TEXT,
  snapshot_json TEXT,              -- serialized style + spec state
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (style_id, version)
);

CREATE TABLE colorways (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- 'Sand', 'Deep Navy'
  color_code TEXT,                 -- hex or Pantone
  fabric_note TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_colorways_style ON colorways(style_id);

CREATE TABLE skus (
  id TEXT PRIMARY KEY,
  sku_code TEXT NOT NULL UNIQUE,   -- e.g. 'MA-M-TRS-001-SND-32'
  style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  colorway_id TEXT REFERENCES colorways(id) ON DELETE SET NULL,
  size TEXT NOT NULL,
  barcode TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_skus_style ON skus(style_id);

CREATE TABLE size_specs (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- 'SS27 base spec'
  base_size TEXT NOT NULL,         -- e.g. '32', 'M'
  size_run TEXT NOT NULL,          -- JSON array: ["28","30","32","34","36"]
  unit TEXT NOT NULL DEFAULT 'cm',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE measurement_points (
  id TEXT PRIMARY KEY,
  size_spec_id TEXT NOT NULL REFERENCES size_specs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,              -- 'WB' waistband, 'INS' inseam
  name TEXT NOT NULL,
  how_to_measure TEXT,
  base_value REAL,                 -- value at base size, in spec unit
  tolerance REAL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_mpoints_spec ON measurement_points(size_spec_id);

CREATE TABLE grading_rules (
  id TEXT PRIMARY KEY,
  size_spec_id TEXT NOT NULL REFERENCES size_specs(id) ON DELETE CASCADE,
  measurement_point_id TEXT NOT NULL REFERENCES measurement_points(id) ON DELETE CASCADE,
  step_value REAL NOT NULL,        -- increment per size step
  notes TEXT
);

CREATE TABLE fabrics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  supplier_id TEXT,                -- FK added logically; suppliers table below
  composition TEXT,                -- '100% linen'
  weight_gsm INTEGER,
  origin_country TEXT,             -- drives duty/yarn-forward logic
  price_per_meter_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  lead_time_days INTEGER,
  moq_meters INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE trims (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,              -- 'Corozo button 20L'
  supplier_id TEXT,
  spec TEXT,
  price_per_unit_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bom_items (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  component TEXT NOT NULL,         -- 'Shell fabric', 'Waistband lining', 'Main button'
  material_type TEXT NOT NULL CHECK (material_type IN ('fabric','trim','label','packaging','other')),
  fabric_id TEXT REFERENCES fabrics(id) ON DELETE SET NULL,
  trim_id TEXT REFERENCES trims(id) ON DELETE SET NULL,
  quantity REAL,
  unit TEXT,                       -- 'm', 'pcs'
  placement TEXT,
  supplier_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_bom_style ON bom_items(style_id);

CREATE TABLE care_instructions (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  wash TEXT,
  bleach TEXT,
  dry TEXT,
  iron TEXT,
  dry_clean TEXT,
  extra_note TEXT
);

-- ============================================================
-- Commerce
-- ============================================================
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  country TEXT,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_customers_email ON customers(email);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  editorial_story TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('mens','womens','unisex')),
  category TEXT NOT NULL,
  fabric_composition TEXT,
  care_summary TEXT,
  origin_statement TEXT,           -- 'Cut and tailored in Casablanca, Morocco'
  fit_notes TEXT,
  shipping_note TEXT,
  base_price_cents INTEGER NOT NULL,
  compare_at_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  availability TEXT NOT NULL DEFAULT 'draft'
    CHECK (availability IN ('draft','available','pre_order','sold_out','archived')),
  pre_order_note TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_published ON products(is_published, availability);
CREATE INDEX idx_products_collection ON products(collection_id);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  colorway_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_pimages_product ON product_images(product_id);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku_id TEXT REFERENCES skus(id) ON DELETE SET NULL,
  colorway_name TEXT NOT NULL,
  size TEXT NOT NULL,
  price_cents INTEGER,             -- NULL = inherit product base price
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (product_id, colorway_name, size)
);
CREATE INDEX idx_variants_product ON product_variants(product_id);

CREATE TABLE stripe_product_mappings (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (variant_id, currency)
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  incoming INTEGER NOT NULL DEFAULT 0,   -- from production orders
  pre_order_allocated INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (variant_id)
);

CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('receive','sell','reserve','release','return','damage','adjust','preorder_allocate')),
  quantity INTEGER NOT NULL,       -- signed delta applied to on_hand/reserved as appropriate
  reference_type TEXT,             -- 'order' | 'production_order' | 'manual'
  reference_id TEXT,
  note TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_invmove_item ON inventory_movements(inventory_item_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,     -- 'MA-1027'
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded','partially_refunded')),
  fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled'
    CHECK (fulfillment_status IN ('unfulfilled','processing','shipped','delivered','cancelled')),
  is_pre_order INTEGER NOT NULL DEFAULT 0,
  shipping_country TEXT,
  shipping_address_json TEXT,      -- non-sensitive address snapshot
  promotion_code TEXT,
  placed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_status ON orders(payment_status, fulfillment_status);
CREATE INDEX idx_orders_customer ON orders(customer_id);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  description TEXT NOT NULL,       -- snapshot: 'Tangier Trouser — Sand / 32'
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD'
);
CREATE INDEX idx_oitems_order ON order_items(order_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,            -- mirrors Stripe status
  method_summary TEXT,             -- 'visa •••• 4242' — never raw card data
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  stripe_refund_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  stripe_promotion_code_id TEXT,
  stripe_coupon_id TEXT,
  description TEXT,
  percent_off REAL,
  amount_off_cents INTEGER,
  currency TEXT,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Production: factories, suppliers, orders, calendar, samples, QC
-- ============================================================
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'factory'
    CHECK (kind IN ('factory','fabric_mill','trim_supplier','service','logistics')),
  city TEXT,
  country TEXT,
  address TEXT,
  map_url TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  languages TEXT,                  -- JSON array: ["fr","ar","en"]
  capabilities TEXT,               -- JSON array: ["tailoring","small_batch",...]
  certifications TEXT,             -- JSON array
  moq_units INTEGER,
  lead_time_days INTEGER,
  payment_terms TEXT,
  on_time_score REAL,              -- 0-5
  quality_score REAL,              -- 0-5
  risk_notes TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,   -- 0 = research/demo lead, unverified
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- `factories` is the subset view concept; kept as its own table per spec for
-- factory-specific production fields, 1:1 with a supplier row.
CREATE TABLE factories (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
  specialty TEXT,                  -- 'tailored trousers, small-batch designer runs'
  min_order_units INTEGER,
  max_monthly_capacity_units INTEGER,
  sample_lead_time_days INTEGER,
  bulk_lead_time_days INTEGER
);

CREATE TABLE supplier_contacts (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  preferred_language TEXT,
  notes TEXT
);
CREATE INDEX idx_scontacts_supplier ON supplier_contacts(supplier_id);

CREATE TABLE supplier_interactions (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES supplier_contacts(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('email','call','whatsapp','visit','quote','sample_feedback','other')),
  direction TEXT CHECK (direction IN ('outbound','inbound')),
  subject TEXT,
  summary TEXT,
  follow_up_due TEXT,
  needs_response INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sinter_supplier ON supplier_interactions(supplier_id);

CREATE TABLE production_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,  -- 'PO-2027-001'
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','confirmed','in_production','qc','shipped','received','cancelled')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  total_cost_cents INTEGER,
  issue_date TEXT,
  ex_factory_date TEXT,            -- promised
  received_date TEXT,
  incoterms TEXT,                  -- 'EXW Casablanca', 'FOB Casablanca'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE production_order_items (
  id TEXT PRIMARY KEY,
  production_order_id TEXT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  sku_id TEXT REFERENCES skus(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR'
);
CREATE INDEX idx_poitems_po ON production_order_items(production_order_id);

-- Reference list of pipeline stages (seeded from business plan calendar).
CREATE TABLE production_stages (
  id TEXT PRIMARY KEY,             -- 'brand_identity', 'sampling', ...
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE production_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  stage_id TEXT REFERENCES production_stages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','blocked','done','cancelled')),
  owner TEXT,                      -- free-text owner until team accounts matter
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  production_order_id TEXT REFERENCES production_orders(id) ON DELETE SET NULL,
  depends_on_task_id TEXT REFERENCES production_tasks(id) ON DELETE SET NULL,
  due_date TEXT,
  completed_at TEXT,
  risk_flag INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ptasks_status ON production_tasks(status, due_date);
CREATE INDEX idx_ptasks_stage ON production_tasks(stage_id);

CREATE TABLE production_calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'milestone' CHECK (kind IN ('milestone','window','deadline')),
  stage_id TEXT REFERENCES production_stages(id) ON DELETE SET NULL,
  starts_on TEXT NOT NULL,         -- date
  ends_on TEXT,                    -- date; NULL = single day
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pcal_dates ON production_calendar_events(starts_on);

CREATE TABLE samples (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  round INTEGER NOT NULL DEFAULT 1,       -- proto 1, proto 2, SMS...
  kind TEXT NOT NULL DEFAULT 'proto' CHECK (kind IN ('proto','fit','sms','pp','top')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','in_progress','shipped','received','in_review','revisions_needed','approved','rejected')),
  requested_at TEXT,
  received_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_samples_style ON samples(style_id);
CREATE INDEX idx_samples_status ON samples(status);

CREATE TABLE sample_reviews (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  reviewer TEXT,
  fit_rating INTEGER,              -- 1-5
  make_rating INTEGER,             -- 1-5
  fabric_rating INTEGER,           -- 1-5
  decision TEXT CHECK (decision IN ('approve','revise','reject')),
  comments TEXT,
  measurements_json TEXT,          -- actual vs spec deltas
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE quality_control_checks (
  id TEXT PRIMARY KEY,
  production_order_id TEXT REFERENCES production_orders(id) ON DELETE CASCADE,
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  checklist_json TEXT,             -- [{item, pass, note}]
  inspector TEXT,
  units_inspected INTEGER,
  units_failed INTEGER,
  result TEXT CHECK (result IN ('pass','conditional','fail')),
  inspected_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE shipment_batches (
  id TEXT PRIMARY KEY,
  production_order_id TEXT REFERENCES production_orders(id) ON DELETE SET NULL,
  carrier TEXT,
  tracking_number TEXT,
  incoterms TEXT,
  origin TEXT,
  destination TEXT,
  units INTEGER,
  shipped_at TEXT,
  eta TEXT,
  received_at TEXT,
  freight_cost_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Costing / duties / margins
-- ============================================================
CREATE TABLE cost_sheets (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  sku_id TEXT REFERENCES skus(id) ON DELETE SET NULL,
  name TEXT NOT NULL,              -- 'SS27 pilot run costing'
  currency TEXT NOT NULL DEFAULT 'USD',
  fabric_cost_cents INTEGER NOT NULL DEFAULT 0,
  trim_cost_cents INTEGER NOT NULL DEFAULT 0,
  cut_sew_make_cents INTEGER NOT NULL DEFAULT 0,
  sample_allocation_cents INTEGER NOT NULL DEFAULT 0,
  packaging_cents INTEGER NOT NULL DEFAULT 0,
  freight_cents INTEGER NOT NULL DEFAULT 0,
  insurance_cents INTEGER NOT NULL DEFAULT 0,
  duty_cents INTEGER NOT NULL DEFAULT 0,
  payment_processing_cents INTEGER NOT NULL DEFAULT 0,
  returns_reserve_cents INTEGER NOT NULL DEFAULT 0,
  target_retail_cents INTEGER,
  actual_retail_cents INTEGER,
  wholesale_price_cents INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_costsheets_style ON cost_sheets(style_id);

CREATE TABLE cost_sheet_items (
  id TEXT PRIMARY KEY,
  cost_sheet_id TEXT NOT NULL REFERENCES cost_sheets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,          -- 'fabric','trim','make','logistics','duty','other'
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT
);

CREATE TABLE duty_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  destination_region TEXT NOT NULL,       -- 'EU','US','UK','CA'
  origin_country TEXT NOT NULL DEFAULT 'MA',
  hs_category TEXT,                       -- optional HS chapter/heading note
  qualifies_condition TEXT,               -- human-readable rule, e.g. yarn-forward
  duty_rate_min REAL NOT NULL,            -- fraction, e.g. 0.165
  duty_rate_max REAL NOT NULL,
  is_preferential INTEGER NOT NULL DEFAULT 0,
  disclaimer TEXT NOT NULL DEFAULT 'Estimate only. Not legal or customs advice. Final classification requires trade/legal review.',
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE landed_cost_scenarios (
  id TEXT PRIMARY KEY,
  cost_sheet_id TEXT NOT NULL REFERENCES cost_sheets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- 'EU DTC', 'US fallback MFN'
  destination_region TEXT NOT NULL,
  duty_rule_id TEXT REFERENCES duty_rules(id) ON DELETE SET NULL,
  duty_rate_used REAL NOT NULL DEFAULT 0,
  freight_cents INTEGER NOT NULL DEFAULT 0,
  insurance_cents INTEGER NOT NULL DEFAULT 0,
  landed_cost_cents INTEGER,       -- computed snapshot
  retail_price_cents INTEGER,
  gross_margin_pct REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE margin_targets (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('dtc','wholesale')),
  category TEXT,                   -- NULL = brand default
  target_gross_margin_pct REAL NOT NULL,
  floor_gross_margin_pct REAL,
  notes TEXT
);

-- ============================================================
-- Tech packs
-- ============================================================
CREATE TABLE tech_packs (
  id TEXT PRIMARY KEY,
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,       -- 'TP-MA-M-TRS-001-v1'
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','sent_to_factory','superseded')),
  season TEXT,
  source TEXT NOT NULL DEFAULT 'blank'
    CHECK (source IN ('blank','style','photo','prompt','ai_concept','previous_version')),
  cover_image_url TEXT,
  summary TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_techpacks_style ON tech_packs(style_id);

-- Ordered, typed sections; content is structured JSON per section kind.
CREATE TABLE tech_pack_sections (
  id TEXT PRIMARY KEY,
  tech_pack_id TEXT NOT NULL REFERENCES tech_packs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'cover','style_overview','flat_sketch','bom','fabric_details','trim_details',
    'colorways','size_spec','measurement_points','grading','construction',
    'stitch_details','labels_packaging','care_label','qc_checklist',
    'revision_history','export_meta'
  )),
  title TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tech_pack_id, kind)
);

CREATE TABLE tech_pack_files (
  id TEXT PRIMARY KEY,
  tech_pack_id TEXT NOT NULL REFERENCES tech_packs(id) ON DELETE CASCADE,
  file_id TEXT,                    -- FK to files table below
  label TEXT,
  kind TEXT,                       -- 'flat_sketch','reference','pattern','render'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tech_pack_exports (
  id TEXT PRIMARY KEY,
  tech_pack_id TEXT NOT NULL REFERENCES tech_packs(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'html' CHECK (format IN ('html','pdf')),
  r2_key TEXT,
  url TEXT,
  version INTEGER NOT NULL,
  exported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tech_pack_comments (
  id TEXT PRIMARY KEY,
  tech_pack_id TEXT NOT NULL REFERENCES tech_packs(id) ON DELETE CASCADE,
  section_kind TEXT,
  author TEXT,
  body TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE construction_notes (
  id TEXT PRIMARY KEY,
  tech_pack_id TEXT NOT NULL REFERENCES tech_packs(id) ON DELETE CASCADE,
  area TEXT NOT NULL,              -- 'Waistband', 'Hem'
  note TEXT NOT NULL,
  note_fr TEXT,                    -- French translation for Casablanca factories
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE stitch_details (
  id TEXT PRIMARY KEY,
  tech_pack_id TEXT NOT NULL REFERENCES tech_packs(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,         -- 'Side seam'
  stitch_class TEXT,               -- ISO 4915 class, e.g. '301 lockstitch'
  spi TEXT,                        -- stitches per inch
  thread TEXT,
  machine TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE labels_packaging (
  id TEXT PRIMARY KEY,
  tech_pack_id TEXT NOT NULL REFERENCES tech_packs(id) ON DELETE CASCADE,
  item TEXT NOT NULL,              -- 'Main label', 'Care label', 'Polybag'
  placement TEXT,
  material TEXT,
  artwork_file_id TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- Files (R2 object metadata)
-- ============================================================
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  entity_type TEXT CHECK (entity_type IN
    ('style','tech_pack','sample','factory','production_order','concept','3d_project','journal','product','general')),
  entity_id TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,  -- public assets may be served via R2_PUBLIC_BASE_URL
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_files_entity ON files(entity_type, entity_id);

-- ============================================================
-- AI / external tool bridges
-- ============================================================
CREATE TABLE ai_prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,          -- 'concept','tech_pack','copy','email','translation'
  target_tool TEXT NOT NULL DEFAULT 'claude'
    CHECK (target_tool IN ('claude','midjourney','firefly','dalle','clo3d','other')),
  prompt_text TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  parent_prompt_id TEXT REFERENCES ai_prompts(id) ON DELETE SET NULL,
  is_preset INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ai_concepts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  brief TEXT,
  prompt_id TEXT REFERENCES ai_prompts(id) ON DELETE SET NULL,
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'exploring'
    CHECK (status IN ('exploring','shortlisted','converted_to_style','converted_to_tech_pack','archived')),
  rating INTEGER,                  -- 1-5
  tags TEXT,                       -- JSON array
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ai_generations (
  id TEXT PRIMARY KEY,
  concept_id TEXT REFERENCES ai_concepts(id) ON DELETE CASCADE,
  tech_pack_id TEXT REFERENCES tech_packs(id) ON DELETE SET NULL,
  tool TEXT NOT NULL,              -- 'claude','midjourney','firefly','dalle'
  model TEXT,
  prompt_text TEXT,
  output_kind TEXT NOT NULL DEFAULT 'text' CHECK (output_kind IN ('text','json','image','link')),
  output_text TEXT,
  output_json TEXT,
  file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  external_url TEXT,               -- e.g. Midjourney job URL
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_aigen_concept ON ai_generations(concept_id);

CREATE TABLE external_tool_exports (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,              -- 'midjourney','firefly','clo3d','browzwear','style3d','illustrator','figma'
  entity_type TEXT,                -- what it attaches to
  entity_id TEXT,
  title TEXT,
  external_url TEXT,
  file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  metadata_json TEXT,              -- seeds, job ids, license notes, measurements
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_extexports_entity ON external_tool_exports(entity_type, entity_id);

CREATE TABLE clo3d_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','pattern_needed','in_simulation','fit_review','approved')),
  tool TEXT NOT NULL DEFAULT 'clo3d' CHECK (tool IN ('clo3d','browzwear','style3d','other')),
  measurements_json TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE simulation_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES clo3d_projects(id) ON DELETE CASCADE,
  file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'render'
    CHECK (kind IN ('project_file','pattern','render','turntable','measurement_export','other')),
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Which external integrations are configured (names/scopes only — never keys).
CREATE TABLE integration_credentials_metadata (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,   -- 'stripe','anthropic','resend',...
  status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured','configured','error')),
  scopes TEXT,
  last_verified_at TEXT,
  note TEXT
);

-- Inbound/outbound webhook registrations and receipt log
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,          -- 'stripe'
  event_type TEXT NOT NULL,
  external_event_id TEXT UNIQUE,   -- idempotency guard
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed','ignored')),
  error TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX idx_webhooks_provider ON webhooks(provider, event_type);

-- ============================================================
-- Analytics foundation
-- ============================================================
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,             -- 'page_view','product_view','checkout_started',...
  session_key TEXT,                -- anonymous client session
  user_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  path TEXT,
  referrer TEXT,
  country TEXT,
  properties_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_analytics_event ON analytics_events(event, created_at);
