import { useQuery } from "@tanstack/react-query";
import type { PurchaseRequest } from "@db/schema";

export function useRequest(id: number) {
  return useQuery<PurchaseRequest>({
    queryKey: [`/api/requests/${id}`],
    enabled: !!id,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    queryFn: async () => {
      const response = await fetch(`/api/requests/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch request');
      }

      return response.json();
    }
  });
}