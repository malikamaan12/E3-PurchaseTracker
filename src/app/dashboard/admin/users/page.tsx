"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { 
  MoreHorizontal, 
  Users, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Key, 
  Building2, 
  Snowflake, 
  Trash2, 
  Flame,
  UserCog,
  Pencil
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { normalizeDepartmentAssignments, type DepartmentAssignment } from "@/lib/auth-shared";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { ActionConfirmDialog } from "@/components/ui/ActionConfirmDialog";

interface User {
  id: number;
  username: string;
  email: string;
  department: string;
  assignedDepartments?: Array<string | DepartmentAssignment>;
  role: string;
  contact_number: string;
  isActive: boolean;
  canManageVendors: boolean;
  createdAt: string;
}

interface Department {
  id: number;
  name: string;
  isApprover: boolean;
}

function CreateDepartmentModal({
  isOpen,
  onClose,
  onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (deptName: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isApprover, setIsApprover] = useState(false);

  const createDeptMutation = useMutation({
    mutationFn: (data: { name: string; isApprover: boolean }) => apiClient.admin.departments.create(data),
    onSuccess: (newDept: any) => {
      toast.success(`Department "${newDept.name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["departments-public"] });
      if (onCreated) onCreated(newDept.name);
      onClose();
      setName("");
      setIsApprover(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to create department"),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-[95vw] md:max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-serif">Add New Department</h2>
            <p className="text-xs text-zinc-400">Register a new department in the organization.</p>
          </div>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            toast.error("Department name is required");
            return;
          }
          createDeptMutation.mutate({ name: name.trim(), isApprover });
        }} className="py-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Department Name</label>
            <input
              placeholder="e.g. Logistics & Fleet, Legal..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-zinc-900/60 border border-white/5 rounded-xl cursor-pointer hover:bg-zinc-900 transition-colors">
            <input
              type="checkbox"
              checked={isApprover}
              onChange={e => setIsApprover(e.target.checked)}
              className="w-4 h-4 rounded text-brand-primary accent-brand-primary cursor-pointer"
            />
            <div>
              <p className="text-xs font-semibold text-white">Approver Department</p>
              <p className="text-[10px] text-zinc-400">Members of this department will have default approval capabilities.</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createDeptMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-brand-primary rounded-xl text-sm font-bold text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {createDeptMutation.isPending ? "Creating..." : "Add Department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateUserModal({
  isOpen,
  onClose,
  departments,
  isSuperAdmin,
  onOpenCreateDept
}: {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  isSuperAdmin?: boolean;
  onOpenCreateDept: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    department: departments[0]?.name || "",
    assignedDepartments: [] as DepartmentAssignment[],
    contact_number: ""
  });

  const [selectedDeptToAdd, setSelectedDeptToAdd] = useState("");
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<'user' | 'approver' | 'both'>('both');

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.admin.users.create(data),
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      onClose();
      setFormData({ 
        username: "", 
        email: "", 
        password: "", 
        role: "user", 
        department: departments[0]?.name || "", 
        assignedDepartments: [],
        contact_number: "" 
      });
      setSelectedDeptToAdd("");
      setSelectedRoleToAdd("both");
    },
    onError: (error: any) => toast.error(error.message || "Failed to create user"),
  });

  if (!isOpen) return null;

  const handleAddAssigned = () => {
    if (!selectedDeptToAdd) return;
    if (selectedDeptToAdd === formData.department) {
      toast.error("This is already the primary department.");
      return;
    }
    if (formData.assignedDepartments.some(a => a.department.toLowerCase() === selectedDeptToAdd.toLowerCase())) {
      toast.error("Department is already added.");
      return;
    }
    setFormData(prev => ({
      ...prev,
      assignedDepartments: [
        ...prev.assignedDepartments,
        { department: selectedDeptToAdd, role: selectedRoleToAdd, status: 'active' }
      ]
    }));
    setSelectedDeptToAdd("");
  };

  const handleRemoveAssigned = (deptName: string) => {
    setFormData(prev => ({
      ...prev,
      assignedDepartments: prev.assignedDepartments.filter(a => a.department.toLowerCase() !== deptName.toLowerCase())
    }));
  };

  const unassignedDepts = departments.filter(d => 
    d.name.toLowerCase() !== formData.department.toLowerCase() &&
    !formData.assignedDepartments.some(a => a.department.toLowerCase() === d.name.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-[95vw] md:max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar">
        <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white font-serif">Create New User</h2>
            <p className="text-xs text-zinc-400 mt-1">Onboard a new system user with roles and department assignments.</p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateDept}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Dept
          </button>
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
                <option value="supervisor">Supervisor</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              </select>

              <select
                className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors appearance-none"
                value={formData.department}
                onChange={e => {
                  const newDept = e.target.value;
                  setFormData({
                    ...formData,
                    department: newDept,
                    assignedDepartments: formData.assignedDepartments.filter(a => a.department !== newDept)
                  });
                }}
                required
              >
                <option value="" disabled>Primary Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* Additional Assigned Departments Section */}
            <div className="bg-zinc-900/40 p-3.5 rounded-2xl border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                  Additional Assigned Departments ({formData.assignedDepartments.length})
                </label>
                <span className="text-[10px] text-zinc-500">Multi-Dept Access</span>
              </div>

              {formData.assignedDepartments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.assignedDepartments.map(a => (
                    <div
                      key={a.department}
                      className="flex items-center gap-2 px-2.5 py-1 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white"
                    >
                      <span className="font-semibold">{a.department}</span>
                      <span className="text-[10px] text-brand-primary capitalize bg-brand-primary/10 px-1.5 py-0.5 rounded">
                        {a.role === 'both' ? 'User + Approver' : a.role}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAssigned(a.department)}
                        className="text-zinc-400 hover:text-rose-400 ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unassignedDepts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <select
                    value={selectedDeptToAdd}
                    onChange={e => setSelectedDeptToAdd(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand-primary/50"
                  >
                    <option value="">Select department...</option>
                    {unassignedDepts.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedRoleToAdd}
                    onChange={e => setSelectedRoleToAdd(e.target.value as any)}
                    className="bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand-primary/50"
                  >
                    <option value="both">Both (User + Approver)</option>
                    <option value="user">User (Submit-only)</option>
                    <option value="approver">Approver (Approve-only)</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleAddAssigned}
                    disabled={!selectedDeptToAdd}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              )}
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

function ManageDepartmentsModal({
  isOpen,
  user,
  departments,
  onClose,
  onOpenCreateDept
}: {
  isOpen: boolean;
  user: User | null;
  departments: Department[];
  onClose: () => void;
  onOpenCreateDept: () => void;
}) {
  const queryClient = useQueryClient();
  const [primaryDept, setPrimaryDept] = useState("");
  const [assignments, setAssignments] = useState<DepartmentAssignment[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptRole, setNewDeptRole] = useState<'user' | 'approver' | 'both'>('both');

  useEffect(() => {
    if (user) {
      setPrimaryDept(user.department || departments[0]?.name || "");
      const normalized = normalizeDepartmentAssignments(user.assignedDepartments, user.department);
      setAssignments(normalized);
      setNewDeptName("");
      setNewDeptRole("both");
    }
  }, [user, departments]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiClient.admin.users.update(id, data),
    onSuccess: () => {
      toast.success("Department assignments updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update departments"),
  });

  if (!isOpen || !user) return null;

  const handleAddAssignment = () => {
    if (!newDeptName) return;
    if (newDeptName === primaryDept) {
      toast.error("This is already the user's primary department.");
      return;
    }
    if (assignments.some(a => a.department.toLowerCase() === newDeptName.toLowerCase())) {
      toast.error("Department is already assigned to this user.");
      return;
    }

    setAssignments(prev => [
      ...prev,
      { department: newDeptName, role: newDeptRole, status: 'active' }
    ]);
    setNewDeptName("");
  };

  const handleRemoveAssignment = (deptName: string) => {
    setAssignments(prev => prev.filter(a => a.department.toLowerCase() !== deptName.toLowerCase()));
  };

  const handleToggleFreeze = (deptName: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.department.toLowerCase() === deptName.toLowerCase()) {
        const nextStatus: 'active' | 'frozen' = a.status === 'active' ? 'frozen' : 'active';
        return { ...a, status: nextStatus };
      }
      return a;
    }));
  };

  const handleChangeRole = (deptName: string, role: 'user' | 'approver' | 'both') => {
    setAssignments(prev => prev.map(a => {
      if (a.department.toLowerCase() === deptName.toLowerCase()) {
        return { ...a, role };
      }
      return a;
    }));
  };

  const handleSave = () => {
    const cleanAssignments = assignments.filter(a => a.department.toLowerCase() !== primaryDept.toLowerCase());
    updateMutation.mutate({
      id: user.id,
      data: {
        department: primaryDept,
        assignedDepartments: cleanAssignments
      }
    });
  };

  const unassignedDepts = departments.filter(d => 
    d.name.toLowerCase() !== primaryDept.toLowerCase() &&
    !assignments.some(a => a.department.toLowerCase() === d.name.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-[95vw] md:max-w-2xl max-h-[90vh] flex flex-col p-6 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-serif">Department Alignment & Access</h2>
              <p className="text-xs text-zinc-400">Manage primary, secondary roles (User/Approver/Both), and freeze state for <span className="text-white font-semibold">{user.username}</span>.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenCreateDept}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Dept
          </button>
        </div>

        <div className="py-4 space-y-5 overflow-y-auto custom-scrollbar flex-1 pr-1">
          {/* Primary Department */}
          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                Primary Department (Home Dept)
              </label>
              <span className="text-[10px] bg-brand-primary/10 text-brand-primary font-bold px-2 py-0.5 rounded-full border border-brand-primary/20">
                Primary Base
              </span>
            </div>
            <select
              value={primaryDept}
              onChange={(e) => {
                const newPrimary = e.target.value;
                setPrimaryDept(newPrimary);
                setAssignments(prev => prev.filter(a => a.department.toLowerCase() !== newPrimary.toLowerCase()));
              }}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50"
            >
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name} {d.isApprover ? "(Approver Dept)" : ""}</option>
              ))}
            </select>
          </div>

          {/* Assigned Departments List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Assigned Additional Departments ({assignments.length})
              </label>
              <span className="text-xs text-zinc-500">
                Granular Roles & Freeze Controls
              </span>
            </div>

            {assignments.length === 0 ? (
              <div className="p-5 text-center bg-zinc-900/40 border border-dashed border-white/10 rounded-2xl text-xs text-zinc-500">
                No additional departments assigned yet. Add one below.
              </div>
            ) : (
              <div className="space-y-2.5">
                {assignments.map((assignment) => {
                  const isFrozen = assignment.status === 'frozen';
                  return (
                    <div
                      key={assignment.department}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isFrozen 
                          ? "bg-cyan-950/20 border-cyan-500/30 text-zinc-300"
                          : "bg-zinc-900/80 border-white/5 text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-xl border shrink-0 ${
                          isFrozen 
                            ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                            : "bg-brand-primary/10 border-brand-primary/20 text-brand-primary"
                        }`}>
                          {isFrozen ? <Snowflake className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${isFrozen ? "text-cyan-200 line-through decoration-cyan-400/50" : "text-white"}`}>
                            {assignment.department}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isFrozen ? (
                              <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
                                <Snowflake className="w-3 h-3" /> Access Frozen
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Active Access
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Role Selector */}
                        <div className="flex items-center bg-zinc-950 border border-white/10 rounded-xl p-0.5 text-xs">
                          {(['user', 'approver', 'both'] as const).map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleChangeRole(assignment.department, r)}
                              className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all ${
                                assignment.role === r
                                  ? r === 'approver'
                                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                    : r === 'both'
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "text-zinc-400 hover:text-white"
                              }`}
                            >
                              {r === 'both' ? 'User + Approver' : r}
                            </button>
                          ))}
                        </div>

                        {/* Freeze/Unfreeze Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleFreeze(assignment.department)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                            isFrozen 
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          }`}
                          title={isFrozen ? "Unfreeze department access" : "Freeze department access"}
                        >
                          {isFrozen ? (
                            <>
                              <Flame className="w-3.5 h-3.5" /> Unfreeze
                            </>
                          ) : (
                            <>
                              <Snowflake className="w-3.5 h-3.5" /> Freeze
                            </>
                          )}
                        </button>

                        {/* Remove / Take Away Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(assignment.department)}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
                          title="Take away / Remove department"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Additional Department Section */}
          {unassignedDepts.length > 0 && (
            <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 space-y-3">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                Assign Another Department
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <select
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-primary/50"
                >
                  <option value="">Select department to assign...</option>
                  {unassignedDepts.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>

                <select
                  value={newDeptRole}
                  onChange={e => setNewDeptRole(e.target.value as any)}
                  className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-primary/50"
                >
                  <option value="both">User + Approver (Both)</option>
                  <option value="user">User (Submit-only)</option>
                  <option value="approver">Approver (Approve-only)</option>
                </select>

                <button
                  type="button"
                  onClick={handleAddAssignment}
                  disabled={!newDeptName}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Assign Department
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-white/5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex-1 px-4 py-2.5 bg-brand-primary rounded-xl text-sm font-bold text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving..." : "Save All Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  isOpen,
  user,
  onClose
}: {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiClient.admin.users.updatePassword(id, { password }),
    onSuccess: () => {
      toast.success(`Password for ${user?.username} reset successfully`);
      onClose();
      setPassword("");
    },
    onError: (error: any) => toast.error(error.message || "Failed to reset password"),
  });

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-[95vw] md:max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-300">
        <h2 className="text-xl font-bold text-white font-serif">Reset User Password</h2>
        <p className="text-xs text-zinc-400 mt-1 mb-4">Set a new password for user <span className="text-white font-bold">{user.username}</span> ({user.email}).</p>

        <form onSubmit={(e) => {
          e.preventDefault();
          if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
          }
          resetPasswordMutation.mutate({ id: user.id, password });
        }} className="space-y-4">
          <input
            type="password"
            placeholder="New Password (min 6 characters)"
            className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-brand-primary rounded-xl text-sm font-bold text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {resetPasswordMutation.isPending ? "Updating..." : "Set Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({
  isOpen,
  user,
  onClose
}: {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setEmail(user.email || "");
      setContactNumber(user.contact_number || "");
    }
  }, [user]);

  const editUserMutation = useMutation({
    mutationFn: (data: { username: string; email: string; contact_number: string }) =>
      apiClient.admin.users.update(user!.id, data),
    onSuccess: (res: any) => {
      toast.success(res.message || "User details updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      onClose();
    },
    onError: (error: any) => toast.error(error.message || "Failed to update user details"),
  });

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-[95vw] md:max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
            <UserCog className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-serif">Edit User Details</h2>
            <p className="text-xs text-zinc-400">Change username, email address, or contact details.</p>
          </div>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          if (!username.trim() || username.trim().length < 2) {
            toast.error("Username must be at least 2 characters");
            return;
          }
          editUserMutation.mutate({
            username: username.trim(),
            email: email.trim(),
            contact_number: contactNumber.trim()
          });
        }} className="space-y-4 pt-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Username</label>
            <input
              type="text"
              placeholder="Username"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              placeholder="Email Address"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Contact Number</label>
            <input
              type="text"
              placeholder="Contact Number"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 transition-colors"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editUserMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-brand-primary rounded-xl text-sm font-bold text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {editUserMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  usePageTitle("User Management");
  const { user, isLoading: isAuthLoading, isSuperAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateDeptModalOpen, setIsCreateDeptModalOpen] = useState(false);
  const [editTargetUser, setEditTargetUser] = useState<User | null>(null);
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [deptTargetUser, setDeptTargetUser] = useState<User | null>(null);
  const [userActionMenu, setUserActionMenu] = useState<User | null>(null);
  const [confirmResetUser, setConfirmResetUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAuthLoading && user && !isSuperAdmin) {
      toast.error("Access denied. Governance & System is restricted to Super Admin.");
      router.replace("/dashboard/admin");
    }
  }, [isAuthLoading, user, isSuperAdmin, router]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: () => apiClient.admin.users.list(),
    enabled: !!user && !isAuthLoading && !!isSuperAdmin
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => apiClient.departments.list(),
    enabled: !!user && !isAuthLoading && !!isSuperAdmin
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiClient.admin.users.update(id, data),
    onSuccess: (res: any) => {
      toast.success(res.message || "User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (error: any) => toast.error(error.message || "Update failed"),
  });

  if (isAuthLoading || (user && !isSuperAdmin)) {
    return null;
  }

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
          <div className="bg-secondary/50 px-4 py-2 rounded-xl flex items-center gap-2 border border-border transition-colors min-h-[44px]">
            <Users className="w-5 h-5 text-brand-primary" />
            <span className="text-foreground font-bold">{users.length} Total Users</span>
          </div>
          <button
            onClick={() => setIsCreateDeptModalOpen(true)}
            aria-label="Add Department"
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl font-bold border border-border transition-all min-h-[44px] touch-target text-xs sm:text-sm"
          >
            <Building2 className="w-4 h-4 text-brand-primary" />
            + Add Department
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            aria-label="Create User"
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all min-h-[44px] touch-target text-xs sm:text-sm"
          >
            <Plus className="w-5 h-5" />
            Create User
          </button>
        </div>
      </div>

      <CreateDepartmentModal
        isOpen={isCreateDeptModalOpen}
        onClose={() => setIsCreateDeptModalOpen(false)}
      />

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        departments={departments}
        isSuperAdmin={isSuperAdmin}
        onOpenCreateDept={() => setIsCreateDeptModalOpen(true)}
      />

      <EditUserModal
        isOpen={!!editTargetUser}
        user={editTargetUser}
        onClose={() => setEditTargetUser(null)}
      />

      <ManageDepartmentsModal
        isOpen={!!deptTargetUser}
        user={deptTargetUser}
        departments={departments}
        onClose={() => setDeptTargetUser(null)}
        onOpenCreateDept={() => setIsCreateDeptModalOpen(true)}
      />

      <ResetPasswordModal
        isOpen={!!resetTargetUser}
        user={resetTargetUser}
        onClose={() => setResetTargetUser(null)}
      />

      {/* Mobile User Cards */}
      <div className="md:hidden space-y-4">
        {users.map((u: User) => {
          const userDeptAssignments = normalizeDepartmentAssignments(u.assignedDepartments, u.department);
          return (
            <div key={u.id} className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{u.username}</p>
                    <button
                      onClick={() => setEditTargetUser(u)}
                      className="p-1.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-brand-primary rounded-lg touch-target"
                      title="Edit user / Change username"
                      aria-label={`Edit ${u.username}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    u.role === 'super_admin' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                    u.role === 'admin' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' :
                    u.role === 'approver' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                    u.role === 'supervisor' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' :
                    'bg-muted text-muted-foreground border-border'
                  }`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Department Badges Mobile */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="px-2 py-0.5 bg-secondary rounded text-[10px] font-bold text-foreground border border-border">
                  {u.department} (Primary)
                </span>
                {userDeptAssignments.map(a => (
                  <span
                    key={a.department}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      a.status === 'frozen'
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 line-through"
                        : a.role === 'approver'
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : a.role === 'both'
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {a.status === 'frozen' ? '❄️ ' : ''}{a.department} ({a.status === 'frozen' ? 'Frozen' : a.role})
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  {u.isActive ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /><span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active</span></>
                  ) : (
                    <><XCircle className="w-3.5 h-3.5 text-rose-500" /><span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Disabled</span></>
                  )}
                </div>
                <button
                  onClick={() => updateMutation.mutate({ id: u.id, data: { canManageVendors: !u.canManageVendors } })}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all min-h-[36px] touch-target ${
                    u.canManageVendors
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {u.canManageVendors ? 'Vendor Mgr' : 'No Extra Rights'}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <button
                  onClick={() => setEditTargetUser(u)}
                  aria-label={`Edit ${u.username}`}
                  className="flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold text-zinc-300 bg-secondary rounded-xl hover:bg-secondary/80 flex items-center justify-center gap-1.5 touch-target"
                >
                  <UserCog className="w-3.5 h-3.5 text-brand-primary" /> Edit
                </button>
                <button
                  onClick={() => setDeptTargetUser(u)}
                  aria-label={`Manage departments for ${u.username}`}
                  className="flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold text-zinc-300 bg-secondary rounded-xl hover:bg-secondary/80 flex items-center justify-center gap-1.5 touch-target"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-400" /> Depts
                </button>
                <button
                  onClick={() => setUserActionMenu(u)}
                  aria-label={`More actions for ${u.username}`}
                  className="min-h-[44px] min-w-[44px] px-3.5 flex items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors touch-target"
                  title="More actions"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile User Action Sheet */}
      {userActionMenu && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-white/10 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{userActionMenu.username}</p>
                <p className="text-xs text-zinc-400 truncate">{userActionMenu.email}</p>
              </div>
              <button
                onClick={() => setUserActionMenu(null)}
                aria-label="Close actions menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white touch-target"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setConfirmResetUser(userActionMenu);
                  setUserActionMenu(null);
                }}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition-colors border border-amber-500/20 flex items-center justify-between touch-target"
              >
                <span>Reset User Password</span>
                <Key className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Confirmation Dialog for Password Reset Initiation */}
      <ActionConfirmDialog
        isOpen={!!confirmResetUser}
        onOpenChange={(open) => { if (!open) setConfirmResetUser(null); }}
        title="Initialize Password Reset"
        variant="warning"
        confirmText="Proceed to Reset Password"
        onConfirm={() => {
          if (confirmResetUser) {
            setResetTargetUser(confirmResetUser);
            setConfirmResetUser(null);
          }
        }}
        description={
          <div className="space-y-3 text-left">
            <p>
              Are you sure you want to reset the password for <span className="font-bold text-foreground">{confirmResetUser?.username}</span> ({confirmResetUser?.email})?
            </p>
            <div className="p-3 bg-secondary/40 rounded-xl border border-border text-xs text-muted-foreground">
              Confirming will open the credential management prompt to input a new temporary or permanent password.
            </div>
          </div>
        }
      />

      {/* Desktop User Table */}
      <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <th className="p-4">User</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Department(s) & Roles</th>
                <th className="p-4">System Role</th>
                <th className="p-4">Vendor Access</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {users.map((u: User) => {
                const userDeptAssignments = normalizeDepartmentAssignments(u.assignedDepartments, u.department);
                return (
                  <tr key={u.id} className="hover:bg-secondary/50 transition-colors group">
                    <td className="p-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-foreground transition-colors truncate whitespace-nowrap" title={u.username}>{u.username}</p>
                          <button
                            onClick={() => setEditTargetUser(u)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-brand-primary transition-all"
                            title="Edit user details / change username"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground truncate whitespace-nowrap" title={u.email}>{u.email}</p>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{u.contact_number || '-'}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5 max-w-sm">
                        {/* Primary Department */}
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 bg-secondary rounded-lg text-xs font-bold text-foreground transition-colors border border-border flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-brand-primary" />
                            {u.department}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Primary</span>
                        </div>

                        {/* Assigned Departments */}
                        {userDeptAssignments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {userDeptAssignments.map((a) => {
                              const isFrozen = a.status === 'frozen';
                              return (
                                <span 
                                  key={a.department}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 transition-colors ${
                                    isFrozen
                                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 line-through"
                                      : a.role === 'approver'
                                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                      : a.role === 'both'
                                      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  }`}
                                  title={`${a.department} | Role: ${a.role} | Status: ${a.status}`}
                                >
                                  {isFrozen && <Snowflake className="w-3 h-3 text-cyan-400" />}
                                  {a.department} ({isFrozen ? 'Frozen' : a.role === 'both' ? 'Both' : a.role})
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        u.role === 'super_admin' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                        u.role === 'admin' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                        u.role === 'approver' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        u.role === 'supervisor' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' :
                        'bg-muted text-muted-foreground border-border'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => updateMutation.mutate({ id: u.id, data: { canManageVendors: !u.canManageVendors } })}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                          u.canManageVendors
                            ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                            : 'bg-zinc-800/50 text-zinc-500 border-white/5 opacity-50 hover:opacity-80'
                        }`}
                      >
                        {u.canManageVendors ? 'Vendor Manager' : 'No Extra Rights'}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {u.isActive ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
                            <CheckCircle2 className="w-4 h-4" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-rose-500">
                            <XCircle className="w-4 h-4" /> Suspended
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors outline-none">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className="glass bg-zinc-950 border border-white/10 p-2 rounded-2xl shadow-2xl min-w-[200px] z-50 animate-in fade-in-50 zoom-in-95">
                            <DropdownMenu.Item
                              onSelect={() => setEditTargetUser(u)}
                              className="px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 text-zinc-300 hover:text-white flex items-center gap-2"
                            >
                              <UserCog className="w-4 h-4 text-brand-primary" />
                              Edit User / Username
                            </DropdownMenu.Item>

                            <DropdownMenu.Item
                              onSelect={() => setDeptTargetUser(u)}
                              className="px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 text-zinc-300 hover:text-white flex items-center gap-2"
                            >
                              <Building2 className="w-4 h-4 text-blue-400" />
                              Manage Departments
                            </DropdownMenu.Item>

                            <DropdownMenu.Item
                              onSelect={() => setResetTargetUser(u)}
                              className="px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 text-zinc-300 hover:text-white flex items-center gap-2"
                            >
                              <Key className="w-4 h-4 text-amber-400" />
                              Reset Password
                            </DropdownMenu.Item>

                            {isSuperAdmin && (
                              <>
                                <DropdownMenu.Separator className="h-px bg-white/10 my-2" />
                                <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Change Role (Super Admin)</div>
                                {["user", "supervisor", "approver", "admin", "super_admin"].map(role => (
                                   <DropdownMenu.Item
                                     key={role}
                                     onSelect={() => updateMutation.mutate({ id: u.id, data: { role } })}
                                     className={`px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 text-zinc-300 hover:text-white focus:bg-white/10 focus:text-white capitalize ${u.role === role ? 'font-bold text-brand-primary' : ''}`}
                                   >
                                     Make {role.replace('_', ' ')}
                                   </DropdownMenu.Item>
                                ))}
                              </>
                            )}

                            <DropdownMenu.Separator className="h-px bg-white/10 my-2" />

                            <DropdownMenu.Item
                              onSelect={() => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                              className={`px-3 py-2 outline-none rounded-lg cursor-pointer hover:bg-white/10 ${u.isActive ? 'text-rose-500 hover:text-rose-400' : 'text-emerald-500 hover:text-emerald-400'}`}
                            >
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" />
                                {u.isActive ? "Deactivate User" : "Activate User"}
                              </div>
                            </DropdownMenu.Item>

                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                );
              })}
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
