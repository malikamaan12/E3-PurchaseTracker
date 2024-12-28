import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginCredentials, User } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { visualizeError, createErrorContext, handleApiError } from '@/lib/errorUtils';

type RequestResult = {
  ok: true;
} | {
  ok: false;
  message: string;
};

async function handleRequest(
  url: string,
  method: string,
  body?: LoginCredentials
): Promise<RequestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return { ok: true };
  } catch (e: any) {
    const errorContext = createErrorContext(e);
    return { ok: false, message: errorContext.message };
  }
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch('/api/user', {
    credentials: 'include'
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null;
    }
    await handleApiError(response);
  }

  return response.json();
}

export function useUser() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, error, isLoading } = useQuery<User | null, Error>({
    queryKey: ['user'],
    queryFn: fetchUser,
    staleTime: Infinity,
    retry: false
  });

  const loginMutation = useMutation({
    mutationFn: (userData: LoginCredentials) => handleRequest('/api/login', 'POST', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      visualizeError({
        message: "Logged in successfully",
        severity: "info",
        code: "AUTH_SUCCESS"
      });
    },
    onError: (error) => {
      visualizeError(createErrorContext(error, 'error', {
        code: 'AUTH_ERROR'
      }));
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => handleRequest('/api/logout', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      visualizeError({
        message: "Logged out successfully",
        severity: "info",
        code: "AUTH_SUCCESS"
      });
    },
    onError: (error) => {
      visualizeError(createErrorContext(error, 'error', {
        code: 'AUTH_ERROR'
      }));
    },
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
  };
}