import { useState } from "react";
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
  value?: number;
  onChange: (value: number) => void;
}

export default function SubPurposeSelect({
  purposeType,
  value,
  onChange,
}: SubPurposeSelectProps) {
  const [open, setOpen] = useState(false);
  const [newSubPurpose, setNewSubPurpose] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subPurposes = [], isLoading } = useQuery<SubPurpose[]>({
    queryKey: ["/api/sub-purposes", purposeType],
    enabled: !!purposeType,
  });

  const createSubPurpose = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/sub-purposes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, purposeType }),
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
          >
            {isLoading ? "Loading..." : value ? selectedSubPurpose?.name : "Select sub-purpose..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search sub-purpose..." />
            <CommandEmpty>No sub-purpose found.</CommandEmpty>
            <CommandGroup>
              {subPurposes.map((subPurpose) => (
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
          <Button variant="outline" size="icon">
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