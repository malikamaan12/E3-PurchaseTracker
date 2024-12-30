import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginCredentials, User } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

type RequestResult = {
  ok: true;
  user?: User;
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
      const errorText = await response.text();
      return { ok: false, message: errorText };
    }

    const data = await response.json();
    return { ok: true, user: data.user };
  } catch (error: any) {
    return { ok: false, message: error.message || 'An error occurred' };
  }
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch('/api/auth/user', {
    credentials: 'include'
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null;
    }
    throw new Error(await response.text());
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
    mutationFn: (userData: LoginCredentials) => handleRequest('/api/auth/login', 'POST', userData),
    onSuccess: (data) => {
      if (data.ok && data.user) {
        queryClient.setQueryData(['user'], data.user);
        toast({
          title: "Success",
          description: "Logged in successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log in",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => handleRequest('/api/auth/logout', 'POST'),
    onSuccess: () => {
      queryClient.setQueryData(['user'], null);
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log out",
        variant: "destructive",
      });
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