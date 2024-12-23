import { Link } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RequestCard from "@/components/RequestCard";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { Plus, LogOut, Search } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

export default function Dashboard() {
  const { user, logout } = useUser();
  const { requests, isLoading } = usePurchaseRequests();

  // Filter states
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [purposeTypeFilter, setPurposeTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Special roles that can see all requests
  const isSpecialRole = user?.department === 'CEO Office' || 
                       user?.department === 'Director' || 
                       user?.department === 'Finance';

  // Get unique values for filters
  const departments = useMemo(() => {
    const deptSet = new Set(requests?.map(r => r.requester.department) || []);
    return Array.from(deptSet);
  }, [requests]);

  const purposeTypes = useMemo(() => {
    const typeSet = new Set(requests?.map(r => r.purposeType) || []);
    return Array.from(typeSet);
  }, [requests]);

  const priorities = ["low", "medium", "high", "urgent"];

  // Filter function
  const filterRequests = (requestList: any[]) => {
    return requestList.filter(r => {
      const matchesDepartment = departmentFilter === "all" || r.requester.department === departmentFilter;
      const matchesPurposeType = purposeTypeFilter === "all" || r.purposeType === purposeTypeFilter;
      const matchesPriority = priorityFilter === "all" || r.priority === priorityFilter;
      const matchesSearch = !searchQuery || 
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.requestNumber.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesDepartment && matchesPurposeType && matchesPriority && matchesSearch;
    });
  };

  // Filter requests based on user role and status
  const myDrafts = filterRequests(
    requests?.filter(r => r.requesterId === user?.id && r.status === 'draft') || []
  );

  const mySubmittedRequests = filterRequests(
    requests?.filter(r => r.requesterId === user?.id && r.status !== 'draft') || []
  );

  const pendingRequests = filterRequests(
    requests?.filter(r => {
      if (r.status !== 'pending') return false;
      const departmentApproval = r.approvals.find(a => a.department === user?.department);
      return !departmentApproval || departmentApproval.status === 'pending';
    }) || []
  );

  const approvedRequests = filterRequests(
    requests?.filter(r => r.status === 'approved') || []
  );

  const rejectedRequests = filterRequests(
    requests?.filter(r => r.status === 'rejected') || []
  );

  const changesRequestedRequests = filterRequests(
    requests?.filter(r => r.status === 'changes_requested') || []
  );

  const pendingApprovals = filterRequests(
    requests?.filter(r => {
      if (r.status !== 'pending' || r.requesterId === user?.id) return false;
      const departmentApproval = r.approvals.find(a => a.department === user?.department);
      return !departmentApproval || departmentApproval.status === 'pending';
    }) || []
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Purchase Management System</h1>
              <p className="text-sm text-gray-600">
                Welcome, {user?.username} ({user?.department})
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/new-request">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </Link>
              <NotificationsDropdown />
              <Button variant="outline" onClick={() => logout()}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
                <Search className="h-4 w-4 absolute left-2 top-3 text-gray-400" />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={purposeTypeFilter} onValueChange={setPurposeTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Purpose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Purposes</SelectItem>
                  {purposeTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
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
                  {priorities.map(priority => (
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
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue={isSpecialRole ? "all-requests" : "my-requests"}>
          <TabsList className="mb-8">
            <TabsTrigger value="my-requests">
              My Requests ({mySubmittedRequests.length + myDrafts.length})
            </TabsTrigger>
            {isSpecialRole ? (
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
            ) : (
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
                    <h3 className="text-lg font-medium mb-4">Draft Requests</h3>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-4">
                        {myDrafts.map((request) => (
                          <RequestCard
                            key={request.id}
                            request={request}
                            showActions={true}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium mb-4">Submitted Requests</h3>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-border" />
                    </div>
                  ) : mySubmittedRequests.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No submitted requests found.
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-4">
                        {mySubmittedRequests.map((request) => (
                          <RequestCard
                            key={request.id}
                            request={request}
                            showActions={false}
                            showApproval={false}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {isSpecialRole && (
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
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-4">
                          {requests?.map((request) => (
                            <RequestCard
                              key={request.id}
                              request={request}
                              showApproval={request.status === 'pending' && request.requesterId !== user?.id}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pending">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">Pending Requests</h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : pendingRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No pending requests.
                      </div>
                    ) : (
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-4">
                          {pendingRequests.map((request) => (
                            <RequestCard
                              key={request.id}
                              request={request}
                              showApproval={request.requesterId !== user?.id}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="approved">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">Approved Requests</h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : approvedRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No approved requests.
                      </div>
                    ) : (
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-4">
                          {approvedRequests.map((request) => (
                            <RequestCard
                              key={request.id}
                              request={request}
                              showApproval={false}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rejected">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">Rejected Requests</h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : rejectedRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No rejected requests.
                      </div>
                    ) : (
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-4">
                          {rejectedRequests.map((request) => (
                            <RequestCard
                              key={request.id}
                              request={request}
                              showApproval={false}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="changes">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-4">Changes Requested</h3>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-border" />
                      </div>
                    ) : changesRequestedRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No requests pending changes.
                      </div>
                    ) : (
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-4">
                          {changesRequestedRequests.map((request) => (
                            <RequestCard
                              key={request.id}
                              request={request}
                              showApproval={false}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          {!isSpecialRole && (
            <TabsContent value="approvals">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium mb-4">Requests Requiring Your Approval</h3>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-border" />
                    </div>
                  ) : pendingApprovals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No pending approvals.
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-4">
                        {pendingApprovals.map((request) => (
                          <RequestCard
                            key={request.id}
                            request={request}
                            showApproval
                          />
                        ))}
                      </div>
                    </ScrollArea>
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