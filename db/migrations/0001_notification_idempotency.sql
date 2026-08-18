-- ============================================================================
-- MIGRATION: 0001_notification_idempotency.sql
-- PURPOSE: Deterministic database-level uniqueness index for notifications.
-- STATUS: PREPARED (Do NOT execute against production without explicit approval).
-- ============================================================================

-- Step 1: Add nullable idempotency_key column to notifications table for zero-downtime compatibility
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Step 2: Create deterministic unique index on idempotency_key
-- Applies across all notifications (read or unread) to guarantee atomic multi-worker deduplication.
-- PostgreSQL standard unique indexes treat NULLs as distinct, perfectly preserving all legacy rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key
ON notifications (idempotency_key);
