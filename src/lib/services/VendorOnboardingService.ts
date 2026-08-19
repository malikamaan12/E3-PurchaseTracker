import { transactionDb as db } from "@db";
import {
  vendors,
  vendorOnboardingDrafts,
  vendorOnboardingTokens,
  vendorDocuments,
  vendorUploadIntents,
  vendorChangeRequests,
  auditLogs,
  users,
  type Vendor,
  type VendorOnboardingDraft,
  type VendorOnboardingToken,
  insertVendorSchema,
  vendorSelfServiceSubmitSchema,
} from "@db/schema";
import { eq, and, or, sql, desc, ilike, inArray, not } from "drizzle-orm";
import crypto from "crypto";
import { ComplianceService } from "./ComplianceService";
import { notificationService } from "./NotificationService";

export class ConflictError extends Error {
  public statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  public statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends Error {
  public statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  public statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface DuplicateMatchResult {
  hasDuplicate: boolean;
  matches: Array<{
    id: number;
    name: string;
    email: string;
    contactNumber: string;
    type: "vendor" | "draft";
    matchedField: string;
    similarityScore: number;
  }>;
}

export class VendorOnboardingService {
  private static instance: VendorOnboardingService;

  private constructor() {}

  public static getInstance(): VendorOnboardingService {
    if (!VendorOnboardingService.instance) {
      VendorOnboardingService.instance = new VendorOnboardingService();
    }
    return VendorOnboardingService.instance;
  }

  /**
   * Normalizes company name by removing punctuation, extra spaces, and common legal suffixes
   */
  public normalizeCompanyName(name: string): string {
    if (!name) return "";
    return name
      .toLowerCase()
      .replace(/\b(w\.l\.l\.|s\.p\.c\.|l\.l\.c\.|p\.l\.c\.)\b/g, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
      .replace(
        /\b(llc|wll|ltd|limited|inc|incorporated|corp|corporation|co|company|spc|trading|contracting|est|establishment|services|group|qatar|w l l|s p c)\b/g,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Comprehensive duplicate check against both live vendors and pending drafts
   */
  public async checkDuplicates({
    companyName,
    email,
    contactNumber,
    taxNumber,
    registrationNumber,
    excludeDraftId,
    excludeVendorId,
  }: {
    companyName: string;
    email: string;
    contactNumber: string;
    taxNumber?: string | null;
    registrationNumber?: string | null;
    excludeDraftId?: number | null;
    excludeVendorId?: number | null;
  }): Promise<DuplicateMatchResult> {
    const matches: DuplicateMatchResult["matches"] = [];
    const normalizedTargetName = this.normalizeCompanyName(companyName);
    const cleanEmail = email.trim().toLowerCase();
    const cleanContact = contactNumber.replace(/\D/g, "");

    // 1. Search existing vendors
    const existingVendors = await db.select().from(vendors);
    for (const v of existingVendors) {
      if (excludeVendorId && v.id === excludeVendorId) continue;

      const normName = this.normalizeCompanyName(v.companyName);
      if (normName === normalizedTargetName && normName.length > 0) {
        matches.push({
          id: v.id,
          name: v.companyName,
          email: v.email,
          contactNumber: v.contactNumber,
          type: "vendor",
          matchedField: "Company Name",
          similarityScore: 100,
        });
        continue;
      }

      if (v.email.trim().toLowerCase() === cleanEmail) {
        matches.push({
          id: v.id,
          name: v.companyName,
          email: v.email,
          contactNumber: v.contactNumber,
          type: "vendor",
          matchedField: "Email Address",
          similarityScore: 95,
        });
        continue;
      }

      if (cleanContact.length >= 7 && v.contactNumber.replace(/\D/g, "") === cleanContact) {
        matches.push({
          id: v.id,
          name: v.companyName,
          email: v.email,
          contactNumber: v.contactNumber,
          type: "vendor",
          matchedField: "Contact Phone Number",
          similarityScore: 90,
        });
        continue;
      }

      if (taxNumber && v.taxNumber && v.taxNumber.trim() === taxNumber.trim()) {
        matches.push({
          id: v.id,
          name: v.companyName,
          email: v.email,
          contactNumber: v.contactNumber,
          type: "vendor",
          matchedField: "Tax Number (TIN)",
          similarityScore: 100,
        });
        continue;
      }

      if (registrationNumber && v.registrationNumber && v.registrationNumber.trim() === registrationNumber.trim()) {
        matches.push({
          id: v.id,
          name: v.companyName,
          email: v.email,
          contactNumber: v.contactNumber,
          type: "vendor",
          matchedField: "Commercial Registration (CR)",
          similarityScore: 100,
        });
        continue;
      }
    }

    // 2. Search onboarding drafts
    const existingDrafts = await db.select().from(vendorOnboardingDrafts);
    for (const d of existingDrafts) {
      if (excludeDraftId && d.id === excludeDraftId) continue;
      if (d.onboardingStatus === "approved" || d.onboardingStatus === "revoked") continue;

      const normName = this.normalizeCompanyName(d.companyName);
      if (normName === normalizedTargetName && normName.length > 0) {
        matches.push({
          id: d.id,
          name: d.companyName,
          email: d.email,
          contactNumber: d.contactNumber,
          type: "draft",
          matchedField: "Pending Draft Name",
          similarityScore: 95,
        });
        continue;
      }

      if (d.email.trim().toLowerCase() === cleanEmail) {
        matches.push({
          id: d.id,
          name: d.companyName,
          email: d.email,
          contactNumber: d.contactNumber,
          type: "draft",
          matchedField: "Pending Draft Email",
          similarityScore: 90,
        });
        continue;
      }
    }

    return {
      hasDuplicate: matches.length > 0,
      matches,
    };
  }

  /**
   * Hashes a raw bearer token with SHA-256
   */
  public hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  /**
   * Generates a 256-bit cryptographically secure bearer token
   */
  public generateRawToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Builds the secure invitation URL with client-side fragment token
   */
  public buildInvitationUrl(rawToken: string, baseUrl?: string): string {
    const origin = baseUrl?.replace(/\/+$/, "") || "http://localhost:3000";
    return `${origin}/vendor/onboard#token=${rawToken}`;
  }

  /**
   * Builds a prepared mailto link for sending the invitation
   */
  public buildMailtoUrl({
    email,
    companyName,
    invitationUrl,
    expiresAt,
  }: {
    email: string;
    companyName: string;
    invitationUrl: string;
    expiresAt: Date;
  }): string {
    const expiryStr = expiresAt.toUTCString();
    const subject = encodeURIComponent(`Action Required: Complete Vendor Onboarding Profile — E3 PurchaseTracker`);
    const body = encodeURIComponent(
      `Dear ${companyName} Team,\n\n` +
      `You have been invited to complete your vendor profile on the E3 PurchaseTracker platform.\n\n` +
      `Please use the secure link below to submit your company details, banking information, and required compliance documents:\n\n` +
      `${invitationUrl}\n\n` +
      `Important Notice:\n` +
      `• This link is valid for exactly 24 hours (Expires: ${expiryStr}).\n` +
      `• You can save and resume your progress at any time within this 24-hour window.\n` +
      `• Once you submit your profile, the link will be finalized.\n\n` +
      `Thank you,\nE3 Procurement & Finance Team`
    );

    return `mailto:${email}?subject=${subject}&body=${body}`;
  }

  /**
   * Creates a vendor onboarding draft and issues a 24-hour invitation link
   */
  public async createDraftAndInvitation({
    data,
    userId,
    baseUrl,
  }: {
    data: {
      companyName: string;
      contactPerson: string;
      email: string;
      contactNumber: string;
      category?: string;
      payment_currency?: string;
      requiredDocumentTypes?: Array<{ type: string; mandatory: boolean; description?: string }>;
      notes?: string;
    };
    userId: number;
    baseUrl?: string;
  }) {
    // 1. Check duplicate warning
    const duplicates = await this.checkDuplicates({
      companyName: data.companyName,
      email: data.email,
      contactNumber: data.contactNumber,
    });

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      // 2. Insert draft
      const [draft] = await tx
        .insert(vendorOnboardingDrafts)
        .values({
          companyName: data.companyName.trim(),
          contactPerson: data.contactPerson.trim(),
          email: data.email.trim().toLowerCase(),
          contactNumber: data.contactNumber.trim(),
          category: data.category || "general",
          payment_currency: data.payment_currency || "QAR",
          requiredDocumentTypes: data.requiredDocumentTypes || [
            { type: "Commercial Registration", mandatory: true, description: "Valid CR with expiry date" },
            { type: "Tax Certificate", mandatory: true, description: "Tax identification certificate" },
            { type: "Establishment Card", mandatory: false, description: "Computer card / Municipality license" },
          ],
          onboardingStatus: "link_active",
          onboardingNotes: data.notes || null,
          createdBy: userId,
          version: 1,
        })
        .returning();

      // 3. Insert 24-hour token
      const [tokenRecord] = await tx
        .insert(vendorOnboardingTokens)
        .values({
          draftId: draft.id,
          tokenHash,
          status: "active",
          expiresAt,
        })
        .returning();

      // 4. Record audit log
      await tx.insert(auditLogs).values({
        action: "VENDOR_ONBOARDING_INVITE_CREATED",
        resourceType: "vendor_onboarding_draft",
        resourceId: draft.id,
        userId,
        details: {
          companyName: draft.companyName,
          email: draft.email,
          expiresAt: expiresAt.toISOString(),
        },
      });

      return { draft, tokenRecord };
    });

    const invitationUrl = this.buildInvitationUrl(rawToken, baseUrl);
    const mailtoUrl = this.buildMailtoUrl({
      email: result.draft.email,
      companyName: result.draft.companyName,
      invitationUrl,
      expiresAt,
    });

    return {
      draft: result.draft,
      invitationId: result.tokenRecord.id,
      expiresAt: expiresAt.toISOString(),
      rawToken,
      invitationUrl,
      mailtoUrl,
      duplicates,
    };
  }

  /**
   * Regenerates a new 24-hour invitation link and revokes all previous active links
   */
  public async regenerateInvitation({
    draftId,
    vendorId,
    userId,
    baseUrl,
  }: {
    draftId?: number | null;
    vendorId?: number | null;
    userId: number;
    baseUrl?: string;
  }) {
    if (!draftId && !vendorId) {
      throw new ValidationError("Either draftId or vendorId is required.");
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      // 1. Revoke existing active tokens
      if (draftId) {
        await tx
          .update(vendorOnboardingTokens)
          .set({
            status: "revoked",
            revokedAt: new Date(),
            revokedBy: userId,
          })
          .where(and(eq(vendorOnboardingTokens.draftId, draftId), eq(vendorOnboardingTokens.status, "active")));

        await tx
          .update(vendorOnboardingDrafts)
          .set({ onboardingStatus: "link_active", updatedAt: new Date() })
          .where(eq(vendorOnboardingDrafts.id, draftId));
      } else if (vendorId) {
        await tx
          .update(vendorOnboardingTokens)
          .set({
            status: "revoked",
            revokedAt: new Date(),
            revokedBy: userId,
          })
          .where(and(eq(vendorOnboardingTokens.vendorId, vendorId), eq(vendorOnboardingTokens.status, "active")));
      }

      // 2. Insert new token
      const [newToken] = await tx
        .insert(vendorOnboardingTokens)
        .values({
          draftId: draftId || null,
          vendorId: vendorId || null,
          tokenHash,
          status: "active",
          expiresAt,
        })
        .returning();

      // 3. Audit log
      await tx.insert(auditLogs).values({
        action: "VENDOR_ONBOARDING_INVITE_REGENERATED",
        resourceType: draftId ? "vendor_onboarding_draft" : "vendor",
        resourceId: draftId || vendorId!,
        userId,
        details: {
          expiresAt: expiresAt.toISOString(),
        },
      });

      return newToken;
    });

    let email = "";
    let companyName = "";

    if (draftId) {
      const [draft] = await db.select().from(vendorOnboardingDrafts).where(eq(vendorOnboardingDrafts.id, draftId));
      if (draft) {
        email = draft.email;
        companyName = draft.companyName;
      }
    } else if (vendorId) {
      const [v] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
      if (v) {
        email = v.email;
        companyName = v.companyName;
      }
    }

    const invitationUrl = this.buildInvitationUrl(rawToken, baseUrl);
    const mailtoUrl = this.buildMailtoUrl({
      email,
      companyName,
      invitationUrl,
      expiresAt,
    });

    return {
      invitationId: result.id,
      expiresAt: expiresAt.toISOString(),
      rawToken,
      invitationUrl,
      mailtoUrl,
    };
  }

  /**
   * Revokes an active invitation link
   */
  public async revokeInvitation({
    draftId,
    vendorId,
    userId,
    reason,
  }: {
    draftId?: number | null;
    vendorId?: number | null;
    userId: number;
    reason?: string;
  }) {
    await db.transaction(async (tx) => {
      if (draftId) {
        await tx
          .update(vendorOnboardingTokens)
          .set({ status: "revoked", revokedAt: new Date(), revokedBy: userId })
          .where(and(eq(vendorOnboardingTokens.draftId, draftId), eq(vendorOnboardingTokens.status, "active")));

        await tx
          .update(vendorOnboardingDrafts)
          .set({ onboardingStatus: "revoked", onboardingNotes: reason || "Revoked by administrator", updatedAt: new Date() })
          .where(eq(vendorOnboardingDrafts.id, draftId));
      } else if (vendorId) {
        await tx
          .update(vendorOnboardingTokens)
          .set({ status: "revoked", revokedAt: new Date(), revokedBy: userId })
          .where(and(eq(vendorOnboardingTokens.vendorId, vendorId), eq(vendorOnboardingTokens.status, "active")));
      }

      await tx.insert(auditLogs).values({
        action: "VENDOR_ONBOARDING_INVITE_REVOKED",
        resourceType: draftId ? "vendor_onboarding_draft" : "vendor",
        resourceId: draftId || vendorId!,
        userId,
        details: { reason },
      });
    });

    return { success: true };
  }

  /**
   * Verifies raw token using constant-time hash comparison and checks expiration/status
   */
  public async verifyToken(rawToken: string) {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
      throw new UnauthorizedError("Invalid or missing invitation token.");
    }

    const calculatedHash = this.hashToken(rawToken);

    // Fetch token by hash
    const [tokenRecord] = await db
      .select()
      .from(vendorOnboardingTokens)
      .where(eq(vendorOnboardingTokens.tokenHash, calculatedHash))
      .limit(1);

    if (!tokenRecord) {
      throw new UnauthorizedError("Invitation not found or invalid link.");
    }

    // Timing-safe comparison
    const recordHashBuffer = Buffer.from(tokenRecord.tokenHash, "hex");
    const calculatedHashBuffer = Buffer.from(calculatedHash, "hex");
    if (
      recordHashBuffer.length !== calculatedHashBuffer.length ||
      !crypto.timingSafeEqual(recordHashBuffer, calculatedHashBuffer)
    ) {
      throw new UnauthorizedError("Security verification failed.");
    }

    // Check status
    if (tokenRecord.status === "revoked") {
      throw new UnauthorizedError("This invitation link has been revoked by an administrator.");
    }

    if (tokenRecord.status === "used") {
      throw new UnauthorizedError("This invitation link has already been completed and approved.");
    }

    // Check expiration (strict 24-hour boundary)
    const now = new Date();
    if (now > new Date(tokenRecord.expiresAt)) {
      // Mark token expired if not already
      if (tokenRecord.status === "active") {
        await db
          .update(vendorOnboardingTokens)
          .set({ status: "expired" })
          .where(eq(vendorOnboardingTokens.id, tokenRecord.id));

        if (tokenRecord.draftId) {
          await db
            .update(vendorOnboardingDrafts)
            .set({ onboardingStatus: "expired" })
            .where(and(eq(vendorOnboardingDrafts.id, tokenRecord.draftId), eq(vendorOnboardingDrafts.onboardingStatus, "link_active")));
        }
      }
      throw new UnauthorizedError("This invitation link expired after 24 hours. Please request a new link.");
    }

    // Fetch associated draft or vendor
    let draft: VendorOnboardingDraft | null = null;
    let vendor: Vendor | null = null;

    if (tokenRecord.draftId) {
      const [d] = await db
        .select()
        .from(vendorOnboardingDrafts)
        .where(eq(vendorOnboardingDrafts.id, tokenRecord.draftId))
        .limit(1);
      draft = d || null;
    }

    if (tokenRecord.vendorId) {
      const [v] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, tokenRecord.vendorId))
        .limit(1);
      vendor = v || null;
    }

