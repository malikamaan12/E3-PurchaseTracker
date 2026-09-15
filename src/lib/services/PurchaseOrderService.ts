import { db } from "@db";
import { 
  purchaseOrders, 
  purchaseOrderEvents, 
  purchaseRequests, 
  vendors, 
  users, 
  auditLogs,
  notifications,
  type PurchaseOrder 
} from "@db/schema";
import { eq, and, desc, sql, gt, count } from "drizzle-orm";
import crypto from "crypto";
import { Resend } from "resend";
import { safeParseItems } from "@/lib/utils/safe-parse";

export interface CreatePoParams {
  requestId: number;
  userId: number;
  userRole: string;
  userDepartment?: string;
  expectedDeliveryDate?: Date | string | null;
  billingCompany?: string;
  deliveryAddress?: string;
  billingAddress?: string;
  specialInstructions?: string;
  termsAndConditions?: string;
  status?: "draft" | "issued";
}

export interface UpdateDraftPoParams {
  expectedDeliveryDate?: Date | string | null;
  billingCompany?: string;
  deliveryAddress?: string;
  billingAddress?: string;
  specialInstructions?: string;
  termsAndConditions?: string;
  freightAmount?: number;
  taxAmount?: number;
}

export class PurchaseOrderService {
  /**
   * Validates if a user has Finance or Admin authority.
   */
  static isAuthorized(userRole: string, userDepartment?: string): boolean {
    const isSuperAdmin = userRole === "super_admin";
    const isAdmin = userRole === "admin" || isSuperAdmin;
    const isFinance = userDepartment?.toLowerCase() === "finance";
    return isAdmin || isFinance;
  }

