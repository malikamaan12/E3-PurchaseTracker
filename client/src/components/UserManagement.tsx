import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Power, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@db/schema";

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Role update mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/update-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
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
        description: "User role updated successfully",
      });
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for toggling user activation
  const toggleActivationMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const res = await fetch(`/api/admin/users/${userId}/toggle-activation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
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
        description: "User status updated successfully",
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

  // Mutation for deleting user
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const checkResponse = await fetch(`/api/admin/users/${userId}/check-deletion`, {
        credentials: "include",
      });

      if (!checkResponse.ok) {
        throw new Error(await checkResponse.text());
      }

      const { canDelete, reason } = await checkResponse.json();
      if (!canDelete) {
        throw new Error(reason || "Cannot delete this user. Try deactivating instead.");
      }

      const deleteResponse = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!deleteResponse.ok) {
        throw new Error(await deleteResponse.text());
      }

      return deleteResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle password change success
  const handlePasswordChangeSuccess = () => {
    toast({
      title: "Success",
      description: "Password updated successfully",
    });
  };

  if (isLoadingUsers) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              {!isMobile && <TableHead>Email</TableHead>}
              {!isMobile && <TableHead>Department</TableHead>}
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                {!isMobile && <TableCell>{user.email}</TableCell>}
                {!isMobile && <TableCell>{user.department}</TableCell>}
                <TableCell>
                  <Badge className={cn(
                    "bg-slate-100 text-slate-800",
                    {
                      "bg-blue-100 text-blue-800": user.role === "admin",
                      "bg-purple-100 text-purple-800": user.role === "approver",
                      "bg-green-100 text-green-800": user.role === "user",
                    }
                  )}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={cn(
                    user.isActive 
                      ? "bg-green-100 text-green-800 hover:bg-green-200" 
                      : "bg-red-100 text-red-800 hover:bg-red-200"
                  )}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size={isMobile ? "icon" : "sm"}
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setIsRoleDialogOpen(true);
                      }}
                      className="flex items-center"
                      title="Change role"
                    >
                      <Shield className="h-4 w-4" />
                      {!isMobile && <span className="ml-1">Role</span>}
                    </Button>

                    <ChangePasswordDialog
                      userId={user.id}
                      username={user.username}
                      onPasswordChange={handlePasswordChangeSuccess}
                    />

                    <Button
                      size={isMobile ? "icon" : "sm"}
                      variant={user.isActive ? "outline" : "default"}
                      onClick={() => {
                        toggleActivationMutation.mutate({
                          userId: user.id,
                          isActive: !user.isActive
                        });
                      }}
                      disabled={toggleActivationMutation.isPending}
                      className={cn(
                        "flex items-center",
                        user.isActive ? "hover:bg-red-100 hover:text-red-800" : "hover:bg-green-100 hover:text-green-800"
                      )}
                      title={user.isActive ? "Deactivate user" : "Activate user"}
                    >
                      {toggleActivationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                      {!isMobile && <span className="ml-1">{user.isActive ? "Deactivate" : "Activate"}</span>}
                    </Button>

                    <Button
                      size={isMobile ? "icon" : "sm"}
                      variant="destructive"
                      onClick={() => {
                        setUserToDelete(user);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="flex items-center"
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                      {!isMobile && <span className="ml-1">Delete</span>}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Role Change Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Select a new role for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Select
                  onValueChange={(value) => {
                    updateRoleMutation.mutate({
                      userId: selectedUser.id,
                      role: value
                    });
                  }}
                  defaultValue={selectedUser.role}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select new role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="approver">Approver</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRoleDialogOpen(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              Users with associated data cannot be deleted - use the deactivate option instead.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {userToDelete && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="font-semibold">Username</p>
                  <p>{userToDelete.username}</p>
                </div>
                <div>
                  <p className="font-semibold">Email</p>
                  <p>{userToDelete.email}</p>
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => deleteMutation.mutate(userToDelete.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    'Delete'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}