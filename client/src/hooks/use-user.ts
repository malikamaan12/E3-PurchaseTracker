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
      const errorData = await response.json().catch(() => null);
      const errorText = errorData?.message || await response.text();
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

        // Explicitly show a success toast
        toast({
          title: "Login Successful",
          description: "Welcome back!",
          variant: "default",
        });
      } else if (!data.ok) {
        // Show error toast for failed login even on "success" path
        toast({
          title: "Login Failed",
          description: data.message || "Invalid username or password",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Login error:", error);

      // Explicitly show an error toast
      toast({
        title: "Authentication Error",
        description: error.message || "Failed to log in",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => handleRequest('/api/auth/logout', 'POST'),
    onSuccess: () => {
      queryClient.setQueryData(['user'], null);

      // Show logout success toast
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
        variant: "default",
      });
    },
    onError: (error: any) => {
      // Show logout error toast
      toast({
        title: "Logout Failed",
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