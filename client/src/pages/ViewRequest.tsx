import { useParams } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import RequestCard from "@/components/RequestCard";
import { useLocation } from "wouter";
import RequestTimeline from "@/components/RequestTimeline";
import ApprovalFlow from "@/components/ApprovalFlow";
import { type RequestData } from "@/types/requests";
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { useRequest } from "@/hooks/use-request";
import { useEffect } from "react";

export default function ViewRequest() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // Use the specific request hook instead of the general requests list
  const { data: request, isLoading, error, refetch } = useRequest(Number(id));

  // Force refetch when component loads to ensure we have latest data
  useEffect(() => {
    if (refetch) {
      refetch();
    }
    console.log("ViewRequest - ID from URL:", id);
  }, [id, refetch]);

  // Add debug logs for troubleshooting
  useEffect(() => {
    if (request) {
      console.log("ViewRequest - Request details:", request);
    }
    if (error) {
      console.error("ViewRequest - Error loading request:", error);
    }
  }, [request, error]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // No need to find the request, as useRequest fetches the specific one

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Request Not Found</h1>
        <p className="text-gray-600 mb-4">The request you're looking for doesn't exist or is still loading.</p>
        <Button onClick={() => {
          if (refetch) refetch(); // Try to refetch requests on button click
        }} className="mb-4">
          Retry Loading
        </Button>
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
        {/* Back Button */}
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="hover:bg-[#7156a2]/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
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

          {/* Request Timeline */}
          <RequestTimeline request={request} />

          {/* Only show approval flow when needed */}
          {(showApproval || request.status !== 'draft') && (
            <Card className="border-[#35bbba]/20 shadow-lg">
              <CardContent className="p-6">
                <ApprovalFlow
                  request={request}
                  onApprovalUpdate={() => {
                    // Invalidate queries to refresh data
                    queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
                    if (refetch) refetch();

                    toast({
                      title: "Approval Updated",
                      description: "The request approval status has been updated",
                      variant: "default"
                    });
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}