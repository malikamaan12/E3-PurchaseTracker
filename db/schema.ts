import { pgTable, text, serial, timestamp, integer, boolean, jsonb, index, numeric } from "drizzle-orm/pg-core";
import { relations, type InferModel, sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

//users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  contact_number: text("contact_number").notNull(),
  department: text("department").notNull(),
  assignedDepartments: jsonb("assigned_departments").$type<string[]>().default([]),
  role: text("role").notNull().default("user"),
  canManageVendors: boolean("can_manage_vendors").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").unique().notNull(),
  isApprover: boolean("is_approver").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

//accountRequests table
export const accountRequests = pgTable("account_requests", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  contact_number: text("contact_number").notNull(),
  department: text("department").notNull(),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

//notifications table with enhanced structure
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  requestId: integer("request_id").references(() => purchaseRequests.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  priority: text("priority").notNull().default('normal'), // 'high', 'normal', 'low'
  isRead: boolean("is_read").notNull().default(false),
  isAcknowledged: boolean("is_acknowledged").notNull().default(false),
  link: text("link"),
  idempotencyKey: text("idempotency_key"),
  actionType: text("action_type"), // Optional field for indicating action required
  actionData: jsonb("action_data").$type<Record<string, any>>(), // Optional data for action
  expiresAt: timestamp("expires_at"), // Optional expiration time
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userUnreadIdx: index("idx_notifications_user_unread").on(table.userId, table.isRead, table.createdAt),
  reqIdIdx: index("idx_notifications_request_id").on(table.requestId),
}));

export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  code: text("code"),
  severity: text("severity").notNull(),
  path: text("path"),
  userId: integer("user_id").references(() => users.id),
  details: text("details").$type<Record<string, unknown>>(),
  aiAnalysis: text("ai_analysis").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purpose Categories (e.g., CAPEX, OPEX, INTERNAL IT)
export const purposeCategories = pgTable("purpose_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("active"), // 'active', 'frozen'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sub-purposes table (Projects/Events) - Upgraded for Phase 6
export const subPurposes = pgTable("sub_purposes", {
  id: serial("id").primaryKey(),
  purposeCategoryId: integer("purpose_category_id").references(() => purposeCategories.id),
  name: text("name").notNull(),
  purposeType: text("purpose_type").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'frozen', 'closed'
  totalBudget: integer("total_budget").notNull().default(0),
  isFrozen: boolean("is_frozen").notNull().default(false),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Departmental Budget Allocations for Projects
export const subPurposeBudgets = pgTable("sub_purpose_budgets", {
  id: serial("id").primaryKey(),
  subPurposeId: integer("sub_purpose_id").notNull().references(() => subPurposes.id),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  allocatedAmount: integer("allocated_amount").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").unique().notNull(),
  requesterId: integer("requester_id").notNull().references(() => users.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  department: text("department"), // Stamped submitting department
  items: text("items").$type<Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
  }>>().notNull(),
  purposeType: text("purpose_type"),
  purposeCategoryId: integer("purpose_category_id").references(() => purposeCategories.id),
  subPurposeId: integer("sub_purpose_id").references(() => subPurposes.id),
  priority: text("priority").notNull().default("medium"),
  priorityScore: integer("priority_score"),
  priorityReason: text("priority_reason"),
  priorityRecommendations: text("priority_recommendations").$type<string[]>(),
  additionalApprovers: text("additional_approvers").$type<string[]>(), // Add additionalApprovers field
  currency: text("currency").notNull().default("QAR"),
  exchangeRate: numeric("exchange_rate"),
  baseAmountQar: integer("base_amount_qar"),
  totalEstimatedCost: integer("total_estimated_cost"),
  freightAmount: integer("freight_amount").default(0),
  revisedTotalCost: integer("revised_total_cost"), // Tracks budget variations [FORCE_REFRESH]
  proposedRevisedCost: integer("proposed_revised_cost"), // Staging field for variations awaiting approval
  status: text("status").notNull().default("draft"),
  paymentStructure: text("payment_structure").notNull().default("POST_PROJECT"), // 'ADVANCE', 'IN_PARTS', 'POST_PROJECT'
  isLocked: boolean("is_locked").notNull().default(false),
  mandatoryApproversCount: integer("mandatory_approvers_count").notNull().default(0),
  latestComplianceSnapshotId: integer("latest_compliance_snapshot_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusCreatedIdx: index("idx_purchase_requests_status_created").on(table.status, table.createdAt),
  requesterIdx: index("idx_purchase_requests_requester").on(table.requesterId),
  departmentIdx: index("idx_purchase_requests_department").on(table.department),
  vendorIdx: index("idx_purchase_requests_vendor").on(table.vendorId),
  subPurposeIdx: index("idx_purchase_requests_subpurpose").on(table.subPurposeId),
  requestNumberIdx: index("idx_purchase_requests_number").on(table.requestNumber),
}));

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => purchaseRequests.id, { onDelete: 'cascade' }),
  approverId: integer("approver_id").references(() => users.id),
  department: text("department").notNull(),
  status: text("status").notNull().default("pending"),
  comments: text("comments"),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  reqStatusIdx: index("idx_approvals_request_id_status").on(table.requestId, table.status),
  deptStatusIdx: index("idx_approvals_department_status").on(table.department, table.status),
  approverIdx: index("idx_approvals_approver").on(table.approverId),
}));

