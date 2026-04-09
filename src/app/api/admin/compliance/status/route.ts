import { NextResponse } from "next/server";
import { db } from "@db";
import { vendors, fileAttachments, purchaseRequests } from "@db/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { TOKEN_COOKIE_NAME } from "@/lib/utils/config";
import { decodeJwtPayload } from "@/lib/utils/jwt";

/**
 * Compliance Status API
 * Aggregates vendor document coverage by scanning multi-request attachments.
 * Heuristically categorizes documents into mandatory compliance slots.
 */
export async function GET() {
  try {
    // 1. Auth Guard (Admin/Approver Only)
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE_NAME)?.value;
    const user = token ? decodeJwtPayload(token) : null;

    if (!user || (user.role !== "admin" && user.role !== "approver")) {
      return NextResponse.json({ error: "Unauthorized access to compliance vault" }, { status: 403 });
    }

    // 2. Fetch all active vendors
    const allVendors = await db.select().from(vendors).orderBy(desc(vendors.createdAt));

    // 3. Document Heuristics (Keywords to look for in filenames)
    const CATEGORIES = {
      registration: ["registration", "cr ", "commercial", "record"],
      tax: ["tax", "vat ", "tin "],
      establishment: ["computer card", "establishment", "municipality"],
      contract: ["contract", "agreement", "mou", "terms"],
    };

    // 4. Build Compliance Matrix
    // Note: We aggregate across all purchase requests because currently documents are only linked to requests.
    const matrix = await Promise.all(allVendors.map(async (v) => {
      // Find all requests for this vendor to fetch their attachments
      const vendorRequests = await db.select({ id: purchaseRequests.id })
        .from(purchaseRequests)
        .where(eq(purchaseRequests.vendorId, v.id));
      
      const requestIds = vendorRequests.map(r => r.id);
      
      let attachments: any[] = [];
      if (requestIds.length > 0) {
        attachments = await db.select()
          .from(fileAttachments)
          .where(inArray(fileAttachments.requestId, requestIds))
          .orderBy(desc(fileAttachments.uploadedAt));
      }

      // Categorize documents
      const docs: Record<string, any> = {
        registration: { status: "missing", file: null },
        tax: { status: "missing", file: null },
        establishment: { status: "missing", file: null },
        contract: { status: "missing", file: null },
      };

      attachments.forEach(file => {
        const name = file.fileName.toLowerCase();
        
        Object.entries(CATEGORIES).forEach(([cat, keywords]) => {
          if (docs[cat].status === "missing" && keywords.some(k => name.includes(k))) {
            docs[cat] = {
              status: "valid",
              file: {
                id: file.id,
                name: file.fileName,
                url: file.fileUrl,
                date: file.uploadedAt
              }
            };
          }
        });
      });

      // Calculate health score
      const validCount = Object.values(docs).filter((d: any) => d.status === "valid").length;
      const healthScore = Math.round((validCount / Object.keys(docs).length) * 100);

      return {
        id: v.id,
        companyName: v.companyName,
        registrationNumber: v.registrationNumber,
        taxNumber: v.taxNumber,
        status: v.status,
        healthScore,
        docs
      };
    }));

    // 5. Global Stats
    const totalVendors = matrix.length;
    const fullyCompliant = matrix.filter(m => m.healthScore === 100).length;
    const highRisk = matrix.filter(m => m.healthScore < 50).length;

    return NextResponse.json({
      summary: {
        totalVendors,
        fullyCompliant,
        highRisk,
        systemHealth: Math.round((fullyCompliant / (totalVendors || 1)) * 100)
      },
      vendors: matrix
    });

  } catch (error: any) {
    console.error("[COMPLIANCE_API] Internal Error:", error);
    return NextResponse.json({ 
      error: "Failed to generate compliance matrix",
      details: error.message 
    }, { status: 500 });
  }
}
