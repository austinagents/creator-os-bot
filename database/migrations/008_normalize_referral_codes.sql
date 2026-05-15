-- PartnerLinks Phase 8: Lowercase Referral Identifiers
-- Migration: 008_normalize_referral_codes.sql
-- Safe to rerun (idempotent)

UPDATE creators
SET creator_code = lower(trim(creator_code))
WHERE creator_code IS NOT NULL
  AND creator_code <> lower(trim(creator_code));

UPDATE creators
SET referral_code = lower(trim(referral_code))
WHERE referral_code IS NOT NULL
  AND referral_code <> lower(trim(referral_code));

UPDATE creators
SET referral_code = lower(trim(creator_code))
WHERE referral_code IS NULL
  AND creator_code IS NOT NULL;

-- Migration complete
