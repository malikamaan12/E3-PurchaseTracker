import { db } from "@db";
import {
  vendorRulesetVersions,
  activeVendorRuleset,
  vendorRuleDefinitions,
  vendorAssignedRequirements,
  vendorRequirementSubmissions,
  vendors,
  users,
  type VendorRuleDefinition,
  type VendorRulesetVersion,
  type VendorAssignedRequirement,
} from "../../../db/schema";
import { eq, and, sql, inArray, desc } from "drizzle-orm";

export interface ImpactPreviewResult {
  targetVersionId: number;
  totalActiveVendors: number;
  affectedVendorsCount: number;
  scoreChanges: {
    increasedCount: number;
    decreasedCount: number;
    unchangedCount: number;
    averageDelta: number;
  };
  statusTransitions: {
    toCompliant: number;
    toPending: number;
    toNonCompliant: number;
    toUnderReview: number;
  };
  sampleAffectedVendors: Array<{
    vendorId: number;
    vendorName: string;
    currentScore: number;
    projectedScore: number;
    currentStatus: string;
    projectedStatus: string;
  }>;
}

export class VendorRuleEngineService {
  /**
   * Ensures the active_vendor_ruleset singleton table exists in the database.
   */
  private static async ensureActiveRulesetTable(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "active_vendor_ruleset" (
          "id" integer PRIMARY KEY DEFAULT 1,
          "active_ruleset_version_id" integer NOT NULL REFERENCES "vendor_ruleset_versions"("id") ON DELETE RESTRICT,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL
        );
      `);
    } catch (e) {
      // Table already exists or initialized
    }
  }

  /**
   * Retrieves the currently published active ruleset.
   * If none exists, automatically initializes Version 1 from default rule definitions.
   */
  static async getActiveRuleset(): Promise<VendorRulesetVersion> {
    await this.ensureActiveRulesetTable();

    // 1. First check the singleton pointer table
    try {
      const activePointer = await db
        .select()
        .from(activeVendorRuleset)
        .where(eq(activeVendorRuleset.id, 1))
        .limit(1);

      if (activePointer.length > 0) {
        const [activeVer] = await db
          .select()
          .from(vendorRulesetVersions)
          .where(eq(vendorRulesetVersions.id, activePointer[0].activeRulesetVersionId))
          .limit(1);

        if (activeVer && activeVer.status === "published") {
          return activeVer;
        }
      }
    } catch {}

    // 2. Fallback to querying published status in vendor_ruleset_versions
    const published = await db
      .select()
      .from(vendorRulesetVersions)
      .where(eq(vendorRulesetVersions.status, "published"))
      .limit(1);

    if (published.length > 0) {
      // Sync singleton pointer table
      try {
        await db.execute(sql`
          INSERT INTO "active_vendor_ruleset" ("id", "active_ruleset_version_id", "updated_at")
          VALUES (1, ${published[0].id}, NOW())
          ON CONFLICT ("id") DO UPDATE
          SET "active_ruleset_version_id" = ${published[0].id},
              "updated_at" = NOW();
        `);
      } catch {}
      return published[0];
    }

    // 3. Auto-seed Version 1 if not present
    return await this.seedInitialRuleset();
  }

  /**
   * Retrieves all active rule definitions ordered by display order.
   */
  static async getRuleDefinitions(): Promise<VendorRuleDefinition[]> {
    return await db
      .select()
      .from(vendorRuleDefinitions)
      .where(eq(vendorRuleDefinitions.isActive, true))
      .orderBy(vendorRuleDefinitions.displayOrder);
  }

  /**
   * Creates or updates a rule definition with strict toggle dependency enforcement and locked rule safeguards.
   */
  static async saveRuleDefinition(
    data: Partial<VendorRuleDefinition> & { ruleKey: string; name: string },
    userId: number
  ): Promise<VendorRuleDefinition> {
    const existing = await db
      .select()
      .from(vendorRuleDefinitions)
      .where(eq(vendorRuleDefinitions.ruleKey, data.ruleKey))
      .limit(1);

    const isLocked = existing.length > 0 && existing[0].isLocked;
    const {
      id: _id,
      isLocked: _requestedLockState,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...editableData
    } = data as VendorRuleDefinition;
    data = editableData as Partial<VendorRuleDefinition> & { ruleKey: string; name: string };

    // Enforce locked rule protections (CR and QID cannot be optional or disabled)
    if (isLocked) {
      if (data.ruleKey === "cr_document") {
        data.companyApplicable = true;
        data.companyMandatory = true;
        data.companyCreatorCanChange = false;
        data.isActive = true;
      } else if (data.ruleKey === "qid_document") {
        data.freelancerApplicable = true;
        data.freelancerMandatory = true;
        data.freelancerCreatorCanChange = false;
        data.isActive = true;
      }
    }

    // Enforce toggle dependency cascades
    // 1. Company cascade
    if (!data.companyApplicable) {
      data.companyMandatory = false;
      data.companyAffectsScore = false;
      data.companyInfoRequired = false;
      data.companyDocRequired = false;
    } else if (data.companyMandatory) {
      data.companyAffectsScore = true;
    }

    // 2. Freelancer cascade
    if (!data.freelancerApplicable) {
      data.freelancerMandatory = false;
      data.freelancerAffectsScore = false;
      data.freelancerInfoRequired = false;
      data.freelancerDocRequired = false;
    } else if (data.freelancerMandatory) {
      data.freelancerAffectsScore = true;
    }

    // 3. Document / Expiry cascade
    if (!data.companyDocRequired && !data.freelancerDocRequired) {
      data.expiryRequired = false;
    }
    if (data.expiryRequired) {
      if (data.companyApplicable) data.companyDocRequired = true;
      if (data.freelancerApplicable) data.freelancerDocRequired = true;
    }

    // Bounded score weight (1-100)
    if (data.scoreWeight !== undefined) {
      data.scoreWeight = Math.max(1, Math.min(100, Math.round(data.scoreWeight)));
    }

    if (existing.length > 0) {
      const [updated] = await db
        .update(vendorRuleDefinitions)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(vendorRuleDefinitions.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(vendorRuleDefinitions)
        .values({
          ...data,
          isLocked: false,
        } as any)
        .returning();
      return inserted;
    }
  }

  /**
   * Creates a new draft ruleset version.
   */
  static async createRulesetDraft(
    changeSummary: string,
    userId: number,
    rulesSnapshot?: VendorRuleDefinition[]
  ): Promise<VendorRulesetVersion> {
    const rules = rulesSnapshot || (await this.getRuleDefinitions());
    const highestVersion = await db
      .select({ version: vendorRulesetVersions.versionNumber })
      .from(vendorRulesetVersions)
      .orderBy(desc(vendorRulesetVersions.versionNumber))
      .limit(1);

    const nextVersion = (highestVersion[0]?.version || 0) + 1;

    const [draft] = await db
      .insert(vendorRulesetVersions)
      .values({
        versionNumber: nextVersion,
        status: "draft",
        rulesSnapshot: rules as any,
        changeSummary,
        publishedBy: userId,
      })
      .returning();

    return draft;
  }

  /**
   * Transactionally publishes a ruleset version, ensuring exactly one active published version.
   * If applyToExistingVendors is true, updates assigned requirements non-destructively.
   */
  static async publishRuleset(
    rulesetVersionId: number,
    changeSummary: string,
    userId: number,
    applyToExistingVendors: boolean = false
  ): Promise<VendorRulesetVersion> {
    const targetRuleset = await db
      .select()
      .from(vendorRulesetVersions)
      .where(eq(vendorRulesetVersions.id, rulesetVersionId))
      .limit(1);

    if (!targetRuleset.length) {
      throw new Error(`Ruleset Version ${rulesetVersionId} not found`);
    }

    const currentRules = await this.getRuleDefinitions();

    // 1. Transactionally switch active published ruleset using an atomic CTE query
    const targetSnapshot = currentRules;
    const summary = changeSummary || targetRuleset[0].changeSummary || "Published ruleset update";

    const result = await db.execute(sql`
      WITH archived_old AS (
        UPDATE "vendor_ruleset_versions"
        SET "status" = 'archived'
        WHERE "status" = 'published' AND "id" != ${rulesetVersionId}
        RETURNING "id"
      ), activated AS (
        UPDATE "vendor_ruleset_versions"
        SET "status" = 'published',
            "rules_snapshot" = ${JSON.stringify(targetSnapshot)}::jsonb,
            "published_at" = NOW(),
            "published_by" = ${userId},
            "change_summary" = ${summary}
        WHERE "id" = ${rulesetVersionId}
        RETURNING *
      ), pointer_sync AS (
        INSERT INTO "active_vendor_ruleset" ("id", "active_ruleset_version_id", "updated_at", "updated_by")
        SELECT 1, "id", NOW(), ${userId}
        FROM activated
        ON CONFLICT ("id") DO UPDATE
        SET "active_ruleset_version_id" = EXCLUDED."active_ruleset_version_id",
            "updated_at" = NOW(),
            "updated_by" = EXCLUDED."updated_by"
        RETURNING "active_ruleset_version_id"
      )
      SELECT * FROM activated;
    `);

    const publishedRow = result.rows[0] as any;
    if (!publishedRow) {
      throw new Error(`Failed to activate ruleset version ${rulesetVersionId}`);
    }

    const published: VendorRulesetVersion = {
      id: publishedRow.id,
      versionNumber: publishedRow.version_number,
      status: publishedRow.status,
      rulesSnapshot: publishedRow.rules_snapshot,
      publishedAt: publishedRow.published_at ? new Date(publishedRow.published_at) : new Date(),
      publishedBy: publishedRow.published_by,
      changeSummary: publishedRow.change_summary,
      createdAt: publishedRow.created_at ? new Date(publishedRow.created_at) : new Date(),
    };

    // 2. If applyToExistingVendors is chosen, sync assigned requirements non-destructively
    if (applyToExistingVendors) {
      await this.applyRulesetToExistingVendors(published.id, currentRules);
    }

    return published;
  }

  /**
   * Rolls back to a previous ruleset version safely by creating a new version with the target's snapshot.
   */
  static async rollbackRuleset(targetRulesetVersionId: number, userId: number): Promise<VendorRulesetVersion> {
    const target = await db
      .select()
      .from(vendorRulesetVersions)
      .where(eq(vendorRulesetVersions.id, targetRulesetVersionId))
      .limit(1);

    if (!target.length) {
      throw new Error(`Target ruleset version ${targetRulesetVersionId} does not exist`);
    }

    const targetVersion = target[0];
    const rulesToRestore = targetVersion.rulesSnapshot as VendorRuleDefinition[];

    // Create a new draft holding the target snapshot and publish it
    const draft = await this.createRulesetDraft(
      `Rollback to ruleset version ${targetVersion.versionNumber}`,
      userId,
      rulesToRestore
    );

    return await this.publishRuleset(
      draft.id,
      `Rolled back to configuration of Version ${targetVersion.versionNumber}`,
      userId,
      true
    );
  }

  /**
   * Assigns requirements from the published ruleset to a single vendor.
   */
  static async assignRequirementsToVendor(
    vendorId: number,
    entityType: "company" | "freelancer",
    resolvedDueDate: Date,
    creatorId?: number,
    customOverrides?: Record<string, boolean>
  ): Promise<VendorAssignedRequirement[]> {
    const activeRuleset = await this.getActiveRuleset();
    const rules = (activeRuleset.rulesSnapshot as VendorRuleDefinition[]) || (await this.getRuleDefinitions());

    const assignments: any[] = [];

    for (const rule of rules) {
      const isApplicable =
        entityType === "company" ? rule.companyApplicable : rule.freelancerApplicable;

      if (!isApplicable) continue;

      let isMandatory =
        entityType === "company" ? rule.companyMandatory : rule.freelancerMandatory;
      const canCreatorChange =
        entityType === "company" ? rule.companyCreatorCanChange : rule.freelancerCreatorCanChange;

      // Allow creator override only if permitted by rule config and not locked
      if (canCreatorChange && !rule.isLocked && customOverrides && customOverrides[rule.ruleKey] !== undefined) {
        isMandatory = customOverrides[rule.ruleKey];
      }

      const affectsScore =
        entityType === "company" ? rule.companyAffectsScore : rule.freelancerAffectsScore;
      const infoRequired =
        entityType === "company" ? rule.companyInfoRequired : rule.freelancerInfoRequired;
      const docRequired =
        entityType === "company" ? rule.companyDocRequired : rule.freelancerDocRequired;

      assignments.push({
        vendorId,
        ruleId: rule.id,
        sourceRulesetVersionId: activeRuleset.id,
        ruleKey: rule.ruleKey,
        name: rule.name,
        section: rule.section,
        inputType: rule.inputType,
        isMandatory,
        isCustom: false,
        affectsScore,
        scoreWeight: rule.scoreWeight || 10,
        infoRequired,
        docRequired,
        expiryRequired: rule.expiryRequired,
        verificationRequired: rule.verificationRequired,
        verificationRole: rule.verificationRole || "finance",
        acceptedFileFormats: rule.acceptedFileFormats || ["pdf", "jpg", "jpeg", "png"],
        maxFileSizeMb: rule.maxFileSizeMb || 10,
        dropdownOptions: rule.dropdownOptions || [],
        instructions: rule.instructions || "",
        displayOrder: rule.displayOrder || 0,
        resolvedDueDate,
        submissionStatus: "missing",
        validityStatus: "not_applicable",
        deadlineStatus: "due",
        createdBy: creatorId,
      });
    }

    if (assignments.length > 0) {
      return await db.insert(vendorAssignedRequirements).values(assignments).returning();
    }

    return [];
  }

  /**
   * Simulates rule changes across all active vendors without modifying the database.
   */
  static async previewImpact(targetRulesetVersionId: number): Promise<ImpactPreviewResult> {
    const targetRuleset = await db
      .select()
      .from(vendorRulesetVersions)
      .where(eq(vendorRulesetVersions.id, targetRulesetVersionId))
      .limit(1);

    const rules = targetRuleset.length > 0 && Array.isArray(targetRuleset[0].rulesSnapshot) && targetRuleset[0].rulesSnapshot.length > 0
      ? (targetRuleset[0].rulesSnapshot as VendorRuleDefinition[])
      : await this.getRuleDefinitions();

    const allVendors = await db.select().from(vendors).where(eq(vendors.status, "active"));
    const allAssigned = await db.select().from(vendorAssignedRequirements);

    const vendorMap = new Map<number, VendorAssignedRequirement[]>();
    for (const req of allAssigned) {
      if (!vendorMap.has(req.vendorId)) vendorMap.set(req.vendorId, []);
      vendorMap.get(req.vendorId)!.push(req);
    }

    let increased = 0;
    let decreased = 0;
    let unchanged = 0;
    let totalDelta = 0;
    let toCompliant = 0;
    let toPending = 0;
    let toNonCompliant = 0;
    let toUnderReview = 0;
    const samples: any[] = [];

    for (const v of allVendors) {
      const currentScore = v.complianceScore || 0;
      const currentStatus = v.complianceStatus || "legacy_pending_assessment";
      const entityType = (v.vendorType === "freelancer" ? "freelancer" : "company") as "company" | "freelancer";

      const currentReqs = vendorMap.get(v.id) || [];
      const verifiedKeys = new Set(
        currentReqs.filter((r) => r.submissionStatus === "verified").map((r) => r.ruleKey)
      );

      // Calculate projected score with target rules
      let totalWeight = 0;
      let earnedWeight = 0;
      let hasMissingMandatory = false;

      for (const rule of rules) {
        const applicable = entityType === "company" ? rule.companyApplicable : rule.freelancerApplicable;
        if (!applicable) continue;

        const mandatory = entityType === "company" ? rule.companyMandatory : rule.freelancerMandatory;
        const affects = entityType === "company" ? rule.companyAffectsScore : rule.freelancerAffectsScore;
        const weight = rule.scoreWeight || 10;

        if (affects) totalWeight += weight;

        const isVerified = verifiedKeys.has(rule.ruleKey);
        if (isVerified && affects) {
          earnedWeight += weight;
        }

        if (mandatory && !isVerified) {
          hasMissingMandatory = true;
        }
      }

      const projectedScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
      const projectedStatus = !hasMissingMandatory ? "compliant" : "pending";

      const delta = projectedScore - currentScore;
      totalDelta += delta;

      if (delta > 0) increased++;
      else if (delta < 0) decreased++;
      else unchanged++;

      if (projectedStatus === "compliant" && currentStatus !== "compliant") toCompliant++;
      if (projectedStatus === "pending" && currentStatus !== "pending") toPending++;

      if (samples.length < 5 && (delta !== 0 || projectedStatus !== currentStatus)) {
        samples.push({
          vendorId: v.id,
          vendorName: v.companyName,
          currentScore,
          projectedScore,
          currentStatus,
          projectedStatus,
        });
      }
    }

    const affected = increased + decreased;
    const avgDelta = allVendors.length > 0 ? totalDelta / allVendors.length : 0;

    return {
      targetVersionId: targetRulesetVersionId,
      totalActiveVendors: allVendors.length,
      affectedVendorsCount: affected,
      scoreChanges: {
        increasedCount: increased,
        decreasedCount: decreased,
        unchangedCount: unchanged,
        averageDelta: Math.round(avgDelta * 10) / 10,
      },
      statusTransitions: {
        toCompliant,
        toPending,
        toNonCompliant,
        toUnderReview,
      },
      sampleAffectedVendors: samples,
    };
  }

  /**
   * Internal helper to non-destructively apply ruleset to existing vendors.
   */
  private static async applyRulesetToExistingVendors(
    rulesetVersionId: number,
    rules: VendorRuleDefinition[]
  ): Promise<void> {
    const activeVendors = await db.select().from(vendors).where(eq(vendors.status, "active"));

    for (const v of activeVendors) {
      const entityType = v.vendorType === "freelancer" ? "freelancer" : "company";
      const existingReqs = await db
        .select()
        .from(vendorAssignedRequirements)
        .where(eq(vendorAssignedRequirements.vendorId, v.id));

      const existingMap = new Map(existingReqs.map((r) => [r.ruleKey, r]));

      for (const rule of rules) {
        const applicable = entityType === "company" ? rule.companyApplicable : rule.freelancerApplicable;
        const mandatory = entityType === "company" ? rule.companyMandatory : rule.freelancerMandatory;
        const affects = entityType === "company" ? rule.companyAffectsScore : rule.freelancerAffectsScore;
        const infoRequired = entityType === "company" ? rule.companyInfoRequired : rule.freelancerInfoRequired;
        const docRequired = entityType === "company" ? rule.companyDocRequired : rule.freelancerDocRequired;

        const current = existingMap.get(rule.ruleKey);

        if (applicable) {
          if (current) {
            // Update rule metadata without resetting submission status
            await db
              .update(vendorAssignedRequirements)
              .set({
                sourceRulesetVersionId: rulesetVersionId,
                name: rule.name,
                section: rule.section,
                inputType: rule.inputType,
                isMandatory: mandatory,
                affectsScore: affects,
                scoreWeight: rule.scoreWeight || 10,
                infoRequired,
                docRequired,
                expiryRequired: rule.expiryRequired,
                verificationRequired: rule.verificationRequired,
                displayOrder: rule.displayOrder,
                updatedAt: new Date(),
              })
              .where(eq(vendorAssignedRequirements.id, current.id));
          } else {
            // New applicable rule -> insert as missing
            await db.insert(vendorAssignedRequirements).values({
              vendorId: v.id,
              ruleId: rule.id,
              sourceRulesetVersionId: rulesetVersionId,
              ruleKey: rule.ruleKey,
              name: rule.name,
              section: rule.section,
              inputType: rule.inputType,
              isMandatory: mandatory,
              affectsScore: affects,
              scoreWeight: rule.scoreWeight || 10,
              infoRequired,
              docRequired,
              expiryRequired: rule.expiryRequired,
              verificationRequired: rule.verificationRequired,
              resolvedDueDate: v.complianceDeadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              submissionStatus: "missing",
              validityStatus: "not_applicable",
              deadlineStatus: "due",
            });
          }
        }
      }

      // Update vendor ruleset version reference
      await db
        .update(vendors)
        .set({ rulesetVersionId })
        .where(eq(vendors.id, v.id));
    }
  }

  /**
   * Internal helper to seed initial Ruleset Version 1.
   */
  private static async seedInitialRuleset(): Promise<VendorRulesetVersion> {
    const rules = await this.getRuleDefinitions();
    const [version] = await db
      .insert(vendorRulesetVersions)
      .values({
        versionNumber: 1,
        status: "published",
        rulesSnapshot: rules as any,
        changeSummary: "System Initial Baseline Ruleset Version 1",
        publishedAt: new Date(),
      })
      .returning();

    await this.ensureActiveRulesetTable();
    try {
      await db.execute(sql`
        INSERT INTO "active_vendor_ruleset" ("id", "active_ruleset_version_id", "updated_at")
        VALUES (1, ${version.id}, NOW())
        ON CONFLICT ("id") DO UPDATE
        SET "active_ruleset_version_id" = ${version.id},
            "updated_at" = NOW();
      `);
    } catch {}

    return version;
  }
}
