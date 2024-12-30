import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@db/schema";
import type { LoginCredentials } from "@db/schema";
import AccountRequestForm from "@/components/AccountRequestForm";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { login } = useUser();
  const { toast } = useToast();

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
      const result = await login(data);
      if (!result.ok) {
        toast({
          title: "Login Failed",
          description: result.message || "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5">
      <div className="w-full max-w-md mx-4">
        <Card className="border-[#35bbba]/20 shadow-lg">
          <CardHeader className="border-b border-[#35bbba]/20 bg-gradient-to-r from-[#7156a2]/5 to-[#35bbba]/5">
            <CardTitle className="text-2xl font-bold text-center text-[#191160]">
              Purchase Management System
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
                  <form onSubmit={loginForm.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#191160]">Username</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="border-[#7156a2]/20 focus:border-[#7156a2]"
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
                          <FormLabel className="text-[#191160]">Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              {...field}
                              className="border-[#7156a2]/20 focus:border-[#7156a2]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full bg-[#7156a2] hover:bg-[#7156a2]/90 text-white transition-colors"
                    >
                      Login
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
      </div>
    </div>
  );
}