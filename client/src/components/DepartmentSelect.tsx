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

// All available departments
const departments = [
  "Business",
  "Management",
  "Operation",
  "Support",
  "Finance",
  "Director",
  "CEO Office",
  "Sales",
  "Marketing",
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
  "Administration"
];

interface DepartmentSelectProps {
  label: string;
  onChange: (value: string[]) => void;
  value?: string[];
  multiple?: boolean;
  excludeDepartments?: string[];
  name?: string;
  id?: string;
}

export default function DepartmentSelect({
  label,
  onChange,
  value = [],
  multiple = false,
  excludeDepartments = [],
  name,
  id,
}: DepartmentSelectProps) {
  const [open, setOpen] = useState(false);

  const availableDepartments = departments.filter(
    dept => !excludeDepartments.includes(dept)
  );

  const handleSelect = (department: string) => {
    let newSelection: string[];
    if (multiple) {
      if (value.includes(department)) {
        newSelection = value.filter((d) => d !== department);
      } else {
        newSelection = [...value, department];
      }
    } else {
      newSelection = [department];
      setOpen(false);
    }
    onChange(newSelection);
  };

  return (
    <div className="space-y-4">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[#7058a3]">
          {label}
        </label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            className="w-full justify-between border-[#7058a3]/20 hover:border-[#7058a3]/40"
            name={name}
            id={id}
          >
            {value.length === 0
              ? "Select departments..."
              : multiple
              ? `${value.length} department${value.length === 1 ? '' : 's'} selected`
              : value[0]}
            <div className="ml-2 flex gap-1">
              {value.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className="rounded-sm px-1 font-normal bg-[#7058a3]/10 text-[#7058a3]"
                >
                  {value.length}
                </Badge>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full min-w-[300px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search departments..." 
              className="h-9"
            />
            <CommandEmpty className="py-2 px-4 text-sm">
              No department found.
            </CommandEmpty>
            <ScrollArea className="h-[200px]">
              <CommandGroup className="p-1">
                {availableDepartments.map((department) => (
                  <CommandItem
                    key={department}
                    value={department}
                    onSelect={() => handleSelect(department)}
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer aria-selected:bg-[#7058a3]/10 hover:bg-[#7058a3]/5"
                  >
                    <div className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-sm border border-[#7058a3]/20",
                      value.includes(department) ? "bg-[#7058a3] text-white" : "opacity-50"
                    )}>
                      {value.includes(department) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <span>{department}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </Command>
        </PopoverContent>
      </Popover>

      {multiple && value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((department) => (
            <Badge
              key={department}
              variant="secondary"
              className="cursor-pointer bg-[#7058a3]/10 text-[#7058a3] hover:bg-[#7058a3]/20 transition-colors"
              onClick={() => handleSelect(department)}
            >
              {department}
              <span className="ml-1 text-[#7058a3]/70">×</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}