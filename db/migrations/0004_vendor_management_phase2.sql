-- ============================================================================
-- MIGRATION: 0004_vendor_management_phase2.sql
-- PURPOSE: Vendor Management Phase 2 — Compliance Cases, Overrides, Settings,
--          Freelancer Support, and Elevated Banking Dual-Review Security.
-- STATUS: PREPARED (DO NOT EXECUTE AUTOMATICALLY — AWAITING EXPLICIT RELEASE APPROVAL)
-- SAFE SEQUENCING: Strictly additive. Nullable columns, safe defaults, zero data loss.
-- ============================================================================

BEGIN;

-- 1. Vendors Table Additive Columns
ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "vendor_type" text NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS "compliance_status" text NOT NULL DEFAULT 'legacy_pending_assessment',
  ADD COLUMN IF NOT EXISTS "grace_period_deadline" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "grace_period_reason" text,
  ADD COLUMN IF NOT EXISTS "grace_period_extended_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "compliance_metadata" jsonb DEFAULT '{}'::jsonb;

-- Constraints on Vendors table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_vendors_vendor_type') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "chk_vendors_vendor_type"
      CHECK ("vendor_type" IN ('company', 'freelancer'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_vendors_compliance_status') THEN
    ALTER TABLE "vendors" ADD CONSTRAINT "chk_vendors_compliance_status"
      CHECK ("compliance_status" IN ('unassessed', 'legacy_pending_assessment', 'compliant', 'expiring_soon', 'non_compliant', 'grace_period', 'compliance_not_applicable'));
  END IF;
END $$;

-- 2. Vendor Compliance Cases Table (Audit Evidence Preserved)
CREATE TABLE IF NOT EXISTS "vendor_compliance_cases" (
  "id" serial PRIMARY KEY,
  "case_number" text NOT NULL UNIQUE,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE RESTRICT,
  "status" text NOT NULL DEFAULT 'open',
  "reason" text NOT NULL,
  "allowed_fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "required_documents" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "instructions" text,
  "opened_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "opened_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "deadline" timestamp with time zone NOT NULL,
  "closed_at" timestamp with time zone,
  "closed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "resolution_notes" text,
  "reminder_count" integer NOT NULL DEFAULT 0,
  "last_reminder_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT NOW(),
  "updated_at" timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_compliance_cases_vendor" ON "vendor_compliance_cases"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_status" ON "vendor_compliance_cases"("status");
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_deadline" ON "vendor_compliance_cases"("deadline");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compliance_cases_status') THEN
    ALTER TABLE "vendor_compliance_cases" ADD CONSTRAINT "chk_compliance_cases_status"
      CHECK ("status" IN ('open', 'under_review', 'resolved_compliant', 'expired_non_compliant', 'cancelled'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compliance_cases_deadline') THEN
    ALTER TABLE "vendor_compliance_cases" ADD CONSTRAINT "chk_compliance_cases_deadline"
      CHECK ("deadline" > "opened_at");
  END IF;
END $$;

-- 3. Vendor Compliance Overrides Table (PR-bound)
CREATE TABLE IF NOT EXISTS "vendor_compliance_overrides" (
  "id" serial PRIMARY KEY,
  "request_id" integer NOT NULL REFERENCES "purchase_requests"("id") ON DELETE RESTRICT,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE RESTRICT,
  "case_id" integer REFERENCES "vendor_compliance_cases"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "justification" text NOT NULL,
  "requested_by" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "reviewed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "consumed_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "rejection_reason" text,
  "request_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_compliance_overrides_req" ON "vendor_compliance_overrides"("request_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_overrides_vendor" ON "vendor_compliance_overrides"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_overrides_status" ON "vendor_compliance_overrides"("status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compliance_overrides_status') THEN
    ALTER TABLE "vendor_compliance_overrides" ADD CONSTRAINT "chk_compliance_overrides_status"
      CHECK ("status" IN ('pending', 'approved', 'rejected', 'consumed', 'revoked'));
  END IF;
END $$;

-- Partial unique index to enforce at most one active override per purchase request
CREATE UNIQUE INDEX IF NOT EXISTS "idx_active_compliance_override_per_request"
  ON "vendor_compliance_overrides" ("request_id")
  WHERE "status" IN ('pending', 'approved');

-- 4. Vendor Compliance Global Settings Singleton Table
CREATE TABLE IF NOT EXISTS "vendor_compliance_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "is_singleton" boolean NOT NULL DEFAULT true,
  "expiration_warning_days" integer NOT NULL DEFAULT 30,
  "default_grace_days" integer NOT NULL DEFAULT 15,
  "company_checklist" jsonb NOT NULL DEFAULT '["CR", "TAX_CARD", "ESTABLISHMENT_ID"]'::jsonb,
  "freelancer_checklist" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "allow_freelancer_cash_exemption" boolean NOT NULL DEFAULT true,
  "reminder_threshold_days" jsonb NOT NULL DEFAULT '[30, 15, 7, 1]'::jsonb,
  "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT NOW(),
  CONSTRAINT "chk_compliance_settings_singleton" CHECK ("id" = 1 AND "is_singleton" = true),
  CONSTRAINT "chk_compliance_settings_grace_range" CHECK ("default_grace_days" BETWEEN 1 AND 365),
  CONSTRAINT "chk_compliance_settings_warning_range" CHECK ("expiration_warning_days" BETWEEN 1 AND 180)
);

-- Ensure singleton default row exists
INSERT INTO "vendor_compliance_settings" ("id", "is_singleton", "expiration_warning_days", "default_grace_days", "company_checklist", "freelancer_checklist", "allow_freelancer_cash_exemption")
VALUES (1, true, 30, 15, '["CR", "TAX_CARD", "ESTABLISHMENT_ID"]'::jsonb, '[]'::jsonb, true)
ON CONFLICT ("id") DO NOTHING;

-- 5. Additive Columns to Existing Support Tables
ALTER TABLE "vendor_onboarding_drafts"
  ADD COLUMN IF NOT EXISTS "vendor_type" text NOT NULL DEFAULT 'company';

ALTER TABLE "vendor_onboarding_tokens"
  ADD COLUMN IF NOT EXISTS "case_id" integer REFERENCES "vendor_compliance_cases"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "change_request_id" integer,
  ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'onboarding';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_vendor_tokens_change_request') THEN
    ALTER TABLE "vendor_onboarding_tokens"
      ADD CONSTRAINT "fk_vendor_tokens_change_request"
      FOREIGN KEY ("change_request_id") REFERENCES "vendor_change_requests"("id") ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE "vendor_upload_intents"
  ADD COLUMN IF NOT EXISTS "case_id" integer REFERENCES "vendor_compliance_cases"("id") ON DELETE SET NULL;

ALTER TABLE "vendor_change_requests"
  ADD COLUMN IF NOT EXISTS "case_id" integer REFERENCES "vendor_compliance_cases"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "change_type" text NOT NULL DEFAULT 'GENERAL_UPDATE',
  ADD COLUMN IF NOT EXISTS "second_reviewed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "second_reviewed_at" timestamp with time zone;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_change_requests_type') THEN
    ALTER TABLE "vendor_change_requests" ADD CONSTRAINT "chk_change_requests_type"
      CHECK ("change_type" IN ('GENERAL_UPDATE', 'BANKING_DETAILS', 'COMPLIANCE_RENEWAL'));
  END IF;
END $$;

COMMIT;
