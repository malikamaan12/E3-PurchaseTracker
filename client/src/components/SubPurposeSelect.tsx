import { useState, useEffect } from "react";
import { Check, Plus } from "lucide-react";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset value when purpose type changes
  useEffect(() => {
    onChange(undefined);
  }, [purposeType, onChange]);

  const { data: subPurposes = [], isLoading } = useQuery<SubPurpose[]>({
    queryKey: ["/api/sub-purposes", { purposeType }],
    queryFn: async () => {
      const response = await fetch(`/api/sub-purposes?purposeType=${encodeURIComponent(purposeType)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch sub-purposes");
      }
      return response.json();
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
      const res = await fetch("/api/sub-purposes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          purpose_type: purposeType 
        }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json() as Promise<SubPurpose>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-purposes"] });
      onChange(data.id);
      setDialogOpen(false);
      setNewSubPurpose("");
      toast({
        title: "Success",
        description: "Sub-purpose created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedSubPurpose = subPurposes.find(sp => sp.id === value);

  // Show warning if selected sub-purpose is no longer available
  useEffect(() => {
    if (selectedSubPurpose && !activeSubPurposes.some(sp => sp.id === selectedSubPurpose.id)) {
      toast({
        title: "Warning",
        description: "The selected sub-purpose is no longer available. Please select another one.",
        variant: "destructive",
      });
      onChange(undefined);
    }
  }, [selectedSubPurpose, activeSubPurposes]);

  const handleCreate = () => {
    if (!newSubPurpose.trim()) return;
    createSubPurpose.mutate(newSubPurpose);
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
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search sub-purpose..." />
            <CommandEmpty>No sub-purpose found.</CommandEmpty>
            <CommandGroup>
              {activeSubPurposes.map((subPurpose) => (
                <CommandItem
                  key={subPurpose.id}
                  onSelect={() => {
                    onChange(subPurpose.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === subPurpose.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {subPurpose.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

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
    </div>
  );
}