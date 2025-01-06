import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { Plus, LogOut, Search, Download, Settings } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";
import DashboardPreferences from "@/components/DashboardPreferences";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { updateRequest } from "@/services/requests";
import { DashboardFilterPanel, type FilterValues } from "@/components/DashboardFilterPanel";
import { isWithinInterval, parseISO } from "date-fns";
import { type RequestData } from "@/types/requests";
import { useVendors } from "@/hooks/use-vendors";
import { useSubPurposes } from "@/hooks/use-sub-purposes";

export default function Dashboard() {
  const { user, logout } = useUser();
  const { requests = [], isLoading, error } = usePurchaseRequests();
  const { preferences, updatePreferences } = useDashboardPreferences();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeFilters, setActiveFilters] = useState<FilterValues>({
    status: [],
    dateRange: {
      from: undefined,
      to: undefined,
    },
    priority: [],
    department: [],
    purposeType: [],
    subPurposeId: null,
    vendorId: null,
    costRange: {
      min: "",
      max: "",
    },
    searchQuery: "",
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const { vendors = [] } = useVendors();
  const { subPurposes = [] } = useSubPurposes();

  // Effect to extract unique departments
  useEffect(() => {
    if (Array.isArray(requests)) {
      const uniqueDepartments = Array.from(
        new Set(
          requests
            .map((r) => r.requester?.department)
            .filter((d): d is string => !!d)
        )
      );
      setDepartments(uniqueDepartments);
    }
  }, [requests]);

  const isSpecialRole = useMemo(() => {
    const hasSpecialRole =
      user?.role === "admin" ||
      user?.role === "approver" ||
      user?.department === "CEO Office" ||
      user?.department === "Director" ||
      user?.department === "Finance";

    return hasSpecialRole;
  }, [user?.role, user?.department]);

  const isAdmin = useMemo(() => {
    return user?.role === "admin";
  }, [user?.role]);

  const isApprover = useMemo(() => {
    return user?.role === "approver";
  }, [user?.role]);

  // Function to apply filters based on tab and filter panel
  const getFilteredRequests = useCallback((allRequests: RequestData[], currentTab: string) => {
    if (!Array.isArray(allRequests)) return [];

    let filtered = [...allRequests];

    // First apply tab-specific filters
    switch (currentTab) {
      case "my-requests":
        filtered = filtered.filter(r => r?.requesterId === user?.id);
        break;
      case "drafts-to-submit":
        filtered = filtered.filter(r => 
          r?.requesterId === user?.id && 
          r?.status === "draft" &&
          r?.title &&
          r?.description &&
          Array.isArray(r?.items) &&
          r?.items.length > 0
        );
        break;
      case "pending":
        filtered = filtered.filter(r => r?.status === "pending");
        break;
      case "approved":
        filtered = filtered.filter(r => r?.status === "approved");
        break;
      case "rejected":
        filtered = filtered.filter(r => r?.status === "rejected");
        break;
      case "changes":
        filtered = filtered.filter(r => 
          r?.status === "changes_requested" ||
          (r?.approvals && r?.approvals.some(a => a.status === "changes_requested"))
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
    }

    // Then apply filter panel filters
    if (activeFilters.status.length > 0) {
      filtered = filtered.filter(r => activeFilters.status.includes(r.status));
    }

    if (activeFilters.dateRange.from || activeFilters.dateRange.to) {
      filtered = filtered.filter(r => {
        const requestDate = parseISO(r.createdAt);
        if (activeFilters.dateRange.from && activeFilters.dateRange.to) {
          return isWithinInterval(requestDate, {
            start: activeFilters.dateRange.from,
            end: activeFilters.dateRange.to,
          });
        }
        if (activeFilters.dateRange.from) {
          return requestDate >= activeFilters.dateRange.from;
        }
        if (activeFilters.dateRange.to) {
          return requestDate <= activeFilters.dateRange.to;
        }
        return true;
      });
    }

    if (activeFilters.priority.length > 0) {
      filtered = filtered.filter(r => activeFilters.priority.includes(r.priority));
    }

    if (activeFilters.department.length > 0) {
      filtered = filtered.filter(r =>
        activeFilters.department.includes(r.requester?.department || '')
      );
    }

    if (activeFilters.purposeType.length > 0) {
      filtered = filtered.filter(r =>
        activeFilters.purposeType.includes(r.purposeType)
      );
    }

    if (activeFilters.subPurposeId !== null) {
      filtered = filtered.filter(r => r.subPurposeId === activeFilters.subPurposeId);
    }

    if (activeFilters.vendorId !== null) {
      filtered = filtered.filter(r => r.vendorId === activeFilters.vendorId);
    }

    if (activeFilters.costRange.min || activeFilters.costRange.max) {
      filtered = filtered.filter(r => {
        const cost = r.totalEstimatedCost || 0;
        const min = activeFilters.costRange.min
          ? parseFloat(activeFilters.costRange.min)
          : -Infinity;
        const max = activeFilters.costRange.max
          ? parseFloat(activeFilters.costRange.max)
          : Infinity;
        return cost >= min && cost <= max;
      });
    }

    if (activeFilters.searchQuery) {
      const query = activeFilters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.title.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.requestNumber.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activeFilters, user]);

  // Function to handle filter changes
  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    setActiveFilters(newFilters);
  }, []);

  // Get filtered requests based on current tab
  const getTabContent = useCallback((tabValue: string) => {
    const filteredRequests = getFilteredRequests(requests, tabValue);
    return renderRequestsTable(filteredRequests, tabValue === "approvals" || (isAdmin && tabValue === "pending"));
  }, [requests, getFilteredRequests, isAdmin]);

  const pendingApprovals = useMemo(() => {
    if (!user || !Array.isArray(requests)) return [];

    return getFilteredRequests(requests, "approvals");
  }, [requests, user, getFilteredRequests]);

  const showApprovalsTab = useMemo(() => {
    return pendingApprovals.length > 0;
  }, [pendingApprovals.length]);

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

  const deleteRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });

      toast({
        title: "Success",
        description: "Request deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete request",
        variant: "destructive",
      });
    }
  };

  const handleDraftSubmit = async (requestId: number) => {
    try {
      await updateRequest({
        id: requestId,
        data: { status: "pending" },
      });

      toast({
        title: "Success",
        description: "Draft request submitted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    }
  };

  const renderRequestsTable = (
    requests: RequestData[],
    showApproval: boolean = false
  ) => {
    const canSubmitDraft = (request: RequestData) => {
      return (
        request.status === "draft" &&
        request.requesterId === user?.id &&
        request.title &&
        request.description &&
        Array.isArray(request.items) &&
        request.items.length > 0
      );
    };

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request #</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Total Cost</TableHead>
            <TableHead className="w-[200px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => {
            if (!request) return null;

            return (
              <TableRow key={request.id}>
                <TableCell className="font-medium">
                  {request.requestNumber}
                </TableCell>
                <TableCell>{request.title}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      request.status === "draft"
                        ? "bg-gray-500/10 text-gray-600"
                        : request.status === "pending"
                        ? "bg-yellow-500/10 text-yellow-700"
                        : request.status === "approved"
                        ? "bg-green-500/10 text-green-700"
                        : request.status === "rejected"
                        ? "bg-red-500/10 text-red-700"
                        : "bg-orange-500/10 text-orange-700"
                    }
                  >
                    {request.status.toUpperCase().replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">
                  {request.priority}
                </TableCell>
                <TableCell>{request.requester?.department}</TableCell>
                <TableCell>
                  {format(new Date(request.createdAt), "MMM d, yyyy")}
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
                    >
                      View
                    </Button>
                    {(isAdmin ||
                      (request.status === "draft" &&
                        request.requesterId === user?.id)) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setLocation(`/requests/${request.id}/edit`)
                          }
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Request
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this request? This
                                action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() =>
                                  deleteRequest(request.id.toString())
                                }
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    {canSubmitDraft(request) && (
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white ml-2"
                        onClick={() => handleDraftSubmit(request.id)}
                      >
                        Submit Draft
                      </Button>
                    )}
                    {showApproval &&
                      request.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setLocation(`/requests/${request.id}`)
                          }
                          className="text-yellow-600 hover:text-yellow-700"
                        >
                          Review
                        </Button>
                      )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const handleNotificationClick = (
    notification: { id: number; link: string | null }
  ) => {
    if (notification.link) {
      setLocation(notification.link);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
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
              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin Panel
                  </Button>
                </Link>
              )}
              <Link href="/new-request">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </Link>
              <NotificationsDropdown
                onNotificationClick={handleNotificationClick}
              />
              <DashboardPreferences
                preferences={preferences}
                onUpdate={updatePreferences}
              />
              <Button variant="outline" onClick={() => logout()}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between gap-4">
              <div className="relative flex-1">
                <Input
                  placeholder="Search requests..."
                  value={activeFilters.searchQuery}
                  onChange={(e) => {
                    handleFilterChange({
                      ...activeFilters,
                      searchQuery: e.target.value,
                    });
                  }}
                  className="pl-8"
                />
                <Search className="h-4 w-4 absolute left-2 top-3 text-gray-400" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
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

        <Tabs defaultValue={preferences.defaultView}>
          <TabsList className="mb-8">
            <TabsTrigger value="my-requests">
              My Requests
            </TabsTrigger>
            <TabsTrigger value="drafts-to-submit">
              Ready to Submit
            </TabsTrigger>
            {(isAdmin || isSpecialRole) && (
              <>
                <TabsTrigger value="all-requests">
                  All Requests
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected
                </TabsTrigger>
                <TabsTrigger value="changes">
                  Changes Requested
                </TabsTrigger>
              </>
            )}
            {!isAdmin && !isSpecialRole && showApprovalsTab && (
              <TabsTrigger value="approvals">
                Pending Approvals
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-requests">
            {getTabContent("my-requests")}
          </TabsContent>
          <TabsContent value="drafts-to-submit">
            {getTabContent("drafts-to-submit")}
          </TabsContent>
          {(isAdmin || isSpecialRole) && (
            <>
              <TabsContent value="all-requests">
                {getTabContent("all-requests")}
              </TabsContent>
              <TabsContent value="pending">
                {getTabContent("pending")}
              </TabsContent>
              <TabsContent value="approved">
                {getTabContent("approved")}
              </TabsContent>
              <TabsContent value="rejected">
                {getTabContent("rejected")}
              </TabsContent>
              <TabsContent value="changes">
                {getTabContent("changes")}
              </TabsContent>
            </>
          )}
          {!isAdmin && !isSpecialRole && showApprovalsTab && (
            <TabsContent value="approvals">
              {getTabContent("approvals")}
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}