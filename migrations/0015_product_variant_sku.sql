-- Migration number: 0015        2026-07-06
-- Make product variants self-describing as sellable SKUs.
--
-- The `skus` table is tied to the design-pipeline `styles`. Products created
-- directly in the storefront (no style behind them) still need a SKU code per
-- variant, so carry it on the variant itself. Nullable + non-unique: codes are
-- optional and a merchant may reuse patterns across archived products.

ALTER TABLE product_variants ADD COLUMN sku_code TEXT;