export const approvalAuditLogs = pgTable("approval_audit_logs", {
  id: serial("id").primaryKey(),
  approvalId: integer("approval_id").notNull().references(() => approvals.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  comments: text("comments"),
  metadata: jsonb("metadata").$type<{
    userAgent?: string;
    ipAddress?: string;
    department?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => purchaseRequests.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});


export const purchaseApprovers = pgTable("purchase_approvers", {
  id: serial("id").primaryKey(),
  departmentId: text("department").notNull(),
  approverId: integer("approver_id").notNull().references(() => users.id),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vendor Management Tables
export const vendorRulesetVersions = pgTable("vendor_ruleset_versions", {
  id: serial("id").primaryKey(),
  versionNumber: integer("version_number").notNull().unique(),
  status: text("status").notNull().default("draft"), // 'draft', 'published', 'archived'
  rulesSnapshot: jsonb("rules_snapshot").$type<Array<Record<string, any>>>().notNull().default([]),
  publishedBy: integer("published_by").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  changeSummary: text("change_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("idx_vendor_ruleset_versions_status").on(table.status),
}));

export const activeVendorRuleset = pgTable("active_vendor_ruleset", {
  id: integer("id").primaryKey().default(1),
  activeRulesetVersionId: integer("active_ruleset_version_id")
    .notNull()
    .references(() => vendorRulesetVersions.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
});


export const vendorRuleDefinitions = pgTable("vendor_rule_definitions", {
  id: serial("id").primaryKey(),
  ruleKey: text("rule_key").notNull().unique(), // 'cr_document', 'qid_document', 'tax_card', 'bank_details', etc.
  name: text("name").notNull(),
  section: text("section").notNull().default("legal"), // 'basic', 'legal', 'finance', 'document', 'contract', 'other'
  description: text("description"),
  instructions: text("instructions"),
  inputType: text("input_type").notNull().default("document"), // 'short_text', 'long_text', 'number', 'currency', 'date', 'email', 'mobile', 'dropdown', 'checkbox', 'document', 'field_and_document'
  dropdownOptions: jsonb("dropdown_options").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  isLocked: boolean("is_locked").notNull().default(false), // True for Company CR & Freelancer QID
  displayOrder: integer("display_order").notNull().default(0),

  // Company Configuration
  companyApplicable: boolean("company_applicable").notNull().default(true),
  companyMandatory: boolean("company_mandatory").notNull().default(false),
  companyCreatorCanChange: boolean("company_creator_can_change").notNull().default(false),
  companyAffectsScore: boolean("company_affects_score").notNull().default(true),
  companyInfoRequired: boolean("company_info_required").notNull().default(false),
  companyDocRequired: boolean("company_doc_required").notNull().default(true),

  // Freelancer Configuration
  freelancerApplicable: boolean("freelancer_applicable").notNull().default(false),
  freelancerMandatory: boolean("freelancer_mandatory").notNull().default(false),
  freelancerCreatorCanChange: boolean("freelancer_creator_can_change").notNull().default(false),
  freelancerAffectsScore: boolean("freelancer_affects_score").notNull().default(true),
  freelancerInfoRequired: boolean("freelancer_info_required").notNull().default(false),
  freelancerDocRequired: boolean("freelancer_doc_required").notNull().default(true),

  // Document & Verification Settings
  expiryRequired: boolean("expiry_required").notNull().default(false),
  verificationRequired: boolean("verification_required").notNull().default(true),
  verificationRole: text("verification_role").notNull().default("finance"), // 'finance', 'admin', 'super_admin'
  expiryWarningDays: integer("expiry_warning_days").notNull().default(30),
  acceptedFileFormats: jsonb("accepted_file_formats").$type<string[]>().default(["pdf", "jpg", "jpeg", "png"]),
  maxFileSizeMb: integer("max_file_size_mb").notNull().default(10),
  scoreWeight: integer("score_weight").notNull().default(10), // Bounded 1-100

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ruleKeyIdx: index("idx_vendor_rule_definitions_key").on(table.ruleKey),
  sectionIdx: index("idx_vendor_rule_definitions_section").on(table.section),
}));

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  contactNumber: text("contact_number").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  taxNumber: text("tax_number"),
  registrationNumber: text("registration_number"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ibanNumber: text("iban_number"),
  branchName: text("branch_name"),
  category: text("category").default("general"),
  payment_currency: text("payment_currency").notNull().default("QAR"),
  rating: integer("rating").default(0),
  vendorType: text("vendor_type").notNull().default("company"), // 'company' | 'freelancer' | 'contractor' | 'consultant' | 'service_provider'
  engagementType: text("engagement_type").notNull().default("permanent"), // 'temporary' | 'permanent'
  complianceStatus: text("compliance_status").notNull().default("legacy_pending_assessment"), // 'unassessed' | 'legacy_pending_assessment' | 'compliant' | 'expiring_soon' | 'non_compliant' | 'grace_period' | 'compliance_not_applicable'
  complianceScore: integer("compliance_score").notNull().default(0),
  complianceDeadline: timestamp("compliance_deadline", { withTimezone: true }),
  rulesetVersionId: integer("ruleset_version_id").references(() => vendorRulesetVersions.id, { onDelete: "set null" }),
  bankingVerificationStatus: text("banking_verification_status").notNull().default("unverified"), // 'unverified' | 'pending_stage1' | 'pending_stage2' | 'verified'
  requiresClassificationReview: boolean("requires_classification_review").notNull().default(false),
  creatorId: integer("creator_id").references(() => users.id, { onDelete: "set null" }),
  complianceMetadata: jsonb("compliance_metadata").$type<Record<string, any>>().default({}),
  gracePeriodDeadline: timestamp("grace_period_deadline", { withTimezone: true }),
  gracePeriodReason: text("grace_period_reason"),
  gracePeriodExtendedBy: integer("grace_period_extended_by").references(() => users.id),
  status: text("status").notNull().default("active"),
  onboardingStatus: text("onboarding_status").notNull().default("approved"),
  version: integer("version").notNull().default(1),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  engagementTypeIdx: index("idx_vendors_engagement_type").on(table.engagementType),
  complianceDeadlineIdx: index("idx_vendors_compliance_deadline").on(table.complianceDeadline),
}));

export const vendorAssignedRequirements = pgTable("vendor_assigned_requirements", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  ruleId: integer("rule_id").references(() => vendorRuleDefinitions.id, { onDelete: "set null" }),
  sourceRulesetVersionId: integer("source_ruleset_version_id").notNull().references(() => vendorRulesetVersions.id, { onDelete: "restrict" }),
  ruleKey: text("rule_key").notNull(),
  name: text("name").notNull(),
  section: text("section").notNull(),
  inputType: text("input_type").notNull(),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  isCustom: boolean("is_custom").notNull().default(false),
  affectsScore: boolean("affects_score").notNull().default(true),
  scoreWeight: integer("score_weight").notNull().default(10),
  infoRequired: boolean("info_required").notNull().default(false),
  docRequired: boolean("doc_required").notNull().default(false),
  expiryRequired: boolean("expiry_required").notNull().default(false),
  verificationRequired: boolean("verification_required").notNull().default(true),
  verificationRole: text("verification_role").notNull().default("finance"),
  acceptedFileFormats: jsonb("accepted_file_formats").$type<string[]>().default(["pdf", "jpg", "jpeg", "png"]),
  maxFileSizeMb: integer("max_file_size_mb").notNull().default(10),
  dropdownOptions: jsonb("dropdown_options").$type<string[]>().default([]),
  instructions: text("instructions"),
  displayOrder: integer("display_order").notNull().default(0),
  resolvedDueDate: timestamp("resolved_due_date", { withTimezone: true }).notNull(),

  // Multi-dimensional states
  submissionStatus: text("submission_status").notNull().default("missing"), // 'missing', 'draft', 'submitted', 'under_review', 'verified', 'rejected'
  validityStatus: text("validity_status").notNull().default("not_applicable"), // 'valid', 'expiring_soon', 'expired', 'not_applicable'
  deadlineStatus: text("deadline_status").notNull().default("due"), // 'due', 'overdue', 'completed_on_time', 'completed_late'

  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index("idx_assigned_reqs_vendor_id").on(table.vendorId),
  submissionStatusIdx: index("idx_assigned_reqs_submission_status").on(table.submissionStatus),
  validityStatusIdx: index("idx_assigned_reqs_validity_status").on(table.validityStatus),
  deadlineStatusIdx: index("idx_assigned_reqs_deadline_status").on(table.deadlineStatus),
}));

export const vendorRequirementSubmissions = pgTable("vendor_requirement_submissions", {
  id: serial("id").primaryKey(),
  assignedRequirementId: integer("assigned_requirement_id").notNull().references(() => vendorAssignedRequirements.id, { onDelete: "cascade" }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull().default(1),
  fieldValue: text("field_value"),
  documentIds: jsonb("document_ids").$type<number[]>().default([]),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  submissionNotes: text("submission_notes"),
  status: text("status").notNull().default("submitted"), // 'draft', 'submitted', 'verified', 'rejected', 'superseded'
  submittedByType: text("submitted_by_type").notNull().default("vendor"), // 'vendor', 'user'
  submittedById: integer("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),

  verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  verificationNotes: text("verification_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  assignedReqIdx: index("idx_req_submissions_assigned_id").on(table.assignedRequirementId),
  vendorIdIdx: index("idx_req_submissions_vendor_id").on(table.vendorId),
  statusIdx: index("idx_req_submissions_status").on(table.status),
}));

export const vendorBankingSubmissions = pgTable("vendor_banking_submissions", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  branchName: text("branch_name").notNull(),
  accountNumber: text("account_number").notNull(),
  ibanNumber: text("iban_number").notNull(),
  payment_currency: text("payment_currency").notNull().default("QAR"),
  bankLetterDocId: integer("bank_letter_doc_id"),
  status: text("status").notNull().default("pending_stage1"), // 'pending_stage1', 'pending_stage2', 'verified', 'rejected'

  stage1ReviewedBy: integer("stage1_reviewed_by").references(() => users.id, { onDelete: "set null" }),
  stage1ReviewedAt: timestamp("stage1_reviewed_at", { withTimezone: true }),
  stage1Notes: text("stage1_notes"),

  stage2ReviewedBy: integer("stage2_reviewed_by").references(() => users.id, { onDelete: "set null" }),
  stage2ReviewedAt: timestamp("stage2_reviewed_at", { withTimezone: true }),
  stage2Notes: text("stage2_notes"),

  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index("idx_banking_submissions_vendor_id").on(table.vendorId),
  statusIdx: index("idx_banking_submissions_status").on(table.status),
}));