    // Update lastAccessedAt
    await db
      .update(vendorOnboardingTokens)
      .set({ lastAccessedAt: new Date() })
      .where(eq(vendorOnboardingTokens.id, tokenRecord.id));

    const remainingSeconds = Math.max(0, Math.floor((new Date(tokenRecord.expiresAt).getTime() - now.getTime()) / 1000));

    return {
      tokenRecord,
      draft,
      vendor,
      remainingSeconds,
      isReadOnly: tokenRecord.status === "submitted",
    };
  }

  /**
   * Saves partial draft progress with Optimistic Concurrency Control
   */
  public async saveDraftProgress({
    draftId,
    invitationId,
    data,
    currentVersion,
  }: {
    draftId: number;
    invitationId: number;
    data: Record<string, any>;
    currentVersion: number;
  }) {
    const [draft] = await db
      .select()
      .from(vendorOnboardingDrafts)
      .where(eq(vendorOnboardingDrafts.id, draftId))
      .limit(1);

    if (!draft) {
      throw new NotFoundError("Draft not found.");
    }

    if (draft.onboardingStatus === "submitted" || draft.onboardingStatus === "approved") {
      throw new ValidationError("Submitted or approved profiles cannot be edited.");
    }

    // OCC Check
    if (draft.version !== currentVersion) {
      throw new ConflictError("Your session is out of date. Another update occurred. Please refresh and try again.");
    }

    const nextVersion = draft.version + 1;
    const nextStatus = draft.onboardingStatus === "link_active" ? "in_progress" : draft.onboardingStatus;

    const [updatedDraft] = await db
      .update(vendorOnboardingDrafts)
      .set({
        companyName: data.companyName ? data.companyName.trim() : draft.companyName,
        contactPerson: data.contactPerson ? data.contactPerson.trim() : draft.contactPerson,
        email: data.email ? data.email.trim().toLowerCase() : draft.email,
        contactNumber: data.contactNumber ? data.contactNumber.trim() : draft.contactNumber,
        address: data.address !== undefined ? data.address : draft.address,
        taxNumber: data.taxNumber !== undefined ? data.taxNumber : draft.taxNumber,
        registrationNumber: data.registrationNumber !== undefined ? data.registrationNumber : draft.registrationNumber,
        bankName: data.bankName !== undefined ? data.bankName : draft.bankName,
        branchName: data.branchName !== undefined ? data.branchName : draft.branchName,
        accountNumber: data.accountNumber !== undefined ? data.accountNumber : draft.accountNumber,
        ibanNumber: data.ibanNumber !== undefined ? data.ibanNumber : draft.ibanNumber,
        payment_currency: data.payment_currency || draft.payment_currency,
        onboardingStatus: nextStatus,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(and(eq(vendorOnboardingDrafts.id, draftId), eq(vendorOnboardingDrafts.version, currentVersion)))
      .returning();

    if (!updatedDraft) {
      throw new ConflictError("Conflict detected during save. Please refresh and retry.");
    }

    return updatedDraft;
  }

  /**
   * Finalizes profile submission, validates mandatory documents, and locks the invitation
   */
  public async submitVendorProfile({
    draftId,
    invitationId,
    data,
    currentVersion,
  }: {
    draftId: number;
    invitationId: number;
    data: Record<string, any>;
    currentVersion: number;
  }) {
    // 1. Strict schema validation
    const parsedData = vendorSelfServiceSubmitSchema.safeParse(data);
    if (!parsedData.success) {
      const errorMsg = parsedData.error.issues.map((i) => i.message).join(", ");
      throw new ValidationError(`Validation failed: ${errorMsg}`);
    }

    // 2. Atomically lock draft, revalidate, clean expired intents, verify mandatory docs, and submit
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      // 2a. Acquire exclusive row lock on draft
      const [lockedDraft] = await tx
        .select()
        .from(vendorOnboardingDrafts)
        .where(eq(vendorOnboardingDrafts.id, draftId))
        .for("update");

      if (!lockedDraft) {
        throw new NotFoundError("Draft profile not found.");
      }

      if (lockedDraft.onboardingStatus === "submitted" || lockedDraft.onboardingStatus === "approved") {
        // Idempotent return if already submitted
        return { success: true, alreadySubmitted: true, draft: lockedDraft };
      }

      if (lockedDraft.version !== currentVersion) {
        throw new ConflictError("Draft version mismatch. Please reload and submit.");
      }

      // 2b. Safely mark any expired pending intents as expired (do not block submission)
      await tx
        .update(vendorUploadIntents)
        .set({ status: "expired" })
        .where(
          and(
            eq(vendorUploadIntents.invitationId, invitationId),
            eq(vendorUploadIntents.status, "pending"),
            sql`${vendorUploadIntents.expiresAt} <= now()`
          )
        );

      // 2c. Block submission if any active unexpired upload intents exist
      const activePendingIntents = await tx
        .select({ id: vendorUploadIntents.id })
        .from(vendorUploadIntents)
        .where(
          and(
            eq(vendorUploadIntents.invitationId, invitationId),
            eq(vendorUploadIntents.status, "pending"),
            sql`${vendorUploadIntents.expiresAt} > now()`
          )
        );

      if (activePendingIntents.length > 0) {
        throw new ValidationError(
          "One or more documents are still uploading. Please wait for all uploads to complete before submitting."
        );
      }

      // 2d. Verify mandatory documents under lock
      const uploadedDocs = await tx
        .select()
        .from(vendorDocuments)
        .where(eq(vendorDocuments.draftId, draftId));

      const requiredTypes = lockedDraft.requiredDocumentTypes || [];
      for (const req of requiredTypes) {
        if (req.mandatory) {
          const hasDoc = uploadedDocs.some(
            (d) => d.documentType.toLowerCase().trim() === req.type.toLowerCase().trim()
          );
          if (!hasDoc) {
            throw new ValidationError(
              `Mandatory document "${req.type}" is missing. Please upload all required compliance documents before submitting.`
            );
          }
        }
      }

      // 2e. Update draft to submitted and advance version
      const [submittedDraft] = await tx
        .update(vendorOnboardingDrafts)
        .set({
          ...parsedData.data,
          onboardingStatus: "submitted",
          submittedAt: now,
          version: lockedDraft.version + 1,
          updatedAt: now,
        })
        .where(eq(vendorOnboardingDrafts.id, draftId))
        .returning();

      // 2f. Lock token record as submitted
      await tx
        .update(vendorOnboardingTokens)
        .set({
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(vendorOnboardingTokens.id, invitationId));

      return { success: true, draft: submittedDraft };
    });

    // 5. Trigger admin notification
    try {
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.role, "admin"), eq(users.role, "super_admin")));

      for (const admin of adminUsers) {
        await notificationService.createNotification({
          userId: admin.id,
          title: "New Vendor Profile Submitted",
          message: `${result.draft.companyName} has completed their self-service onboarding profile. Ready for compliance review.`,
          type: "vendor_created",
          priority: "high",
          actionType: "review",
          actionData: { draftId },
        });
      }
    } catch (err) {
      console.error("[VendorOnboardingService] Failed to dispatch admin notification:", err);
    }

    return result;
  }

  /**
   * Request corrections from the vendor and issue a new 24-hour invitation link
   */
  public async requestChanges({
    draftId,
    userId,
    notes,
    baseUrl,
  }: {
    draftId: number;
    userId: number;
    notes: string;
    baseUrl?: string;
  }) {
    if (!notes || notes.trim().length < 5) {
      throw new ValidationError("Please provide clear instructions on the changes required.");
    }

    const [draft] = await db
      .select()
      .from(vendorOnboardingDrafts)
      .where(eq(vendorOnboardingDrafts.id, draftId))
      .limit(1);

    if (!draft) {
      throw new NotFoundError("Draft not found.");
    }

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      // Revoke all usable tokens for this draft before issuing a replacement.
      // Explicit allowlist: 'active' (unused links) and 'submitted' (vendor submitted
      // but admin is requesting re-submission). 'revoked' and 'used' are not touched.
      await tx
        .update(vendorOnboardingTokens)
        .set({ status: "revoked", revokedAt: new Date(), revokedBy: userId })
        .where(
          and(
            eq(vendorOnboardingTokens.draftId, draftId),
            inArray(vendorOnboardingTokens.status, ["active", "submitted"])
          )
        );

      // Create new active token
      await tx.insert(vendorOnboardingTokens).values({
        draftId,
        tokenHash,
        status: "active",
        expiresAt,
      });

      // Update draft status
      await tx
        .update(vendorOnboardingDrafts)
        .set({
          onboardingStatus: "changes_requested",
          onboardingNotes: notes.trim(),
          updatedAt: new Date(),
        })
        .where(eq(vendorOnboardingDrafts.id, draftId));

      // Audit log
      await tx.insert(auditLogs).values({
        action: "VENDOR_ONBOARDING_CHANGES_REQUESTED",
        resourceType: "vendor_onboarding_draft",
        resourceId: draftId,
        userId,
        details: { notes },
      });
    });

    const invitationUrl = this.buildInvitationUrl(rawToken, baseUrl);
    const mailtoUrl = this.buildMailtoUrl({
      email: draft.email,
      companyName: draft.companyName,
      invitationUrl,
      expiresAt,
    });

    return {
      success: true,
      invitationUrl,
      mailtoUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Approves a submitted draft, validates compliance, and promotes it to the official vendors table
   */
  async approveAndPromoteDraft({
    draftId,
    userId,
    forceStaleRetry = false,
  }: {
    draftId: number;
    userId: number;
    forceStaleRetry?: boolean;
  }) {
    // ── APPROVAL CLAIM TIMEOUT ─────────────────────────────────────────────────
    const CLAIM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

    // Stage 1: Authoritative Atomic Lock, Compliance Claim & Vendor Staging
    // All reads and writes inside this transaction operate under SELECT ... FOR UPDATE.
    const stageResult = await db.transaction(async (tx) => {
      // 1. Acquire exclusive row lock on the draft to serialize all concurrent approvals
      const [lockedDraft] = await tx
        .select()
        .from(vendorOnboardingDrafts)
        .where(eq(vendorOnboardingDrafts.id, draftId))
        .for("update");

      if (!lockedDraft) {
        throw new NotFoundError("Draft not found.");
      }

      // Idempotent retry: if draft is already approved and vendor is active, return immediately
      if (lockedDraft.onboardingStatus === "approved" && lockedDraft.promotedVendorId) {
        const [activeV] = await tx
          .select()
          .from(vendors)
          .where(eq(vendors.id, lockedDraft.promotedVendorId))
          .limit(1);
        if (activeV && activeV.status === "active") {
          return { vendor: activeV, scanClaimed: false, attemptId: null, reason: "already_approved" };
        }
      }

      // 2. Approval-state guard: only submitted drafts may be approved
      if (lockedDraft.onboardingStatus !== "submitted") {
        throw new ValidationError(
          `Cannot approve draft in status "${lockedDraft.onboardingStatus}". Only submitted drafts can be approved.`
        );
      }

      // 3. Compliance-scan claim check (prevents duplicate concurrent scans)
      const now = new Date();
      const existingStatus = lockedDraft.approvalProcessingStatus;
      const existingStart = lockedDraft.approvalProcessingStartedAt;
      const isProcessing = existingStatus === "processing";

      if (isProcessing) {
        const elapsed = existingStart ? now.getTime() - new Date(existingStart).getTime() : 0;
        const isStale = elapsed >= CLAIM_TIMEOUT_MS;

        if (!forceStaleRetry) {
          // Ordinary approvals NEVER silently overwrite an active or stale processing claim
          const [existingVendor] = lockedDraft.promotedVendorId
            ? await tx.select().from(vendors).where(eq(vendors.id, lockedDraft.promotedVendorId)).limit(1)
            : [null];
          return {
            vendor: existingVendor ?? null,
            scanClaimed: false,
            attemptId: null,
            reason: isStale ? "approval_processing_stale" : "approval_already_processing",
            isStale,
          };
        }

        // Explicit forceStaleRetry: enforce that the claim has genuinely exceeded the timeout
        if (!isStale) {
          throw new ValidationError(
            `Approval attempt is currently actively processing (${Math.round((CLAIM_TIMEOUT_MS - elapsed) / 1000)}s remaining). Force retry is only permitted for stale attempts exceeding 10 minutes.`
          );
        }

        // Audit log for the explicit authenticated stale retry
        await tx.insert(auditLogs).values({
          action: "VENDOR_ONBOARDING_STALE_APPROVAL_RETRIED",
          resourceType: "vendor_onboarding_draft",
          resourceId: draftId,
          userId,
          details: {
            previousAttemptId: lockedDraft.approvalAttemptId,
            staleStartedAt: lockedDraft.approvalProcessingStartedAt,
            elapsedMs: elapsed,
          },
        });
      }

      // 4. Claim the compliance scan slot (for idle/failed drafts or authorized stale retries)
      const newAttemptId = crypto.randomUUID();
      await tx
        .update(vendorOnboardingDrafts)
        .set({
          approvalAttemptId: newAttemptId,
          approvalProcessingStartedAt: now,
          approvalProcessingStatus: "processing",
          updatedAt: now,
        })
        .where(eq(vendorOnboardingDrafts.id, draftId));

      // 5. Verify mandatory document checklist under lock
      const requiredTypes = (lockedDraft.requiredDocumentTypes as Array<{ type: string; mandatory: boolean }>) || [];
      const mandatoryTypes = requiredTypes.filter((t) => t.mandatory).map((t) => t.type.toLowerCase().trim());

      if (mandatoryTypes.length > 0) {
        const uploadedDocs = await tx
          .select()
          .from(vendorDocuments)
          .where(and(eq(vendorDocuments.draftId, draftId), eq(vendorDocuments.status, "valid")));

        const uploadedTypeSet = new Set(uploadedDocs.map((d) => d.documentType.toLowerCase().trim()));
        const missingTypes = mandatoryTypes.filter((reqType) => !uploadedTypeSet.has(reqType));

        if (missingTypes.length > 0) {
          // Release claim before throwing so admin can retry after uploading missing docs
          await tx
            .update(vendorOnboardingDrafts)
            .set({ approvalAttemptId: null, approvalProcessingStartedAt: null, approvalProcessingStatus: null, updatedAt: now })
            .where(eq(vendorOnboardingDrafts.id, draftId));
          throw new ValidationError(`Cannot approve vendor: Missing mandatory documents (${missingTypes.join(", ")}).`);
        }
      }

      // 6. Build strict allowlist EXCLUSIVELY from lockedDraft (post-lock, post-claim)
      // Rejects all client-controlled operational fields
      const allowlistedVendorFields = {
        companyName: lockedDraft.companyName,
        contactPerson: lockedDraft.contactPerson,
        contactNumber: lockedDraft.contactNumber,
        email: lockedDraft.email,
        address: lockedDraft.address || "",
        taxNumber: lockedDraft.taxNumber || null,
        registrationNumber: lockedDraft.registrationNumber || null,
        bankName: lockedDraft.bankName || "",
        branchName: lockedDraft.branchName || "",
        accountNumber: lockedDraft.accountNumber || "",
        ibanNumber: lockedDraft.ibanNumber || "",
        category: lockedDraft.category || "general",
        payment_currency: (lockedDraft.payment_currency as any) || "QAR",
        onboardingStatus: "pending",
        remarks: lockedDraft.onboardingNotes || "Approved via vendor self-service onboarding",
      };

      const parsed = insertVendorSchema.safeParse({
        ...allowlistedVendorFields,
        status: "pending",
      });
      if (!parsed.success) {
        const err = parsed.error.issues.map((i) => i.message).join(", ");
        await tx
          .update(vendorOnboardingDrafts)
          .set({ approvalAttemptId: null, approvalProcessingStartedAt: null, approvalProcessingStatus: null, updatedAt: now })
          .where(eq(vendorOnboardingDrafts.id, draftId));
        throw new ValidationError(`Cannot approve vendor due to incomplete data: ${err}`);
      }

      let vRecord: any;

      if (lockedDraft.promotedVendorId) {
        // Reuse existing pending vendor on retry (under lock)
        const [existing] = await tx
          .select()
          .from(vendors)
          .where(eq(vendors.id, lockedDraft.promotedVendorId))
          .for("update");

        if (existing) {
          if (existing.status === "active") {
            return { vendor: existing, scanClaimed: false, attemptId: null };
          }
          const [updated] = await tx
            .update(vendors)
            .set({
              ...allowlistedVendorFields,
              status: "pending",
              updatedAt: now,
            })
            .where(eq(vendors.id, existing.id))
            .returning();
          vRecord = updated;
        }
      }

      if (!vRecord) {
        // First approval: insert pending vendor with authoritative server-forced status
        const [newV] = await tx
          .insert(vendors)
          .values({
            ...allowlistedVendorFields,
            status: "pending",
          })
          .returning();

        await tx
          .update(vendorOnboardingDrafts)
          .set({ promotedVendorId: newV.id, updatedAt: now })
          .where(eq(vendorOnboardingDrafts.id, draftId));

        vRecord = newV;
      }

      // Atomically transfer all uploaded draft documents to the vendor record
      await tx
        .update(vendorDocuments)
        .set({
          vendorId: vRecord.id,
          draftId: null,
          reviewStatus: "approved",
        })
        .where(or(eq(vendorDocuments.draftId, draftId), eq(vendorDocuments.vendorId, vRecord.id)));

      return { vendor: vRecord, scanClaimed: true, attemptId: newAttemptId };
    });

    // ── POST-STAGE-1: Handle non-claiming paths ────────────────────────────────
    if (!stageResult.scanClaimed) {
      if (stageResult.vendor && stageResult.vendor.status === "active") {
        return { success: true, vendor: stageResult.vendor };
      }
      // Another request is already processing this approval. Return informational response.
      return {
        success: false,
        reason: "approval_already_processing",
        message: "An approval is already in progress for this draft. Please wait for it to complete, or retry after 10 minutes if it appears stalled.",
      };
    }

    const stagedVendor = stageResult.vendor;
    const claimAttemptId = stageResult.attemptId!;

    // Idempotent guard for the case where vendor was already active before scan
    if (stagedVendor.status === "active") {
      return { success: true, vendor: stagedVendor };
    }

    // Stage 2: Run regulatory ComplianceService evaluation (only the claiming thread reaches here)
    try {
      await ComplianceService.getInstance().scanVendorDocuments(stagedVendor.id);
    } catch (complianceErr: any) {
      const correlationId = crypto.randomUUID();
      console.error(
        `[VendorOnboardingService][Correlation: ${correlationId}] Compliance scan failed for staged Vendor ${stagedVendor.id}:`,
        complianceErr
      );
      // Mark claim 'failed' — UUID-guarded so a superseded thread cannot corrupt another thread's claim
      await db
        .update(vendorOnboardingDrafts)
        .set({
          approvalProcessingStatus: "failed",
          onboardingNotes: `Compliance scan pending resolution (Reference: ${correlationId}). Vendor remains staged in pending review.`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendorOnboardingDrafts.id, draftId),
            eq(vendorOnboardingDrafts.approvalAttemptId, claimAttemptId)
          )
        );
      // Sanitize client-facing error: return only a correlation ID, never internal identifiers
      throw new Error(
        `Compliance verification could not be completed at this time (Correlation ID: ${correlationId}). Please contact system administrators.`
      );
    }

    // Stage 4: Activate vendor atomically after successful compliance scan
    // Uses FOR UPDATE + UUID guard to prevent duplicate activation and audit logs
    // from any concurrent thread that somehow reaches this point.
    const [activeVendor] = await db.transaction(async (tx) => {
      // Re-acquire row lock on the vendor to prevent concurrent duplicate activation
      const [vendorToActivate] = await tx
        .select()
        .from(vendors)
        .where(eq(vendors.id, stagedVendor.id))
        .for("update");

      if (!vendorToActivate) {
        throw new NotFoundError("Staged vendor not found during activation.");
      }

      // Idempotent: vendor already activated by a concurrent thread — return without second audit
      if (vendorToActivate.status === "active") {
        return [vendorToActivate];
      }

      // Re-acquire row lock on draft and verify the attempt UUID still matches this thread
      const [draftToFinalize] = await tx
        .select()
        .from(vendorOnboardingDrafts)
        .where(eq(vendorOnboardingDrafts.id, draftId))
        .for("update");

      if (!draftToFinalize) {
        throw new NotFoundError("Draft not found during activation.");
      }

      if (draftToFinalize.approvalAttemptId !== claimAttemptId) {
        // This thread's claim was superseded by a retry that took over the slot.
        // Do not activate — the new claimant will handle activation.
        throw new ConflictError(
          "Approval attempt was superseded by a newer retry. The previous attempt will not activate the vendor."
        );
      }

      const now = new Date();

      const [v] = await tx
        .update(vendors)
        .set({ status: "active", updatedAt: now })
        .where(eq(vendors.id, stagedVendor.id))
        .returning();

      // Mark draft approved and clear the compliance claim atomically
      await tx
        .update(vendorOnboardingDrafts)
        .set({
          onboardingStatus: "approved",
          promotedVendorId: v.id,
          approvalAttemptId: null,
          approvalProcessingStartedAt: null,
          approvalProcessingStatus: null,
          updatedAt: now,
        })
        .where(eq(vendorOnboardingDrafts.id, draftId));

      // Mark the invitation token as used
      await tx
        .update(vendorOnboardingTokens)
        .set({ status: "used", updatedAt: now })
        .where(eq(vendorOnboardingTokens.draftId, draftId));

      // Insert exactly one audit log entry (idempotency guard above prevents duplicates)
      await tx.insert(auditLogs).values({
        action: "VENDOR_ONBOARDING_APPROVED",
        resourceType: "vendor",
        resourceId: v.id,
        userId,
        details: {
          draftId,
          companyName: v.companyName,
          approvalAttemptId: claimAttemptId,
          status: "active",
        },
      });

      return [v];
    });

    return {
      success: true,
      vendor: activeVendor,
    };
  }

  /**
   * Submits a pending change request for an already approved vendor
   */
  public async submitApprovedVendorChangeRequest({
    vendorId,
    invitationId,
    proposedData,
  }: {
    vendorId: number;
    invitationId?: number | null;
    proposedData: Record<string, any>;
  }) {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new NotFoundError("Vendor not found.");
    }

    const currentDataSnapshot = {
      companyName: vendor.companyName,
      contactPerson: vendor.contactPerson,
      contactNumber: vendor.contactNumber,
      email: vendor.email,
      address: vendor.address,
      taxNumber: vendor.taxNumber,
      registrationNumber: vendor.registrationNumber,
      bankName: vendor.bankName,
      branchName: vendor.branchName,
      accountNumber: vendor.accountNumber,
      ibanNumber: vendor.ibanNumber,
      category: vendor.category,
      payment_currency: vendor.payment_currency,
    };

    const [changeReq] = await db
      .insert(vendorChangeRequests)
      .values({
        vendorId,
        invitationId: invitationId || null,
        proposedData,
        currentDataSnapshot,
        status: "pending",
      })
      .returning();

    return changeReq;
  }

  /**
   * Reviews and applies or rejects an approved vendor's change request
   */
  public async reviewChangeRequest({
    requestId,
    userId,
    action,
    reviewNotes,
  }: {
    requestId: number;
    userId: number;
    action: "approve" | "reject";
    reviewNotes?: string;
  }) {
    const [req] = await db
      .select()
      .from(vendorChangeRequests)
      .where(eq(vendorChangeRequests.id, requestId))
      .limit(1);

    if (!req) {
      throw new NotFoundError("Change request not found.");
    }

    if (req.status !== "pending") {
      throw new ValidationError(`Change request is already ${req.status}.`);
    }

    if (action === "reject") {
      const [updated] = await db
        .update(vendorChangeRequests)
        .set({
          status: "rejected",
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || "Rejected by administrator",
          updatedAt: new Date(),
        })
        .where(eq(vendorChangeRequests.id, requestId))
        .returning();

      await db.insert(auditLogs).values({
        action: "VENDOR_CHANGE_REQUEST_REJECTED",
        resourceType: "vendor_change_request",
        resourceId: requestId,
        userId,
        details: { vendorId: req.vendorId, notes: reviewNotes },
      });

      return { success: true, status: "rejected", changeRequest: updated };
    }

    // Apply changes atomically to vendors table
    const result = await db.transaction(async (tx) => {
      const p = req.proposedData as Record<string, any>;

      // 1. Update live vendor record
      const [updatedVendor] = await tx
        .update(vendors)
        .set({
          companyName: p.companyName || undefined,
          contactPerson: p.contactPerson || undefined,
          contactNumber: p.contactNumber || undefined,
          email: p.email || undefined,
          address: p.address || undefined,
          taxNumber: p.taxNumber !== undefined ? p.taxNumber : undefined,
          registrationNumber: p.registrationNumber !== undefined ? p.registrationNumber : undefined,
          bankName: p.bankName || undefined,
          branchName: p.branchName || undefined,
          accountNumber: p.accountNumber || undefined,
          ibanNumber: p.ibanNumber || undefined,
          category: p.category || undefined,
          payment_currency: p.payment_currency || undefined,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, req.vendorId))
        .returning();

      // 2. Mark change request approved
      const [updatedReq] = await tx
        .update(vendorChangeRequests)
        .set({
          status: "approved",
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(vendorChangeRequests.id, requestId))
        .returning();

      // 3. Record audit log
      await tx.insert(auditLogs).values({
        action: "VENDOR_CHANGE_REQUEST_APPROVED",
        resourceType: "vendor_change_request",
        resourceId: requestId,
        userId,
        details: {
          vendorId: req.vendorId,
          appliedFields: Object.keys(p),
        },
      });

      return { updatedVendor, updatedReq };
    });

    return { success: true, status: "approved", ...result };
  }
}

export const vendorOnboardingService = VendorOnboardingService.getInstance();
