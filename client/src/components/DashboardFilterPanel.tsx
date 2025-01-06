import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface FilterValues {
  status: string[];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  priority: string[];
  department: string[];
  purposeType: string[];
  costRange: {
    min: string;
    max: string;
  };
  searchQuery: string;
}

interface DashboardFilterPanelProps {
  onFilterChange: (filters: FilterValues) => void;
  departments: string[];
  isLoading?: boolean;
}

const FILTER_STORAGE_KEY = "dashboard_filters";

export function DashboardFilterPanel({
  onFilterChange,
  departments,
  isLoading = false,
}: DashboardFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(() => {
    const savedFilters = localStorage.getItem(FILTER_STORAGE_KEY);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      // Convert date strings back to Date objects
      if (parsed.dateRange) {
        parsed.dateRange.from = parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined;
        parsed.dateRange.to = parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined;
      }
      return parsed;
    }
    return {
      status: [],
      dateRange: {
        from: undefined,
        to: undefined,
      },
      priority: [],
      department: [],
      purposeType: [],
      costRange: {
        min: "",
        max: "",
      },
      searchQuery: "",
    };
  });

  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  useEffect(() => {
    // Save filters to localStorage whenever they change
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const updateFilters = (key: keyof FilterValues, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);

    // Update active filters
    const activeFiltersList = Object.entries(newFilters)
      .filter(([_, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object") {
          if ("from" in value && "to" in value) {
            return value.from || value.to;
          }
          if ("min" in value && "max" in value) {
            return value.min || value.max;
          }
        }
        return value;
      })
      .map(([key]) => key);

    setActiveFilters(activeFiltersList);
  };

  const clearFilter = (key: keyof FilterValues) => {
    const clearedValue = Array.isArray(filters[key])
      ? []
      : key === "dateRange"
      ? { from: undefined, to: undefined }
      : key === "costRange"
      ? { min: "", max: "" }
      : "";

    updateFilters(key, clearedValue);
  };

  const clearAllFilters = () => {
    const clearedFilters: FilterValues = {
      status: [],
      dateRange: {
        from: undefined,
        to: undefined,
      },
      priority: [],
      department: [],
      purposeType: [],
      costRange: {
        min: "",
        max: "",
      },
      searchQuery: "",
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
    setActiveFilters([]);
    localStorage.removeItem(FILTER_STORAGE_KEY);
  };

  const formatFilterLabel = (key: string): string => {
    return key
      .split(/(?=[A-Z])/)
      .join(" ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  if (isLoading) {
    return (
      <Card className="mb-6 animate-pulse">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFilters.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilters.length} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8"
              >
                Clear all
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="h-8 gap-2"
              >
                {isOpen ? (
                  <>
                    Hide Filters
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show Filters
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
      </CardHeader>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status[0] || ""}
                  onValueChange={(value) =>
                    updateFilters("status", value ? [value] : [])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="changes_requested">
                      Changes Requested
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={filters.priority[0] || ""}
                  onValueChange={(value) =>
                    updateFilters("priority", value ? [value] : [])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={filters.department[0] || ""}
                  onValueChange={(value) =>
                    updateFilters("department", value ? [value] : [])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Purpose Type</Label>
                <Select
                  value={filters.purposeType[0] || ""}
                  onValueChange={(value) =>
                    updateFilters("purposeType", value ? [value] : [])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="E3 EVENT">E3 EVENT</SelectItem>
                    <SelectItem value="PROJECT">PROJECT</SelectItem>
                    <SelectItem value="MALL">MALL</SelectItem>
                    <SelectItem value="BUSINESS GROWTH">
                      BUSINESS GROWTH
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Date Range</Label>
                <DatePickerWithRange
                  date={{
                    from: filters.dateRange.from,
                    to: filters.dateRange.to,
                  }}
                  onSelect={(range) => updateFilters("dateRange", range)}
                />
              </div>

              <div className="space-y-2">
                <Label>Cost Range</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">
                      QAR
                    </span>
                    <Input
                      type="number"
                      placeholder="Min"
                      className="pl-12"
                      value={filters.costRange.min}
                      onChange={(e) =>
                        updateFilters("costRange", {
                          ...filters.costRange,
                          min: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">
                      QAR
                    </span>
                    <Input
                      type="number"
                      placeholder="Max"
                      className="pl-12"
                      value={filters.costRange.max}
                      onChange={(e) =>
                        updateFilters("costRange", {
                          ...filters.costRange,
                          max: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {activeFilters.map((filter) => (
                  <Badge
                    key={filter}
                    variant="secondary"
                    className="flex items-center gap-1 px-3 py-1"
                  >
                    {formatFilterLabel(filter)}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors"
                      onClick={() => clearFilter(filter as keyof FilterValues)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}