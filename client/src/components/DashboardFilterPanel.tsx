import { useState, useEffect, useCallback } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DateRangePicker from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import debounce from "lodash/debounce";
import { LoadingFilterPreview } from "./LoadingFilterPreview";

export interface FilterValues {
  status: string[];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  priority: string[];
  department: string[];
  purposeType: string[];
  subPurposeId: number | null;
  vendorId: number | null;
  costRange: {
    min: string;
    max: string;
  };
  searchQuery: string;
}

interface DashboardFilterPanelProps {
  onFilterChange: (filters: FilterValues) => void;
  departments: string[];
  vendors: Array<{ 
    id: number; 
    name?: string;
    companyName?: string;
  }>;
  subPurposes: Array<{ id: number; name: string; purposeType: string }>;
  isLoading?: boolean;
}

const FILTER_STORAGE_KEY = "dashboard_filters";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes Requested" }
];

const PURPOSE_TYPES = [
  "E3 EVENT",
  "PROJECT",
  "MALL",
  "BUSINESS GROWTH"
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" }
];

export function DashboardFilterPanel({
  onFilterChange,
  departments,
  vendors,
  subPurposes,
  isLoading = false,
}: DashboardFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Define function to get default filters
  function getDefaultFilters(): FilterValues {
    return {
      status: [],
      dateRange: {
        from: undefined,
        to: undefined,
      },
      priority: [],
      department: [],
      purposeType: [],
      subPurposeId: null,
      vendorId: null,
      costRange: {
        min: "",
        max: "",
      },
      searchQuery: "",
    };
  }
  
  // Initialize filters from localStorage or defaults
  const [filters, setFilters] = useState<FilterValues>(() => {
    const savedFilters = localStorage.getItem(FILTER_STORAGE_KEY);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        if (parsed.dateRange) {
          parsed.dateRange.from = parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined;
          parsed.dateRange.to = parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined;
        }
        return parsed;
      } catch (error) {
        console.error("Error parsing saved filters:", error);
        return getDefaultFilters();
      }
    }
    return getDefaultFilters();
  });

  // Define isFilterActive function with useCallback to prevent recreation on each render
  const isFilterActive = useCallback((value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") {
      if (value === null) return false;
      if ("from" in value && "to" in value) {
        return Boolean(value.from) || Boolean(value.to);
      }
      if ("min" in value && "max" in value) {
        return Boolean(value.min) || Boolean(value.max);
      }
    }
    if (typeof value === "number") return true;
    return Boolean(value);
  }, []);

  // Update active filters and localStorage when filters change
  useEffect(() => {
    // Update localStorage whenever filters change
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));

    // Calculate active filters when filters state changes
    const activeFiltersList = Object.entries(filters)
      .filter(([key, value]) => isFilterActive(value))
      .map(([key]) => key);

    setActiveFilters(activeFiltersList);
  }, [filters, isFilterActive]);

  // Filter available sub-purposes based on selected purpose type
  const availableSubPurposes = filters.purposeType.length > 0
    ? subPurposes.filter(sp => filters.purposeType.includes(sp.purposeType))
    : subPurposes;

  // Debounced function to apply filter changes
  const debouncedOnFilterChange = useCallback(
    debounce(async (newFilters: FilterValues) => {
      setIsApplying(true);
      try {
        await onFilterChange(newFilters);
        setIsDirty(false);
        setShowPreview(true);
        setTimeout(() => setShowPreview(false), 2000); // Hide preview after 2s
      } finally {
        setIsApplying(false);
      }
    }, 500),
    [onFilterChange]
  );

  // Function to update filter values
  const updateFilters = (key: keyof FilterValues, value: any) => {
    // Handle purposeType and subPurposeId relationship
    if (key === 'purposeType' && filters.subPurposeId) {
      const newPurposeTypes = Array.isArray(value) ? value : (value ? [value] : []);

      // If the new purpose types don't include the current subPurpose's type, clear subPurposeId
      if (filters.subPurposeId !== null) {
        const currentSubPurpose = subPurposes.find(sp => sp.id === filters.subPurposeId);
        if (currentSubPurpose && !newPurposeTypes.includes(currentSubPurpose.purposeType)) {
          const newFilters = {
            ...filters,
            [key]: newPurposeTypes,
            subPurposeId: null
          };
          setFilters(newFilters);
          setIsDirty(true);
          return;
        }
      }
    }

    // For single-value selects, convert to array if not already
    if ((key === 'status' || key === 'priority' || key === 'department' || key === 'purposeType') && 
        !Array.isArray(value) && value) {
      value = [value];
    }

    // Update the filters
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setIsDirty(true);
  };

  // Function to apply filters
  const applyFilters = () => {
    setShowPreview(true);
    debouncedOnFilterChange(filters);
  };

  // Function to clear a specific filter
  const clearFilter = (key: keyof FilterValues) => {
    const clearedValue = Array.isArray(filters[key])
      ? []
      : key === "dateRange"
      ? { from: undefined, to: undefined }
      : key === "costRange"
      ? { min: "", max: "" }
      : key === "vendorId" || key === "subPurposeId"
      ? null
      : "";

    updateFilters(key, clearedValue);

    // Apply filters immediately when clearing
    applyFilters();
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    const clearedFilters = getDefaultFilters();
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
    setActiveFilters([]);
    setIsDirty(false);
    localStorage.removeItem(FILTER_STORAGE_KEY);
  };

  // Format filter label for display
  const formatFilterLabel = (key: string): string => {
    return key
      .split(/(?=[A-Z])/)
      .join(" ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .replace("Id", "");
  };

  // Show loading state if necessary
  if (isLoading) {
    return <LoadingFilterPreview />;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("mb-6", isApplying && "opacity-70 pointer-events-none transition-opacity duration-200")}>
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
              {isDirty && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={applyFilters}
                  className="h-8"
                  disabled={isApplying}
                >
                  {isApplying ? "Applying..." : "Apply Filters"}
                </Button>
              )}
              {activeFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8"
                  disabled={isApplying}
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
                  disabled={isApplying}
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

        {(isApplying || showPreview) && (
          <div className="px-6 py-4 border-t">
            <LoadingFilterPreview />
          </div>
        )}

        <CollapsibleContent>
          <CardContent className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Status Filter */}
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
                    {STATUS_OPTIONS.map(({value, label}) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority Filter */}
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
                    {PRIORITY_OPTIONS.map(({value, label}) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department Filter */}
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
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Purpose Type Filter */}
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
                    {PURPOSE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sub-Purpose Filter */}
              <div className="space-y-2">
                <Label>Sub-Purpose</Label>
                <div className="relative">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-between" 
                        disabled={!filters.purposeType.length}
                      >
                        {filters.subPurposeId 
                          ? availableSubPurposes.find(sp => sp.id === filters.subPurposeId)?.name || "Select sub-purpose" 
                          : "Select sub-purpose"}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--trigger-width] max-h-[300px] overflow-y-auto">
                      {availableSubPurposes.map((sp) => (
                        <DropdownMenuItem 
                          key={sp.id} 
                          onClick={() => updateFilters("subPurposeId", sp.id)}
                          className="flex flex-col items-start"
                        >
                          <div className="font-medium">{sp.name}</div>
                          {sp.purposeType && (
                            <div className="text-xs text-muted-foreground mt-0.5">{sp.purposeType}</div>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem 
                        onClick={() => updateFilters("subPurposeId", null)}
                        className="border-t"
                      >
                        Clear selection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Vendor Filter */}
              <div className="space-y-2">
                <Label>Vendor</Label>
                <div className="relative">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-between"
                      >
                        {filters.vendorId 
                          ? vendors.find(v => v.id === filters.vendorId)?.name || 
                            vendors.find(v => v.id === filters.vendorId)?.companyName || 
                            "Select vendor" 
                          : "Select vendor"}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--trigger-width] max-h-[300px] overflow-y-auto">
                      {vendors.map((vendor) => (
                        <DropdownMenuItem 
                          key={vendor.id} 
                          onClick={() => updateFilters("vendorId", vendor.id)}
                          className="flex flex-col items-start"
                        >
                          <div className="font-medium">{vendor.name || vendor.companyName || `Vendor #${vendor.id}`}</div>
                          {vendor.companyName && vendor.name && vendor.name !== vendor.companyName && (
                            <div className="text-xs text-muted-foreground mt-0.5">{vendor.companyName}</div>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem 
                        onClick={() => updateFilters("vendorId", null)}
                        className="border-t"
                      >
                        Clear selection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Date Range Filter */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <DateRangePicker 
                  dateRange={{
                    from: filters.dateRange.from,
                    to: filters.dateRange.to,
                  }}
                  onDateRangeChange={(range: DateRange | undefined) => updateFilters("dateRange", range || { from: undefined, to: undefined })}
                />
              </div>

              {/* Cost Range Filter */}
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

            {/* Active Filters Display */}
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
      </Card>
    </Collapsible>
  );
}