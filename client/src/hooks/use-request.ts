import { useQuery } from "@tanstack/react-query";
import type { PurchaseRequestWithRelations } from "@db/schema";
import { useToast } from "./use-toast";
import { useLocation } from "wouter";

export function useRequest(id: number) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  return useQuery<PurchaseRequestWithRelations>({
    queryKey: [`/api/requests/${id}`],
    enabled: !!id && !isNaN(id),
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1, // Reduced retries since permission errors won't resolve with retries
    queryFn: async () => {
      try {
        console.log(`Fetching single request with ID: ${id}`);
        const response = await fetch(`/api/requests/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });

        // Handle permission errors specifically
        if (response.status === 403) {
          console.error(`Permission error fetching request: ${id}`);
          toast({
            title: "Access Denied",
            description: "You don't have permission to view this request.",
            variant: "destructive"
          });
          // Navigate back to dashboard on permission errors
          setLocation("/dashboard");
          throw new Error("You don't have permission to view this request");
        }
        
        // Handle other errors
        if (!response.ok) {
          console.error(`Error fetching request: ${response.status} ${response.statusText}`);
          toast({
            title: "Error",
            description: `Failed to fetch request: ${response.status === 500 ? "Internal server error" : response.statusText}`,
            variant: "destructive"
          });
          throw new Error(`Failed to fetch request: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Single request data:", data);
        return data;
      } catch (error) {
        console.error("Error in useRequest hook:", error);
        throw error;
      }
    }
  });
}