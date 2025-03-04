import { useState } from "react";
import { useLocation } from "wouter";
import UserManagement from "@/components/UserManagement";
import VendorManagement from "@/pages/VendorManagement";
import DepartmentDashboard from "@/pages/DepartmentDashboard";
import PDFConfiguration from "@/pages/PDFConfiguration";
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
import { ArrowLeft, Check, X, Plus, BarChart } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("users");
  const [isSubPurposeDialogOpen, setIsSubPurposeDialogOpen] = useState(false);
  const [selectedSubPurpose, setSelectedSubPurpose] = useState<SubPurpose | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch account requests
  const { data: accountRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ["/api/admin/account-requests"],
    queryFn: async () => {
      const response = await fetch("/api/admin/account-requests", {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch account requests');
      return response.json() as Promise<AccountRequest[]>;
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

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/update-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
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
        description: "User role updated successfully",
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

  // Form for creating sub-purpose
  const form = useForm<z.infer<typeof insertSubPurposeSchema>>({
    resolver: zodResolver(insertSubPurposeSchema),
    defaultValues: {
      name: "",
      purpose_type: "E3 EVENT",
      is_frozen: false,
      valid_from: undefined,
      valid_to: undefined,
    },
  });

  // Handle form submission
  const handleSubmit = form.handleSubmit((data) => {
    const formattedData = {
      ...data,
      valid_from: data.valid_from ? new Date(data.valid_from).toISOString() : null,
      valid_to: data.valid_to ? new Date(data.valid_to).toISOString() : null,
    };
    createSubPurpose.mutate(formattedData as z.infer<typeof insertSubPurposeSchema>);
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

  // Add these mutations after the createSubPurpose mutation
  const editSubPurpose = useMutation({
    mutationFn: async (data: SubPurpose) => {
      const res = await fetch(`/api/admin/sub-purposes/${data.id}`, {
        method: "PUT",
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
      setIsEditDialogOpen(false);
      setSelectedSubPurpose(null);
      form.reset();
      toast({
        title: "Success",
        description: "Sub-purpose updated successfully",
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

  const deleteSubPurpose = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/sub-purposes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sub-purposes"] });
      setIsDeleteDialogOpen(false);
      setSelectedSubPurpose(null);
      toast({
        title: "Success",
        description: "Sub-purpose deleted successfully",
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

  // Fetch sub-purposes
  const { data: subPurposes = [], isLoading: isLoadingSubPurposes } = useQuery<SubPurpose[]>({
    queryKey: ["/api/admin/sub-purposes"],
    queryFn: async () => {
      const response = await fetch("/api/admin/sub-purposes", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch sub-purposes");
      return response.json();
    },
  });

  const toggleSubPurposeFreeze = useMutation({
    mutationFn: async ({ id, isFrozen }: { id: number; isFrozen: boolean }) => {
      const res = await fetch(`/api/admin/sub-purposes/${id}/freeze`, {
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

  // Handle edit click
  const handleEditClick = (subPurpose: SubPurpose) => {
    setSelectedSubPurpose(subPurpose);
    form.reset({
      name: subPurpose.name,
      purpose_type: subPurpose.purpose_type,
      valid_from: subPurpose.valid_from ? new Date(subPurpose.valid_from).toISOString().slice(0, 16) : undefined,
      valid_to: subPurpose.valid_to ? new Date(subPurpose.valid_to).toISOString().slice(0, 16) : undefined,
      is_frozen: subPurpose.is_frozen,
    });
    setIsEditDialogOpen(true);
  };

  // Handle delete click
  const handleDeleteClick = (subPurpose: SubPurpose) => {
    setSelectedSubPurpose(subPurpose);
    setIsDeleteDialogOpen(true);
  };

  // Handle edit submit
  const handleEditSubmit = form.handleSubmit((data) => {
    if (!selectedSubPurpose) return;

    const formattedData = {
      ...data,
      id: selectedSubPurpose.id,
      valid_from: data.valid_from ? new Date(data.valid_from).toISOString() : null,
      valid_to: data.valid_to ? new Date(data.valid_to).toISOString() : null,
    };
    editSubPurpose.mutate(formattedData as SubPurpose);
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="requests">Account Requests</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Management</TabsTrigger>
          <TabsTrigger value="sub-purposes">Sub-purposes</TabsTrigger>
          <TabsTrigger value="pdf-config">PDF Configuration</TabsTrigger>
          <TabsTrigger value="department-analytics">
            <BarChart className="h-4 w-4 mr-2" />
            Department Analytics
          </TabsTrigger>
        </TabsList>

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
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
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
                        <TableCell>
                          {request.status === "pending" ? (
                            <Select
                              value={request.role}
                              onValueChange={(value) => {
                                updateRoleMutation.mutate({
                                  userId: request.id,
                                  role: value,
                                });
                              }}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="approver">Approver</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              className={cn(
                                "bg-slate-100 text-slate-800",
                                {
                                  "bg-blue-100 text-blue-800": request.role === "admin",
                                  "bg-purple-100 text-purple-800": request.role === "approver",
                                  "bg-green-100 text-green-800": request.role === "user",
                                }
                              )}
                            >
                              {request.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              request.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : request.status === "approved"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                            )}
                          >
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
                                onClick={() => approveAccountRequest.mutate(request.id)}
                                disabled={approveAccountRequest.isPending}
                              >
                                {approveAccountRequest.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => rejectAccountRequest.mutate(request.id)}
                                disabled={rejectAccountRequest.isPending}
                              >
                                {rejectAccountRequest.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
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

        {/* Vendor Management Tab */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Management</CardTitle>
              <CardDescription>
                Manage vendor accounts, status, and information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VendorManagement />
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
                        <TableCell>{subPurpose.purpose_type}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            subPurpose.is_frozen
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          )}>
                            {subPurpose.is_frozen ? "Frozen" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {subPurpose.valid_from
                            ? new Date(subPurpose.valid_from).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {subPurpose.valid_to
                            ? new Date(subPurpose.valid_to).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleSubPurposeFreeze.mutate({
                                  id: subPurpose.id,
                                  isFrozen: !subPurpose.is_frozen,
                                })
                              }
                              className={cn(
                                "flex items-center",
                                subPurpose.is_frozen
                                  ? "text-green-500 hover:text-green-700"
                                  : "text-red-500 hover:text-red-700"
                              )}
                            >
                              {subPurpose.is_frozen ? "Unfreeze" : "Freeze"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(subPurpose)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(subPurpose)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                        name="purpose_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purpose Type</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select purpose type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="E3 EVENT">E3 EVENT</SelectItem>
                                <SelectItem value="PROJECT">PROJECT</SelectItem>
                                <SelectItem value="MALL">MALL</SelectItem>
                                <SelectItem value="BUSINESS GROWTH">BUSINESS GROWTH</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="valid_from"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid From</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                {...field}
                                value={field.value ?? ''}
                              />
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
                        name="valid_to"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid To</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                {...field}
                                value={field.value ?? ''}
                              />
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
                          onClick={() => {
                            setIsSubPurposeDialogOpen(false);
                            form.reset();
                          }}
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
              {/* Add Edit Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Sub-purpose</DialogTitle>
                    <DialogDescription>
                      Modify the sub-purpose details
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...form}>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
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
                        name="purpose_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Purpose Type</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select purpose type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="E3 EVENT">E3 EVENT</SelectItem>
                                <SelectItem value="PROJECT">PROJECT</SelectItem>
                                <SelectItem value="MALL">MALL</SelectItem>
                                <SelectItem value="BUSINESS GROWTH">BUSINESS GROWTH</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="valid_from"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid From</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                {...field}
                                value={field.value ?? ''}
                              />
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
                        name="valid_to"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid To</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                {...field}
                                value={field.value ?? ''}
                              />
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
                          onClick={() => {
                            setIsEditDialogOpen(false);
                            setSelectedSubPurpose(null);
                            form.reset();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={editSubPurpose.isPending}>
                          {editSubPurpose.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Add Delete Confirmation Dialog */}
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the sub-purpose
                      "{selectedSubPurpose?.name}".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => selectedSubPurpose && deleteSubPurpose.mutate(selectedSubPurpose.id)}
                      disabled={deleteSubPurpose.isPending}
                    >
                      {deleteSubPurpose.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PDF Configuration Tab */}
        <TabsContent value="pdf-config">
          <Card>
            <CardHeader>
              <CardTitle>PDF Configuration</CardTitle>
              <CardDescription>
                Customize PDF document settings and branding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PDFConfiguration />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Department Analytics Tab */}
        <TabsContent value="department-analytics">
          <Card>
            <CardHeader>
              <CardTitle>Department Analytics</CardTitle>
              <CardDescription>
                View and analyze department-wise request statistics and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DepartmentDashboard />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}