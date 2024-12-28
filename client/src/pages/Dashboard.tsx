import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface RequestData {
  id: number;
  requesterId: number;
  status: string;
  title: string;
  description: string;
  requestNumber: string;
  createdAt: string;
  priority: string;
  purposeType: string;
  totalEstimatedCost: number;
  items?: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    description?: string;
  }>;
  requester?: {
    id: number;
    username: string;
    email?: string;
    department?: string;
    role?: string;
  };
  approvals?: Array<{
    id: number;
    status: string;
    department: string;
    comments?: string;
  }>;
}

export default function Dashboard() {
  const { user, logout } = useUser();
  const { requests = [], isLoading, error } = usePurchaseRequests();
  const { preferences, updatePreferences, resetFilters } = useDashboardPreferences();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // For debugging
  console.log('Current user:', user);
  console.log('All requests:', requests);

  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [purposeTypeFilter, setPurposeTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Reset filters when component mounts or user changes
  useEffect(() => {
    if (user) {
      console.log('Resetting filters for user:', user.username);
      setDepartmentFilter("all");
      setPurposeTypeFilter("all");
      setPriorityFilter("all");
      setSearchQuery("");
      resetFilters();
    }
  }, [user, resetFilters]);

  const isSpecialRole = useMemo(() => {
    const hasSpecialRole = user?.role === "admin" ||
      user?.role === "approver" ||
      user?.department === "CEO Office" ||
      user?.department === "Director" ||
      user?.department === "Finance";

    console.log('User special role status:', hasSpecialRole);
    return hasSpecialRole;
  }, [user?.role, user?.department]);

  const isAdmin = useMemo(() => {
    return user?.role === "admin";
  }, [user?.role]);

  const isApprover = useMemo(() => {
    return user?.role === "approver";
  }, [user?.role]);

  const pendingApprovals = useMemo(() => {
    if (!user || !Array.isArray(requests)) return [];

    return requests.filter((request: RequestData) => {
      if (!request || request.status !== "pending") return false;

      // Admin, approvers and special roles can approve any request
      if (
        isAdmin ||
        isApprover ||
        ["CEO Office", "Director", "Finance"].includes(user.department || "")
      ) {
        return true;
      }

      // Regular users can't approve their own requests
      if (request.requesterId === user.id) return false;

      // Check if this department hasn't approved yet
      const departmentApproval = request.approvals?.find(
        (a) => a.department === user.department
      );

      return !departmentApproval || departmentApproval.status === "pending";
    });
  }, [requests, user, isAdmin, isApprover]);

  const showApprovalsTab = useMemo(() => {
    return pendingApprovals.length > 0;
  }, [pendingApprovals.length]);

  const filterRequests = (requestList: RequestData[]) => {
    if (!Array.isArray(requestList)) return [];

    return requestList.filter((r) => {
      if (!r) return false;

      const matchesDepartment =
        departmentFilter === "all" || r.requester?.department === departmentFilter;
      const matchesPurposeType =
        purposeTypeFilter === "all" || r.purposeType === purposeTypeFilter;
      const matchesPriority =
        priorityFilter === "all" || r.priority === priorityFilter;
      const matchesSearch =
        !searchQuery ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.requestNumber.toLowerCase().includes(searchQuery.toLowerCase());

      return (
        matchesDepartment &&
        matchesPurposeType &&
        matchesPriority &&
        matchesSearch
      );
    });
  };

  // Get all requests visible to the user based on their role
  const visibleRequests = useMemo(() => {
    if (!Array.isArray(requests)) return [];

    if (isAdmin || isApprover || isSpecialRole) {
      return requests;
    }

    // Regular users can only see their own requests
    return requests.filter((r: RequestData) => r?.requesterId === user?.id);
  }, [requests, isAdmin, isApprover, isSpecialRole, user?.id]);

  const myDrafts = filterRequests(
    visibleRequests.filter((r) => r?.requesterId === user?.id && r?.status === "draft")
  );

  const mySubmittedRequests = filterRequests(
    visibleRequests.filter((r) => r?.requesterId === user?.id && r?.status !== "draft")
  );

  const pendingRequests = filterRequests(
    visibleRequests.filter((r) => r?.status === "pending")
  );

  const approvedRequests = filterRequests(
    visibleRequests.filter((r) => r?.status === "approved")
  );

  const rejectedRequests = filterRequests(
    visibleRequests.filter((r) => r?.status === "rejected")
  );

  const changesRequestedRequests = filterRequests(
    visibleRequests.filter((r) => r?.status === "changes_requested")
  );

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

            const canSubmitDraft =
              request.status === "draft" &&
              request.requesterId === user?.id &&
              request.title &&
              request.description &&
              request.items?.length > 0;

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
                    {canSubmitDraft && (
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

  const draftRequestsReadyToSubmit = filterRequests(
    visibleRequests.filter(
      (r) =>
        r?.requesterId === user?.id &&
        r?.status === "draft" &&
        r?.title &&
        r?.description &&
        r?.items?.length > 0
    )
  );

  const handleNotificationClick = (
    notification: { id: number; link: string | null }
  ) => {
    if (notification.link) {
      setLocation(notification.link);
    }
  };

  const departments = useMemo(() => {
    if (!Array.isArray(requests)) return [];
    const deptSet = new Set<string>();
    requests.forEach((r) => {
      if (r.requester?.department) {
        deptSet.add(r.requester.department);
      }
    });
    return Array.from(deptSet);
  }, [requests]);

  const purposeTypes = useMemo(() => {
    if (!Array.isArray(requests)) return [];
    const typeSet = new Set<string>();
    requests.forEach((r) => {
      if (r.purposeType) {
        typeSet.add(r.purposeType);
      }
    });
    return Array.from(typeSet);
  }, [requests]);

  const priorities = ["low", "medium", "high", "urgent"];


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
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="relative">
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
                <Search className="h-4 w-4 absolute left-2 top-3 text-gray-400" />
              </div>
              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={purposeTypeFilter}
                onValueChange={setPurposeTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Purposes</SelectItem>
                  {purposeTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace("_", " ").toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {priorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setDepartmentFilter("all");
                  setPurposeTypeFilter("all");
                  setPriorityFilter("all");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </Button>

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

        <Tabs defaultValue={preferences.defaultView}>
          <TabsList className="mb-8">
            <TabsTrigger value="my-requests">
              My Requests ({mySubmittedRequests.length + myDrafts.length})
            </TabsTrigger>
            <TabsTrigger value="drafts-to-submit">
              Ready to Submit ({draftRequestsReadyToSubmit.length})
            </TabsTrigger>
            {(isAdmin || isSpecialRole) && (
              <>
                <TabsTrigger value="all-requests">
                  All Requests ({requests?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({pendingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved ({approvedRequests.length})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({rejectedRequests.length})
                </TabsTrigger>
                <TabsTrigger value="changes">
                  Changes Requested ({changesRequestedRequests.length})
                </TabsTrigger>
              </>
            )}
            {!isAdmin && !isSpecialRole && showApprovalsTab && (
              <TabsTrigger value="approvals">
                Pending Approvals ({pendingApprovals.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-requests">
            <div className="space-y-6">
              {myDrafts.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">
                      Draft Requests
                    </h3>
                    <div className="overflow-x-auto">
                      {renderRequestsTable(myDrafts, false)}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium mb-4">
                    Submitted Requests
                  </h3>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-border" />
                    </div>
                  ) : mySubmittedRequests.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No submitted requests found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {renderRequestsTable(mySubmittedRequests, false)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="drafts-to-submit">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-medium mb-4">
                  Draft Requests Ready to Submit
                </h3>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-border" />
                  </div>
                ) : draftRequestsReadyToSubmit.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No draft requests ready to submit.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {renderRequestsTable(draftRequestsReadyToSubmit, false)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {(isAdmin || isSpecialRole) && (
            <>
              <TabsContent value="all-requests">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">All Requests</h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : requests?.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No requests found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {renderRequestsTable(
                          filterRequests(requests || []),
                          true
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pending">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">
                      Pending Requests
                    </h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : pendingRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No pending requests.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {renderRequestsTable(pendingRequests, true)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="approved">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">
                      Approved Requests
                    </h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : approvedRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No approved requests.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {renderRequestsTable(approvedRequests, false)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rejected">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">
                      Rejected Requests
                    </h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : rejectedRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No rejected requests.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {renderRequestsTable(rejectedRequests, false)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="changes">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">
                      Changes Requested
                    </h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : changesRequestedRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No requests pending changes.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {renderRequestsTable(changesRequestedRequests, false)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          {showApprovalsTab && !isAdmin && !isSpecialRole && (
            <TabsContent value="approvals">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium mb-4">
                    Requests Requiring Your Approval
                  </h3>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-border" />
                    </div>
                  ) : pendingApprovals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No pending approvals.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {renderRequestsTable(pendingApprovals, true)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}