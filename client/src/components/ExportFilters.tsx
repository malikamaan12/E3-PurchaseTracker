import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useVendors } from "@/hooks/use-vendors";
import { useSubPurposes } from "@/hooks/use-sub-purposes";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes Requested" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const departmentOptions = [
  { value: "Finance", label: "Finance" },
  { value: "CEO Office", label: "CEO Office" },
  { value: "Director", label: "Director" },
  { value: "IT", label: "IT" },
  { value: "HR", label: "HR" },
  { value: "Operations", label: "Operations" },
  { value: "Sales", label: "Sales" },
  { value: "Marketing", label: "Marketing" },
];

const purposeOptions = [
  { value: "operational", label: "Operational" },
  { value: "capital", label: "Capital" },
  { value: "services", label: "Services" },
  { value: "supplies", label: "Supplies" },
  { value: "travel", label: "Travel" },
];

export interface FilterValues {
  status: string[];
  priority: string[];
  department: string[];
  purposeType: string[];
  subPurposeId: number | null;
  vendorId: number | null;
  startDate: string | null;
  endDate: string | null;
  searchTerm: string;
}

const filterSchema = z.object({
  status: z.array(z.string()),
  priority: z.array(z.string()),
  department: z.array(z.string()),
  purposeType: z.array(z.string()),
  subPurposeId: z.number().nullable(),
  vendorId: z.number().nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  searchTerm: z.string().optional(),
});

type FilterFormValues = z.infer<typeof filterSchema>;

interface ExportFiltersProps {
  onFilterChange: (filters: FilterValues) => void;
  onReset: () => void;
  initialFilters?: FilterValues;
  disabled?: boolean;
}

