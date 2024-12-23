import { Link } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import RequestCard from "@/components/RequestCard";
import { Plus, LogOut } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useUser();
  const { requests, isLoading } = usePurchaseRequests();

  const myDrafts = requests?.filter(r => 
    r.requesterId === user?.id && 
    r.status === 'draft'
  ) || [];

  const mySubmittedRequests = requests?.filter(r => 
    r.requesterId === user?.id && 
    r.status !== 'draft'
  ) || [];

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
            <div className="flex gap-4">
              <Link href="/new-request">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </Link>
              <Button variant="outline" onClick={() => logout()}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="my-requests">
          <TabsList className="mb-8">
            <TabsTrigger value="my-requests">
              My Requests ({mySubmittedRequests.length + myDrafts.length})
            </TabsTrigger>
            <TabsTrigger value="approvals">
              Pending Approvals ({pendingApprovals.length})
            </TabsTrigger>
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
        </Tabs>
      </main>
    </div>
  );
}