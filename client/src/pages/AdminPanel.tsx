import { useState } from "react";
import { useLocation } from "wouter";
import CompanyBrandingForm from "@/components/CompanyBrandingForm";
import UserManagement from "@/components/UserManagement";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AccountRequest, SubPurpose } from "@db/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubPurposeSchema } from "@db/schema";
import { z } from "zod";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("users");
  const [isSubPurposeDialogOpen, setIsSubPurposeDialogOpen] = useState(false);

  // Fetch account requests
  const { data: accountRequests = [], isLoading: isLoadingRequests } = useQuery<AccountRequest[]>({
    queryKey: ["/api/admin/account-requests"],
  });

  // Fetch sub-purposes
  const { data: subPurposes = [], isLoading: isLoadingSubPurposes } = useQuery<SubPurpose[]>({
    queryKey: ["/api/admin/sub-purposes"],
  });

  // Form for creating sub-purpose
  const form = useForm<z.infer<typeof insertSubPurposeSchema>>({
    resolver: zodResolver(insertSubPurposeSchema),
    defaultValues: {
      name: "",
      purposeType: "event",
      isFrozen: false,
    },
  });

  // Account request management
  const approveAccountRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/account-requests/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/account-requests"] });
      toast({
        title: "Success",
        description: "Account request approved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectAccountRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/account-requests/${id}/reject`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/account-requests"] });
      toast({
        title: "Success",
        description: "Account request rejected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create sub-purpose mutation
  const createSubPurpose = useMutation({
    mutationFn: async (data: z.infer<typeof insertSubPurposeSchema>) => {
      const res = await fetch("/api/admin/sub-purposes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sub-purposes"] });
      setIsSubPurposeDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Sub-purpose created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle sub-purpose freeze status
  const toggleSubPurposeFreeze = useMutation({
    mutationFn: async ({ id, isFrozen }: { id: number; isFrozen: boolean }) => {
      const res = await fetch(`/api/admin/sub-purposes/${id}/toggle-freeze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isFrozen }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sub-purposes"] });
      toast({
        title: "Success",
        description: "Sub-purpose status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-8">
      <Button
        variant="ghost"
        className="mb-4 hover:bg-[#7156a2]/10 transition-colors interactive-bounce"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="requests">Account Requests</TabsTrigger>
          <TabsTrigger value="sub-purposes">Sub-purposes</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        {/* User Management Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts, roles, and access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagement />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Account Requests</CardTitle>
              <CardDescription>
                Manage pending account creation requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRequests ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>{request.username}</TableCell>
                        <TableCell>{request.email}</TableCell>
                        <TableCell>{request.department}</TableCell>
                        <TableCell>{request.role}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            request.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : request.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                          )}>
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-500 hover:text-green-700"
                                onClick={() =>
                                  approveAccountRequest.mutate(request.id)
                                }
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                onClick={() =>
                                  rejectAccountRequest.mutate(request.id)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sub-purposes Tab */}
        <TabsContent value="sub-purposes">
          <Card>
            <CardHeader>
              <CardTitle>Sub-purposes Management</CardTitle>
              <CardDescription>
                Manage sub-purposes for purchase requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button
                  onClick={() => setIsSubPurposeDialogOpen(true)}
                  className="flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Sub-purpose
                </Button>
              </div>

              {isLoadingSubPurposes ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Purpose Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valid From</TableHead>
                      <TableHead>Valid To</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subPurposes.map((subPurpose) => (
                      <TableRow key={subPurpose.id}>
                        <TableCell>{subPurpose.name}</TableCell>
                        <TableCell>{subPurpose.purposeType}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            subPurpose.isFrozen
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          )}>
                            {subPurpose.isFrozen ? "Frozen" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {subPurpose.validFrom
                            ? new Date(subPurpose.validFrom).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {subPurpose.validTo
                            ? new Date(subPurpose.validTo).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toggleSubPurposeFreeze.mutate({
                                id: subPurpose.id,
                                isFrozen: !subPurpose.isFrozen,
                              })
                            }
                            className={cn(
                              "flex items-center",
                              subPurpose.isFrozen
                                ? "text-green-500 hover:text-green-700"
                                : "text-red-500 hover:text-red-700"
                            )}
                          >
                            {subPurpose.isFrozen ? "Unfreeze" : "Freeze"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Create Sub-purpose Dialog */}
              <Dialog open={isSubPurposeDialogOpen} onOpenChange={setIsSubPurposeDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Sub-purpose</DialogTitle>
                    <DialogDescription>
                      Add a new sub-purpose for purchase requests
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((data) => createSubPurpose.mutate(data))} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter sub-purpose name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="purposeType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purpose Type</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select purpose type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="event">Event</SelectItem>
                                <SelectItem value="project">Project</SelectItem>
                                <SelectItem value="mall">Mall</SelectItem>
                                <SelectItem value="business_growth">Business Growth</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="validFrom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid From</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormDescription>
                              Optional: Set when this sub-purpose becomes valid
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="validTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid To</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormDescription>
                              Optional: Set when this sub-purpose expires
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsSubPurposeDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createSubPurpose.isPending}>
                          {createSubPurpose.isPending ? "Creating..." : "Create"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>
                Customize company branding, logo, and PDF templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyBrandingForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}