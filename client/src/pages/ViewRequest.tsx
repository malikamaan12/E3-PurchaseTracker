import { useParams } from "wouter";
import { useUser } from "@/hooks/use-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import RequestCard from "@/components/RequestCard";
import { useLocation } from "wouter";
import RequestTimeline from "@/components/RequestTimeline";
import ApprovalFlow from "@/components/ApprovalFlow";
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useRequest } from "@/hooks/use-request";

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
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="flex items-center mb-4 text-red-500">
          <AlertCircle className="h-6 w-6 mr-2" />
          <h1 className="text-2xl font-bold">Request Not Found</h1>
        </div>
        <p className="text-gray-600 mb-4">
          {error instanceof Error 
            ? error.message 
            : "The request you're looking for doesn't exist or could not be loaded."}
        </p>
        <Button onClick={() => refetch()} className="mb-4">
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}