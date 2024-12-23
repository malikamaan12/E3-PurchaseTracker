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

  const myRequests = requests?.filter(r => r.requesterId === user?.id) || [];
  const pendingApprovals = requests?.filter(r => 
    r.status !== 'draft' && 
    r.approvals.some(a => 
      a.department === user?.department && 
      a.status === 'pending'
    )
  ) || [];
  
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
              My Requests ({myRequests.length})
            </TabsTrigger>
            {user?.role === "approver" && (
              <TabsTrigger value="approvals">
                Pending Approvals ({pendingApprovals.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-requests">
            <Card>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-border" />
                  </div>
                ) : myRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No requests found. Create a new request to get started.
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-4">
                      {myRequests.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                          showActions={request.status === 'draft'}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {user?.role === "approver" && (
            <TabsContent value="approvals">
              <Card>
                <CardContent className="p-6">
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
