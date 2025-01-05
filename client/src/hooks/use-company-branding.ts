import { useQuery } from '@tanstack/react-query';

export function useCompanyBranding() {
  return useQuery({
    queryKey: ['/api/branding'],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
