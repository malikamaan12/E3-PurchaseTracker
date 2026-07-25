import { format } from "date-fns";

export interface RequestNumberOptions {
  projectName?: string | null;
  departmentName?: string | null;
  date?: Date;
  sequence: number;
}

/**
 * Formats department name into a clean 3-4 letter uppercase code
 * e.g. "F&B" or "Food and Beverages" -> "FNB"
 * "Information Technology" -> "IT"
 * "CEO Office" -> "CEO"
 * "Marketing" -> "MKT"
 */
export function formatDepartmentCode(dept?: string | null): string {
  if (!dept) return "GEN";
  
  const upper = dept.toUpperCase().trim();
  if (upper === "F&B" || upper.includes("FOOD") || upper.includes("BEVERAGE")) return "FNB";
  if (upper === "IT" || upper.includes("INFORMATION") || upper.includes("TECH")) return "IT";
  if (upper.includes("FINANCE")) return "FIN";
  if (upper.includes("MARKETING")) return "MKT";
  if (upper.includes("OPERATIONS")) return "OPS";
  if (upper.includes("LOGISTICS")) return "LOG";
  if (upper.includes("CEO")) return "CEO";
  if (upper.includes("MANAGEMENT")) return "MGMT";
  if (upper.includes("BRAND")) return "BRD";
  if (upper.includes("EVENT")) return "EVT";
  if (upper.includes("PURCHASE") || upper.includes("PROCURE")) return "PROC";

  const cleaned = dept
    .replace(/&/g, 'N')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  return cleaned.substring(0, 4) || "GEN";
}

/**
 * Formats project name into a clean 4-8 letter uppercase code
 * e.g. "Q3 Exhibition Operations" -> "EXHIBITION"
 */
export function formatProjectCode(project?: string | null): string {
  if (!project) return "PROJ";
  
  const cleaned = project
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  if (cleaned.length === 0) return "PROJ";
  return cleaned.substring(0, 8);
}

/**
 * Generates unique Request ID in format: PROJECT-DEPARTMENT-DATE-SEQUENCE
 * Example: EXHIBITION-FNB-20260725-0001
 */
export function generateUniqueRequestId(options: RequestNumberOptions): string {
  const projCode = formatProjectCode(options.projectName);
  const deptCode = formatDepartmentCode(options.departmentName);
  const dateStr = format(options.date || new Date(), "yyyyMMdd");
  const seqStr = options.sequence.toString().padStart(4, '0');

  return `${projCode}-${deptCode}-${dateStr}-${seqStr}`;
}
