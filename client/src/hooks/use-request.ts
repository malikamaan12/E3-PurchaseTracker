import { useQuery } from "@tanstack/react-query";
import type { PurchaseRequestWithRelations } from "@db/schema";
import { useToast } from "./use-toast";

export function useRequest(id: number) {
  const { toast } = useToast();
  
  return useQuery<PurchaseRequestWithRelations>({
    queryKey: [`/api/requests/${id}`],
    enabled: !!id && !isNaN(id),
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 2,
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

        if (!response.ok) {
          console.error(`Error fetching request: ${response.status} ${response.statusText}`);
          toast({
            title: "Error",
            description: `Failed to fetch request: ${response.statusText}`,
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