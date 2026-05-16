-- PartnerLinks: Product Referral Click Attribution Metadata
-- Migration: 013_click_product_attribution.sql
-- Safe to rerun (idempotent)

ALTER TABLE clicks ADD COLUMN IF NOT EXISTS creator_code text;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS brand_slug text;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS product_slug text;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS shop_domain text;
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS partnerlinks_ref text;

CREATE INDEX IF NOT EXISTS idx_clicks_creator_code ON clicks(creator_code);
CREATE INDEX IF NOT EXISTS idx_clicks_referral_code ON clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_clicks_brand_slug ON clicks(brand_slug);
CREATE INDEX IF NOT EXISTS idx_clicks_product_slug ON clicks(product_slug);
CREATE INDEX IF NOT EXISTS idx_clicks_shop_domain ON clicks(shop_domain);
CREATE INDEX IF NOT EXISTS idx_clicks_partnerlinks_ref ON clicks(partnerlinks_ref);
CREATE INDEX IF NOT EXISTS idx_clicks_shop_product_created ON clicks(shop_domain, product_slug, created_at);

-- Migration complete
