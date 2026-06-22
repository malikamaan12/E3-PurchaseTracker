"use client";

import { useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { MoreHorizontal, Users, ShieldAlert, CheckCircle2, XCircle, Plus, Key } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

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

function CreateUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    department: "",
    contact_number: ""
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.admin.users.create(data),
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      onClose();
      setFormData({ username: "", email: "", password: "", role: "user", department: "", contact_number: "" });
    },
    onError: (error: any) => toast.error(error.message || "Failed to create user"),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-white/5 bg-white/5">
          <h2 className="text-xl font-bold text-white font-serif">Create New User</h2>
          <p className="text-xs text-zinc-400 mt-1">Onboard a new system user with specific role and department.</p>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="p-6 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Account Info</label>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  placeholder="Username"
                  className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  required
                />
                <input 
                  placeholder="Password"
                  type="password"
                  className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
            </div>

            <input 
              placeholder="Email Address"
              type="email"
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <select 
                className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors appearance-none"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="user">User</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
              </select>
              <input 
                placeholder="Department"
                className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
                value={formData.department}
                onChange={e => setFormData({...formData, department: e.target.value})}
              />
            </div>

            <input 
              placeholder="Contact Number"
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
              value={formData.contact_number}
              onChange={e => setFormData({...formData, contact_number: e.target.value})}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-brand-primary rounded-xl text-sm font-bold text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: () => apiClient.admin.users.list(),
    enabled: !!user && !isAuthLoading
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiClient.admin.users.update(id, data),
    onSuccess: (res: any) => {
      toast.success(res.message || "User updated");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (error: any) => toast.error(error.message || "Update failed"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiClient.admin.users.updatePassword(id, { password }),
    onSuccess: () => toast.success("Password reset successfully"),
    onError: (error: any) => toast.error(error.message || "Failed to reset password"),
  });

  const handleResetPassword = (id: number) => {
    const password = prompt("Enter new password (min 6 characters):");
    if (password && password.length >= 6) {
      resetPasswordMutation.mutate({ id, password });
    } else if (password) {
      toast.error("Password too short");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage system access, department alignment, and roles.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border transition-colors">
            <Users className="w-5 h-5 text-brand-primary" />
            <span className="text-foreground font-bold">{users.length} Total Users</span>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create User
          </button>
        </div>
      </div>

      <CreateUserModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

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
                    <div className="max-w-[150px] sm:max-w-[250px]">
                      <p className="text-sm font-bold text-foreground transition-colors truncate" title={user.username}>{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate" title={user.email}>{user.email}</p>
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
                      onClick={() => updateMutation.mutate({ id: user.id, data: { canManageVendors: !user.canManageVendors } })}
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
                          
                          <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Security</div>
                          <DropdownMenu.Item 
                             onSelect={() => handleResetPassword(user.id)}
                             className="px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 text-zinc-300 hover:text-white focus:bg-white/10 focus:text-white"
                           >
                             <div className="flex items-center gap-2">
                               <Key className="w-4 h-4" />
                               Reset Password
                             </div>
                           </DropdownMenu.Item>

                          <DropdownMenu.Separator className="h-px bg-white/10 my-2" />

                          <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Change Role</div>
                          {["user", "approver", "admin"].map(role => (
                             <DropdownMenu.Item 
                               key={role}
                               onSelect={() => updateMutation.mutate({ id: user.id, data: { role } })}
                               className="px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 text-zinc-300 hover:text-white focus:bg-white/10 focus:text-white capitalize"
                             >
                               Make {role}
                             </DropdownMenu.Item>
                          ))}
                          
                          <DropdownMenu.Separator className="h-px bg-white/10 my-2" />
                          
                          <DropdownMenu.Item 
                            onSelect={() => updateMutation.mutate({ id: user.id, data: { isActive: !user.isActive } })}
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
