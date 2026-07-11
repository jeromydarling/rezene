-- The Timeless Library: per-shop pins. The library's CONTENT is never stored
-- here — it lives at the source (the Met's CC0 collection, the Internet
-- Archive's scans) and is fetched on request through the worker, with search
-- results cached at the platform (0047). What a shop KEEPS is a pin: a
-- denormalized snapshot of the item (title, image URLs, and a ready-to-quote
-- credit line) so a shop's library survives cache eviction and source
-- hiccups. Pins feed trend boards — the Language of Costume method: quote
-- the archive, with the citation attached.

CREATE TABLE IF NOT EXISTS library_pins (
  id TEXT PRIMARY KEY,
  item_key TEXT NOT NULL,            -- '<source>:<source id>' e.g. 'met:81124', 'ia:sim_vogue_1924-04-01_63_7$12'
  room TEXT NOT NULL DEFAULT 'plates'
    CHECK (room IN ('plates','magazines','books','patterns')),
  title TEXT NOT NULL,
  creator TEXT,
  date_text TEXT,
  thumb_url TEXT,
  image_url TEXT,
  source_url TEXT NOT NULL,          -- where the original lives (Met object page, IA details)
  credit TEXT NOT NULL,              -- citation line, ready to paste on a board
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_key)
);

CREATE INDEX IF NOT EXISTS idx_library_pins_room ON library_pins(room, created_at DESC);