export const purchaseRequestComplianceSnapshots = pgTable("purchase_request_compliance_snapshots", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull().default("submission"), // 'submission', 'resubmission', 'approval_step'
  complianceScore: integer("compliance_score").notNull(),
  complianceStatus: text("compliance_status").notNull(),
  vendorAgeDays: integer("vendor_age_days").notNull(),
  complianceDeadline: timestamp("compliance_deadline", { withTimezone: true }),
  isOverdue: boolean("is_overdue").notNull().default(false),
  overdueDays: integer("overdue_days").notNull().default(0),
  missingMandatoryKeys: jsonb("missing_mandatory_keys").$type<string[]>().notNull().default([]),
  expiredRequirementKeys: jsonb("expired_requirement_keys").$type<string[]>().notNull().default([]),
  rulesetVersionId: integer("ruleset_version_id").references(() => vendorRulesetVersions.id, { onDelete: "set null" }),
  rawSnapshotData: jsonb("raw_snapshot_data").$type<Record<string, any>>().notNull().default({}),
  triggeredBy: integer("triggered_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  requestIdIdx: index("idx_pr_snapshots_request_id").on(table.requestId),
  vendorIdIdx: index("idx_pr_snapshots_vendor_id").on(table.vendorId),
}));

export const vendorComplianceScoreHistory = pgTable("vendor_compliance_score_history", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  previousScore: integer("previous_score").notNull(),
  newScore: integer("new_score").notNull(),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  calculationBreakdown: jsonb("calculation_breakdown").$type<Record<string, any>>().notNull().default({}),
  triggeringEvent: text("triggering_event").notNull(), // 'INITIAL_CREATION', 'SUBMISSION_VERIFIED', 'SUBMISSION_REJECTED', 'DOCUMENT_EXPIRED', 'DEADLINE_PASSED', 'RULESET_REAPPLIED'
  rulesetVersionId: integer("ruleset_version_id").references(() => vendorRulesetVersions.id, { onDelete: "set null" }),
  recalculatedBy: integer("recalculated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index("idx_score_history_vendor_id").on(table.vendorId),
}));

export const vendorPortalEvents = pgTable("vendor_portal_events", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  tokenId: integer("token_id"),
  eventType: text("event_type").notNull(), // 'LINK_GENERATED', 'LINK_COPIED', 'LINK_SENT_EMAIL', 'PORTAL_OPENED', 'DRAFT_SAVED', 'PORTAL_SUBMITTED', 'REMINDER_SENT'
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorType: text("actor_type").notNull().default("user"), // 'user', 'vendor', 'system'
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index("idx_portal_events_vendor_id").on(table.vendorId),
}));

export const vendorComplianceCases = pgTable("vendor_compliance_cases", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  caseNumber: text("case_number").notNull().unique(),
  status: text("status").notNull().default("open"), // 'open' | 'under_review' | 'resolved_compliant' | 'expired_non_compliant' | 'closed_cancelled'
  reason: text("reason").notNull(), // 'annual_review' | 'document_expiry' | 'onboarding_assessment' | 'manual_audit' | 'banking_update'
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  requiredDocuments: jsonb("required_documents").$type<string[]>().notNull().default([]),
  allowedFields: jsonb("allowed_fields").$type<string[]>().notNull().default([]),
  instructions: text("instructions"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  openedBy: integer("opened_by").references(() => users.id, { onDelete: "restrict" }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedBy: integer("closed_by").references(() => users.id, { onDelete: "restrict" }),
  resolutionNotes: text("resolution_notes"),
  auditReference: text("audit_reference"),
  reminderCount: integer("reminder_count").notNull().default(0),
  lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index("idx_vendor_compliance_cases_vendor_id").on(table.vendorId),
  statusIdx: index("idx_vendor_compliance_cases_status").on(table.status),
  deadlineIdx: index("idx_vendor_compliance_cases_deadline").on(table.deadline),
}));

export const vendorComplianceOverrides = pgTable("vendor_compliance_overrides", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => purchaseRequests.id, { onDelete: "restrict" }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  caseId: integer("case_id").references(() => vendorComplianceCases.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected' | 'consumed' | 'revoked'
  justification: text("justification").notNull(),
  requestedBy: integer("requested_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  requestSnapshot: jsonb("request_snapshot").$type<Record<string, any>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  requestIdIdx: index("idx_vendor_compliance_overrides_request_id").on(table.requestId),
  vendorIdIdx: index("idx_vendor_compliance_overrides_vendor_id").on(table.vendorId),
  statusIdx: index("idx_vendor_compliance_overrides_status").on(table.status),
}));

export const vendorComplianceSettings = pgTable("vendor_compliance_settings", {
  id: serial("id").primaryKey(),
  isSingleton: boolean("is_singleton").notNull().default(true).unique(),
  defaultGraceDays: integer("default_grace_days").notNull().default(15),
  expirationWarningDays: integer("expiration_warning_days").notNull().default(30),
  companyChecklist: jsonb("company_checklist").$type<string[]>().notNull().default(["CR", "TAX_CARD", "ESTABLISHMENT_ID"]),
  freelancerChecklist: jsonb("freelancer_checklist").$type<string[]>().notNull().default([]),
  allowFreelancerCashExemption: boolean("allow_freelancer_cash_exemption").notNull().default(true),
  reminderThresholdDays: jsonb("reminder_threshold_days").$type<number[]>().notNull().default([30, 15, 7, 1]),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendorOnboardingDrafts = pgTable("vendor_onboarding_drafts", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  contactNumber: text("contact_number").notNull(),
  email: text("email").notNull(),
  address: text("address"),
  taxNumber: text("tax_number"),
  registrationNumber: text("registration_number"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ibanNumber: text("iban_number"),
  branchName: text("branch_name"),
  category: text("category").default("general"),
  payment_currency: text("payment_currency").notNull().default("QAR"),
  vendorType: text("vendor_type").notNull().default("company"),
  qidNumber: text("qid_number"),
  passportNumber: text("passport_number"),
  requiredDocumentTypes: jsonb("required_document_types").$type<Array<{
    type: string;
    mandatory: boolean;
    description?: string;
  }>>().default([]),
  onboardingStatus: text("onboarding_status").notNull().default("invited"),
  onboardingNotes: text("onboarding_notes"),
  submittedAt: timestamp("submitted_at"),
  promotedVendorId: integer("promoted_vendor_id").references(() => vendors.id),
  version: integer("version").notNull().default(1),
  // Compliance-scan claim fields — prevent duplicate concurrent scans
  approvalAttemptId: text("approval_attempt_id"),             // nullable UUID of the active claim
  approvalProcessingStartedAt: timestamp("approval_processing_started_at"), // when claim was taken
  approvalProcessingStatus: text("approval_processing_status"), // 'processing' | 'failed' | null
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vendorOnboardingTokens = pgTable("vendor_onboarding_tokens", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id").references(() => vendorOnboardingDrafts.id, { onDelete: 'cascade' }),
  vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: 'cascade' }),
  caseId: integer("case_id").references(() => vendorComplianceCases.id, { onDelete: 'set null' }),
  changeRequestId: integer("change_request_id").references((): any => vendorChangeRequests.id, { onDelete: 'set null' }),
  scope: text("scope").notNull().default("onboarding"), // 'onboarding' | 'compliance_case' | 'vendor_update'
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status").notNull().default("active"), // 'active', 'submitted', 'expired', 'revoked', 'used'
  expiresAt: timestamp("expires_at").notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  submittedAt: timestamp("submitted_at"),
  revokedAt: timestamp("revoked_at"),
  revokedBy: integer("revoked_by").references(() => users.id),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tokenHashIdx: index("idx_vendor_onboarding_tokens_hash").on(table.tokenHash),
  draftIdIdx: index("idx_vendor_onboarding_tokens_draft_id").on(table.draftId),
  vendorIdIdx: index("idx_vendor_onboarding_tokens_vendor_id").on(table.vendorId),
  caseIdIdx: index("idx_vendor_onboarding_tokens_case_id").on(table.caseId),
}));

