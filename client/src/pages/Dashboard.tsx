import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { Plus, LogOut, Search, Download, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDashboardPreferences, DEFAULT_PREFERENCES } from "@/hooks/use-dashboard-preferences";
import DashboardPreferences from "@/components/DashboardPreferences";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardFilterPanel, type FilterValues } from "@/components/DashboardFilterPanel";
import { isWithinInterval, parseISO, isSameDay } from "date-fns";
import { type RequestData } from "@/types/requests";
import { useVendors } from "@/hooks/use-vendors";
import { useSubPurposes } from "@/hooks/use-sub-purposes";

// Brand colors
const BRAND = {
  primary: '#7156a2',
  secondary: '#35bbba',
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
  const { preferences, updatePreferences } = useDashboardPreferences();
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
          r.approvals?.some(a => a.status === "changes_requested")
        );
        break;
      case "approvals":
        if (!user) return [];
        filtered = filtered.filter(request => {
          if (request.status !== "pending") return false;
          if (request.requesterId === user.id) return false;
          const departmentApproval = request.approvals?.find(
            a => a.department === user.department
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
        r.items?.some(item => item.vendorId === activeFilters.vendorId)
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

  // Update department list from requests
  useEffect(() => {
    if (Array.isArray(safeRequests)) {
      const uniqueDepartments = Array.from(
        new Set(
          safeRequests
            .map((r) => r.requester?.department)
            .filter((d): d is string => !!d)
        )
      );
      setDepartments(uniqueDepartments);
    }
  }, [safeRequests]);

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

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "QAR",
    }).format(Number(amount));
  };

  const handleNotificationClick = (notification: { id: number; link: string | null }) => {
    if (notification.link) {
      setLocation(notification.link);
    }
  };

  // Render methods
  const renderRequestsTable = (requests: RequestData[], showApproval: boolean = false) => {
    if (!Array.isArray(requests)) return null;

    if (requests.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          No requests found matching your filters
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-[#35bbba]/20 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#7156a2]/20 bg-[#7156a2]/5">
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
              <TableRow key={request.id} className="hover:bg-[#35bbba]/5 transition-colors">
                <TableCell className="font-medium">
                  {request.requestNumber}
                </TableCell>
                <TableCell>{request.title}</TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      "transition-colors",
                      request.status === "approved"
                        ? "bg-[#35bbba]/10 text-[#35bbba] border-[#35bbba]/20"
                        : request.status === "rejected"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : request.status === "changes_requested"
                        ? "bg-orange-100 text-orange-800 border-orange-200"
                        : request.status === "pending"
                        ? "bg-[#7156a2]/10 text-[#7156a2] border-[#7156a2]/20"
                        : "bg-gray-100 text-gray-800 border-gray-200"
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
                  {formatCurrency(request.totalEstimatedCost || 0)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(`/requests/${request.id}`)}
                      className="hover:bg-[#7156a2]/10 hover:text-[#7156a2] transition-colors"
                    >
                      View
                    </Button>
                    {(isAdmin || (request.status === "draft" && request.requesterId === user?.id)) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/requests/${request.id}/edit`)}
                        className="text-[#35bbba] hover:text-[#35bbba] hover:bg-[#35bbba]/10"
                      >
                        Edit
                      </Button>
                    )}
                    {showApproval && request.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/requests/${request.id}`)}
                        className="text-[#35bbba] hover:text-[#35bbba] hover:bg-[#35bbba]/10"
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
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7156a2] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Purchase Management System
              </h1>
              <p className="text-sm text-gray-600">
                Welcome, {user?.username} ({user?.department})
              </p>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="outline" className="border-[#7156a2]/20 hover:bg-[#7156a2]/10">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin Panel
                  </Button>
                </Link>
              )}
              <Link href="/new-request">
                <Button className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </Link>
              <NotificationsDropdown onNotificationClick={handleNotificationClick} />
              <DashboardPreferences
                preferences={preferences || DEFAULT_PREFERENCES}
                onUpdate={updatePreferences}
              />
              <Button
                variant="outline"
                className="border-[#7156a2]/20 hover:bg-[#7156a2]/10"
                onClick={() => logout()}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6 border-[#35bbba]/20 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex justify-between gap-4">
              <div className="relative flex-1">
                <Input
                  placeholder="Search requests..."
                  value={activeFilters.searchQuery}
                  onChange={(e) => handleFilterChange({
                    ...activeFilters,
                    searchQuery: e.target.value,
                  })}
                  className="pl-8 border-[#7156a2]/20 focus:border-[#7156a2]/50 focus:ring-[#7156a2]/50"
                />
                <Search className="h-4 w-4 absolute left-2 top-3 text-gray-400" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="bg-[#35bbba]/10 hover:bg-[#35bbba]/20 text-[#35bbba]">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

        <Tabs defaultValue={(preferences?.defaultView || "my-requests")} className="space-y-6">
          <TabsList className="mb-8 bg-white border border-[#7156a2]/20 p-1">
            <TabsTrigger value="my-requests" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white">
              My Requests
              <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 border-white/20 transition-colors">
                {requestCounts.myRequests}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="drafts-to-submit" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white">
              Ready to Submit
              <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 border-white/20 transition-colors">
                {requestCounts.draftsToSubmit}
              </Badge>
            </TabsTrigger>
            {(isAdmin || isSpecialRole) && (
              <>
                <TabsTrigger value="all-requests" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white">
                  All Requests
                  <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 border-white/20 transition-colors">
                    {requestCounts.allRequests}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white">
                  Pending
                  <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 border-white/20 transition-colors">
                    {requestCounts.pending}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="approved" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white">
                  Approved
                  <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 border-white/20 transition-colors">
                    {requestCounts.approved}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="rejected" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white">
                  Rejected
                  <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 border-white/20 transition-colors">
                    {requestCounts.rejected}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="changes" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white">
                  Changes Requested
                  <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 border-white/20 transition-colors">
                    {requestCounts.changes}
                  </Badge>
                </TabsTrigger>
              </>
            )}
            {!isAdmin && !isSpecialRole && showApprovalsTab && (
              <TabsTrigger value="approvals" className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white">
                Pending Approvals
                <Badge variant="outline" className="ml-2.5 min-w-[2rem] px-2 py-0.5 rounded-full font-semibold text-xs bg-white/10 border-white/20 transition-colors">
                  {requestCounts.approvals}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <div className="bg-white rounded-lg border border-[#35bbba]/20 shadow-lg p-6">
            <TabsContent value="my-requests">
              {renderRequestsTable(categorizedRequests.myRequests)}
            </TabsContent>
            <TabsContent value="drafts-to-submit">
              {renderRequestsTable(categorizedRequests.draftsToSubmit)}
            </TabsContent>
            {(isAdmin || isSpecialRole) && (
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