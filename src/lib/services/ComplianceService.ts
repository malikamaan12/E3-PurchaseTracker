import { db } from "@db";
import { vendors, fileAttachments, purchaseRequests } from "@db/schema";
import { eq, desc, inArray } from "drizzle-orm";

/**
 * ComplianceService
 * Orchestrates heuristic document scanning and persistent regulatory scoring.
 */
export class ComplianceService {
  private static instance: ComplianceService;

  // Document Heuristics (Keywords to look for in filenames)
  private readonly CATEGORIES = {
    registration: ["registration", "cr ", "commercial", "record"],
    tax: ["tax", "vat ", "tin "],
    establishment: ["computer card", "establishment", "municipality"],
    contract: ["contract", "agreement", "mou", "terms"],
  };

  private constructor() {}

  public static getInstance(): ComplianceService {
    if (!ComplianceService.instance) {
      ComplianceService.instance = new ComplianceService();
    }
    return ComplianceService.instance;
  }

  /**
   * Performs an exhaustive heuristic scan of all documents for a vendor
   * and persists the score and metadata to the database.
   */
  public async scanVendorDocuments(vendorId: number) {
    try {
      console.log(`[ComplianceService] Starting heuristic scan for Vendor ID: ${vendorId}`);

      // 1. Fetch vendor requests to find attachments
      const vendorRequests = await db.select({ id: purchaseRequests.id })
        .from(purchaseRequests)
        .where(eq(purchaseRequests.vendorId, vendorId));
      
      const requestIds = vendorRequests.map(r => r.id);
      
      let attachments: any[] = [];
      if (requestIds.length > 0) {
        const prAttachments = await db.select()
          .from(fileAttachments)
          .where(inArray(fileAttachments.requestId, requestIds))
          .orderBy(desc(fileAttachments.uploadedAt));
          
        attachments.push(...prAttachments.map(f => ({
          id: f.id,
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          uploadedAt: f.uploadedAt
        })));
      }

      // Fetch from vendorDocuments as well
      const { vendorDocuments } = await import("@db/schema");
      const vDocs = await db.select()
        .from(vendorDocuments)
        .where(eq(vendorDocuments.vendorId, vendorId));

      vDocs.forEach(d => {
        attachments.push({
          id: d.id,
          fileName: `${d.documentType} - ${d.documentName}`,
          fileUrl: d.fileUrl,
          uploadedAt: d.uploadedAt,
          documentType: d.documentType,
          expiryDate: d.expiryDate
        });
      });

      // 2. Initialize Matrix
      const docs: Record<string, any> = {
        registration: { status: "missing", file: null },
        tax: { status: "missing", file: null },
        establishment: { status: "missing", file: null },
        contract: { status: "missing", file: null },
      };

      // 3. Categorize based on heuristics
      attachments.forEach(file => {
        const name = (file.fileName || "").toLowerCase();
        
        let status = "valid";
        if (file.expiryDate && new Date(file.expiryDate) < new Date()) {
          status = "expired";
        }

        let matchedCat: string | null = null;
        if (file.documentType) {
           const typeStr = (file.documentType || "").toLowerCase();
           if (typeStr.includes("registration")) matchedCat = "registration";
           else if (typeStr.includes("tax")) matchedCat = "tax";
           else if (typeStr.includes("nda") || typeStr.includes("contract")) matchedCat = "contract";
           else if (typeStr.includes("iso") || typeStr.includes("establishment")) matchedCat = "establishment";
        }

        const assignDoc = (cat: string) => {
          if (docs[cat] && docs[cat].status !== "valid") {
            docs[cat] = {
              status: status,
              file: {
                id: file.id,
                name: file.fileName || "Document",
                url: file.fileUrl || "",
                date: file.uploadedAt
              }
            };
          }
        };

        if (matchedCat) {
          assignDoc(matchedCat);
        } else {
          Object.entries(this.CATEGORIES).forEach(([cat, keywords]) => {
            if (keywords.some(k => name.includes(k))) {
              assignDoc(cat);
            }
          });
        }
      });

      // 4. Calculate health score
      const validCount = Object.values(docs).filter((d: any) => d.status === "valid").length;
      const healthScore = Math.round((validCount / Math.max(1, Object.keys(docs).length)) * 100);

      // 5. Persist to Vendor Record
      try {
        await db.update(vendors)
          .set({
            complianceScore: healthScore,
            complianceMetadata: docs,
            updatedAt: new Date()
          })
          .where(eq(vendors.id, vendorId));
      } catch (dbErr) {
        console.warn(`[ComplianceService] Non-fatal metadata update error for vendor ${vendorId}:`, dbErr);
      }

      console.log(`[ComplianceService] Scan complete. Vendor ${vendorId} Health Score: ${healthScore}%`);
      return { healthScore, docs };
      
    } catch (error) {
      console.error(`[ComplianceService] Error scanning vendor ${vendorId}:`, error);
      throw error;
    }
  }

  /**
   * Background scan wrapper - allows immediate return in serverless environments
   */
  public async triggerAsyncScan(vendorId: number) {
    // In a full environment we might use a worker queue. 
    // Here we start the promise but don't await it if we want it "asyncish".
    // Note: Vercel functions terminate when the response is sent unless usingwaitUntil.
    return this.scanVendorDocuments(vendorId);
  }
}

export const complianceService = ComplianceService.getInstance();
