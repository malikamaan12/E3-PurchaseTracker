import { useQuery } from '@tanstack/react-query';
import type { CompanyBranding } from '@db/schema';

export function useCompanyBranding() {
  return useQuery<CompanyBranding>({
    queryKey: ['/api/branding'],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}