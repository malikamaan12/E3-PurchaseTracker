import { Link } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import RequestCard from "@/components/RequestCard";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { Plus, LogOut } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useUser();
  const { requests, isLoading } = usePurchaseRequests();

  // Special roles that can see all requests
  const isSpecialRole = user?.department === 'CEO Office' || 
                       user?.department === 'Director' || 
                       user?.department === 'Finance';

  // Filter requests based on user role and status
  const myDrafts = requests?.filter(r => 
    r.requesterId === user?.id && 
    r.status === 'draft'
  ) || [];

  const mySubmittedRequests = requests?.filter(r => 
    r.requesterId === user?.id && 
    r.status !== 'draft'
  ) || [];

  // For special roles (CEO, Director, Finance), show all requests based on status
  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const approvedRequests = requests?.filter(r => r.status === 'approved') || [];
  const rejectedRequests = requests?.filter(r => r.status === 'rejected') || [];
  const changesRequestedRequests = requests?.filter(r => r.status === 'changes_requested') || [];

  // Updated pending approvals logic to show requests that:
  // 1. Are in pending status
  // 2. Need approval from the user's department
  // 3. Haven't been approved/rejected by the user's department yet
  const pendingApprovals = requests?.filter(r => {
    if (r.status !== 'pending') return false;

    // Check if this department needs to approve
    const departmentApproval = r.approvals.find(a => 
      a.department === user?.department
    );

    // Show if either:
    // 1. No approval record exists yet for this department (needs to be created)
    // 2. Approval exists but is still pending
    return !departmentApproval || departmentApproval.status === 'pending';
  }) || [];

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
                              showApproval={request.status === 'pending'}
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
                              showApproval
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