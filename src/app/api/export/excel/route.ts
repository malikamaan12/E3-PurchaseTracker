import ExcelJS from 'exceljs';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@db';
import { purchaseRequests, users, vendors, subPurposes, approvals } from '@db/schema';
import { eq, desc, and, or, inArray, sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/auth-next';
import { normalizeDepartmentAssignments } from '@/lib/auth-shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const isSuperAdmin = user.role === 'super_admin';
    const isAdmin = user.role === 'admin' || isSuperAdmin;
    const userDepts = (user.departments && user.departments.length > 0 ? user.departments : [user.department]).filter(Boolean);
    const userDeptsLower = userDepts.map((d: string) => d.toLowerCase().trim());

    // Compute approver authority departments
    const approverDepts: string[] = [];
    if ((user.role === 'approver' || user.isApprover) && user.department) {
      approverDepts.push(user.department);
    }
    const normalizedAssignments = user.departmentAssignments || normalizeDepartmentAssignments(user.assignedDepartments, user.department);
    for (const assignment of normalizedAssignments) {
      if (assignment.status === 'active' && (assignment.role === 'approver' || assignment.role === 'both')) {
        if (assignment.department && !approverDepts.includes(assignment.department)) {
          approverDepts.push(assignment.department);
        }
      }
    }
    const approverDeptsLower = approverDepts.map((d: string) => d.toLowerCase().trim());

    const whereConditions: any[] = [];

    if (!isSuperAdmin) {
      if (userDeptsLower.length > 0) {
        whereConditions.push(
          sql`(${purchaseRequests.status} != 'pending_dept_head' OR LOWER(COALESCE(${purchaseRequests.department}, ${users.department})) = ANY(${userDeptsLower}) OR COALESCE(${purchaseRequests.department}, ${users.department}) = ANY(${userDepts}) OR ${purchaseRequests.requesterId} = ${user.id})`
        );
      } else {
        whereConditions.push(
          sql`(${purchaseRequests.status} != 'pending_dept_head' OR ${purchaseRequests.requesterId} = ${user.id})`
        );
      }
    }

    if (!isAdmin) {
      const visibilityConditions = [];
      if (userDeptsLower.length > 0) {
        visibilityConditions.push(sql`LOWER(COALESCE(${purchaseRequests.department}, ${users.department})) = ANY(${userDeptsLower}) OR COALESCE(${purchaseRequests.department}, ${users.department}) = ANY(${userDepts})`);
      }
      visibilityConditions.push(eq(purchaseRequests.requesterId, user.id));

      if (approverDeptsLower.length > 0) {
        visibilityConditions.push(
          sql`EXISTS (SELECT 1 FROM ${approvals} WHERE ${approvals.requestId} = ${purchaseRequests.id} AND (LOWER(${approvals.department}) = ANY(${approverDeptsLower}) OR ${approvals.department} = ANY(${approverDepts})))`
        );
      }

      whereConditions.push(or(...visibilityConditions));
    }

    // Fetch scoped requests with joined data
    const requests = await db
      .select({
        id: purchaseRequests.id,
        requestNumber: purchaseRequests.requestNumber,
        title: purchaseRequests.title,
        status: purchaseRequests.status,
        totalEstimatedCost: purchaseRequests.totalEstimatedCost,
        currency: purchaseRequests.currency,
        baseAmountQar: purchaseRequests.baseAmountQar,
        paymentStructure: purchaseRequests.paymentStructure,
        createdAt: purchaseRequests.createdAt,
        requesterName: users.username,
        department: sql<string>`COALESCE(${purchaseRequests.department}, ${users.department})`,
        vendorName: vendors.companyName,
        projectName: subPurposes.name,
      })
      .from(purchaseRequests)
      .leftJoin(users, eq(purchaseRequests.requesterId, users.id))
      .leftJoin(vendors, eq(purchaseRequests.vendorId, vendors.id))
      .leftJoin(subPurposes, eq(purchaseRequests.subPurposeId, subPurposes.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(purchaseRequests.createdAt));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'E3 PurchaseTracker';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Financial Requests Summary', {
      views: [{ showGridLines: true }]
    });

    // 1. Corporate Title Banner
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'E3 PURCHASETRACKER — FINANCIAL PROCUREMENT REPORT';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E1E2E' }
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 36;

    // Subtitle / Date
    worksheet.mergeCells('A2:J2');
    const subCell = worksheet.getCell('A2');
    subCell.value = `Generated on: ${new Date().toLocaleString()} | Total Records: ${requests.length} | Exported By: ${user.username} (${user.department})`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '475569' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    worksheet.addRow([]); // Blank row 3

    // 2. Table Headers
    const headers = [
      'Request #',
      'Title / Description',
      'Requester',
      'Department',
      'Vendor Name',
      'Project / Purpose',
      'Status',
      'Original Amount',
      'Total Base (QAR)',
      'Created Date'
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4F46E5' } // Corporate Indigo Header
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'CBD5E1' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        bottom: { style: 'medium', color: { argb: '1E1E2E' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } },
      };
    });

    // 3. Populate Data Rows & Apply Styling
    let totalQarSum = 0;

    requests.forEach((r) => {
      const row = worksheet.addRow([
        r.requestNumber || `PR-${r.id}`,
        r.title,
        r.requesterName || 'N/A',
        r.department || 'N/A',
        r.vendorName || 'N/A',
        r.projectName || 'General',
        (r.status || 'pending').toUpperCase().replace(/_/g, ' '),
        r.totalEstimatedCost ? `${(r.currency || 'QAR')} ${Number(r.totalEstimatedCost).toLocaleString()}` : '-',
        Number(r.baseAmountQar || r.totalEstimatedCost || 0),
        r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'
      ]);

      totalQarSum += Number(r.baseAmountQar || r.totalEstimatedCost || 0);

      row.height = 22;

      // Status pill coloring (Cell 7 - Column G)
      const statusCell = row.getCell(7);
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' };

      const statusUpper = (r.status || '').toLowerCase();
      if (statusUpper === 'approved') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }; // Soft green
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '166534' } };
      } else if (statusUpper === 'rejected') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }; // Soft red
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '991B1B' } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } }; // Soft yellow/amber
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '92400E' } };
      }

      // Format QAR Amount Cell (Cell 9 - Column I)
      const qarCell = row.getCell(9);
      qarCell.numFmt = '"QAR "#,##0.00';
      qarCell.alignment = { vertical: 'middle', horizontal: 'right' };
      qarCell.font = { name: 'Calibri', size: 10, bold: true };

      // Standard cell borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } },
        };
      });
    });

    // 4. Totals Row
    const totalRow = worksheet.addRow([
      'TOTAL EXPENDITURE',
      '', '', '', '', '', '', '',
      totalQarSum,
      ''
    ]);

    worksheet.mergeCells(`A${totalRow.number}:H${totalRow.number}`);
    totalRow.height = 26;

    const totalLabelCell = totalRow.getCell(1);
    totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totalLabelCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '1E1E2E' } };

    const totalValueCell = totalRow.getCell(9);
    totalValueCell.numFmt = '"QAR "#,##0.00';
    totalValueCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '4F46E5' } };
    totalValueCell.alignment = { vertical: 'middle', horizontal: 'right' };

    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      cell.border = {
        top: { style: 'thin', color: { argb: '94A3B8' } },
        bottom: { style: 'double', color: { argb: '1E1E2E' } }
      };
    });

    // 5. Auto-Fit Column Widths
    worksheet.columns.forEach((column) => {
      let maxLen = 14;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const valStr = cell.value ? String(cell.value) : '';
        if (valStr.length > maxLen && valStr.length < 50) {
          maxLen = valStr.length;
        }
      });
      column.width = maxLen + 4;
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="E3_PurchaseTracker_Report_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("[Excel Export API] Error:", error);
    return NextResponse.json({ error: "Failed to generate Excel report" }, { status: 500 });
  }
}
