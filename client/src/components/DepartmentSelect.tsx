import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mandatoryDepartments } from "@db/schema";

// Split departments into mandatory and optional
const optionalDepartments = [
  "Business Growth",
  "Branding",
  "Logistics",
  "Mall Activations",
  "Information Technology",
  "HR",
  "Procurement",
  "Legal",
  "Research and Development",
  "Quality Assurance",
  "Customer Service",
  "Project Management",
  "Sales",
  "Marketing"
].filter(dept => !mandatoryDepartments.includes(dept));

interface DepartmentSelectProps {
  label: string;
  onChange: (value: string[]) => void;
  multiple?: boolean;
}

export default function DepartmentSelect({
  label,
  onChange,
  multiple = false,
}: DepartmentSelectProps) {
  const [open, setOpen] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const handleSelect = (department: string) => {
    let newSelection: string[];
    if (multiple) {
      if (selectedDepartments.includes(department)) {
        newSelection = selectedDepartments.filter((d) => d !== department);
      } else {
        newSelection = [...selectedDepartments, department];
      }
    } else {
      newSelection = [department];
      setOpen(false);
    }
    setSelectedDepartments(newSelection);
    onChange(newSelection);
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>

      {/* Display mandatory approvers */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">
          Mandatory Approvers:
        </div>
        <div className="flex flex-wrap gap-2">
          {mandatoryDepartments.map((dept) => (
            <Badge key={dept} variant="secondary" className="bg-muted">
              <Lock className="w-3 h-3 mr-1" />
              {dept}
            </Badge>
          ))}
        </div>
      </div>

      {/* Optional department selection */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">
          Additional Approvers:
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedDepartments.length === 0
                ? "Select additional departments..."
                : multiple
                ? `${selectedDepartments.length} selected`
                : selectedDepartments[0]}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search departments..." />
              <CommandEmpty>No department found.</CommandEmpty>
              <ScrollArea className="h-[200px]">
                <CommandGroup>
                  {optionalDepartments.map((department) => (
                    <CommandItem
                      key={department}
                      onSelect={() => handleSelect(department)}
                      className="cursor-pointer hover:bg-accent"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedDepartments.includes(department)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {department}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </ScrollArea>
            </Command>
          </PopoverContent>
        </Popover>

        {multiple && selectedDepartments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedDepartments.map((department) => (
              <Badge
                key={department}
                variant="secondary"
                className="cursor-pointer hover:bg-muted"
                onClick={() => handleSelect(department)}
              >
                {department}
                <span className="ml-1 text-muted-foreground">×</span>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}