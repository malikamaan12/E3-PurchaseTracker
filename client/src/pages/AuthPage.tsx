import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, loginSchema } from "@db/schema";
import type { NewUser, LoginCredentials } from "@db/schema";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const { login, register } = useUser();
  const { toast } = useToast();

  const loginForm = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<NewUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      contactNumber: "",
      department: "",
      role: "user",
    },
  });

  const onTabChange = (value: string) => {
    setActiveTab(value);
    loginForm.reset();
    registerForm.reset();
  };

  const onSubmit = async (data: LoginCredentials | NewUser) => {
    try {
      if (activeTab === "login") {
        const result = await login(data as LoginCredentials);
        if (!result.ok) {
          toast({
            title: "Login Failed",
            description: result.message || "Invalid username or password",
            variant: "destructive",
          });
        }
      } else {
        const result = await register(data as NewUser);
        if (!result.ok) {
          toast({
            title: "Registration Failed",
            description: result.message || "Please check your input and try again",
            variant: "destructive",
          });
        }
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

  const currentForm = activeTab === "login" ? loginForm : registerForm;

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
                  Register
                </TabsTrigger>
              </TabsList>

              <Form {...currentForm}>
                <form onSubmit={currentForm.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={currentForm.control}
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
                    control={currentForm.control}
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

                  {activeTab === "register" && (
                    <>
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#191160]">Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                {...field}
                                className="border-[#7156a2]/20 focus:border-[#7156a2]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="contactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#191160]">Contact Number</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                {...field}
                                className="border-[#7156a2]/20 focus:border-[#7156a2]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#191160]">Role</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="border-[#7156a2]/20 focus:border-[#7156a2]">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="approver">Approver</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#191160]">Department</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="border-[#7156a2]/20 focus:border-[#7156a2]">
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {/* Management */}
                                <SelectItem value="Admin">Admin</SelectItem>
                                <SelectItem value="CEO Office">CEO Office</SelectItem>
                                <SelectItem value="Director">Director</SelectItem>
                                <SelectItem value="Finance">Finance</SelectItem>
                                {/* Business */}
                                <SelectItem value="Sales">Sales</SelectItem>
                                <SelectItem value="Marketing">Marketing</SelectItem>
                                <SelectItem value="Business Growth">Business Growth</SelectItem>
                                {/* Operations */}
                                <SelectItem value="Branding">Branding</SelectItem>
                                <SelectItem value="Logistics">Logistics</SelectItem>
                                <SelectItem value="Mall Activation">Mall Activation</SelectItem>
                                {/* Support */}
                                <SelectItem value="IT">IT</SelectItem>
                                <SelectItem value="HR">HR</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-[#7156a2] hover:bg-[#7156a2]/90 text-white transition-colors"
                  >
                    {activeTab === "login" ? "Login" : "Register"}
                  </Button>
                </form>
              </Form>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}