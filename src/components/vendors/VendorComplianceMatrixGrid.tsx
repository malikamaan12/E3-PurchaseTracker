"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Building2,
  User,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { VendorVerificationDrawer } from "./VendorVerificationDrawer";

interface VendorComplianceMatrixGridProps {
  onSelectVendor?: (vendorId: number) => void;
}

export function VendorComplianceMatrixGrid({ onSelectVendor }: VendorComplianceMatrixGridProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    columns: any[];
    rows: any[];
    pagination: { page: number; limit: number; totalVendors: number; totalPages: number };
  }>({
    columns: [],
    rows: [],
    pagination: { page: 1, limit: 50, totalVendors: 0, totalPages: 1 },
  });

  const [search, setSearch] = useState("");
  const [vendorType, setVendorType] = useState("all");
  const [complianceStatus, setComplianceStatus] = useState("all");
  const [page, setPage] = useState(1);

  // Selected cell for verification drawer
  const [selectedCell, setSelectedCell] = useState<{
    vendorId: number;
    vendorName: string;
    requirement: any;
  } | null>(null);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        search,
        vendorType: vendorType !== "all" ? vendorType : "",
        complianceStatus: complianceStatus !== "all" ? complianceStatus : "",
      });

      const res = await fetch(`/api/vendors/matrix?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setData(result);
      }
    } catch (err: any) {
      console.error("Failed to load matrix:", err);
      toast.error(err.message || "Failed to load vendor matrix");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [page, vendorType, complianceStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMatrix();
  };

  const copyVendorLink = async (vendorId: number) => {
    try {
      const res = await fetch(`/api/vendors/${vendorId}/completion-link`);
      const resData = await res.json();
      if (resData.success && resData.completionLink) {
        await navigator.clipboard.writeText(resData.completionLink);
        toast.success("Vendor self-service completion link copied to clipboard.");
      }
    } catch (err) {
      toast.error("Failed to generate vendor link");
    }
  };

  // Helper for rendering cell badge
  const renderCellBadge = (req: any) => {
    if (!req) {
      return <span className="text-muted-foreground/40 text-[11px]">—</span>;
    }

    const { submissionStatus, validityStatus, deadlineStatus } = req;

    if (submissionStatus === "verified") {
      if (validityStatus === "expiring_soon") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Expiring</span>
          </span>
        );
      }
      if (validityStatus === "expired") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Expired</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Verified</span>
        </span>
      );
    }

    if (submissionStatus === "submitted" || submissionStatus === "under_review") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[10px] font-semibold animate-pulse">
          <Clock className="w-3 h-3 text-blue-600" />
          <span>Under Review</span>
        </span>
      );
    }

    if (submissionStatus === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
          <XCircle className="w-3 h-3 text-rose-600" />
          <span>Rejected</span>
        </span>
      );
    }

    // Missing
    if (deadlineStatus === "overdue") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-rose-600 border border-rose-300 bg-rose-500/5 text-[10px] font-semibold">
          <AlertTriangle className="w-3 h-3" />
          <span>Overdue</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-muted-foreground border border-border text-[10px]">
        Missing
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-2xl border shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search vendor by company, contact, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs rounded-xl bg-background"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={vendorType} onValueChange={setVendorType}>
            <SelectTrigger className="w-[140px] text-xs rounded-xl">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entity Types</SelectItem>
              <SelectItem value="company">Companies</SelectItem>
              <SelectItem value="freelancer">Freelancers</SelectItem>
            </SelectContent>
          </Select>

          <Select value={complianceStatus} onValueChange={setComplianceStatus}>
            <SelectTrigger className="w-[150px] text-xs rounded-xl">
              <SelectValue placeholder="Compliance Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="compliant">Compliant</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
              <SelectItem value="non_compliant">Non-Compliant</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Spreadsheet Matrix Grid */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-muted/70 border-b text-muted-foreground font-semibold uppercase tracking-wider sticky top-0 z-30 shadow-sm">
                {/* Sticky Left Columns */}
                <th className="py-3 px-4 sticky left-0 z-40 bg-muted/95 backdrop-blur shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[200px]">
                  Vendor
                </th>
                <th className="py-3 px-3 text-center min-w-[90px]">Type</th>
                <th className="py-3 px-3 text-center min-w-[90px]">Engagement</th>
                <th className="py-3 px-3 text-center min-w-[120px]">Status</th>
                <th className="py-3 px-3 text-center min-w-[80px]">Score</th>
                <th className="py-3 px-3 text-center min-w-[110px]">Deadline</th>

                {/* Dynamic Requirement Columns */}
                {data.columns.map((col) => (
                  <th key={col.id} className="py-3 px-3 text-center min-w-[130px] border-l border-border/50">
                    <span className="truncate block max-w-[140px] mx-auto">{col.name}</span>
                  </th>
                ))}

                {/* Action Sticky Right Column */}
                <th className="py-3 px-3 text-center min-w-[100px] sticky right-0 z-40 bg-muted/95 backdrop-blur shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7 + data.columns.length} className="py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <p className="text-xs">Loading Compliance Matrix...</p>
                    </div>
                  </td>
                </tr>
              ) : data.rows.length === 0 ? (
                <tr>
                  <td colSpan={7 + data.columns.length} className="py-16 text-center text-muted-foreground">
                    No matching vendors found.
                  </td>
                </tr>
              ) : (
                data.rows.map(({ vendor, requirements }) => (
                  <tr key={vendor.id} className="hover:bg-muted/30 transition-colors">
                    {/* Sticky Vendor Identity */}
                    <td className="py-3 px-4 font-semibold text-foreground sticky left-0 z-20 bg-card shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <p className="font-bold text-foreground truncate max-w-[190px]">{vendor.companyName}</p>
                      <p className="text-[10px] text-muted-foreground font-normal truncate max-w-[190px]">
                        {vendor.contactPerson} ({vendor.email})
                      </p>
                    </td>

                    {/* Entity Type */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] capitalize font-medium">
                        {vendor.vendorType === "freelancer" ? (
                          <span className="flex items-center gap-1 text-indigo-600">
                            <User className="w-3 h-3" /> Freelancer
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-primary">
                            <Building2 className="w-3 h-3" /> Company
                          </span>
                        )}
                      </span>
                    </td>

                    {/* Engagement Type */}
                    <td className="py-3 px-3 text-center capitalize text-[11px] text-muted-foreground">
                      {vendor.engagementType || "Permanent"}
                    </td>

                    {/* Compliance Status */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize ${
                          vendor.complianceStatus === "compliant"
                            ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                            : vendor.complianceStatus === "under_review"
                            ? "bg-blue-500/15 text-blue-700 border-blue-500/30"
                            : vendor.complianceStatus === "pending"
                            ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                            : "bg-rose-500/15 text-rose-700 border-rose-500/30"
                        }`}
                      >
                        {vendor.complianceStatus?.replace(/_/g, " ") || "Unassessed"}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="py-3 px-3 text-center font-bold text-foreground">
                      {vendor.complianceScore ?? 0}%
                    </td>

                    {/* Deadline */}
                    <td className="py-3 px-3 text-center text-[11px] text-muted-foreground">
                      {vendor.complianceDeadline
                        ? new Date(vendor.complianceDeadline).toLocaleDateString()
                        : "No deadline"}
                    </td>

                    {/* Dynamic Requirement Cells */}
                    {data.columns.map((col) => {
                      const req = requirements[col.ruleKey];
                      return (
                        <td
                          key={col.id}
                          onClick={() => {
                            if (req) {
                              setSelectedCell({
                                vendorId: vendor.id,
                                vendorName: vendor.companyName,
                                requirement: req,
                              });
                            }
                          }}
                          className={`py-3 px-3 text-center border-l border-border/50 ${
                            req ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                          }`}
                        >
                          {renderCellBadge(req)}
                        </td>
                      );
                    })}

                    {/* Sticky Action Button */}
                    <td className="py-3 px-3 text-center sticky right-0 z-20 bg-card shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyVendorLink(vendor.id)}
                        className="h-7 w-7 p-0 rounded-lg"
                        title="Copy Completion Link"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <p>
            Showing {data.rows.length} of {data.pagination.totalVendors} total active vendors
          </p>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 rounded-xl gap-1 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </Button>

            <span className="font-semibold text-foreground px-2">
              Page {data.pagination.page} of {data.pagination.totalPages || 1}
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.pagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 rounded-xl gap-1 text-xs"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Verification Drawer */}
      {selectedCell && (
        <VendorVerificationDrawer
          open={!!selectedCell}
          onOpenChange={(open) => {
            if (!open) setSelectedCell(null);
          }}
          vendorId={selectedCell.vendorId}
          vendorName={selectedCell.vendorName}
          assignedRequirement={selectedCell.requirement}
          onVerificationComplete={fetchMatrix}
        />
      )}
    </div>
  );
}
