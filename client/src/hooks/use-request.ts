import { useQuery } from "@tanstack/react-query";
import type { PurchaseRequest } from "@db/schema";

export function useRequest(id: number) {
  return useQuery<PurchaseRequest>({
    queryKey: [`/api/requests/${id}`],
    enabled: !!id,
  });
}