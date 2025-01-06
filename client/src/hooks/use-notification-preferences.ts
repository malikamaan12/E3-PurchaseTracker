import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { NotificationPreference } from "@db/schema";

interface UpdatePreferenceData {
  enabled?: boolean;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
}

interface NotificationMetadata {
  categories: Record<string, string>;
  types: Record<string, string>;
}

export function useNotificationPreferences() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: preferences = [],
    isLoading: preferencesLoading,
    error: preferencesError
  } = useQuery<NotificationPreference[]>({
    queryKey: ['/api/notification-preferences'],
    retry: false,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false
  });

  const {
    data: metadata = { categories: {}, types: {} },
    isLoading: metadataLoading
  } = useQuery<NotificationMetadata>({
    queryKey: ['/api/notification-preferences/metadata'],
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  const updatePreference = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdatePreferenceData }) => {
      const res = await fetch(`/api/notification-preferences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences'] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Updating Preferences",
        description: error instanceof Error ? error.message : "Failed to update preferences",
        variant: "destructive"
      });
    }
  });

  const getCategoryPreferences = (category: string) => {
    return preferences.filter(pref => pref.category === category);
  };

  return {
    preferences,
    metadata,
    isLoading: preferencesLoading || metadataLoading,
    error: preferencesError,
    updatePreference: updatePreference.mutate,
    getCategoryPreferences
  };
}