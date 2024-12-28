import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { mandatoryDepartments } from "@db/schema";

// Filter out mandatory departments since they are automatically added
const departments = [
  "Branding",
  "Logistics",
  "Mall Activation",
  "IT",
  "HR",
  "Mall Management",
  "Operations",
  "Marketing",
  "Sales",
  "Finance",
  "Legal",
  "Administration",
  "Procurement",
  "Customer Service",
  "Business Development",
  "Project Management",
  "Quality Assurance",
  "Research and Development"
].filter(dept => !mandatoryDepartments.includes(dept as any));

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
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      <div className="space-y-2">
        <div className="text-sm text-gray-500">
          Note: CEO Office, Finance, and Director approvals are mandatory and will be added automatically.
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
                ? "Select additional approvers..."
                : multiple
                ? `${selectedDepartments.length} selected`
                : selectedDepartments[0]}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search department..." />
              <CommandEmpty>No department found.</CommandEmpty>
              <CommandGroup>
                {departments.map((department) => (
                  <CommandItem
                    key={department}
                    onSelect={() => handleSelect(department)}
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
            </Command>
          </PopoverContent>
        </Popover>
        {multiple && selectedDepartments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedDepartments.map((department) => (
              <Badge
                key={department}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => handleSelect(department)}
              >
                {department}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}