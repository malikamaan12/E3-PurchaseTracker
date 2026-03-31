import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { EnhancedNotificationsDropdown } from "@/components/EnhancedNotificationsDropdown";
import { 
  Plus, LogOut, Search, Download, Settings, FileArchive, FileSpreadsheet, Table as TableIcon,
  FileText, FileEdit, Files, Clock, CheckCircle, XCircle, PencilRuler, CircleCheck, ArrowDownToLine
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardFilterPanel, type FilterValues } from "@/components/DashboardFilterPanel";
import { BulkExportButton } from "@/components/BulkExportButton";
import { isWithinInterval, parseISO, isSameDay } from "date-fns";
import { type RequestData } from "@/types/requests";
import { useVendors } from "@/hooks/use-vendors";
import { useSubPurposes } from "@/hooks/use-sub-purposes";
import { ThemeToggle } from "@/components/ThemeToggle";

// Brand colors - Use CSS variables from theme.json instead of hardcoded values
// These fallbacks ensure compatibility but we should rely on theme tokens
const BRAND = {
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
};

interface RequestCounts {
  myRequests: number;
  draftsToSubmit: number;
  allRequests: number;
  pending: number;
  approved: number;
  rejected: number;
  changes: number;
  approvals: number;
}

export default function Dashboard() {
  // Core hooks and state
  const { user, logout } = useUser();
  const { requests, isLoading } = usePurchaseRequests();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { vendors = [] } = useVendors();
  const { subPurposes = [] } = useSubPurposes();
  

  // Local state
  const [activeFilters, setActiveFilters] = useState<FilterValues>({
    status: [],
    dateRange: { from: undefined, to: undefined },
    priority: [],
    department: [],
    purposeType: [],
    subPurposeId: null,
    vendorId: null,
    costRange: { min: "", max: "" },
    searchQuery: "",
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("my-requests");

  // Handle tab navigation for special tabs
  useEffect(() => {
    if (activeTab === "export") {
      setLocation("/export");
      // Reset to default tab after navigation
      setActiveTab("my-requests");
    }
  }, [activeTab, setLocation]);

  // Role-based access control
  const isAdmin = useMemo(() => user?.role === "admin", [user?.role]);
  const isSpecialRole = useMemo(() => (
    user?.role === "admin" ||
    user?.role === "approver" ||
    user?.department === "CEO Office" ||
    user?.department === "Director" ||
    user?.department === "Finance"
  ), [user?.role, user?.department]);

  // Safe requests array
  const safeRequests = useMemo(() => requests || [], [requests]);

  // Check if user is an additional approver for any requests
  const isAdditionalApprover = useMemo(() => {
    if (!user?.department || !Array.isArray(safeRequests)) return false;
    
    return safeRequests.some(request => {
      let additionalApprovers: string[] = [];
      
      // Handle both string and array formats for additionalApprovers
      if (typeof request.additionalApprovers === 'string') {
        try {
          additionalApprovers = JSON.parse(request.additionalApprovers);
        } catch (e) {
          additionalApprovers = [];
        }
      } else if (Array.isArray(request.additionalApprovers)) {
        additionalApprovers = request.additionalApprovers;
      }
      
      return additionalApprovers.includes(user.department);
    });
  }, [user?.department, safeRequests]);

  // Enhanced role check that includes additional approvers
  const hasExtendedAccess = useMemo(() => isAdmin || isSpecialRole || isAdditionalApprover, [isAdmin, isSpecialRole, isAdditionalApprover]);

  // Filtering logic
  const getFilteredRequests = useCallback((currentTab: string): RequestData[] => {
    if (!Array.isArray(safeRequests)) return [];

    let filtered = [...safeRequests];

    // Tab-specific filters
    switch (currentTab) {
      case "my-requests":
        filtered = filtered.filter(r => r.requesterId === user?.id);
        break;
      case "drafts-to-submit":
        filtered = filtered.filter(r => 
          r.requesterId === user?.id &&
          r.status === "draft" &&
          r.title &&
          r.description &&
          Array.isArray(r.items) &&
          r.items.length > 0
        );
        break;
      case "pending":
        filtered = filtered.filter(r => r.status === "pending");
        break;
      case "approved":
        filtered = filtered.filter(r => r.status === "approved");
        break;
      case "rejected":
        filtered = filtered.filter(r => r.status === "rejected");
        break;
      case "changes":
        filtered = filtered.filter(r =>
          r.status === "changes_requested" ||
          r.approvals?.some((a: { status: string }) => a.status === "changes_requested")
        );
        break;
      case "approvals":
        if (!user) return [];
        filtered = filtered.filter(request => {
          if (request.status !== "pending") return false;
          if (request.requesterId === user.id) return false;
          const departmentApproval = request.approvals?.find(
            (a: { department: string, status: string }) => a.department === user.department
          );
          return !departmentApproval || departmentApproval.status === "pending";
        });
        break;
      // Default case to handle 'all-requests' tab
      default:
        break;
    }

    // Apply status filter
    if (activeFilters.status.length > 0) {
      filtered = filtered.filter(r => activeFilters.status.includes(r.status));
    }

    // Apply priority filter
    if (activeFilters.priority.length > 0) {
      filtered = filtered.filter(r => 
        r.priority && activeFilters.priority.includes(r.priority.toLowerCase())
      );
    }

    // Apply department filter
    if (activeFilters.department.length > 0) {
      filtered = filtered.filter(r => 
        r.requester?.department && activeFilters.department.includes(r.requester.department)
      );
    }

    // Apply purpose type filter
    if (activeFilters.purposeType.length > 0) {
      filtered = filtered.filter(r => 
        r.purposeType && activeFilters.purposeType.includes(r.purposeType)
      );
    }

    // Apply sub-purpose filter
    if (activeFilters.subPurposeId !== null) {
      filtered = filtered.filter(r => r.subPurposeId === activeFilters.subPurposeId);
    }

    // Apply vendor filter
    if (activeFilters.vendorId !== null) {
      filtered = filtered.filter(r => 
        r.items?.some((item: { vendorId?: number }) => item.vendorId === activeFilters.vendorId)
      );
    }

    // Apply cost range filter
    if (activeFilters.costRange.min || activeFilters.costRange.max) {
      filtered = filtered.filter(r => {
        const cost = Number(r.totalEstimatedCost) || 0;
        const min = activeFilters.costRange.min ? Number(activeFilters.costRange.min) : 0;
        const max = activeFilters.costRange.max ? Number(activeFilters.costRange.max) : Infinity;

        return cost >= min && cost <= max;
      });
    }

    // Apply search query filter
    if (activeFilters.searchQuery) {
      const query = activeFilters.searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        (r.title && r.title.toLowerCase().includes(query)) ||
        (r.description && r.description.toLowerCase().includes(query)) ||
        (r.requestNumber && r.requestNumber.toLowerCase().includes(query)) ||
        (r.requester?.username && r.requester.username.toLowerCase().includes(query))
      );
    }

    // Apply date range filter
    if (activeFilters.dateRange.from || activeFilters.dateRange.to) {
      filtered = filtered.filter(r => {
        if (!r.createdAt) return false;
        const requestDate = parseISO(r.createdAt);

        if (activeFilters.dateRange.from && activeFilters.dateRange.to) {
          // Include the end date by extending it to the end of the day
          const adjustedEndDate = new Date(activeFilters.dateRange.to);
          adjustedEndDate.setHours(23, 59, 59, 999);

          return isWithinInterval(requestDate, {
            start: activeFilters.dateRange.from,
            end: adjustedEndDate,
          });
        }
        if (activeFilters.dateRange.from) {
          return requestDate >= activeFilters.dateRange.from;
        }
        if (activeFilters.dateRange.to) {
          // Include the end date by extending it to the end of the day
          const adjustedEndDate = new Date(activeFilters.dateRange.to);
          adjustedEndDate.setHours(23, 59, 59, 999);

          return requestDate <= adjustedEndDate;
        }
        return true;
      });
    }

    return filtered;
  }, [safeRequests, user, activeFilters]);

  // Update department list from requests - use useMemo instead of useEffect to prevent unnecessary re-renders
  useMemo(() => {
    if (Array.isArray(safeRequests)) {
      const uniqueDepartments = Array.from(
        new Set(
          safeRequests
            .map((r) => r.requester?.department)
            .filter((d): d is string => !!d)
        )
      );
      
      // Only update if departments actually changed
      if (JSON.stringify(uniqueDepartments) !== JSON.stringify(departments)) {
        setDepartments(uniqueDepartments);
      }
    }
  }, [safeRequests, departments]);

  // Calculate filtered requests for each category
  const categorizedRequests = useMemo(() => ({
    myRequests: getFilteredRequests("my-requests"),
    draftsToSubmit: getFilteredRequests("drafts-to-submit"),
    pending: getFilteredRequests("pending"),
    approved: getFilteredRequests("approved"),
    rejected: getFilteredRequests("rejected"),
    changes: getFilteredRequests("changes"),
    approvals: getFilteredRequests("approvals"),
    allRequests: getFilteredRequests("all-requests") // Added allRequests
  }), [getFilteredRequests]);

  // Request counts
  const requestCounts: RequestCounts = useMemo(() => ({
    myRequests: categorizedRequests.myRequests.length,
    draftsToSubmit: categorizedRequests.draftsToSubmit.length,
    allRequests: categorizedRequests.allRequests.length, // Use categorizedRequests.allRequests
    pending: categorizedRequests.pending.length,
    approved: categorizedRequests.approved.length,
    rejected: categorizedRequests.rejected.length,
    changes: categorizedRequests.changes.length,
    approvals: categorizedRequests.approvals.length
  }), [categorizedRequests]);

  const showApprovalsTab = useMemo(() => 
    requestCounts.approvals > 0
  , [requestCounts.approvals]);

  // Event handlers
  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    console.log("Filter changed:", newFilters);
    setActiveFilters(newFilters);

    // Show toast notification for filter changes
    toast({
      title: "Filters Applied",
      description: `Applied ${Object.entries(newFilters).filter(([_, value]) => 
        Array.isArray(value) ? value.length > 0 : 
        value && typeof value === 'object' ? Object.values(value).some(v => !!v) : 
        !!value
      ).length} filters`,
      variant: "default",
    });
  }, [toast]);

  const handleExport = async (format: "xlsx" | "csv") => {
    try {
      const response = await fetch(`/api/requests/export?format=${format}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `procurement_report_${date}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number | string, currency: string = "QAR") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(Number(amount));
  };



  // Render methods
  const renderRequestsTable = (requests: RequestData[], showApproval: boolean = false) => {
    if (!Array.isArray(requests)) return null;

    if (requests.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground dark:text-gray-400">
          No requests found matching your filters
        </div>
      );
    }

    // Responsive design - Show cards on mobile, table on larger screens
    return (
      <>
        {/* Mobile view - Cards */}
        <div className="md:hidden space-y-4">
          {requests.map((request) => (
            <div 
              key={request.id} 
              className="bg-white dark:bg-gray-800 border border-[#35bbba]/20 dark:border-[#35bbba]/40 rounded-lg p-4 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    {request.requestNumber}
                  </div>
                  <h3 className="font-semibold text-base mt-1">{request.title}</h3>
                </div>
                <Badge
                  className={cn(
                    "transition-colors",
                    request.status === "approved"
                      ? "bg-[#35bbba]/10 text-[#35bbba] border-[#35bbba]/20 dark:bg-[#35bbba]/20 dark:border-[#35bbba]/30"
                      : request.status === "rejected"
                      ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30"
                      : request.status === "changes_requested"
                      ? "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30"
                      : request.status === "pending"
                      ? "bg-[#7156a2]/10 text-[#7156a2] border-[#7156a2]/20 dark:bg-[#7156a2]/20 dark:border-[#7156a2]/30"
                      : "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                  )}
                >
                  {request.status.toUpperCase().replace("_", " ")}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Priority:</span>{" "}
                  <span className="font-medium capitalize">{request.priority}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Department:</span>{" "}
                  <span className="font-medium">{request.requester?.department}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Created:</span>{" "}
                  <span className="font-medium">
                    {request.createdAt && format(new Date(request.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Total:</span>{" "}
                  <span className="font-medium">{formatCurrency(request.totalEstimatedCost || 0, request.currency)}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation(`/requests/${request.id}`)}
                  className="hover:bg-[#7156a2]/10 hover:text-[#7156a2] transition-colors dark:hover:bg-[#7156a2]/20"
                >
                  View
                </Button>
                {(isAdmin || (request.status === "draft" && request.requesterId === user?.id)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation(`/requests/${request.id}/edit`)}
                    className="text-[#35bbba] hover:text-[#35bbba] hover:bg-[#35bbba]/10 dark:hover:bg-[#35bbba]/20"
                  >
                    Edit
                  </Button>
                )}
                {showApproval && request.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation(`/requests/${request.id}`)}
                    className="text-[#35bbba] hover:text-[#35bbba] hover:bg-[#35bbba]/10 dark:hover:bg-[#35bbba]/20"
                  >
                    Review
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop view - Table */}
        <div className="hidden md:block rounded-lg border border-[#35bbba]/20 dark:border-[#35bbba]/40 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#7156a2]/20 dark:border-[#7156a2]/40 bg-[#7156a2]/5 dark:bg-[#7156a2]/10">
                  <TableHead className="font-semibold">Request #</TableHead>
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Priority</TableHead>
                  <TableHead className="font-semibold">Department</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold">Total Cost</TableHead>
                  <TableHead className="w-[200px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className="hover:bg-[#35bbba]/5 dark:hover:bg-[#35bbba]/10 transition-colors">
                    <TableCell className="font-medium">
                      {request.requestNumber}
                    </TableCell>
                    <TableCell>{request.title}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "transition-colors",
                          request.status === "approved"
                            ? "bg-[#35bbba]/10 text-[#35bbba] border-[#35bbba]/20 dark:bg-[#35bbba]/20 dark:border-[#35bbba]/30"
                            : request.status === "rejected"
                            ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30"
                            : request.status === "changes_requested"
                            ? "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30"
                            : request.status === "pending"
                            ? "bg-[#7156a2]/10 text-[#7156a2] border-[#7156a2]/20 dark:bg-[#7156a2]/20 dark:border-[#7156a2]/30"
                            : "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                        )}
                      >
                        {request.status.toUpperCase().replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {request.priority}
                    </TableCell>
                    <TableCell>{request.requester?.department}</TableCell>
                    <TableCell>
                      {request.createdAt && format(new Date(request.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(request.totalEstimatedCost || 0, request.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/requests/${request.id}`)}
                          className="hover:bg-[#7156a2]/10 hover:text-[#7156a2] transition-colors dark:hover:bg-[#7156a2]/20"
                        >
                          View
                        </Button>
                        {(isAdmin || (request.status === "draft" && request.requesterId === user?.id)) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/requests/${request.id}/edit`)}
                            className="text-[#35bbba] hover:text-[#35bbba] hover:bg-[#35bbba]/10 dark:hover:bg-[#35bbba]/20"
                          >
                            Edit
                          </Button>
                        )}
                        {showApproval && request.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/requests/${request.id}`)}
                            className="text-[#35bbba] hover:text-[#35bbba] hover:bg-[#35bbba]/10 dark:hover:bg-[#35bbba]/20"
                          >
                            Review
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                Purchase Management System
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Welcome, {user?.username} ({user?.department})
              </p>
            </div>
            <div className="flex flex-row flex-wrap items-center gap-1.5 sm:gap-3 w-full sm:w-auto justify-end mt-2 sm:mt-0">
              {isAdmin && (
                <Link href="/admin">
                  <Button size="sm" variant="outline" className="border-[#7156a2]/20 hover:bg-[#7156a2]/10 dark:border-[#7156a2]/50 dark:hover:bg-[#7156a2]/30 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-3">
                    <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </Link>
              )}
              <Link href="/new-request">
                <Button size="sm" className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-3">
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Request</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </Link>
              <EnhancedNotificationsDropdown />
              <ThemeToggle />
              <Button
                size="sm"
                variant="outline"
                className="border-[#7156a2]/20 hover:bg-[#7156a2]/10 dark:border-[#7156a2]/50 dark:hover:bg-[#7156a2]/30 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-3"
                onClick={async () => {
                  try {
                    await logout();
                    window.location.href = '/login';
                  } catch (error) {
                    console.error('Logout error:', error);
                  }
                }}
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Card className="mb-6 border-[#35bbba]/20 dark:border-[#35bbba]/40 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:flex-1 mb-3 sm:mb-0">
                <Input
                  placeholder="Search requests..."
                  value={activeFilters.searchQuery}
                  onChange={(e) => handleFilterChange({
                    ...activeFilters,
                    searchQuery: e.target.value,
                  })}
                  className="pl-8 border-[#7156a2]/20 focus:border-[#7156a2]/50 focus:ring-[#7156a2]/50 dark:border-[#7156a2]/40 dark:focus:border-[#7156a2]/70 dark:focus:ring-[#7156a2]/70"
                />
                <Search className="h-4 w-4 absolute left-2 top-3 text-gray-400 dark:text-gray-500" />
              </div>
              {isAdmin && (
                <div className="w-full sm:w-auto flex justify-center">
                  <Link href="/export" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto bg-[#35bbba]/10 hover:bg-[#35bbba]/20 text-[#35bbba] dark:bg-[#35bbba]/20 dark:hover:bg-[#35bbba]/30 dark:text-[#35bbba]">
                      <FileText className="h-4 w-4 mr-2" />
                      Bulk Export
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <DashboardFilterPanel
          onFilterChange={handleFilterChange}
          departments={departments}
          vendors={vendors}
          subPurposes={subPurposes}
          isLoading={isFilterLoading}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="my-requests" className="space-y-6">
          {/* Tabs navigation - desktop and mobile */}
          <div className="pb-4">
            {/* Desktop view - standard row */}
            <div className="hidden sm:block overflow-x-auto">
              <TabsList className="mb-6 bg-white dark:bg-gray-900 border border-[#7156a2]/20 dark:border-[#7156a2]/40 p-1 w-max min-w-full">
                <TabsTrigger value="my-requests" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white text-sm">
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    <span>My Requests</span>
                  </span>
                  <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 dark:bg-white/5 border-white/20 transition-colors">
                    {requestCounts.myRequests}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="drafts-to-submit" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white text-sm">
                  <span className="flex items-center">
                    <FileEdit className="h-4 w-4 mr-2" />
                    <span>Ready to Submit</span>
                  </span>
                  <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 dark:bg-white/5 border-white/20 transition-colors">
                    {requestCounts.draftsToSubmit}
                  </Badge>
                </TabsTrigger>
                {(isAdmin || hasExtendedAccess) && (
                  <>
                    <TabsTrigger value="all-requests" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white text-sm">
                      <span className="flex items-center">
                        <Files className="h-4 w-4 mr-2" />
                        <span>All Requests</span>
                      </span>
                      <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 dark:bg-white/5 border-white/20 transition-colors">
                        {requestCounts.allRequests}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white text-sm">
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>Pending</span>
                      </span>
                      <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 dark:bg-white/5 border-white/20 transition-colors">
                        {requestCounts.pending}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white text-sm">
                      <span className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span>Approved</span>
                      </span>
                      <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 dark:bg-white/5 border-white/20 transition-colors">
                        {requestCounts.approved}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white text-sm">
                      <span className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2" />
                        <span>Rejected</span>
                      </span>
                      <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 dark:bg-white/5 border-white/20 transition-colors">
                        {requestCounts.rejected}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="changes" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white text-sm">
                      <span className="flex items-center">
                        <PencilRuler className="h-4 w-4 mr-2" />
                        <span>Changes Requested</span>
                      </span>
                      <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 dark:bg-white/5 border-white/20 transition-colors">
                        {requestCounts.changes}
                      </Badge>
                    </TabsTrigger>
                  </>
                )}
                {!isAdmin && !isSpecialRole && showApprovalsTab && (
                  <TabsTrigger value="approvals" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white text-sm">
                    <span className="flex items-center">
                      <CircleCheck className="h-4 w-4 mr-2" />
                      <span>Pending Approvals</span>
                    </span>
                    <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 dark:bg-white/5 border-white/20 transition-colors">
                      {requestCounts.approvals}
                    </Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
            
            {/* Mobile view - matching the screenshot layout */}
            <div className="sm:hidden mb-4">
              <TabsList className="hidden">
                {/* Hidden TabsList to satisfy the Tabs component structure */}
                <TabsTrigger value="placeholder" />
              </TabsList>
              
              <div className="pt-1 pb-3">
                {/* First row - Main tabs (4 items) */}
                <div className="grid grid-cols-4 gap-x-4 mb-6">
                  <div 
                    onClick={() => setActiveTab("my-requests")}
                    className={`flex flex-col items-center ${activeTab === "my-requests" ? "text-[#7156a2]" : "text-gray-600 dark:text-gray-400"}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 ${activeTab === "my-requests" ? "bg-[#eeeaf5] dark:bg-[#7156a2]/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="text-xs font-medium">My</div>
                    <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                      {requestCounts.myRequests}
                    </div>
                  </div>
                  
                  <div 
                    onClick={() => setActiveTab("drafts-to-submit")}
                    className={`flex flex-col items-center ${activeTab === "drafts-to-submit" ? "text-[#7156a2]" : "text-gray-600 dark:text-gray-400"}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 ${activeTab === "drafts-to-submit" ? "bg-[#eeeaf5] dark:bg-[#7156a2]/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                      <FileEdit className="h-6 w-6" />
                    </div>
                    <div className="text-xs font-medium">Drafts</div>
                    <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                      {requestCounts.draftsToSubmit}
                    </div>
                  </div>
                  
                  {(isAdmin || hasExtendedAccess) && (
                    <div 
                      onClick={() => setActiveTab("all-requests")}
                      className={`flex flex-col items-center ${activeTab === "all-requests" ? "text-[#7156a2]" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 ${activeTab === "all-requests" ? "bg-[#eeeaf5] dark:bg-[#7156a2]/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <Files className="h-6 w-6" />
                      </div>
                      <div className="text-xs font-medium">All</div>
                      <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                        {requestCounts.allRequests}
                      </div>
                    </div>
                  )}
                  

                  
                  {!isAdmin && !isSpecialRole && showApprovalsTab && (
                    <div 
                      onClick={() => setActiveTab("approvals")}
                      className={`flex flex-col items-center ${activeTab === "approvals" ? "text-[#7156a2]" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 ${activeTab === "approvals" ? "bg-[#eeeaf5] dark:bg-[#7156a2]/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <CircleCheck className="h-6 w-6" />
                      </div>
                      <div className="text-xs font-medium">Approvals</div>
                      <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                        {requestCounts.approvals}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Second row for status tabs (4 items) */}
                {(isAdmin || hasExtendedAccess) && (
                  <div className="grid grid-cols-4 gap-x-4">
                    <div 
                      onClick={() => setActiveTab("pending")}
                      className={`flex flex-col items-center ${activeTab === "pending" ? "text-[#7156a2]" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 ${activeTab === "pending" ? "bg-[#eeeaf5] dark:bg-[#7156a2]/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <Clock className="h-6 w-6" />
                      </div>
                      <div className="text-xs font-medium">Pending</div>
                      <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                        {requestCounts.pending}
                      </div>
                    </div>
                    
                    <div 
                      onClick={() => setActiveTab("approved")}
                      className={`flex flex-col items-center ${activeTab === "approved" ? "text-[#7156a2]" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 ${activeTab === "approved" ? "bg-[#eeeaf5] dark:bg-[#7156a2]/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <CheckCircle className="h-6 w-6" />
                      </div>
                      <div className="text-xs font-medium">Approved</div>
                      <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                        {requestCounts.approved}
                      </div>
                    </div>
                    
                    <div 
                      onClick={() => setActiveTab("rejected")}
                      className={`flex flex-col items-center ${activeTab === "rejected" ? "text-[#7156a2]" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 ${activeTab === "rejected" ? "bg-[#eeeaf5] dark:bg-[#7156a2]/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <XCircle className="h-6 w-6" />
                      </div>
                      <div className="text-xs font-medium">Rejected</div>
                      <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                        {requestCounts.rejected}
                      </div>
                    </div>
                    
                    <div 
                      onClick={() => setActiveTab("changes")}
                      className={`flex flex-col items-center ${activeTab === "changes" ? "text-[#7156a2]" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 ${activeTab === "changes" ? "bg-[#eeeaf5] dark:bg-[#7156a2]/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <PencilRuler className="h-6 w-6" />
                      </div>
                      <div className="text-xs font-medium">Changes</div>
                      <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                        {requestCounts.changes}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-[#35bbba]/20 dark:border-[#35bbba]/40 shadow-lg p-4 sm:p-6">
            <TabsContent value="my-requests">
              {renderRequestsTable(categorizedRequests.myRequests)}
            </TabsContent>
            <TabsContent value="drafts-to-submit">
              {renderRequestsTable(categorizedRequests.draftsToSubmit)}
            </TabsContent>
            {(isAdmin || hasExtendedAccess) && (
              <>
                <TabsContent value="all-requests">
                  {renderRequestsTable(categorizedRequests.allRequests)}
                </TabsContent>
                <TabsContent value="pending">
                  {renderRequestsTable(categorizedRequests.pending, isAdmin)}
                </TabsContent>
                <TabsContent value="approved">
                  {renderRequestsTable(categorizedRequests.approved)}
                </TabsContent>
                <TabsContent value="rejected">
                  {renderRequestsTable(categorizedRequests.rejected)}
                </TabsContent>
                <TabsContent value="changes">
                  {renderRequestsTable(categorizedRequests.changes)}
                </TabsContent>
              </>
            )}
            {!isAdmin && !isSpecialRole && showApprovalsTab && (
              <TabsContent value="approvals">
                {renderRequestsTable(categorizedRequests.approvals, true)}
              </TabsContent>
            )}
          </div>
        </Tabs>
      </main>
    </div>
  );
}