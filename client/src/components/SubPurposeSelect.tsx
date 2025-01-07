import { useState, useEffect } from "react";
import { Check, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { SubPurpose } from "@db/schema";

interface SubPurposeSelectProps {
  purposeType: string;
  value?: number | null;
  onChange: (value: number | undefined) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
}

export default function SubPurposeSelect({
  purposeType,
  value,
  onChange,
  id,
  name,
  disabled = false
}: SubPurposeSelectProps) {
  const [open, setOpen] = useState(false);
  const [newSubPurpose, setNewSubPurpose] = useState("");
  const [editingSubPurpose, setEditingSubPurpose] = useState<SubPurpose | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubPurpose | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset value when purpose type changes
  useEffect(() => {
    onChange(undefined);
  }, [purposeType, onChange]);

  const { data: subPurposes = [], isLoading } = useQuery<SubPurpose[]>({
    queryKey: ["/api/subpurposes", purposeType],
    queryFn: async () => {
      if (!purposeType) return [];

      const response = await fetch(`/api/subpurposes?purposeType=${encodeURIComponent(purposeType)}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching sub-purposes:', errorText);
        throw new Error(errorText || "Failed to fetch sub-purposes");
      }

      const data = await response.json();
      console.log('Fetched sub-purposes:', data);
      return data;
    },
    enabled: !!purposeType,
  });

  // Filter active sub-purposes based on time constraints and frozen status
  const activeSubPurposes = subPurposes.filter(sp => {
    if (sp.is_frozen) return false;

    const now = new Date();

    if (sp.valid_from && new Date(sp.valid_from) > now) {
      return false;
    }

    if (sp.valid_to && new Date(sp.valid_to) < now) {
      return false;
    }

    return true;
  });

  const createSubPurpose = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/admin/sub-purposes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name,
          purposeType,
          is_frozen: false,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create sub-purpose");
      }

      return res.json() as Promise<SubPurpose>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subpurposes"] });
      onChange(data.id);
      setDialogOpen(false);
      setNewSubPurpose("");
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

  const updateSubPurpose = useMutation({
    mutationFn: async (data: { id: number; name: string }) => {
      const res = await fetch(`/api/admin/sub-purposes/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to update sub-purpose");
      }

      return res.json() as Promise<SubPurpose>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subpurposes"] });
      setEditDialogOpen(false);
      setEditingSubPurpose(null);
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
        const errorText = await res.text();
        throw new Error(errorText || "Failed to delete sub-purpose");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subpurposes"] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
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

  const selectedSubPurpose = subPurposes.find(sp => sp.id === value);

  useEffect(() => {
    if (selectedSubPurpose && !activeSubPurposes.some(sp => sp.id === selectedSubPurpose.id)) {
      toast({
        title: "Warning",
        description: "The selected sub-purpose is no longer available. Please select another one.",
        variant: "destructive",
      });
      onChange(undefined);
    }
  }, [selectedSubPurpose, activeSubPurposes, onChange, toast]);

  const handleCreate = () => {
    if (!newSubPurpose.trim()) return;
    createSubPurpose.mutate(newSubPurpose);
  };

  const handleEdit = () => {
    if (!editingSubPurpose || !editingSubPurpose.name.trim()) return;
    updateSubPurpose.mutate({
      id: editingSubPurpose.id,
      name: editingSubPurpose.name,
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteSubPurpose.mutate(deleteTarget.id);
  };

  const handleItemClick = (subPurpose: SubPurpose, e: React.MouseEvent) => {
    // Don't close the popover if clicking edit or delete buttons
    if ((e.target as HTMLElement).closest('.edit-button, .delete-button')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    onChange(subPurpose.id);
    setOpen(false);
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || !purposeType}
            id={id}
            name={name}
          >
            {isLoading 
              ? "Loading..." 
              : !purposeType 
              ? "Select purpose type first"
              : value 
              ? selectedSubPurpose?.name 
              : "Select sub-purpose..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search sub-purpose..." />
            <CommandEmpty>No sub-purpose found.</CommandEmpty>
            <CommandGroup>
              {activeSubPurposes.map((subPurpose) => (
                <CommandItem
                  key={subPurpose.id}
                  onSelect={(currentValue) => handleItemClick(subPurpose, currentValue)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === subPurpose.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {subPurpose.name}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 edit-button"
                      onClick={() => {
                        setEditingSubPurpose(subPurpose);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 delete-button"
                      onClick={() => {
                        setDeleteTarget(subPurpose);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            disabled={disabled || !purposeType}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sub-purpose</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Enter sub-purpose name"
              value={newSubPurpose}
              onChange={(e) => setNewSubPurpose(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub-purpose</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Enter sub-purpose name"
              value={editingSubPurpose?.name || ""}
              onChange={(e) => 
                setEditingSubPurpose(prev => 
                  prev ? { ...prev, name: e.target.value } : null
                )
              }
            />
          </div>
          <DialogFooter>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sub-purpose</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}