"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { MoreHorizontal, Users, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface User {
  id: number;
  username: string;
  email: string;
  department: string;
  role: string;
  contact_number: string;
  isActive: boolean;
  canManageVendors: boolean;
  createdAt: string;
}

export default function UserManagementPage() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: () => apiClient.admin.users.list(),
  });

  const toggleActivationMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiClient.admin.users.toggleActivation(id, isActive),
    onSuccess: () => {
      toast.success("User status updated");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (error: any) => toast.error(error.message || "Failed to update status"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiClient.admin.users.updateRole(id, role),
    onSuccess: () => {
      toast.success("User role updated");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (error: any) => toast.error(error.message || "Failed to update role"),
  });
  
  const updatePermissionsMutation = useMutation({
    mutationFn: ({ id, canManageVendors }: { id: number; canManageVendors: boolean }) =>
      apiClient.admin.users.updatePermissions(id, { canManageVendors }),
    onSuccess: (data: any) => {
      toast.success(data.message || "Permissions updated");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (error: any) => toast.error(error.message || "Failed to update permissions"),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage system access, department alignment, and roles.</p>
        </div>
        <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border transition-colors">
          <Users className="w-5 h-5 text-brand-primary" />
          <span className="text-foreground font-bold">{users.length} Total Users</span>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">User</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Contact</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Department</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Role</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Permissions</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Status</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user: User) => (
                <tr key={user.id} className="hover:bg-secondary/50 transition-colors group">
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-bold text-foreground transition-colors">{user.username}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{user.contact_number}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-secondary rounded text-xs font-medium text-foreground transition-colors">
                      {user.department}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      user.role === 'admin' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                      user.role === 'approver' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      'bg-muted text-muted-foreground border-border'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => updatePermissionsMutation.mutate({ id: user.id, canManageVendors: !user.canManageVendors })}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        user.canManageVendors 
                          ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                          : 'bg-zinc-800/50 text-zinc-500 border-white/5 opacity-50 hover:opacity-80'
                      }`}
                    >
                      {user.canManageVendors ? 'Vendor Manager' : 'No Extra Rights'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {user.isActive ? (
                        <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs text-emerald-500 font-medium">Active</span></>
                      ) : (
                        <><XCircle className="w-4 h-4 text-rose-500" /><span className="text-xs text-rose-500 font-medium">Disabled</span></>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content align="end" className="glass bg-zinc-950/90 border border-white/10 p-2 rounded-xl shadow-2xl min-w-[200px] z-50 text-sm animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                          
                          <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Change Role</div>
                          {["user", "approver", "admin"].map(role => (
                             <DropdownMenu.Item 
                               key={role}
                               onSelect={() => updateRoleMutation.mutate({ id: user.id, role })}
                               className="px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 text-zinc-300 hover:text-white focus:bg-white/10 focus:text-white capitalize"
                             >
                               Make {role}
                             </DropdownMenu.Item>
                          ))}
                          
                          <DropdownMenu.Separator className="h-px bg-white/10 my-2" />
                          
                          <DropdownMenu.Item 
                            onSelect={() => toggleActivationMutation.mutate({ id: user.id, isActive: !user.isActive })}
                            className={`px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 ${user.isActive ? 'text-rose-500 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}
                          >
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4" />
                              {user.isActive ? "Deactivate User" : "Activate User"}
                            </div>
                          </DropdownMenu.Item>

                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-8 text-center text-muted-foreground font-medium">No users found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
