import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

type LoginCredentials = {
  username: string;
  password: string;
};

type LoginResponse = {
  status: "success" | "error";
  message: string;
  user?: User;
};

type RequestResult = {
  ok: true;
  data: LoginResponse;
} | {
  ok: false;
  message: string;
};

async function handleRequest(
  url: string,
  method: string,
  body?: any
): Promise<RequestResult> {
  try {
    console.log(`Making ${method} request to ${url}`);
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      credentials: "include",
    });

    const data = await response.json();
    console.log(`Response from ${url}:`, data);

    if (!response.ok) {
      return {
        ok: false,
        message: data.message || `${response.status}: ${response.statusText}`,
      };
    }

    return { ok: true, data };
  } catch (error: any) {
    console.error(`Error in ${method} ${url}:`, error);
    return {
      ok: false,
      message: error.message || "Network error. Please try again.",
    };
  }
}

async function fetchUser(): Promise<User | null> {
  try {
    console.log("Fetching current user");
    const response = await fetch('/api/user', {
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log("No authenticated user found");
        return null;
      }
      throw new Error(await response.text());
    }

    const user = await response.json();
    console.log("Current user:", user);
    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
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
    mutationFn: async (credentials: LoginCredentials) => {
      console.log("Login attempt for:", credentials.username);
      const result = await handleRequest('/api/login', 'POST', credentials);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
    onSuccess: (data) => {
      console.log("Login successful:", data);
      queryClient.setQueryData(['user'], data.user);
      toast({
        title: "Success",
        description: data.message || "Welcome back!",
      });
    },
    onError: (error: Error) => {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const result = await handleRequest('/api/logout', 'POST');
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], null);
      toast({
        title: "Success",
        description: data.message || "Logged out successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout Failed",
        description: error.message,
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