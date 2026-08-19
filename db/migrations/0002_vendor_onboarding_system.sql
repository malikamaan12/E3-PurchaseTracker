-- ============================================================================
-- MIGRATION: 0002_vendor_onboarding_system.sql
-- PURPOSE: Vendor Self-Service Onboarding, Staging Drafts, Tokens, and Change Requests
-- STATUS: PREPARED (Do NOT execute against production without explicit approval).
-- SAFE SEQUENCING: Zero impact on existing active vendors, documents, or compliance scores.
-- ============================================================================

BEGIN;

-- Step 1: Add safe lifecycle and version columns to existing vendors table
ALTER TABLE "vendors" 
  ADD COLUMN IF NOT EXISTS "onboarding_status" text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;

-- Step 2: Create vendor_onboarding_drafts staging table for incomplete drafts
CREATE TABLE IF NOT EXISTS "vendor_onboarding_drafts" (
  "id" serial PRIMARY KEY,
  "company_name" text NOT NULL,
  "contact_person" text NOT NULL,
  "contact_number" text NOT NULL,
  "email" text NOT NULL,
  "address" text,
  "tax_number" text,
  "registration_number" text,
  "bank_name" text,
  "account_number" text,
  "iban_number" text,
  "branch_name" text,
  "category" text DEFAULT 'general',
  "payment_currency" text NOT NULL DEFAULT 'QAR',
  "required_document_types" jsonb DEFAULT '[]'::jsonb,
  "onboarding_status" text NOT NULL DEFAULT 'invited',
  "onboarding_notes" text,
  "submitted_at" timestamp,
  "promoted_vendor_id" integer REFERENCES "vendors"("id") ON DELETE SET NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "chk_draft_status" CHECK ("onboarding_status" IN ('invited', 'in_progress', 'submitted', 'changes_requested', 'approved', 'rejected', 'revoked')),
  CONSTRAINT "chk_draft_version" CHECK ("version" > 0)
);

CREATE INDEX IF NOT EXISTS "idx_vendor_onboarding_drafts_status" ON "vendor_onboarding_drafts" ("onboarding_status");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_vendor_onboarding_drafts_promoted" ON "vendor_onboarding_drafts" ("promoted_vendor_id") WHERE "promoted_vendor_id" IS NOT NULL;

