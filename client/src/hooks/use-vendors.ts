import { useQuery } from "@tanstack/react-query";

interface Vendor {
  id: number;
  name: string;
}

export function useVendors() {
  const { data: vendors, isLoading, error } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    vendors,
    isLoading,
    error
  };
}