export function ExportFilters({
  onFilterChange,
  onReset,
  initialFilters,
  disabled = false,
}: ExportFiltersProps) {
  const { toast } = useToast();
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({
    status: [],
    priority: [],
    department: [],
    purposeType: [],
    subPurposeId: null,
    vendorId: null,
    startDate: null,
    endDate: null,
    searchTerm: '',
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const response = await fetch("/api/vendors");
      if (!response.ok) throw new Error("Failed to fetch vendors");
      return response.json();
    },
  });

  const { data: subPurposes = [] } = useQuery({
    queryKey: ["subPurposes"],
    queryFn: async () => {
      const response = await fetch("/api/sub-purposes");
      if (!response.ok) throw new Error("Failed to fetch sub-purposes");
      return response.json();
    },
  });

  const form = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      status: initialFilters?.status || [],
      priority: initialFilters?.priority || [],
      department: initialFilters?.department || [],
      purposeType: initialFilters?.purposeType || [],
      subPurposeId: initialFilters?.subPurposeId || null,
      vendorId: initialFilters?.vendorId || null,
      startDate: initialFilters?.startDate ? new Date(initialFilters.startDate) : null,
      endDate: initialFilters?.endDate ? new Date(initialFilters.endDate) : null,
      searchTerm: initialFilters?.searchTerm || '',
    },
  });

  useEffect(() => {
    if (initialFilters) {
      // Reset form with initial filters
      form.reset({
        status: initialFilters.status || [],
        priority: initialFilters.priority || [],
        department: initialFilters.department || [],
        purposeType: initialFilters.purposeType || [],
        subPurposeId: initialFilters.subPurposeId || null,
        vendorId: initialFilters.vendorId || null,
        startDate: initialFilters.startDate ? new Date(initialFilters.startDate) : null,
        endDate: initialFilters.endDate ? new Date(initialFilters.endDate) : null,
        searchTerm: initialFilters.searchTerm || '',
      });
      setAppliedFilters(initialFilters);
    }
  }, [initialFilters, form]);

  const onSubmit = (values: FilterFormValues) => {
    // Convert date objects to strings
    const filters: FilterValues = {
      ...values,
      startDate: values.startDate ? format(values.startDate, 'yyyy-MM-dd') : null,
      endDate: values.endDate ? format(values.endDate, 'yyyy-MM-dd') : null,
    };

    setAppliedFilters(filters);
    onFilterChange(filters);
    toast({
      title: "Filters Applied",
      description: "The export list has been updated.",
    });
  };

  const resetForm = () => {
    form.reset({
      status: [],
      priority: [],
      department: [],
      purposeType: [],
      subPurposeId: null,
      vendorId: null,
      startDate: null,
      endDate: null,
      searchTerm: '',
    });
    onReset();
    setAppliedFilters({
      status: [],
      priority: [],
      department: [],
      purposeType: [],
      subPurposeId: null,
      vendorId: null,
      startDate: null,
      endDate: null,
      searchTerm: '',
    });
    toast({
      title: "Filters Reset",
      description: "All filters have been cleared.",
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (appliedFilters.status.length) count++;
    if (appliedFilters.priority.length) count++;
    if (appliedFilters.department.length) count++;
    if (appliedFilters.purposeType.length) count++;
    if (appliedFilters.subPurposeId) count++;
    if (appliedFilters.vendorId) count++;
    if (appliedFilters.startDate || appliedFilters.endDate) count++;
    if (appliedFilters.searchTerm) count++;
    return count;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="searchTerm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Search</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Search by title, description or ID" 
                  disabled={disabled}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="status">
            <AccordionTrigger>Status</AccordionTrigger>
            <AccordionContent>
              <FormField
                control={form.control}
                name="status"
                render={() => (
                  <FormItem>
                    <div className="space-y-2">
                      {statusOptions.map((option) => (
                        <FormField
                          key={option.value}
                          control={form.control}
                          name="status"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={option.value}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    disabled={disabled}
                                    checked={field.value?.includes(option.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option.value])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== option.value
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {option.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="priority">
            <AccordionTrigger>Priority</AccordionTrigger>
            <AccordionContent>
              <FormField
                control={form.control}
                name="priority"
                render={() => (
                  <FormItem>
                    <div className="space-y-2">
                      {priorityOptions.map((option) => (
                        <FormField
                          key={option.value}
                          control={form.control}
                          name="priority"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={option.value}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    disabled={disabled}
                                    checked={field.value?.includes(option.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option.value])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== option.value
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {option.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="department">
            <AccordionTrigger>Department</AccordionTrigger>
            <AccordionContent>
              <FormField
                control={form.control}
                name="department"
                render={() => (
                  <FormItem>
                    <div className="space-y-2">
                      {departmentOptions.map((option) => (
                        <FormField
                          key={option.value}
                          control={form.control}
                          name="department"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={option.value}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    disabled={disabled}
                                    checked={field.value?.includes(option.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option.value])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== option.value
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {option.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="purpose">
            <AccordionTrigger>Purpose</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="purposeType"
                  render={() => (
                    <FormItem>
                      <FormLabel>Purpose Type</FormLabel>
                      <div className="space-y-2">
                        {purposeOptions.map((option) => (
                          <FormField
                            key={option.value}
                            control={form.control}
                            name="purposeType"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={option.value}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      disabled={disabled}
                                      checked={field.value?.includes(option.value)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, option.value])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== option.value
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    {option.label}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subPurposeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub Purpose</FormLabel>
                      <Select
                        disabled={disabled}
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
                        value={field.value?.toString() || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sub purpose" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
                          {subPurposes.map((subPurpose: any) => (
                            <SelectItem key={subPurpose.id} value={subPurpose.id.toString()}>
                              {subPurpose.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="vendor">
            <AccordionTrigger>Vendor</AccordionTrigger>
            <AccordionContent>
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <Select
                      disabled={disabled}
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : null)}
                      value={field.value?.toString() || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Any</SelectItem>
                        {vendors.map((vendor: any) => (
                          <SelectItem key={vendor.id} value={vendor.id.toString()}>
                            {vendor.companyName || vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dateRange">
            <AccordionTrigger>Date Range</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={disabled}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            disabled={disabled}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={disabled}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            disabled={disabled}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-between mt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={resetForm}
            disabled={disabled || getActiveFilterCount() === 0}
          >
            Reset Filters
          </Button>
          <Button 
            type="submit" 
            disabled={disabled}
          >
            Apply Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default ExportFilters;