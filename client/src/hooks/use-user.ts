import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";

type User = {
  id: number;
  username: string;
  email: string;
  department: string;
  role: string;
  contact_number: string;
  isActive: boolean;
};

type LoginCredentials = {
  username: string;
  password: string;
};

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
    console.error('Auth request error:', error);
    return { ok: false, message: error.message || 'An error occurred' };
  }
}

async function fetchUser(): Promise<User | null> {
  try {
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
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

export function useUser() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, error, isLoading } = useQuery<User | null, Error>({
    queryKey: ['user'],
    queryFn: fetchUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => 
      handleRequest('/api/auth/login', 'POST', credentials),
    onSuccess: (data) => {
      if (data.ok && data.user) {
        queryClient.setQueryData(['user'], data.user);
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => handleRequest('/api/auth/logout', 'POST'),
    onSuccess: () => {
      queryClient.setQueryData(['user'], null);
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