export const vendorUploadIntents = pgTable("vendor_upload_intents", {
  id: serial("id").primaryKey(),
  invitationId: integer("invitation_id").notNull().references(() => vendorOnboardingTokens.id, { onDelete: 'cascade' }),
  draftId: integer("draft_id").references(() => vendorOnboardingDrafts.id, { onDelete: 'cascade' }),
  vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: 'cascade' }),
  caseId: integer("case_id").references(() => vendorComplianceCases.id, { onDelete: 'set null' }),
  objectKey: text("object_key").notNull().unique(),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'cancelled', 'expired'
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  objectKeyIdx: index("idx_vendor_upload_intents_key").on(table.objectKey),
  invitationIdIdx: index("idx_vendor_upload_intents_invitation").on(table.invitationId),
}));

export const vendorChangeRequests = pgTable("vendor_change_requests", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  invitationId: integer("invitation_id").references(() => vendorOnboardingTokens.id),
  caseId: integer("case_id").references(() => vendorComplianceCases.id, { onDelete: 'set null' }),
  changeType: text("change_type").notNull().default("GENERAL_UPDATE"), // 'GENERAL_UPDATE' | 'BANKING_DETAILS' | 'COMPLIANCE_RENEWAL'
  proposedData: jsonb("proposed_data").$type<Record<string, any>>().notNull(),
  currentDataSnapshot: jsonb("current_data_snapshot").$type<Record<string, any>>().notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'finance_approved', 'approved', 'rejected'
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  secondReviewedBy: integer("second_reviewed_by").references(() => users.id), // For elevated dual review (Super Admin)
  secondReviewedAt: timestamp("second_reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  vendorIdIdx: index("idx_vendor_change_requests_vendor_id").on(table.vendorId),
  statusIdx: index("idx_vendor_change_requests_status").on(table.status),
}));

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  tokens: integer("tokens").notNull(),
  lastRefill: text("last_refill").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  expiresAtIdx: index("idx_rate_limit_buckets_expires").on(table.expiresAt),
}));

export const vendorCategories = pgTable("vendor_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vendorToCategories = pgTable("vendor_to_categories", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  categoryId: integer("category_id").notNull().references(() => vendorCategories.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendorDocuments = pgTable("vendor_documents", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: 'cascade' }),
  draftId: integer("draft_id").references(() => vendorOnboardingDrafts.id, { onDelete: 'cascade' }),
  caseId: integer("case_id").references((): any => vendorComplianceCases.id, { onDelete: 'set null' }),
  invitationId: integer("invitation_id").references(() => vendorOnboardingTokens.id),
  documentType: text("document_type").notNull(),
  documentName: text("document_name").notNull(),
  fileUrl: text("file_url").notNull(),
  status: text("status").notNull().default("valid"), // 'valid', 'expired', 'superseded'
  reviewStatus: text("review_status").notNull().default("approved"), // 'pending_review', 'approved', 'rejected', 'superseded'
  reviewNotes: text("review_notes"),
  uploadedBySource: text("uploaded_by_source").notNull().default("admin"), // 'admin', 'vendor_onboarding', 'system'
  supersededById: integer("superseded_by_id").references((): any => vendorDocuments.id),
  originalDocId: integer("original_doc_id").references((): any => vendorDocuments.id),
  expiryDate: timestamp("expiry_date"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  draftIdIdx: index("idx_vendor_documents_draft_id").on(table.draftId),
  reviewStatusIdx: index("idx_vendor_documents_review_status").on(table.reviewStatus),
  caseIdIdx: index("idx_vendor_documents_case_id").on(table.caseId),
}));

export const vendorPerformance = pgTable("vendor_performance", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  requestId: integer("request_id").references(() => purchaseRequests.id, { onDelete: 'cascade' }),
  qualityScore: integer("quality_score").notNull(),
  deliveryScore: integer("delivery_score").notNull(),
  communicationScore: integer("communication_score").notNull(),
  costScore: integer("cost_score").notNull(),
  comments: text("comments"),
  reviewedBy: integer("reviewed_by").notNull().references(() => users.id),
  reviewedAt: timestamp("reviewed_at").defaultNow(),
});

export const paymentInstallments = pgTable("payment_installments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => purchaseRequests.id, { onDelete: 'cascade' }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  installmentName: text("installment_name").notNull(), // "1st Advance", "Delivery Milestone"
  dueDate: timestamp("due_date").notNull(),
  valueType: text("value_type").notNull().default("FIXED_AMOUNT"), // 'PERCENTAGE', 'FIXED_AMOUNT'
  amountValue: integer("amount_value").notNull(), // The actual % or $ value
  calculatedAmount: integer("calculated_amount").notNull(), // The exact QAR amount
  paidAmount: integer("paid_amount"), // The actual amount paid by Finance
  savingsAmount: integer("savings_amount"), // The negotiated discount/savings on this installment
  currency: text("currency").notNull().default("QAR"),
  exchangeRate: numeric("exchange_rate"),
  calculatedAmountQar: integer("calculated_amount_qar"), // The unified QAR equivalent
  status: text("status").notNull().default("pending"), // 'pending', 'paid', 'partial', 'rescheduled'
  paidAt: timestamp("paid_at"),
  actualPaymentDate: timestamp("actual_payment_date"),
  rescheduledDate: timestamp("rescheduled_date"),
  transactionReference: text("transaction_reference"),
  remarks: text("remarks"),
  financeNotes: text("finance_notes"),
  attachmentUrl: text("attachment_url"), // Receipt/invoice URL from R2 storage
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  reqStatusIdx: index("idx_payment_installments_req_status").on(table.requestId, table.status),
  vendorIdx: index("idx_payment_installments_vendor").on(table.vendorId),
}));

