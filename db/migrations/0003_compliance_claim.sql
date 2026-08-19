-- ============================================================================
-- MIGRATION: 0003_compliance_claim.sql
-- PURPOSE: Add durable compliance-scan claim fields to vendor_onboarding_drafts.
--          Prevents concurrent approval requests from executing duplicate compliance
--          scans. The claim is set atomically inside the SELECT ... FOR UPDATE
--          transaction and cleared on successful activation or marked 'failed' on error.
-- STATUS: PREPARED (Do NOT execute against production without explicit approval).
-- SAFE SEQUENCING: Additive only. All new columns nullable. Zero impact on existing
--                  drafts, vendors, documents, or compliance scores.
-- ============================================================================

BEGIN;

-- Add compliance claim columns to vendor_onboarding_drafts
ALTER TABLE "vendor_onboarding_drafts"
  ADD COLUMN IF NOT EXISTS "approval_attempt_id" text,
  ADD COLUMN IF NOT EXISTS "approval_processing_started_at" timestamp,
  ADD COLUMN IF NOT EXISTS "approval_processing_status" text;

-- Constrain the status to known values only (NULL = idle)
ALTER TABLE "vendor_onboarding_drafts"
  ADD CONSTRAINT "chk_draft_approval_processing_status"
  CHECK (
    "approval_processing_status" IN ('processing', 'failed')
    OR "approval_processing_status" IS NULL
  );

COMMENT ON COLUMN "vendor_onboarding_drafts"."approval_attempt_id"
  IS 'UUID of the active approval scan claim. NULL when no scan is in progress.';
COMMENT ON COLUMN "vendor_onboarding_drafts"."approval_processing_started_at"
  IS 'Timestamp when the claim was acquired. Claims older than 10 minutes are stale.';
COMMENT ON COLUMN "vendor_onboarding_drafts"."approval_processing_status"
  IS 'processing = scan in progress; failed = last scan errored (retriable); NULL = idle.';

COMMIT;

-- ============================================================================
-- ROLLBACK (pre-use — columns have never held production data):
--
-- BEGIN;
-- ALTER TABLE "vendor_onboarding_drafts"
--   DROP CONSTRAINT IF EXISTS "chk_draft_approval_processing_status",
--   DROP COLUMN IF EXISTS "approval_attempt_id",
--   DROP COLUMN IF EXISTS "approval_processing_started_at",
--   DROP COLUMN IF EXISTS "approval_processing_status";
-- COMMIT;
--
-- ROLLBACK (post-use — preserve data, mark stale claims failed):
--
-- BEGIN;
-- UPDATE "vendor_onboarding_drafts"
--   SET "approval_processing_status" = 'failed'
--   WHERE "approval_processing_status" = 'processing';
-- COMMIT;
-- ============================================================================
