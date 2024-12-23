import { useEffect } from "react";
import { useLocation } from "wouter";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import NewRequest from "./NewRequest";
import { Loader2 } from "lucide-react";

export default function EditRequest({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { requests, isLoading } = usePurchaseRequests();
  const request = requests?.find((r) => r.id === parseInt(params.id));

  useEffect(() => {
    if (!isLoading && !request) {
      setLocation("/");
    }
  }, [request, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!request) {
    return null;
  }

  return <NewRequest editMode={true} initialData={request} />;
}