export const paymentVariations = pgTable("payment_variations", {
  id: serial("id").primaryKey(),
  installmentId: integer("installment_id").notNull().references(() => paymentInstallments.id, { onDelete: 'cascade' }),
  variationType: text("variation_type").notNull(), // 'EXCEEDED', 'REDUCED'
  amountDifference: integer("amount_difference").notNull(),
  reason: text("reason").notNull(),
  approvalStatus: text("approval_status").notNull().default("PENDING_FINANCE"), // 'PENDING_FINANCE', 'APPROVED', 'REJECTED'
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============= Relations =============
export const errorLogRelations = relations(errorLogs, ({ one }) => ({
  user: one(users, {
    fields: [errorLogs.userId],
    references: [users.id],
  }),
}));

export const userRelations = relations(users, ({ many }) => ({
  requestsCreated: many(purchaseRequests),
  approvalsGiven: many(approvals),
  notifications: many(notifications),
  notificationPreferences: many(notificationPreferences)
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  request: one(purchaseRequests, {
    fields: [notifications.requestId],
    references: [purchaseRequests.id],
  }),
}));

export const purchaseRequestRelations = relations(purchaseRequests, ({ one, many }) => ({
  requester: one(users, {
    fields: [purchaseRequests.requesterId],
    references: [users.id],
  }),
  approvals: many(approvals),
  subPurpose: one(subPurposes, {
    fields: [purchaseRequests.subPurposeId],
    references: [subPurposes.id],
  }),
  attachments: many(fileAttachments),
  vendor: one(vendors, {
    fields: [purchaseRequests.vendorId],
    references: [vendors.id],
  }),
  installments: many(paymentInstallments),
}));

export const purposeCategoryRelations = relations(purposeCategories, ({ many }) => ({
  subPurposes: many(subPurposes),
}));

export const subPurposeRelations = relations(subPurposes, ({ one, many }) => ({
  category: one(purposeCategories, {
    fields: [subPurposes.purposeCategoryId],
    references: [purposeCategories.id],
  }),
  budgets: many(subPurposeBudgets),
  requests: many(purchaseRequests),
}));

export const subPurposeBudgetRelations = relations(subPurposeBudgets, ({ one }) => ({
  subPurpose: one(subPurposes, {
    fields: [subPurposeBudgets.subPurposeId],
    references: [subPurposes.id],
  }),
  department: one(departments, {
    fields: [subPurposeBudgets.departmentId],
    references: [departments.id],
  }),
}));

export const approvalRelations = relations(approvals, ({ one, many }) => ({
  request: one(purchaseRequests, {
    fields: [approvals.requestId],
    references: [purchaseRequests.id],
  }),
  approver: one(users, {
    fields: [approvals.approverId],
    references: [users.id],
  }),
  auditLogs: many(approvalAuditLogs)
}));

export const approvalAuditLogRelations = relations(approvalAuditLogs, ({ one }) => ({
  approval: one(approvals, {
    fields: [approvalAuditLogs.approvalId],
    references: [approvals.id],
  }),
  user: one(users, {
    fields: [approvalAuditLogs.userId],
    references: [users.id],
  }),
}));


export const fileAttachmentRelations = relations(fileAttachments, ({ one }) => ({
  request: one(purchaseRequests, {
    fields: [fileAttachments.requestId],
    references: [purchaseRequests.id],
  }),
}));

// Relations
export const vendorRelations = relations(vendors, ({ one, many }) => ({
  categories: many(vendorToCategories),
  performance: many(vendorPerformance),
  installments: many(paymentInstallments),
  assignedRequirements: many(vendorAssignedRequirements),
  requirementSubmissions: many(vendorRequirementSubmissions),
  bankingSubmissions: many(vendorBankingSubmissions),
  scoreHistory: many(vendorComplianceScoreHistory),
  portalEvents: many(vendorPortalEvents),
  rulesetVersion: one(vendorRulesetVersions, {
    fields: [vendors.rulesetVersionId],
    references: [vendorRulesetVersions.id],
  }),
}));

export const vendorAssignedRequirementsRelations = relations(vendorAssignedRequirements, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [vendorAssignedRequirements.vendorId],
    references: [vendors.id],
  }),
  rule: one(vendorRuleDefinitions, {
    fields: [vendorAssignedRequirements.ruleId],
    references: [vendorRuleDefinitions.id],
  }),
  sourceRulesetVersion: one(vendorRulesetVersions, {
    fields: [vendorAssignedRequirements.sourceRulesetVersionId],
    references: [vendorRulesetVersions.id],
  }),
  submissions: many(vendorRequirementSubmissions),
}));

export const vendorRequirementSubmissionsRelations = relations(vendorRequirementSubmissions, ({ one }) => ({
  assignedRequirement: one(vendorAssignedRequirements, {
    fields: [vendorRequirementSubmissions.assignedRequirementId],
    references: [vendorAssignedRequirements.id],
  }),
  vendor: one(vendors, {
    fields: [vendorRequirementSubmissions.vendorId],
    references: [vendors.id],
  }),
  verifiedByUser: one(users, {
    fields: [vendorRequirementSubmissions.verifiedBy],
    references: [users.id],
  }),
}));

export const vendorBankingSubmissionsRelations = relations(vendorBankingSubmissions, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorBankingSubmissions.vendorId],
    references: [vendors.id],
  }),
  stage1User: one(users, {
    fields: [vendorBankingSubmissions.stage1ReviewedBy],
    references: [users.id],
  }),
  stage2User: one(users, {
    fields: [vendorBankingSubmissions.stage2ReviewedBy],
    references: [users.id],
  }),
}));

export const purchaseRequestComplianceSnapshotsRelations = relations(purchaseRequestComplianceSnapshots, ({ one }) => ({
  request: one(purchaseRequests, {
    fields: [purchaseRequestComplianceSnapshots.requestId],
    references: [purchaseRequests.id],
  }),
  vendor: one(vendors, {
    fields: [purchaseRequestComplianceSnapshots.vendorId],
    references: [vendors.id],
  }),
  rulesetVersion: one(vendorRulesetVersions, {
    fields: [purchaseRequestComplianceSnapshots.rulesetVersionId],
    references: [vendorRulesetVersions.id],
  }),
}));

export const vendorCategoryRelations = relations(vendorCategories, ({ many }) => ({
  vendors: many(vendorToCategories),
}));

export const vendorToCategoriesRelations = relations(vendorToCategories, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorToCategories.vendorId],
    references: [vendors.id],
  }),
  category: one(vendorCategories, {
    fields: [vendorToCategories.categoryId],
    references: [vendorCategories.id],
  }),
}));


// ============= Basic Type Definitions =============
export type User = InferModel<typeof users>;
export type SubPurpose = InferModel<typeof subPurposes>;
export type PurchaseRequest = InferModel<typeof purchaseRequests>;
export type Approval = InferModel<typeof approvals>;
export type FileAttachment = InferModel<typeof fileAttachments>;
export type NotificationType = InferModel<typeof notifications>;
export type AccountRequest = InferModel<typeof accountRequests>;
export type ErrorLog = InferModel<typeof errorLogs>;
export type InsertErrorLog = InferModel<typeof errorLogs, "insert">;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type InsertUser = InferModel<typeof users, "insert">;
export type SelectUser = InferModel<typeof users, "select">;
export type InsertNotification = InferModel<typeof notifications, "insert">;
export type SelectNotification = InferModel<typeof notifications, "select">;
export type PurchaseApprover = InferModel<typeof purchaseApprovers>;
export type PurposeCategory = InferModel<typeof purposeCategories>;
export type SubPurposeBudget = InferModel<typeof subPurposeBudgets>;
export type InsertSubPurpose = InferModel<typeof subPurposes, "insert">;
export type Vendor = InferModel<typeof vendors>;
export type InsertVendor = InferModel<typeof vendors, "insert">;
export type VendorCategory = InferModel<typeof vendorCategories>;
export type VendorOnboardingDraft = InferModel<typeof vendorOnboardingDrafts>;
export type InsertVendorOnboardingDraft = InferModel<typeof vendorOnboardingDrafts, "insert">;
export type VendorOnboardingToken = InferModel<typeof vendorOnboardingTokens>;
export type InsertVendorOnboardingToken = InferModel<typeof vendorOnboardingTokens, "insert">;
export type VendorUploadIntent = InferModel<typeof vendorUploadIntents>;
export type InsertVendorUploadIntent = InferModel<typeof vendorUploadIntents, "insert">;
export type VendorChangeRequest = InferModel<typeof vendorChangeRequests>;
export type InsertVendorChangeRequest = InferModel<typeof vendorChangeRequests, "insert">;
export type VendorComplianceCase = InferModel<typeof vendorComplianceCases>;
export type InsertVendorComplianceCase = InferModel<typeof vendorComplianceCases, "insert">;
export type VendorComplianceOverride = InferModel<typeof vendorComplianceOverrides>;
export type InsertVendorComplianceOverride = InferModel<typeof vendorComplianceOverrides, "insert">;
export type VendorComplianceSettings = InferModel<typeof vendorComplianceSettings>;
export type InsertVendorComplianceSettings = InferModel<typeof vendorComplianceSettings, "insert">;
export type RateLimitBucket = InferModel<typeof rateLimitBuckets>;
export type VendorDocument = InferModel<typeof vendorDocuments>;
export type InsertVendorDocument = InferModel<typeof vendorDocuments, "insert">;
export type PaymentInstallment = InferModel<typeof paymentInstallments>;
export type PaymentVariation = InferModel<typeof paymentVariations>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;
export type SelectDepartment = typeof departments.$inferSelect;

