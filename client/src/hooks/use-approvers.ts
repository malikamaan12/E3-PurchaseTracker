import { useQuery } from "@tanstack/react-query";

export interface Approver {
  id: number;
  username: string;
  email: string;
  department: string;
  departmentId: string;
  isMandatory: boolean;
  level: number;
}

export function useApprovers() {
  return useQuery<Approver[]>({
    queryKey: ["/api/approvers"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}