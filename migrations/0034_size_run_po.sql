-- Migration number: 0034        2026-07-08
-- Size-run purchase orders: a production-order line can carry a size breakdown
-- (e.g. {"S":10,"M":20,"L":15}) instead of a single lumped quantity. When a
-- breakdown is present, `quantity` holds its sum. Per-shop.

ALTER TABLE production_order_items ADD COLUMN size_breakdown TEXT;