export type VendorRulesetVersion = InferModel<typeof vendorRulesetVersions>;
export type InsertVendorRulesetVersion = InferModel<typeof vendorRulesetVersions, "insert">;
export type ActiveVendorRuleset = InferModel<typeof activeVendorRuleset>;
export type InsertActiveVendorRuleset = InferModel<typeof activeVendorRuleset, "insert">;
export type VendorRuleDefinition = InferModel<typeof vendorRuleDefinitions>;
export type InsertVendorRuleDefinition = InferModel<typeof vendorRuleDefinitions, "insert">;
export type VendorAssignedRequirement = InferModel<typeof vendorAssignedRequirements>;
export type InsertVendorAssignedRequirement = InferModel<typeof vendorAssignedRequirements, "insert">;
export type VendorRequirementSubmission = InferModel<typeof vendorRequirementSubmissions>;
export type InsertVendorRequirementSubmission = InferModel<typeof vendorRequirementSubmissions, "insert">;
export type VendorBankingSubmission = InferModel<typeof vendorBankingSubmissions>;
export type InsertVendorBankingSubmission = InferModel<typeof vendorBankingSubmissions, "insert">;
export type PurchaseRequestComplianceSnapshot = InferModel<typeof purchaseRequestComplianceSnapshots>;
export type InsertPurchaseRequestComplianceSnapshot = InferModel<typeof purchaseRequestComplianceSnapshots, "insert">;
export type VendorComplianceScoreHistory = InferModel<typeof vendorComplianceScoreHistory>;
export type InsertVendorComplianceScoreHistory = InferModel<typeof vendorComplianceScoreHistory, "insert">;
export type VendorPortalEvent = InferModel<typeof vendorPortalEvents>;
export type InsertVendorPortalEvent = InferModel<typeof vendorPortalEvents, "insert">;

// Add PurchaseRequestWithRelations type
export type PurchaseRequestWithRelations = PurchaseRequest & {
  requester?: User;
  approvals?: (Approval & { approver?: User })[];
  subPurpose?: SubPurpose;
  attachments?: FileAttachment[];
  vendor?: Vendor;
  installments?: PaymentInstallment[];
};

// ============= Validation Schemas =============
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  contact_number: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  department: z.string().min(1, "Department is required"),
  role: z.enum(["user", "approver", "admin"]).default("user"),
  canManageVendors: z.boolean().default(false),
});

// PurposeCategory validation
export const insertPurposeCategorySchema = createInsertSchema(purposeCategories, {
  name: z.string().min(1, "Name is required"),
  status: z.enum(["active", "frozen"]).default("active"),
}).omit({ id: true, createdAt: true, updatedAt: true });

// SubPurpose validation schema (Projects/Events)
export const insertSubPurposeSchema = createInsertSchema(subPurposes, {
  name: z.string().min(1, "Name is required"),
  purposeCategoryId: z.number().optional().nullable(),
  purposeType: z.string().default("PROJECT"),
  status: z.enum(["active", "frozen", "closed"]).default("active"),
  totalBudget: z.number().min(0, "Total budget cannot be negative"),
  isFrozen: z.boolean().default(false),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// SubPurposeBudget validation
export const insertSubPurposeBudgetSchema = createInsertSchema(subPurposeBudgets, {
  subPurposeId: z.number().int().positive(),
  departmentId: z.number().int().positive(),
  allocatedAmount: z.number().min(0, "Allocated amount cannot be negative"),
});

export const insertAccountRequestSchema = createInsertSchema(accountRequests, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  contact_number: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  department: z.string().min(1, "Department is required"),
  role: z.enum(["user", "approver", "admin"]).default("user"),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

// Update PurchaseRequest schema to use the same purpose types
export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests, {
  title: z.string()
    .min(1, "Title is required")
    .max(100, "Title cannot exceed 100 characters")
    .optional(),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
  items: z.array(z.object({
    name: z.string()
      .min(1, "Item name is required")
      .max(100, "Item name cannot exceed 100 characters"),
    quantity: z.number()
      .positive("Quantity must be greater than 0")
      .multipleOf(0.01, "Quantity can have up to 2 decimal places")
      .max(999999.99, "Quantity is too large"),
    estimatedCost: z.number()
      .min(0, "Cost cannot be negative")
      .multipleOf(0.01, "Cost can have up to 2 decimal places")
      .max(999999999.99, "Cost is too large"),
    description: z.string()
      .max(200, "Item description cannot exceed 200 characters")
      .optional()
  })).optional().default([]),
  purposeType: z.enum(["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"], {
    required_error: "Purpose type is required",
    invalid_type_error: "Must be one of: E3 EVENT, PROJECT, MALL, BUSINESS GROWTH"
  }).optional(),
  vendorId: z.number().int().positive("Vendor selection is required").optional(),
  // Make subPurposeId conditionally required only for PROJECT type
  subPurposeId: z.number().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  currency: z.enum(["QAR", "USD", "EUR", "AED", "CNY"]).optional(),
  totalEstimatedCost: z.number()
    .multipleOf(0.01, "Total cost can have up to 2 decimal places")
    .min(0, "Total cost cannot be negative")
    .max(999999999.99, "Total cost is too large")
    .optional(),
  freightAmount: z.number()
    .multipleOf(0.01, "Freight amount can have up to 2 decimal places")
    .min(0, "Freight amount cannot be negative")
    .max(999999999.99, "Freight amount is too large")
    .optional()
    .default(0),
  status: z.enum(["draft", "pending", "approved", "rejected", "changes_requested"]).optional(),
  isLocked: z.boolean().optional(),
  mandatoryApproversCount: z.number().int().min(0).optional(),
  requestNumber: z.string().optional(),
  requesterId: z.number().optional(),
  priorityScore: z.number().optional(),
  priorityReason: z.string().optional(),
  priorityRecommendations: z.array(z.string()).optional(),
  additionalApprovers: z.array(z.string()).optional().default([]),
}).superRefine((data, ctx) => {
  // When validating a full purchase request (not a draft)
  if (data.status !== 'draft' && data.status !== undefined) {
    // Only require for PROJECT type
    if (data.purposeType === 'PROJECT' && !data.subPurposeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sub-purpose is required for PROJECT type",
        path: ["subPurposeId"]
      });
    }
  }
});

export const insertPurchaseApproverSchema = createInsertSchema(purchaseApprovers, {
  departmentId: z.string().min(1, "Department is required"),
  approverId: z.number().int().positive("Invalid approver ID"),
  isMandatory: z.boolean().default(false),
  level: z.number().int().min(1).max(5),
});

// Update the vendor schema validation
export const insertVendorSchema = createInsertSchema(vendors, {
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  contactPerson: z.string().min(2, "Contact person name must be at least 2 characters"),
  contactNumber: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  email: z.string().email("Invalid email format"),
  address: z.string().min(3, "Address must be at least 3 characters"),
  taxNumber: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ibanNumber: z.string().optional().nullable(),
  branchName: z.string().optional().nullable(),
  category: z.string().default("general"),
  payment_currency: z.enum(["QAR", "USD", "EUR", "AED", "CNY"]).default("QAR"),
  vendorType: z.enum(["company", "freelancer", "contractor", "consultant", "service_provider"]).default("company"),
  engagementType: z.enum(["temporary", "permanent"]).default("permanent"),
  remarks: z.string().optional().nullable(),
  status: z.enum(["active", "blocked", "frozen", "pending"]).default("active"),
});

// Universal quick vendor creation schema
export const vendorQuickCreateSchema = z.object({
  companyName: z.string().min(2, "Company / Freelancer name must be at least 2 characters"),
  contactPerson: z.string().min(2, "Contact person name must be at least 2 characters"),
  contactNumber: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  email: z.string().email("Invalid email format"),
  address: z.string().trim().min(3, "Address must be at least 3 characters"),
  vendorType: z.enum(["company", "freelancer", "contractor", "consultant", "service_provider"]).default("company"),
  engagementType: z.enum(["temporary", "permanent"]).default("permanent"),
  deadlineOption: z.enum(["7", "14", "30", "custom"]).default("30"),
  customDeadline: z.string().optional().nullable(),
  category: z.string().default("general"),
  payment_currency: z.enum(["QAR", "USD", "EUR", "AED", "CNY"]).default("QAR"),
  remarks: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.deadlineOption !== "custom") return;

  if (!data.customDeadline) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customDeadline"],
      message: "Custom compliance deadline is required",
    });
    return;
  }

  const customDeadline = new Date(data.customDeadline);
  if (Number.isNaN(customDeadline.getTime()) || customDeadline <= new Date()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customDeadline"],
      message: "Custom compliance deadline must be a future date",
    });
  }
});

