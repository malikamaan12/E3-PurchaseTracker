import { useParams } from "wouter";
import { useUser } from "@/hooks/use-user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, AlertCircle, FileText, Sparkles } from "lucide-react";
import RequestCard from "@/components/RequestCard";
import { useLocation } from "wouter";
import RequestTimeline from "@/components/RequestTimeline";
import ApprovalFlow from "@/components/ApprovalFlow";
import { ClaudeAIInsights } from "@/components/ClaudeAIInsights";
import { ExportTabs } from "@/components/ExportTabs";
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useRequest } from "@/hooks/use-request";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ViewRequest() {
  const { id } = useParams();
  const { toast } = useToast();
  const requestId = Number(id);
  const { data: request, isLoading, error, isError, refetch } = useRequest(requestId);
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Log data for debugging
  useEffect(() => {
    if (request) {
      console.log("ViewRequest - Request data:", request);
      console.log("ViewRequest - Vendor data:", request.vendor);
      console.log("ViewRequest - SubPurpose data:", request.subPurpose);
    }
  }, [request]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (isError || !request) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const isPermissionError = errorMessage.includes("permission") || errorMessage.includes("403");
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="flex items-center mb-4 text-red-500">
          <AlertCircle className="h-6 w-6 mr-2" />
          <h1 className="text-2xl font-bold">
            {isPermissionError ? "Access Denied" : "Request Not Found"}
          </h1>
        </div>
        <p className="text-gray-600 mb-4">
          {isPermissionError 
            ? "You don't have permission to view this request. Contact your administrator if you believe this is incorrect."
            : errorMessage.includes("Failed to fetch request")
              ? "The request you're looking for doesn't exist or could not be loaded."
              : errorMessage}
        </p>
        {!isPermissionError && (
          <Button onClick={() => refetch()} className="mb-4">
            Retry Loading
          </Button>
        )}
        <Button onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Ensure additionalApprovers is always an array
  const additionalApprovers = Array.isArray(request.additionalApprovers) 
    ? request.additionalApprovers 
    : [];

  // Check if user can approve this request
  const showApproval =
    request.status === "pending" &&
    request.requesterId !== user?.id &&
    (user?.department === "CEO Office" ||
      user?.department === "Director" ||
      user?.department === "Finance" ||
      additionalApprovers.includes(user?.department || ""));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button and Download Options */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="hover:bg-[#7156a2]/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          {/* Export Options */}
          <ExportTabs request={request} compact={true} />
        </div>

        <div className="grid gap-6">
          {/* Request Details Card */}
          <Card className="border-[#35bbba]/20 shadow-lg">
            <CardContent className="p-6">
              <RequestCard
                request={request}
                showActions={request.requesterId === user?.id}
                showApproval={false} 
                showItemDescriptions={true}
              />
            </CardContent>
          </Card>

          {/* Tabbed layout for details */}
          <Card className="border-[#35bbba]/20 shadow-lg">
            <CardContent className="p-6">
              <Tabs defaultValue="timeline">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="timeline">
                    <FileText className="h-4 w-4 mr-2" />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="approval" disabled={!(showApproval || request.status !== 'draft')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Approval
                  </TabsTrigger>
                  <TabsTrigger value="insights">
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Insights
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="timeline">
                  <RequestTimeline request={request} />
                </TabsContent>
                
                <TabsContent value="approval">
                  {(showApproval || request.status !== 'draft') && (
                    <ApprovalFlow
                      request={request}
                      onApprovalUpdate={() => {
                        // Invalidate queries to refresh data
                        queryClient.invalidateQueries({ queryKey: [`/api/requests/${requestId}`] });
                        queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
                        refetch();

                        toast({
                          title: "Approval Updated",
                          description: "The request approval status has been updated",
                          variant: "default"
                        });
                      }}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="insights">
                  <ClaudeAIInsights
                    requestData={request}
                    vendorOptions={[request.vendor].filter(Boolean)}
                    attachmentData={request.attachments && request.attachments.length > 0 ? request.attachments : undefined}
                    showExecutiveSummary={user?.role === 'admin' || user?.department === 'CEO Office' || user?.department === 'Director'}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}