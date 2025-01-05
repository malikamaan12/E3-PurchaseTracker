import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import DraggableBrandingForm from "@/components/DraggableBrandingForm";
import UserManagement from "@/components/UserManagement";
import VendorManagement from "@/pages/VendorManagement";
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
import { ArrowLeft, Check, X, Plus, Filter } from "lucide-react";
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

// Add filter interface
interface AccountRequestFilters {
  status?: string;
  department?: string;
  role?: string;
}

// Create a schema for the filters
const filterSchema = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  role: z.string().optional(),
});

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("users");
  const [isSubPurposeDialogOpen, setIsSubPurposeDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState<AccountRequestFilters>({});

  // Initialize form with validation schema
  const filterForm = useForm<AccountRequestFilters>({
    resolver: zodResolver(filterSchema),
    defaultValues: filters,
    mode: 'onChange'
  });

  // Synchronize form values with filters state
  useEffect(() => {
    filterForm.reset(filters);
  }, [filters]);

  // Fetch account requests with filters
  const { data: accountRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ["/api/admin/account-requests", filters],
    queryFn: async ({ queryKey }) => {
      const [_, currentFilters] = queryKey;
      const queryParams = new URLSearchParams();

      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value);
        }
      });

      const response = await fetch(`/api/admin/account-requests?${queryParams.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch account requests');
      return response.json() as Promise<AccountRequest[]>;
    },
  });

  // Handle filter form submission
  const handleFilterSubmit = async (data: AccountRequestFilters) => {
    // Remove empty values
    const cleanedFilters = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value && value !== '')
    ) as AccountRequestFilters;

    setFilters(cleanedFilters);
    setIsFilterDialogOpen(false);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({});
    filterForm.reset({
      status: '',
      department: '',
      role: ''
    });
    setIsFilterDialogOpen(false);
  };

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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/account-requests", filters] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/account-requests", filters] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/account-requests", filters] });
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

  // Update the form submission handler
  const handleSubmit = form.handleSubmit((data) => {
    // Format dates properly before submission
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="requests">Account Requests</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Management</TabsTrigger>
          <TabsTrigger value="sub-purposes">Sub-purposes</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        {/* Account Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Account Requests</CardTitle>
                  <CardDescription>
                    Manage pending account creation requests
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {(filters.status || filters.department || filters.role) && (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                  <Button onClick={() => setIsFilterDialogOpen(true)}>
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>
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

              {/* Filter Dialog */}
              <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filter Account Requests</DialogTitle>
                    <DialogDescription>
                      Filter requests by status, department, or role
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...filterForm}>
                    <form onSubmit={filterForm.handleSubmit(handleFilterSubmit)} className="space-y-4">
                      <FormField
                        control={filterForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(value) => {
                                field.onChange(value);
                                filterForm.trigger("status");
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">All</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={filterForm.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(value) => {
                                field.onChange(value);
                                filterForm.trigger("department");
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">All</SelectItem>
                                <SelectItem value="IT">IT</SelectItem>
                                <SelectItem value="HR">HR</SelectItem>
                                <SelectItem value="Finance">Finance</SelectItem>
                                <SelectItem value="Marketing">Marketing</SelectItem>
                                <SelectItem value="Operations">Operations</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={filterForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(value) => {
                                field.onChange(value);
                                filterForm.trigger("role");
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">All</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="approver">Approver</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsFilterDialogOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Apply Filters</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
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
                            ? new Date(subPurpose.valid_from).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {subPurpose.valid_to
                            ? new Date(subPurpose.valid_to).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                            : "N/A"}
                        </TableCell>
                        <TableCell>
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
                                value={field.value || ''}
                                onChange={(e) => {
                                  const date = e.target.value;
                                  if (!date || !isNaN(Date.parse(date))) {
                                    field.onChange(date);
                                  }
                                }}
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
                                value={field.value || ''}
                                onChange={(e) => {
                                  const date = e.target.value;
                                  if (!date || !isNaN(Date.parse(date))) {
                                    field.onChange(date);
                                  }
                                }}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>
                Customize your company branding with an intuitive drag and drop interface
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DraggableBrandingForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}