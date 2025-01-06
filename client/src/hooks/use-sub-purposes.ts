import { useQuery } from "@tanstack/react-query";

interface SubPurpose {
  id: number;
  name: string;
  purposeType: string;
}

export function useSubPurposes() {
  const { data: subPurposes, isLoading, error } = useQuery<SubPurpose[]>({
    queryKey: ['/api/sub-purposes'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    subPurposes,
    isLoading,
    error
  };
}
