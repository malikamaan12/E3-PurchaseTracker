import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  SubPurpose,
  NewSubPurpose,
  AccountRequest,
  User,
} from "@db/schema";
import { insertSubPurposeSchema, insertUserSchema } from "@db/schema";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("users");

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch sub-purposes
  const { data: subPurposes = [], isLoading: isLoadingPurposes } = useQuery<SubPurpose[]>({
    queryKey: ["/api/sub-purposes"],
  });

  // Fetch account requests
  const { data: accountRequests = [], isLoading: isLoadingRequests } = useQuery<AccountRequest[]>({
    queryKey: ["/api/admin/account-requests"],
  });

  // Sub-purpose management
  const createSubPurpose = useMutation({
    mutationFn: async (data: NewSubPurpose) => {
      const res = await fetch("/api/admin/sub-purposes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-purposes"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sub-purposes"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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

  // User management
  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
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

  const updateUser = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
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

  const purposeForm = useForm<NewSubPurpose>({
    resolver: zodResolver(insertSubPurposeSchema),
    defaultValues: {
      name: "",
      purposeType: "event",
      isFrozen: false,
      validFrom: "",
      validTo: "",
    },
  });

  const userForm = useForm({
    resolver: zodResolver(insertUserSchema.partial()),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      contactNumber: "",
      department: "",
      role: "user",
    },
  });

  return (
    <div className="container mx-auto py-8">
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="purposes">Purpose Management</TabsTrigger>
          <TabsTrigger value="requests">Account Requests</TabsTrigger>
        </TabsList>

        {/* User Management Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell>
                          <Select
                            defaultValue={user.role}
                            onValueChange={(value) =>
                              updateUser.mutate({
                                id: user.id,
                                data: { role: value },
                              })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="approver">Approver</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this user? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => deleteUser.mutate(user.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purpose Management Tab */}
        <TabsContent value="purposes">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Purpose Management</CardTitle>
                  <CardDescription>
                    Manage purpose types and sub-purposes
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Sub-purpose
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Sub-purpose</DialogTitle>
                    </DialogHeader>
                    <Form {...purposeForm}>
                      <form
                        onSubmit={purposeForm.handleSubmit((data) =>
                          createSubPurpose.mutate(data)
                        )}
                        className="space-y-4"
                      >
                        <FormField
                          control={purposeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={purposeForm.control}
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
                                  <SelectItem value="business_growth">
                                    Business Growth
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={purposeForm.control}
                          name="isFrozen"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>Freeze Status</FormLabel>
                                <FormDescription>
                                  When frozen, this sub-purpose will not be available for new requests
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={purposeForm.control}
                            name="validFrom"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Valid From</FormLabel>
                                <FormControl>
                                  <Input
                                    type="datetime-local"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={purposeForm.control}
                            name="validTo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Valid To</FormLabel>
                                <FormControl>
                                  <Input
                                    type="datetime-local"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <DialogFooter>
                          <Button type="submit">Create Sub-purpose</Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPurposes ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valid Period</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subPurposes.map((purpose) => (
                      <TableRow key={purpose.id}>
                        <TableCell>{purpose.name}</TableCell>
                        <TableCell>{purpose.purposeType}</TableCell>
                        <TableCell>
                          <Badge
                            variant={purpose.isFrozen ? "destructive" : "default"}
                          >
                            {purpose.isFrozen ? "Frozen" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {purpose.validFrom && purpose.validTo ? (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(purpose.validFrom), "MMM d, yyyy")} -{" "}
                              {format(new Date(purpose.validTo), "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No date restrictions
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Toggle freeze status
                                const toggleFreeze = async () => {
                                  try {
                                    await fetch(`/api/admin/sub-purposes/${purpose.id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        isFrozen: !purpose.isFrozen,
                                      }),
                                      credentials: "include",
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/sub-purposes"] });
                                    toast({
                                      title: "Success",
                                      description: `Sub-purpose ${purpose.isFrozen ? "unfrozen" : "frozen"} successfully`,
                                    });
                                  } catch (error: any) {
                                    toast({
                                      title: "Error",
                                      description: error.message,
                                      variant: "destructive",
                                    });
                                  }
                                };
                                toggleFreeze();
                              }}
                            >
                              {purpose.isFrozen ? "Unfreeze" : "Freeze"}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Sub-purpose</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this sub-purpose?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() =>
                                      deleteSubPurpose.mutate(purpose.id)
                                    }
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
                          <Badge
                            variant={
                              request.status === "pending"
                                ? "outline"
                                : request.status === "approved"
                                ? "default"
                                : "destructive"
                            }
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
      </Tabs>
    </div>
  );
}