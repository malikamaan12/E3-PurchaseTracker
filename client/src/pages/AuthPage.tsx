import { useState, useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@db/schema";
import type { LoginCredentials } from "@db/schema";
import AccountRequestForm from "@/components/AccountRequestForm";
import { Loader2, Eye, EyeOff } from "lucide-react";
import e3Logo from "../assets/e3-logo.svg";
import { navigate } from "wouter/use-browser-location";
// Import e3WhiteLogo
const e3WhiteLogo = "/images/e3-white-logo.png";

// Custom hook to fetch the login logo
function useLoginLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchLogoUrl() {
      try {
        const response = await fetch("/api/login-logo");
        if (!response.ok) {
          throw new Error("Failed to fetch login logo");
        }
        const data = await response.json();
        console.log("Login logo data:", data);
        if (data.loginLogo) {
          setLogoUrl(data.loginLogo);
        }
      } catch (err) {
        console.error("Error fetching login logo:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }

    fetchLogoUrl();
  }, []);

  return { logoUrl, isLoading, error };
}

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useUser();
  const { toast } = useToast();
  const { logoUrl, isLoading: logoLoading } = useLoginLogo();

  const loginForm = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onTabChange = (value: string) => {
    if (value === "login" || value === "register") {
      setActiveTab(value);
      if (value === "login") {
        loginForm.reset();
      }
    }
  };

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setIsLoading(true);

      // Show temporary loading toast
      const loadingToast = toast({
        description: "Logging in...",
        variant: "default",
      });

      // The login function in useUser will handle success/error toasts
      await login(data);
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Auth error:", error);

      // Only show this toast if the error wasn't caught by the login mutation
      toast({
        title: "Authentication Error",
        description:
          error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5 dark:from-[#7156a2]/20 dark:to-[#35bbba]/20 dark:bg-gray-900">
      <div className="w-full max-w-md mx-4">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-full max-w-sm flex items-center justify-center">
            {logoLoading ? (
              <div className="h-16 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt="E3 Logo"
                className="max-h-16 w-auto object-contain object-center"
                style={{ 
                  maxHeight: '64px',
                  height: 'auto',
                  width: 'auto',
                  display: 'block',
                  imageRendering: 'auto'
                }}
              />
            ) : (
              <img
                src={e3WhiteLogo}
                alt="E3 Logo"
                className="max-h-16 w-auto object-contain object-center"
                style={{ 
                  maxHeight: '64px',
                  height: 'auto',
                  width: 'auto',
                  display: 'block',
                  imageRendering: 'auto'
                }}
              />
            )}
          </div>
        </div>
        <Card className="border-[#35bbba]/20 dark:border-[#35bbba]/40 shadow-lg">
          <CardHeader className="border-b border-[#35bbba]/20 dark:border-[#35bbba]/40 bg-gradient-to-r from-[#7156a2]/5 to-[#35bbba]/5 dark:from-[#7156a2]/10 dark:to-[#35bbba]/10">
            <CardTitle className="text-2xl font-bold text-center text-gray-900 dark:text-white">
              E3 Purchase Request System
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={onTabChange}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="data-[state=active]:bg-[#7156a2] data-[state=active]:text-white"
                >
                  Request Account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-200">
                            Username
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="border-[#7156a2]/20 focus:border-[#7156a2]"
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-200">
                            Password
                          </FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                type={showPassword ? "text" : "password"}
                                {...field}
                                className="border-[#7156a2]/20 focus:border-[#7156a2] pr-10"
                                disabled={isLoading}
                              />
                            </FormControl>
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                              tabIndex={-1}
                              disabled={isLoading}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full bg-[#7156a2] hover:bg-[#7156a2]/90 text-white transition-colors"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
                <AccountRequestForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 px-4">
          Welcome to the E3 Purchase Request System—built with passion by E3 and
          driven by your success!
        </div>
      </div>
    </div>
  );
}
