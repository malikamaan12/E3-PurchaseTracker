"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList, 
  CommandSeparator 
} from "@/components/ui/Command";
import { 
  LayoutDashboard, 
  FileText, 
  Building2, 
  PieChart, 
  ShieldCheck, 
  Briefcase, 
  Users, 
  PlusCircle, 
  Settings, 
  Search,
  CheckSquare
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search destination..." />
      <CommandList className="custom-scrollbar border-t border-white/5">
        <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
          No matching commands or pages found.
        </CommandEmpty>

        <CommandGroup heading="Quick Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-brand-primary" />
            <span>Dashboard Overview</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/requests"))}>
            <FileText className="mr-2 h-4 w-4 text-blue-400" />
            <span>Purchase Requests</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/vendors"))}>
            <Building2 className="mr-2 h-4 w-4 text-emerald-400" />
            <span>Vendor Directory</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/analytics"))}>
            <PieChart className="mr-2 h-4 w-4 text-purple-400" />
            <span>Analytics & Expenditure</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/compliance"))}>
            <ShieldCheck className="mr-2 h-4 w-4 text-amber-400" />
            <span>Compliance Audit</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="my-1 bg-white/5" />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/requests?new=true"))}>
            <PlusCircle className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Create Purchase Request</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/vendors/onboarding"))}>
            <Building2 className="mr-2 h-4 w-4 text-amber-500" />
            <span>Onboard New Vendor</span>
          </CommandItem>
        </CommandGroup>

        {isAdmin && (
          <>
            <CommandSeparator className="my-1 bg-white/5" />
            <CommandGroup heading="Administration">
              <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/admin"))}>
                <Settings className="mr-2 h-4 w-4 text-rose-400" />
                <span>Admin Control Center</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/admin/users"))}>
                <Users className="mr-2 h-4 w-4 text-cyan-400" />
                <span>User & Access Management</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/admin/sub-purposes"))}>
                <Briefcase className="mr-2 h-4 w-4 text-brand-primary" />
                <span>Project Financial Controller</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/admin/departments"))}>
                <CheckSquare className="mr-2 h-4 w-4 text-indigo-400" />
                <span>Department Management</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