  /**
   * Generates next sequential PO number, e.g. PO-2026-00001
   */
  static async generatePoNumber(targetYear?: number): Promise<string> {
    const year = targetYear || new Date().getFullYear();
    const prefix = `PO-${year}-`;

    const latest = await db
      .select({ poNumber: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(sql`${purchaseOrders.poNumber} LIKE ${`${prefix}%`}`)
      .orderBy(desc(purchaseOrders.poNumber))
      .limit(1);

    let nextSeq = 1;
    if (latest.length > 0 && latest[0].poNumber) {
      const parts = latest[0].poNumber.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    const seqPadded = String(nextSeq).padStart(5, "0");
    return `PO-${year}-${seqPadded}`;
  }

  /**
   * Generates a 256-bit cryptographically secure raw token and SHA-256 hash.
   */
  static generateToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    return { rawToken, tokenHash };
  }

  /**
   * Creates a Purchase Order for an approved purchase request.
   */
  static async createPurchaseOrder(params: CreatePoParams): Promise<{ purchaseOrder: PurchaseOrder; rawToken: string }> {
    const { requestId, userId, userRole, userDepartment, status = "issued" } = params;

    if (!this.isAuthorized(userRole, userDepartment)) {
      throw new Error("Access denied: Only Finance officers or Administrators can create Purchase Orders.");
    }

    // 1. Fetch Purchase Request with vendor and project details
    const request = await db.query.purchaseRequests.findFirst({
      where: eq(purchaseRequests.id, requestId),
      with: {
        vendor: true,
        requester: true,
        subPurpose: true,
      },
    });

    if (!request) {
      throw new Error(`Purchase Request #${requestId} not found.`);
    }

    // 2. Strict Trigger Rule: Must be 'approved'
    if (request.status !== "approved" && request.status !== "partially_paid" && request.status !== "fully_paid") {
      throw new Error(
        `Purchase Orders can only be generated for approved requests. Current status: '${request.status.toUpperCase()}'.`
      );
    }

    if (!request.vendorId) {
      throw new Error("Cannot generate Purchase Order: No vendor is linked to this request.");
    }

    // 3. Check for existing active or draft PO
    const existingPo = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.requestId, requestId),
        sql`${purchaseOrders.status} != 'cancelled'`
      ),
    });

    if (existingPo) {
      throw new Error(
        `A Purchase Order (${existingPo.poNumber}) already exists for this request in '${existingPo.status.toUpperCase()}' status.`
      );
    }

    // 4. Build frozen items snapshot
    const rawItems = safeParseItems(request.items);
    const itemsSnapshot = (rawItems || []).map((it: any) => {
      const quantity = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Math.max(0, Number(it.estimatedCost) || 0);
      const totalPrice = quantity * unitPrice;
      return {
        name: it.name || "Item",
        description: it.description || "",
        quantity,
        unitPrice,
        totalPrice,
      };
    });

    const subtotal = itemsSnapshot.reduce((sum, it) => sum + it.totalPrice, 0);
    const freight = Math.max(0, Number(request.freightAmount) || 0);
    const tax = 0;
    const total = subtotal + freight + tax;

    // 5. Generate PO Number and Public Vendor Token
    const poNumber = await this.generatePoNumber();
    const { rawToken, tokenHash } = this.generateToken();

    // Default 60-day expiry for vendor link
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const billingCompany = params.billingCompany?.trim() 
      || request.subPurpose?.name 
      || "Events & Entertainment Enterprises W.L.L";
    const deliveryAddress = params.deliveryAddress?.trim() || "E3 Headquarters, Logistics & Receiving Department, Doha, Qatar";
    const billingAddress = params.billingAddress?.trim() || "Events & Entertainment Enterprises W.L.L, Finance Department, Doha, Qatar";
    const paymentTerms = request.paymentStructure || "POST_PROJECT";
    const specialInstructions = params.specialInstructions?.trim() || "Please inspect items upon arrival. Official invoice referencing this PO number must accompany delivery.";
    const termsAndConditions = params.termsAndConditions?.trim() || "Standard E3 Procurement Terms Apply. Payment processed within agreed terms upon delivery inspection.";

    const expectedDeliveryDate = params.expectedDeliveryDate ? new Date(params.expectedDeliveryDate) : null;

    // 6. Insert Purchase Order
    const [po] = await db
      .insert(purchaseOrders)
      .values({
        poNumber,
        requestId,
        vendorId: request.vendorId,
        createdById: userId,
        status,
        itemsSnapshot,
        currency: request.currency || "QAR",
        subtotalAmount: String(subtotal),
        freightAmount: String(freight),
        taxAmount: String(tax),
        totalAmount: String(total),
        paymentTerms,
        expectedDeliveryDate,
        billingCompany,
        deliveryAddress,
        billingAddress,
        specialInstructions,
        termsAndConditions,
        tokenHash,
        tokenExpiresAt,
        tokenStatus: "active",
        issuedAt: status === "issued" ? new Date() : null,
      })
      .returning();

    // 7. Record Event
    await db.insert(purchaseOrderEvents).values({
      poId: po.id,
      eventType: status === "issued" ? "ISSUED" : "CREATED",
      actorType: "internal_user",
      actorId: userId,
      metadata: { poNumber, totalAmount: total, currency: request.currency },
    });

    // 8. Institutional Audit Log
    await db.insert(auditLogs).values({
      userId,
      action: "PURCHASE_ORDER_GENERATED",
      resourceType: "purchase_order",
      resourceId: po.id,
      details: {
        poNumber,
        requestId,
        vendorId: request.vendorId,
        totalAmount: total,
        status,
      },
    });

    // 9. In-app notification for Requester
    if (request.requesterId) {
      await db.insert(notifications).values({
        userId: request.requesterId,
        requestId,
        title: `Purchase Order Generated: ${poNumber}`,
        message: `Finance has issued Purchase Order ${poNumber} for your approved request "${request.title}".`,
        type: "approval_granted",
        priority: "normal",
        link: `/dashboard/requests/${requestId}`,
      });
    }

    return { purchaseOrder: po, rawToken };
  }

  /**
   * Issues a previously created draft Purchase Order.
   */
  static async issuePurchaseOrder(
    poId: number, 
    userId: number, 
    userRole: string, 
    userDepartment?: string
  ): Promise<PurchaseOrder> {
    if (!this.isAuthorized(userRole, userDepartment)) {
      throw new Error("Access denied: Only Finance officers or Administrators can issue Purchase Orders.");
    }

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!existing) throw new Error("Purchase Order not found.");
    if (existing.status !== "draft") throw new Error(`PO is already in '${existing.status}' status.`);

    const [updated] = await db
      .update(purchaseOrders)
      .set({
        status: "issued",
        issuedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId))
      .returning();

    await db.insert(purchaseOrderEvents).values({
      poId,
      eventType: "ISSUED",
      actorType: "internal_user",
      actorId: userId,
    });

    return updated;
  }

  /**
   * Updates an existing draft Purchase Order.
   */
  static async updateDraftPo(
    poId: number,
    userId: number,
    userRole: string,
    userDepartment: string | undefined,
    updates: UpdateDraftPoParams
  ): Promise<PurchaseOrder> {
    if (!this.isAuthorized(userRole, userDepartment)) {
      throw new Error("Access denied: Only Finance officers or Administrators can edit Purchase Orders.");
    }

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!existing) throw new Error("Purchase Order not found.");
    if (existing.status !== "draft") {
      throw new Error("Only draft Purchase Orders can be edited. Issued orders are locked for integrity.");
    }

    const updateFields: any = { updatedAt: new Date() };
    if (updates.expectedDeliveryDate !== undefined) {
      updateFields.expectedDeliveryDate = updates.expectedDeliveryDate ? new Date(updates.expectedDeliveryDate) : null;
    }
    if (updates.billingCompany !== undefined) updateFields.billingCompany = updates.billingCompany;
    if (updates.deliveryAddress !== undefined) updateFields.deliveryAddress = updates.deliveryAddress;
    if (updates.billingAddress !== undefined) updateFields.billingAddress = updates.billingAddress;
    if (updates.specialInstructions !== undefined) updateFields.specialInstructions = updates.specialInstructions;
    if (updates.termsAndConditions !== undefined) updateFields.termsAndConditions = updates.termsAndConditions;

    if (updates.freightAmount !== undefined || updates.taxAmount !== undefined) {
      const freight = updates.freightAmount !== undefined ? updates.freightAmount : Number(existing.freightAmount || 0);
      const tax = updates.taxAmount !== undefined ? updates.taxAmount : Number(existing.taxAmount || 0);
      const subtotal = Number(existing.subtotalAmount || 0);
      updateFields.freightAmount = String(freight);
      updateFields.taxAmount = String(tax);
      updateFields.totalAmount = String(subtotal + freight + tax);
    }

    const [updated] = await db
      .update(purchaseOrders)
      .set(updateFields)
      .where(eq(purchaseOrders.id, poId))
      .returning();

    return updated;
  }

  /**
   * Retrieves a Purchase Order by public vendor token and logs the view event.
   */
  static async getPurchaseOrderByToken(rawToken: string, ip?: string, userAgent?: string): Promise<{
    po: any;
    vendor: any;
    request: any;
  }> {
    if (!rawToken || typeof rawToken !== "string") {
      throw new Error("Invalid access token.");
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const po = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.tokenHash, tokenHash),
        eq(purchaseOrders.tokenStatus, "active")
      ),
      with: {
        vendor: true,
        request: {
          columns: {
            id: true,
            requestNumber: true,
            title: true,
            department: true,
          },
        },
        createdBy: {
          columns: {
            username: true,
            email: true,
            contact_number: true,
          },
        },
      },
    });

    if (!po) {
      throw new Error("Purchase Order link is invalid or has been revoked.");
    }

    if (po.tokenExpiresAt && new Date() > po.tokenExpiresAt) {
      throw new Error("This Purchase Order link has expired. Please contact the procurement department.");
    }

    // Asynchronously log the view event (vendor portal access)
    db.insert(purchaseOrderEvents).values({
      poId: po.id,
      eventType: "VIEWED",
      actorType: "vendor",
      metadata: { ip, userAgent, timestamp: new Date().toISOString() },
    }).catch((err) => console.error("[PO View Log] Failed:", err));

    return {
      po,
      vendor: po.vendor,
      request: po.request,
    };
  }

  /**
   * Vendor acknowledges and accepts the Purchase Order.
   */
  static async acknowledgePurchaseOrder(
    rawToken: string,
    data: { acknowledgedBy: string; acknowledgmentNotes?: string },
    ip?: string
  ): Promise<PurchaseOrder> {
    if (!data.acknowledgedBy?.trim()) {
      throw new Error("Authorized representative name is required to acknowledge this Purchase Order.");
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const [existing] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.tokenHash, tokenHash), eq(purchaseOrders.tokenStatus, "active")))
      .limit(1);

    if (!existing) {
      throw new Error("Purchase Order link is invalid or expired.");
    }

    if (existing.status === "cancelled") {
      throw new Error("This Purchase Order has been cancelled and cannot be acknowledged.");
    }

    const [updated] = await db
      .update(purchaseOrders)
      .set({
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: data.acknowledgedBy.trim(),
        acknowledgmentNotes: data.acknowledgmentNotes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, existing.id))
      .returning();

    // Log event
    await db.insert(purchaseOrderEvents).values({
      poId: existing.id,
      eventType: "ACKNOWLEDGED",
      actorType: "vendor",
      metadata: {
        acknowledgedBy: data.acknowledgedBy,
        acknowledgmentNotes: data.acknowledgmentNotes,
        ip,
      },
    });

    // Notify Finance officers and Requester
    const pr = await db.query.purchaseRequests.findFirst({
      where: eq(purchaseRequests.id, existing.requestId),
      columns: { requesterId: true, title: true },
    });

    if (pr?.requesterId) {
      await db.insert(notifications).values({
        userId: pr.requesterId,
        requestId: existing.requestId,
        title: `Vendor Confirmed PO: ${existing.poNumber}`,
        message: `${data.acknowledgedBy} has acknowledged and confirmed Purchase Order ${existing.poNumber}.`,
        type: "approval_granted",
        priority: "normal",
        link: `/dashboard/requests/${existing.requestId}`,
      });
    }

    return updated;
  }

  /**
   * Cancels a Purchase Order with an audit reason.
   */
  static async cancelPurchaseOrder(
    poId: number,
    userId: number,
    userRole: string,
    userDepartment: string | undefined,
    reason: string
  ): Promise<PurchaseOrder> {
    if (!this.isAuthorized(userRole, userDepartment)) {
      throw new Error("Access denied: Only Finance officers or Administrators can cancel Purchase Orders.");
    }

    if (!reason?.trim()) {
      throw new Error("A cancellation reason is required.");
    }

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!existing) throw new Error("Purchase Order not found.");

    const [updated] = await db
      .update(purchaseOrders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: reason.trim(),
        tokenStatus: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId))
      .returning();

    await db.insert(purchaseOrderEvents).values({
      poId,
      eventType: "CANCELLED",
      actorType: "internal_user",
      actorId: userId,
      metadata: { reason },
    });

    await db.insert(auditLogs).values({
      userId,
      action: "PURCHASE_ORDER_CANCELLED",
      resourceType: "purchase_order",
      resourceId: poId,
      details: { cancellationReason: reason },
    });

    return updated;
  }

  /**
   * Regenerates a fresh public token for an existing Purchase Order.
   */
  static async regenerateShareToken(
    poId: number,
    userId: number,
    userRole: string,
    userDepartment?: string
  ): Promise<{ rawToken: string; po: PurchaseOrder }> {
    if (!this.isAuthorized(userRole, userDepartment)) {
      throw new Error("Access denied: Only Finance officers or Administrators can regenerate sharing tokens.");
    }

    const { rawToken, tokenHash } = this.generateToken();
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const [po] = await db
      .update(purchaseOrders)
      .set({
        tokenHash,
        tokenExpiresAt,
        tokenStatus: "active",
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId))
      .returning();

    await db.insert(purchaseOrderEvents).values({
      poId,
      eventType: "LINK_COPIED",
      actorType: "internal_user",
      actorId: userId,
      metadata: { action: "REGENERATED_TOKEN" },
    });

    return { rawToken, po };
  }

  /**
   * Sends an official Purchase Order link and notification to the vendor via Resend.
   */
  static async sendVendorPoEmail(
    poId: number,
    rawToken: string,
    userId: number,
    userRole: string,
    userDepartment?: string,
    customMessage?: string
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isAuthorized(userRole, userDepartment)) {
      throw new Error("Access denied: Only Finance officers or Administrators can send vendor emails.");
    }

    const po = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, poId),
      with: { vendor: true, request: true },
    });

    if (!po || !po.vendor?.email) {
      throw new Error("Cannot send email: Vendor email address is missing or invalid.");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://app.e3.qa";
    const portalUrl = `${appUrl}/portal/po/${rawToken}`;

    const vendorName = po.vendor.companyName || po.vendor.contactPerson || "Valued Partner";
    const poNum = po.poNumber;
    const formattedTotal = `${po.currency} ${Number(po.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1E1E2E 0%, #2D2D44 100%); padding: 32px 28px; text-align: left;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.5px;">E3 HOLDINGS</h1>
          <p style="color: #94a3b8; font-size: 13px; margin: 0; font-weight: 500;">Official Purchase Order Notification</p>
        </div>
        
        <div style="padding: 32px 28px;">
          <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px 0;">Dear <strong>${vendorName}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
            We are pleased to issue official Purchase Order <strong>${poNum}</strong> for your products / services. Please find the order summary below:
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">PO Number:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right;">${poNum}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Order Total:</td>
                <td style="padding: 6px 0; color: #4F46E5; font-weight: 800; font-size: 15px; text-align: right;">${formattedTotal}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Delivery Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : "Per Agreement"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Payment Terms:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${(po.paymentTerms || "Standard").replace(/_/g, " ")}</td>
              </tr>
            </table>
          </div>

          ${customMessage ? `<div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 14px; border-radius: 6px; margin-bottom: 24px; font-size: 13px; color: #3730a3;"><strong>Note from Finance:</strong><br/>${customMessage}</div>` : ""}

          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="background: #4F46E5; color: #ffffff; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
              View Purchase Order & Download PDF
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0; text-align: center;">
            You can view complete line items, download the signed PDF, and confirm order acknowledgment through our secure vendor portal.
          </p>
        </div>

        <div style="background: #f1f5f9; padding: 20px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
          <p style="margin: 0 0 4px 0;">E3 Institutional Procurement Governance • Doha, Qatar</p>
          <p style="margin: 0;">This email contains confidential institutional purchasing information.</p>
        </div>
      </div>
    `;

    const resend = new Resend(process.env.RESEND_API_KEY || "");
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: "E3 Procurement <orders@updates.e3.qa>",
      to: [po.vendor.email],
      subject: `Official Purchase Order ${poNum} — E3 Holdings`,
      html: htmlContent,
    });

    if (resendError) {
      console.error("[Send Vendor PO Email] Error:", resendError);
      throw new Error(`Failed to send email to vendor: ${resendError.message}`);
    }

    await db.insert(purchaseOrderEvents).values({
      poId,
      eventType: "LINK_EMAILED",
      actorType: "internal_user",
      actorId: userId,
      metadata: { recipientEmail: po.vendor.email, messageId: resendData?.id },
    });

    return { success: true, messageId: resendData?.id };
  }
}
