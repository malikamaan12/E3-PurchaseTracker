import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User, NewUser } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

type LoginResponse = {
  status: "success" | "error";
  message: string;
  user?: User;
};

type RequestResult = {
  ok: true;
  data?: LoginResponse;
} | {
  ok: false;
  message: string;
};

async function handleRequest(
  url: string,
  method: string,
  body?: NewUser
): Promise<RequestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status >= 500) {
        return { ok: false, message: "Server error. Please try again later." };
      }

      const errorData = await response.json();
      return { ok: false, message: errorData.message || "An unexpected error occurred" };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (e: any) {
    console.error("Request error:", e);
    return { ok: false, message: e.message || "Network error. Please check your connection." };
  }
}

async function fetchUser(): Promise<User | null> {
  try {
    const response = await fetch('/api/user', {
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error(await response.text());
    }

    return response.json();
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
    mutationFn: async (userData: NewUser) => {
      console.log("Attempting login for user:", userData.username);
      const result = await handleRequest('/api/login', 'POST', userData);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data!;
    },
    onSuccess: (data) => {
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
        description: error.message || "Failed to log in. Please try again.",
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
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], null);
      toast({
        title: "Success",
        description: data.message || "You have been logged out successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout Failed",
        description: error.message || "Failed to log out. Please try again.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: NewUser) => {
      console.log("Attempting registration for user:", userData.username);
      const result = await handleRequest('/api/register', 'POST', userData);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user);
      toast({
        title: "Success",
        description: data.message || "Registration successful! Welcome aboard.",
      });
    },
    onError: (error: Error) => {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register. Please try again.",
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
    register: registerMutation.mutateAsync,
  };
}