// Admin minimal draft creation schema
export const vendorDraftCreationSchema = z.object({
  companyName: z.string().min(2, "Company / Freelancer name must be at least 2 characters"),
  contactPerson: z.string().min(2, "Contact person name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  contactNumber: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  vendorType: z.enum(["company", "freelancer", "contractor", "consultant", "service_provider"]).default("company"),
  category: z.string().default("general"),
  payment_currency: z.enum(["QAR", "USD", "EUR", "AED", "CNY"]).default("QAR"),
  requiredDocumentTypes: z.array(z.object({
    type: z.string().min(1),
    mandatory: z.boolean(),
    description: z.string().optional()
  })).default([
    { type: "Commercial Registration", mandatory: true, description: "Official CR document with valid expiry date" },
    { type: "Tax Certificate", mandatory: false, description: "Optional tax / VAT identification certificate" },
    { type: "Establishment Card", mandatory: false, description: "Computer card / Municipality license" }
  ]),
  notes: z.string().optional()
});

// Vendor partial save schema (all non-identity fields optional)
export const vendorSelfServiceSaveSchema = z.object({
  companyName: z.string().min(2).optional(),
  contactPerson: z.string().min(2).optional(),
  contactNumber: z.string().optional(),
  email: z.string().email().optional(),
  vendorType: z.enum(["company", "freelancer", "contractor", "consultant", "service_provider"]).optional(),
  address: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  branchName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ibanNumber: z.string().optional().nullable(),
  payment_currency: z.enum(["QAR", "USD", "EUR", "AED", "CNY"]).optional(),
  version: z.number().int().positive()
});

// Vendor final submission schema (strict validation on all mandatory items)
export const vendorSelfServiceSubmitSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  contactPerson: z.string().min(2, "Contact person name must be at least 2 characters"),
  contactNumber: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  email: z.string().email("Invalid email format"),
  address: z.string().min(5, "Headquarters address must be at least 5 characters"),
  taxNumber: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  bankName: z.string().min(2, "Bank name must be at least 2 characters"),
  branchName: z.string().min(2, "Branch name must be at least 2 characters"),
  accountNumber: z.string()
    .min(5, "Account number must be at least 5 characters")
    .regex(/^[\w\s\-\.\/]+$/, "Account number can only contain letters, numbers, spaces, hyphens, dots, and slashes"),
  ibanNumber: z.string()
    .min(10, "IBAN must be at least 10 characters")
    .regex(/^[A-Z0-9\s\-\.]+$/, "IBAN must contain only uppercase letters, numbers, spaces, dots, and slashes"),
  payment_currency: z.enum(["QAR", "USD", "EUR", "AED", "CNY"]).default("QAR"),
  version: z.number().int().positive()
});

// Use the same schema for form validation
export const vendorFormSchema = insertVendorSchema;

export const insertVendorCategorySchema = createInsertSchema(vendorCategories, {
  name: z.string().min(2, "Category name must be at least 2 characters"),
  description: z.string().optional(),
});

export const insertVendorPerformanceSchema = createInsertSchema(vendorPerformance, {
  qualityScore: z.number().min(1).max(5),
  deliveryScore: z.number().min(1).max(5),
  communicationScore: z.number().min(1).max(5),
  costScore: z.number().min(1).max(5),
  comments: z.string().optional(),
});

export const insertPaymentInstallmentSchema = createInsertSchema(paymentInstallments, {
  installmentName: z.string().min(1, "Installment name is required"),
  valueType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  amountValue: z.number().min(0),
  calculatedAmount: z.number().min(0),
  currency: z.enum(["QAR", "USD", "EUR", "AED", "CNY"]).default("QAR"),
  status: z.enum(["pending", "paid", "cancelled"]).default("pending"),
  dueDate: z.coerce.date(),
  transactionReference: z.string().optional(),
  remarks: z.string().optional(),
});

export const insertPaymentVariationSchema = createInsertSchema(paymentVariations, {
  variationType: z.enum(["EXCEEDED", "REDUCED"]),
  amountDifference: z.number(),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

// ============= Create Select Schemas =============
export const selectUserSchema = createSelectSchema(users);
export const selectAccountRequestSchema = createSelectSchema(accountRequests);
export const selectNotificationSchema = createSelectSchema(notifications);
export const selectPurchaseRequestSchema = createSelectSchema(purchaseRequests);
export const selectApprovalSchema = createSelectSchema(approvals);
export const selectFileAttachmentSchema = createSelectSchema(fileAttachments);
export const selectPurchaseApproverSchema = createSelectSchema(purchaseApprovers);

// Using createSelectSchema for error logs with proper typing
export const selectErrorLogSchema = createSelectSchema(errorLogs);

export const selectSubPurposeSchema = createSelectSchema(subPurposes);
export const selectVendorSchema = createSelectSchema(vendors);
export const selectVendorOnboardingDraftSchema = createSelectSchema(vendorOnboardingDrafts);
export const selectVendorOnboardingTokenSchema = createSelectSchema(vendorOnboardingTokens);
export const selectVendorUploadIntentSchema = createSelectSchema(vendorUploadIntents);
export const selectVendorChangeRequestSchema = createSelectSchema(vendorChangeRequests);
export const selectVendorCategorySchema = createSelectSchema(vendorCategories);
export const selectVendorPerformanceSchema = createSelectSchema(vendorPerformance);
export const selectPaymentInstallmentSchema = createSelectSchema(paymentInstallments);
export const selectPaymentVariationSchema = createSelectSchema(paymentVariations);
export const selectDepartmentSchema = createSelectSchema(departments);
export const insertDepartmentSchema = createInsertSchema(departments, {
  name: z.string().min(2, "Department name must be at least 2 characters"),
  isApprover: z.boolean().default(false),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// ============= Error log schemas =============
export const insertErrorLogSchema = z.object({
  message: z.string().min(1, "Message is required"),
  code: z.string().optional(),
  severity: z.enum(["critical", "error", "warning", "info"]),
  path: z.string().optional(),
  userId: z.number().optional(),
  details: z.record(z.unknown()).optional(),
  aiAnalysis: z.record(z.unknown()).optional(),
});

// ============= Notification System Settings =============
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  category: text("category").notNull(),
  type: text("type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add notification categories and types as constants
export const NOTIFICATION_CATEGORIES = {
  REQUESTS: 'requests',
  APPROVALS: 'approvals',
  SYSTEM: 'system',
  VENDORS: 'vendors',
  ACCOUNT: 'account'
} as const;

export const NOTIFICATION_TYPES = {
  // Request related
  NEW_REQUEST: 'new_request',
  REQUEST_STATUS_CHANGE: 'request_status_change',
  REQUEST_COMMENT: 'request_comment',
  REQUEST_MENTION: 'request_mention',

  // Approval related
  PENDING_APPROVAL: 'pending_approval',
  APPROVAL_GRANTED: 'approval_granted',
  APPROVAL_REJECTED: 'approval_rejected',

  // System related
  SYSTEM_MAINTENANCE: 'system_maintenance',
  SYSTEM_UPDATE: 'system_update',

  // Vendor related
  VENDOR_STATUS_CHANGE: 'vendor_status_change',
  VENDOR_PERFORMANCE_UPDATE: 'vendor_performance_update',

  // Account related
  ACCOUNT_STATUS_CHANGE: 'account_status_change',
  PASSWORD_CHANGE: 'password_change',
  ROLE_CHANGE: 'role_change'
} as const;

// Add types
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;
export type NotificationEventType = keyof typeof NOTIFICATION_TYPES;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// Fix the schema validation for notification preferences
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences, {
  category: z.enum([
    NOTIFICATION_CATEGORIES.REQUESTS,
    NOTIFICATION_CATEGORIES.APPROVALS,
    NOTIFICATION_CATEGORIES.SYSTEM,
    NOTIFICATION_CATEGORIES.VENDORS,
    NOTIFICATION_CATEGORIES.ACCOUNT
  ]),
  type: z.enum([
    NOTIFICATION_TYPES.NEW_REQUEST,
    NOTIFICATION_TYPES.REQUEST_STATUS_CHANGE,
    NOTIFICATION_TYPES.REQUEST_COMMENT,
    NOTIFICATION_TYPES.REQUEST_MENTION,
    NOTIFICATION_TYPES.PENDING_APPROVAL,
    NOTIFICATION_TYPES.APPROVAL_GRANTED,
    NOTIFICATION_TYPES.APPROVAL_REJECTED,
    NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
    NOTIFICATION_TYPES.SYSTEM_UPDATE,
    NOTIFICATION_TYPES.VENDOR_STATUS_CHANGE,
    NOTIFICATION_TYPES.VENDOR_PERFORMANCE_UPDATE,
    NOTIFICATION_TYPES.ACCOUNT_STATUS_CHANGE,
    NOTIFICATION_TYPES.PASSWORD_CHANGE,
    NOTIFICATION_TYPES.ROLE_CHANGE
  ]),
  enabled: z.boolean(),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean()
});

// Add relations
export const notificationPreferenceRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id]
  })
}));