-- Step 3: Create vendor_onboarding_tokens for secure 24-hour invitation links
CREATE TABLE IF NOT EXISTS "vendor_onboarding_tokens" (
  "id" serial PRIMARY KEY,
  "draft_id" integer REFERENCES "vendor_onboarding_drafts"("id") ON DELETE CASCADE,
  "vendor_id" integer REFERENCES "vendors"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'active',
  "expires_at" timestamp NOT NULL,
  "last_accessed_at" timestamp,
  "submitted_at" timestamp,
  "revoked_at" timestamp,
  "revoked_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "ip_hash" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "chk_token_target" CHECK (("draft_id" IS NOT NULL AND "vendor_id" IS NULL) OR ("draft_id" IS NULL AND "vendor_id" IS NOT NULL)),
  CONSTRAINT "chk_token_status" CHECK ("status" IN ('active', 'submitted', 'used', 'revoked', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_vendor_onboarding_tokens_hash" ON "vendor_onboarding_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_vendor_onboarding_tokens_draft_id" ON "vendor_onboarding_tokens" ("draft_id");
CREATE INDEX IF NOT EXISTS "idx_vendor_onboarding_tokens_vendor_id" ON "vendor_onboarding_tokens" ("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_vendor_onboarding_tokens_expires" ON "vendor_onboarding_tokens" ("expires_at");
CREATE INDEX IF NOT EXISTS "idx_vendor_onboarding_tokens_status" ON "vendor_onboarding_tokens" ("status");

-- Step 4: Create vendor_upload_intents table for direct-to-R2 upload verification
CREATE TABLE IF NOT EXISTS "vendor_upload_intents" (
  "id" serial PRIMARY KEY,
  "invitation_id" integer NOT NULL REFERENCES "vendor_onboarding_tokens"("id") ON DELETE CASCADE,
  "draft_id" integer REFERENCES "vendor_onboarding_drafts"("id") ON DELETE CASCADE,
  "vendor_id" integer REFERENCES "vendors"("id") ON DELETE CASCADE,
  "object_key" text NOT NULL UNIQUE,
  "document_type" text NOT NULL,
  "file_name" text NOT NULL,
  "file_size" integer NOT NULL,
  "mime_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "chk_intent_target" CHECK (("draft_id" IS NOT NULL AND "vendor_id" IS NULL) OR ("draft_id" IS NULL AND "vendor_id" IS NOT NULL)),
  CONSTRAINT "chk_intent_status" CHECK ("status" IN ('pending', 'completed', 'failed', 'expired')),
  CONSTRAINT "chk_intent_file_size" CHECK ("file_size" > 0 AND "file_size" <= 10485760)
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_vendor_upload_intents_key" ON "vendor_upload_intents" ("object_key");
CREATE INDEX IF NOT EXISTS "idx_vendor_upload_intents_invitation" ON "vendor_upload_intents" ("invitation_id");
CREATE INDEX IF NOT EXISTS "idx_vendor_upload_intents_status" ON "vendor_upload_intents" ("status");

-- Step 5: Create vendor_change_requests for approved vendor staging modifications
CREATE TABLE IF NOT EXISTS "vendor_change_requests" (
  "id" serial PRIMARY KEY,
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "invitation_id" integer REFERENCES "vendor_onboarding_tokens"("id") ON DELETE SET NULL,
  "proposed_data" jsonb NOT NULL,
  "current_data_snapshot" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp,
  "review_notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "chk_change_req_status" CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS "idx_vendor_change_requests_vendor_id" ON "vendor_change_requests" ("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_vendor_change_requests_status" ON "vendor_change_requests" ("status");

-- Step 6: Create rate_limit_buckets for durable serverless rate limiting
CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "key" text PRIMARY KEY,
  "tokens" integer NOT NULL,
  "last_refill" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  CONSTRAINT "chk_rate_limit_tokens" CHECK ("tokens" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_rate_limit_buckets_expires" ON "rate_limit_buckets" ("expires_at");

-- Step 7: Update vendor_documents safely without classifying existing docs as pending
-- 7a. Add columns initially nullable
ALTER TABLE "vendor_documents"
  ADD COLUMN IF NOT EXISTS "draft_id" integer REFERENCES "vendor_onboarding_drafts"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "invitation_id" integer REFERENCES "vendor_onboarding_tokens"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "review_status" text,
  ADD COLUMN IF NOT EXISTS "review_notes" text,
  ADD COLUMN IF NOT EXISTS "uploaded_by_source" text,
  ADD COLUMN IF NOT EXISTS "superseded_by_id" integer REFERENCES "vendor_documents"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "original_doc_id" integer REFERENCES "vendor_documents"("id") ON DELETE SET NULL;

-- 7b. Explicitly backfill existing legacy documents as 'approved' and 'admin'
UPDATE "vendor_documents"
  SET "review_status" = 'approved'
  WHERE "review_status" IS NULL;

UPDATE "vendor_documents"
  SET "uploaded_by_source" = 'admin'
  WHERE "uploaded_by_source" IS NULL;

-- 7c. Apply final NOT NULL and default rules
ALTER TABLE "vendor_documents"
  ALTER COLUMN "review_status" SET DEFAULT 'approved',
  ALTER COLUMN "review_status" SET NOT NULL,
  ALTER COLUMN "uploaded_by_source" SET DEFAULT 'admin',
  ALTER COLUMN "uploaded_by_source" SET NOT NULL;

-- 7d. Add document integrity constraints and indexes
ALTER TABLE "vendor_documents"
  ADD CONSTRAINT "chk_doc_review_status" CHECK ("review_status" IN ('pending_review', 'approved', 'rejected', 'superseded')),
  ADD CONSTRAINT "chk_doc_uploaded_source" CHECK ("uploaded_by_source" IN ('admin', 'vendor_onboarding', 'system')),
  ADD CONSTRAINT "chk_doc_target" CHECK (("draft_id" IS NOT NULL AND "vendor_id" IS NULL) OR ("draft_id" IS NULL AND "vendor_id" IS NOT NULL));

-- 7e. Make vendor_id nullable for pre-promotion draft document staging
ALTER TABLE "vendor_documents" ALTER COLUMN "vendor_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_vendor_documents_draft_id" ON "vendor_documents" ("draft_id");
CREATE INDEX IF NOT EXISTS "idx_vendor_documents_review_status" ON "vendor_documents" ("review_status");

COMMIT;
