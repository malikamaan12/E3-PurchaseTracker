-- Enhanced PDF Settings Schema Migration
-- Adds new columns to the pdf_settings table to support advanced customization features

-- Add watermark_text column if not exists
ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS watermark_text TEXT DEFAULT 'CONFIDENTIAL';

-- Add font_family column if not exists
ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'helvetica';

-- Add logo_position column if not exists
ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS logo_position TEXT DEFAULT 'left';

-- Add company information columns if not exists
ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS company_address TEXT DEFAULT NULL;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS company_phone TEXT DEFAULT NULL;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS company_email TEXT DEFAULT NULL;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS company_website TEXT DEFAULT NULL;

-- Add section visibility control columns if not exists
ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_basic_info BOOLEAN DEFAULT TRUE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_requester_details BOOLEAN DEFAULT TRUE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_date_of_request BOOLEAN DEFAULT TRUE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_purpose_info BOOLEAN DEFAULT TRUE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_vendor_details BOOLEAN DEFAULT TRUE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_items BOOLEAN DEFAULT TRUE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_approvals BOOLEAN DEFAULT TRUE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_attachments BOOLEAN DEFAULT TRUE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_audit_info BOOLEAN DEFAULT FALSE;

ALTER TABLE pdf_settings
ADD COLUMN IF NOT EXISTS show_signatures BOOLEAN DEFAULT TRUE;

-- Check existing settings, create default if none exist
INSERT INTO pdf_settings (
  header_title, header_subtitle, header_color, footer_text, footer_color,
  page_numbering, watermark_opacity, watermark_text, template_config
)
SELECT 
  'Purchase Request', 'Events & Entertainment Enterprises', '#0070c0',
  '© 2025 - Confidential', '#333333', TRUE, 10, 'CONFIDENTIAL',
  '{"name":"Standard PR Template","type":"purchase_request","layout":"standard","showHeader":true,"showFooter":true,"showLogo":true,"showWatermark":true,"securityLevel":"internal","headerColor":[0,112,192],"accentColor":[79,70,229],"watermarkOpacity":0.1,"watermarkText":"CONFIDENTIAL","showApprovalFlow":true,"showSignatureLines":true,"showAttachments":true,"showTotalsTable":true,"customFields":{"showRequesterId":true,"showRequesterDepartment":true,"showPurposeType":true,"showSubmissionDate":true}}'
WHERE NOT EXISTS (SELECT 1 FROM pdf_settings LIMIT 1);