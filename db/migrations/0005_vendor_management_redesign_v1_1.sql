-- ============================================================================
-- MIGRATION: 0005_vendor_management_redesign_v1_1.sql
-- PURPOSE: Vendor Management Redesign — Ruleset Versioning, Dynamic Rule Matrix,
--          Decoupled Submissions, Multi-Dimensional Status, Staged Banking Dual-Control,
--          Append-Only PR Compliance Snapshots & Compliance Score History.
-- SAFE SEQUENCING: Strictly additive, idempotent, reversible.
-- ============================================================================

BEGIN;

-- 1. Ruleset Versions Table (Immutable Published Snapshots)
CREATE TABLE IF NOT EXISTS "vendor_ruleset_versions" (
  "id" serial PRIMARY KEY,
  "version_number" integer NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'archived'
  "rules_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "published_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "published_at" timestamp with time zone,
  "change_summary" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_vendor_ruleset_versions_status" ON "vendor_ruleset_versions"("status");

-- Enforce EXACTLY ONE active published ruleset via Partial Unique Index
CREATE UNIQUE INDEX IF NOT EXISTS "idx_single_published_ruleset" 
  ON "vendor_ruleset_versions" ("status") 
  WHERE "status" = 'published';

-- 2. Rule Definitions Catalog Table
CREATE TABLE IF NOT EXISTS "vendor_rule_definitions" (
  "id" serial PRIMARY KEY,
  "rule_key" text NOT NULL UNIQUE, -- 'cr_document', 'qid_document', 'tax_card', 'bank_details', etc.
  "name" text NOT NULL,
  "section" text NOT NULL DEFAULT 'legal', -- 'basic', 'legal', 'finance', 'document', 'contract', 'other'
  "description" text,
  "instructions" text,
  "input_type" text NOT NULL DEFAULT 'document', -- 'short_text', 'long_text', 'number', 'currency', 'date', 'email', 'mobile', 'dropdown', 'checkbox', 'document', 'field_and_document'
  "dropdown_options" jsonb DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_locked" boolean NOT NULL DEFAULT false, -- True for Company CR & Freelancer QID
  "display_order" integer NOT NULL DEFAULT 0,
  
  -- Company Configuration
  "company_applicable" boolean NOT NULL DEFAULT true,
  "company_mandatory" boolean NOT NULL DEFAULT false,
  "company_creator_can_change" boolean NOT NULL DEFAULT false,
  "company_affects_score" boolean NOT NULL DEFAULT true,
  "company_info_required" boolean NOT NULL DEFAULT false,
  "company_doc_required" boolean NOT NULL DEFAULT true,

  -- Freelancer Configuration
  "freelancer_applicable" boolean NOT NULL DEFAULT false,
  "freelancer_mandatory" boolean NOT NULL DEFAULT false,
  "freelancer_creator_can_change" boolean NOT NULL DEFAULT false,
  "freelancer_affects_score" boolean NOT NULL DEFAULT true,
  "freelancer_info_required" boolean NOT NULL DEFAULT false,
  "freelancer_doc_required" boolean NOT NULL DEFAULT true,

  -- Document & Verification Rules
  "expiry_required" boolean NOT NULL DEFAULT false,
  "verification_required" boolean NOT NULL DEFAULT true,
  "verification_role" text NOT NULL DEFAULT 'finance', -- 'finance', 'admin', 'super_admin'
  "expiry_warning_days" integer NOT NULL DEFAULT 30,
  "accepted_file_formats" jsonb NOT NULL DEFAULT '["pdf", "jpg", "jpeg", "png"]'::jsonb,
  "max_file_size_mb" integer NOT NULL DEFAULT 10,
  "score_weight" integer NOT NULL DEFAULT 10, -- Bounded between 1 and 100
  
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_vendor_rule_definitions_key" ON "vendor_rule_definitions"("rule_key");
CREATE INDEX IF NOT EXISTS "idx_vendor_rule_definitions_section" ON "vendor_rule_definitions"("section");

-- 3. Alter Vendors Table (Make bank details nullable for fast creation & add new metadata columns)
ALTER TABLE "vendors"
  ALTER COLUMN "bank_name" DROP NOT NULL,
  ALTER COLUMN "account_number" DROP NOT NULL,
  ALTER COLUMN "iban_number" DROP NOT NULL,
  ALTER COLUMN "branch_name" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "engagement_type" text NOT NULL DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS "compliance_deadline" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "ruleset_version_id" integer REFERENCES "vendor_ruleset_versions"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "banking_verification_status" text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS "requires_classification_review" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "creator_id" integer REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_vendors_engagement_type" ON "vendors"("engagement_type");
CREATE INDEX IF NOT EXISTS "idx_vendors_compliance_deadline" ON "vendors"("compliance_deadline");

-- 4. Alter Purchase Requests Table (Add latest compliance snapshot reference)
ALTER TABLE "purchase_requests"
  ADD COLUMN IF NOT EXISTS "latest_compliance_snapshot_id" integer;

-- 5. Vendor Assigned Requirements Table (Obligations assigned to a vendor)
CREATE TABLE IF NOT EXISTS "vendor_assigned_requirements" (
  "id" serial PRIMARY KEY,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "rule_id" integer REFERENCES "vendor_rule_definitions"("id") ON DELETE SET NULL,
  "source_ruleset_version_id" integer NOT NULL REFERENCES "vendor_ruleset_versions"("id") ON DELETE RESTRICT,
  "rule_key" text NOT NULL,
  "name" text NOT NULL,
  "section" text NOT NULL,
  "input_type" text NOT NULL,
  "is_mandatory" boolean NOT NULL DEFAULT false,
  "is_custom" boolean NOT NULL DEFAULT false,
  "affects_score" boolean NOT NULL DEFAULT true,
  "score_weight" integer NOT NULL DEFAULT 10,
  "info_required" boolean NOT NULL DEFAULT false,
  "doc_required" boolean NOT NULL DEFAULT false,
  "expiry_required" boolean NOT NULL DEFAULT false,
  "verification_required" boolean NOT NULL DEFAULT true,
  "verification_role" text NOT NULL DEFAULT 'finance',
  "accepted_file_formats" jsonb NOT NULL DEFAULT '["pdf", "jpg", "jpeg", "png"]'::jsonb,
  "max_file_size_mb" integer NOT NULL DEFAULT 10,
  "dropdown_options" jsonb DEFAULT '[]'::jsonb,
  "instructions" text,
  "display_order" integer NOT NULL DEFAULT 0,
  "resolved_due_date" timestamp with time zone NOT NULL,
  
  -- Multi-Dimensional Current State
  "submission_status" text NOT NULL DEFAULT 'missing', -- 'missing', 'draft', 'submitted', 'under_review', 'verified', 'rejected'
  "validity_status" text NOT NULL DEFAULT 'not_applicable', -- 'valid', 'expiring_soon', 'expired', 'not_applicable'
  "deadline_status" text NOT NULL DEFAULT 'due', -- 'due', 'overdue', 'completed_on_time', 'completed_late'
  
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_assigned_reqs_vendor_id" ON "vendor_assigned_requirements"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_assigned_reqs_submission_status" ON "vendor_assigned_requirements"("submission_status");
CREATE INDEX IF NOT EXISTS "idx_assigned_reqs_validity_status" ON "vendor_assigned_requirements"("validity_status");
CREATE INDEX IF NOT EXISTS "idx_assigned_reqs_deadline_status" ON "vendor_assigned_requirements"("deadline_status");

-- 6. Vendor Requirement Submissions Table (Decoupled responses & audit history)
CREATE TABLE IF NOT EXISTS "vendor_requirement_submissions" (
  "id" serial PRIMARY KEY,
  "assigned_requirement_id" integer NOT NULL REFERENCES "vendor_assigned_requirements"("id") ON DELETE CASCADE,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL DEFAULT 1,
  "field_value" text,
  "document_ids" jsonb DEFAULT '[]'::jsonb,
  "expiry_date" timestamp with time zone,
  "submission_notes" text,
  "status" text NOT NULL DEFAULT 'submitted', -- 'draft', 'submitted', 'verified', 'rejected', 'superseded'
  "submitted_by_type" text NOT NULL DEFAULT 'vendor', -- 'vendor', 'user'
  "submitted_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "submitted_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  
  "verified_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "verified_at" timestamp with time zone,
  "rejection_reason" text,
  "verification_notes" text,
  
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_req_submissions_assigned_id" ON "vendor_requirement_submissions"("assigned_requirement_id");
CREATE INDEX IF NOT EXISTS "idx_req_submissions_vendor_id" ON "vendor_requirement_submissions"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_req_submissions_status" ON "vendor_requirement_submissions"("status");

-- 7. Staged Banking Submissions Table (Quarantine Dual-Control)
CREATE TABLE IF NOT EXISTS "vendor_banking_submissions" (
  "id" serial PRIMARY KEY,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "bank_name" text NOT NULL,
  "branch_name" text NOT NULL,
  "account_number" text NOT NULL,
  "iban_number" text NOT NULL,
  "payment_currency" text NOT NULL DEFAULT 'QAR',
  "bank_letter_doc_id" integer,
  "status" text NOT NULL DEFAULT 'pending_stage1', -- 'pending_stage1', 'pending_stage2', 'verified', 'rejected'
  
  -- Stage 1: Finance Review
  "stage1_reviewed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "stage1_reviewed_at" timestamp with time zone,
  "stage1_notes" text,
  
  -- Stage 2: Super Admin Confirmation
  "stage2_reviewed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "stage2_reviewed_at" timestamp with time zone,
  "stage2_notes" text,
  
  "rejection_reason" text,
  "submitted_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_banking_submissions_vendor_id" ON "vendor_banking_submissions"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_banking_submissions_status" ON "vendor_banking_submissions"("status");

-- 8. Append-Only PR Compliance Snapshots Table
CREATE TABLE IF NOT EXISTS "purchase_request_compliance_snapshots" (
  "id" serial PRIMARY KEY,
  "request_id" integer NOT NULL,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE RESTRICT,
  "event_type" text NOT NULL DEFAULT 'submission', -- 'submission', 'resubmission', 'approval_step'
  "compliance_score" integer NOT NULL,
  "compliance_status" text NOT NULL,
  "vendor_age_days" integer NOT NULL,
  "compliance_deadline" timestamp with time zone,
  "is_overdue" boolean NOT NULL DEFAULT false,
  "overdue_days" integer NOT NULL DEFAULT 0,
  "missing_mandatory_keys" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expired_requirement_keys" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "ruleset_version_id" integer REFERENCES "vendor_ruleset_versions"("id") ON DELETE SET NULL,
  "raw_snapshot_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "triggered_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_pr_snapshots_request_id" ON "purchase_request_compliance_snapshots"("request_id");
CREATE INDEX IF NOT EXISTS "idx_pr_snapshots_vendor_id" ON "purchase_request_compliance_snapshots"("vendor_id");

-- 9. Append-Only Compliance Score History Table
CREATE TABLE IF NOT EXISTS "vendor_compliance_score_history" (
  "id" serial PRIMARY KEY,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "previous_score" integer NOT NULL,
  "new_score" integer NOT NULL,
  "previous_status" text NOT NULL,
  "new_status" text NOT NULL,
  "calculation_breakdown" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "triggering_event" text NOT NULL, -- 'INITIAL_CREATION', 'SUBMISSION_VERIFIED', 'SUBMISSION_REJECTED', 'DOCUMENT_EXPIRED', 'DEADLINE_PASSED', 'RULESET_REAPPLIED'
  "ruleset_version_id" integer REFERENCES "vendor_ruleset_versions"("id") ON DELETE SET NULL,
  "recalculated_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_score_history_vendor_id" ON "vendor_compliance_score_history"("vendor_id");

-- 10. Vendor Portal Events Table (Link Lifecycle Tracking)
CREATE TABLE IF NOT EXISTS "vendor_portal_events" (
  "id" serial PRIMARY KEY,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "token_id" integer,
  "event_type" text NOT NULL, -- 'LINK_GENERATED', 'LINK_COPIED', 'LINK_SENT_EMAIL', 'PORTAL_OPENED', 'DRAFT_SAVED', 'PORTAL_SUBMITTED', 'REMINDER_SENT'
  "actor_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_type" text NOT NULL DEFAULT 'user', -- 'user', 'vendor', 'system'
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_portal_events_vendor_id" ON "vendor_portal_events"("vendor_id");

-- 11. SEED DEFAULT RULE DEFINITIONS (Locked Core Rules)
INSERT INTO "vendor_rule_definitions" (
  "rule_key", "name", "section", "description", "instructions", "input_type", 
  "is_active", "is_locked", "display_order",
  "company_applicable", "company_mandatory", "company_creator_can_change", "company_affects_score", "company_info_required", "company_doc_required",
  "freelancer_applicable", "freelancer_mandatory", "freelancer_creator_can_change", "freelancer_affects_score", "freelancer_info_required", "freelancer_doc_required",
  "expiry_required", "verification_required", "verification_role", "expiry_warning_days", "score_weight"
) VALUES
  (
    'cr_document', 'Commercial Registration (CR)', 'legal', 
    'Official Commercial Registration issued by MOCI', 'Upload valid, official Commercial Registration document.', 'field_and_document',
    true, true, 1,
    true, true, false, true, true, true,
    false, false, false, false, false, false,
    true, true, 'finance', 30, 40
  ),
  (
    'qid_document', 'Qatar ID (QID)', 'legal', 
    'Official Qatar Identification Document for individual freelancer', 'Upload clear front and back copy of valid Qatar ID.', 'field_and_document',
    true, true, 2,
    false, false, false, false, false, false,
    true, true, false, true, true, true,
    true, true, 'finance', 30, 40
  ),
  (
    'tax_card', 'Tax Card / TIN Certificate', 'finance', 
    'General Tax Authority (GTA) Tax Card or TIN Registration Certificate', 'Upload official Tax Card showing Tax Identification Number.', 'field_and_document',
    true, false, 3,
    true, false, true, true, true, true,
    true, false, true, true, true, true,
    false, true, 'finance', 30, 20
  ),
  (
    'bank_details', 'Bank Account & Official Confirmation Letter', 'finance', 
    'Official bank details with IBAN and stamped confirmation letter', 'Enter bank account details and upload official stamped bank letter.', 'field_and_document',
    true, false, 4,
    true, false, true, true, true, true,
    true, false, true, true, true, true,
    false, true, 'finance', 30, 30
  ),
  (
    'establishment_card', 'Establishment Card (Computer Card)', 'legal', 
    'Ministry of Interior Computer / Establishment Card', 'Upload valid Establishment Card.', 'document',
    true, false, 5,
    true, false, true, true, false, true,
    false, false, false, false, false, false,
    true, true, 'finance', 30, 10
  )
ON CONFLICT ("rule_key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "is_locked" = EXCLUDED."is_locked",
  "company_mandatory" = EXCLUDED."company_mandatory",
  "freelancer_mandatory" = EXCLUDED."freelancer_mandatory";

-- 12. SEED INITIAL PUBLISHED RULESET VERSION 1
DO $$
DECLARE
  v_rules jsonb;
  v_version_id integer;
BEGIN
  -- Gather current rule definitions snapshot
  SELECT jsonb_agg(to_jsonb(r)) INTO v_rules FROM "vendor_rule_definitions" r WHERE r."is_active" = true;
  
  -- Insert or ensure Version 1 exists and is published
  IF NOT EXISTS (SELECT 1 FROM "vendor_ruleset_versions" WHERE "version_number" = 1) THEN
    INSERT INTO "vendor_ruleset_versions" ("version_number", "status", "rules_snapshot", "change_summary", "published_at")
    VALUES (1, 'published', COALESCE(v_rules, '[]'::jsonb), 'Initial system baseline ruleset', NOW())
    RETURNING "id" INTO v_version_id;
  END IF;
END $$;

COMMIT;
