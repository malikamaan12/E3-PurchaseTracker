import { useParams } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useUser } from "@/hooks/use-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import RequestCard from "@/components/RequestCard";
import { useLocation } from "wouter";

export default function ViewRequest() {
  const { id } = useParams();
  const { requests, isLoading } = usePurchaseRequests();
  const { user } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  const request = requests?.find((r) => r.id === Number(id));

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Request Not Found</h1>
        <p className="text-gray-600 mb-4">The request you're looking for doesn't exist.</p>
        <Button onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const showApproval =
    request.status === "pending" &&
    request.requesterId !== user?.id &&
    (user?.department === "CEO Office" ||
      user?.department === "Director" ||
      user?.department === "Finance");

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <RequestCard
              request={request}
              showActions={request.requesterId === user?.id}
              showApproval={showApproval}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
