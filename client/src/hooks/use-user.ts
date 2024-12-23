import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User, NewUser } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

type LoginResponse = {
  message: string;
  user: User;
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
        return { ok: false, message: response.statusText };
      }

      const errorData = await response.json();
      return { ok: false, message: errorData.message || "An error occurred" };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, message: e.toString() };
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

    throw new Error(`${response.status}: ${await response.text()}`);
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
    mutationFn: async (userData: NewUser) => {
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
        description: data.message || "Logged in successfully",
      });
    },
    onError: (error: Error) => {
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
      return result;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['user'], null);
      toast({
        title: "Success",
        description: result.data?.message || "Logged out successfully",
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

  const registerMutation = useMutation({
    mutationFn: async (userData: NewUser) => {
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
        description: data.message || "Registration successful",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
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
    register: registerMutation.mutateAsync,
  };
}