export const paymentInstallmentRelations = relations(paymentInstallments, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [paymentInstallments.vendorId],
    references: [vendors.id]
  }),
  request: one(purchaseRequests, {
    fields: [paymentInstallments.requestId],
    references: [purchaseRequests.id]
  }),
  variations: many(paymentVariations),
}));

export const paymentVariationRelations = relations(paymentVariations, ({ one }) => ({
  installment: one(paymentInstallments, {
    fields: [paymentVariations.installmentId],
    references: [paymentInstallments.id]
  }),
  approver: one(users, {
    fields: [paymentVariations.approvedBy],
    references: [users.id]
  }),
}));

export const vendorPerformanceRelations = relations(vendorPerformance, ({one, many}) => ({
    vendor: one(vendors, {
        fields: [vendorPerformance.vendorId],
        references: [vendors.id]
    }),
    request: one(purchaseRequests, {
        fields: [vendorPerformance.requestId],
        references: [purchaseRequests.id]
    })
}))

// Update AuditAction type to include PDF operations
export type AuditAction = 'pdf_generated' | 'pdf_downloaded' | 'pdf_viewed' |
  'csv_downloaded' | 'excel_downloaded' | 'zip_downloaded' | 'pdf_analyzed';

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userid").references(() => users.id),
  action: text("action").notNull(),
  resourceId: integer("resourceid"),
  resourceType: text("resourcetype"),
  details: jsonb("details").$type<Record<string, any>>(),
  ipAddress: text("ipaddress"),
  userAgent: text("useragent"),
  timestamp: timestamp("timestamp").defaultNow()
}, (table) => {
  return {
    resourceIdIdx: index("audit_logs_resource_id_idx").on(table.resourceId),
    timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
  };
});

// Add pdfSettings table after the auditLogs table
export const pdfSettings = pgTable("pdf_settings", {
  id: serial("id").primaryKey(),
  headerTitle: text("header_title").notNull(),
  headerSubtitle: text("header_subtitle"),
  headerColor: text("header_color").notNull(),
  footerText: text("footer_text"),
  footerColor: text("footer_color").notNull(),
  pageNumbering: boolean("page_numbering").notNull().default(true),
  pageNumberPosition: text("page_number_position").default("bottom-right"),
  watermarkOpacity: integer("watermark_opacity").notNull().default(10),
  watermarkText: text("watermark_text").default("CONFIDENTIAL"),
  marginTop: integer("margin_top").notNull().default(20),
  marginBottom: integer("margin_bottom").notNull().default(20),
  marginLeft: integer("margin_left").notNull().default(25),
  marginRight: integer("margin_right").notNull().default(25),
  fontSize: integer("font_size").notNull().default(11),
  fontFamily: text("font_family").default("helvetica"),
  headerImage: text("header_image"),
  footerImage: text("footer_image"),
  logo: text("logo"),
  logoPosition: text("logo_position").default("left"),
  loginLogo: text("login_logo"),
  headerHeight: integer("header_height").notNull().default(100),
  footerHeight: integer("footer_height").notNull().default(50),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  companyWebsite: text("company_website"),
  showBasicInfo: boolean("show_basic_info").default(true),
  showRequesterDetails: boolean("show_requester_details").default(true),
  showDateOfRequest: boolean("show_date_of_request").default(true),
  showPurposeInfo: boolean("show_purpose_info").default(true),
  showVendorDetails: boolean("show_vendor_details").default(true),
  showItems: boolean("show_items").default(true),
  showApprovals: boolean("show_approvals").default(true),
  showAttachments: boolean("show_attachments").default(true),
  showAuditInfo: boolean("show_audit_info").default(false),
  showSignatures: boolean("show_signatures").default(true),
  templateConfig: text("template_config"), // Store template configuration as JSON
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add schema validation
export const insertPdfSettingsSchema = createInsertSchema(pdfSettings, {
  headerTitle: z.string().min(1, "Header title is required"),
  headerSubtitle: z.string().optional().nullable(),
  headerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  footerText: z.string().optional().nullable(),
  footerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  pageNumbering: z.boolean().default(true),
  pageNumberPosition: z.enum(["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]).optional().nullable().default("bottom-right"),
  watermarkOpacity: z.number().min(0).max(100).default(10),
  watermarkText: z.string().optional().nullable().default("CONFIDENTIAL"),
  marginTop: z.number().min(10).max(50).default(20),
  marginBottom: z.number().min(10).max(50).default(20),
  marginLeft: z.number().min(15).max(50).default(25),
  marginRight: z.number().min(15).max(50).default(25),
  fontSize: z.number().min(8).max(16).default(11),
  fontFamily: z.string().optional().nullable().default("helvetica"),
  headerImage: z.string().optional().nullable(),
  footerImage: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  logoPosition: z.enum(["left", "center", "right"]).optional().nullable().default("left"),
  loginLogo: z.string().optional().nullable(),
  headerHeight: z.number().min(20).max(200).default(100),
  footerHeight: z.number().min(20).max(200).default(50),
  companyAddress: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  companyEmail: z.string().optional().nullable(),
  companyWebsite: z.string().optional().nullable(),
  showBasicInfo: z.boolean().optional().nullable().default(true),
  showRequesterDetails: z.boolean().optional().nullable().default(true),
  showDateOfRequest: z.boolean().optional().nullable().default(true),
  showPurposeInfo: z.boolean().optional().nullable().default(true),
  showVendorDetails: z.boolean().optional().nullable().default(true),
  showItems: z.boolean().optional().nullable().default(true),
  showApprovals: z.boolean().optional().nullable().default(true),
  showAttachments: z.boolean().optional().nullable().default(true),
  showAuditInfo: z.boolean().optional().nullable().default(false),
  showSignatures: z.boolean().optional().nullable().default(true),
  templateConfig: z.string().optional().nullable(), // JSON string for template configuration
  userId: z.number().optional().nullable(),
});

// Add relations
export const pdfSettingsRelations = relations(pdfSettings, ({ one }) => ({
  user: one(users, {
    fields: [pdfSettings.userId],
    references: [users.id],
  }),
}));

// Add types
export type PdfSettings = typeof pdfSettings.$inferSelect;
export type InsertPdfSettings = typeof pdfSettings.$inferInsert;

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings);
export const selectSystemSettingSchema = createSelectSchema(systemSettings);
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

export const itemCatalog = pgTable("item_catalog", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  defaultCost: integer("default_cost").notNull().default(0),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ItemCatalog = typeof itemCatalog.$inferSelect;
