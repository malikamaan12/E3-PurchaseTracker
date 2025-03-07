import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, FileDown } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { BulkExportButton } from './BulkExportButton';

// Define the schema for our filter form
const formSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  department: z.array(z.string()).optional(),
  purposeType: z.string().optional(),
  includeAttachments: z.boolean().default(true),
  includeApprovals: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface ExportFiltersProps {
  requests: any[];
  onFilter: (filteredRequests: any[]) => void;
  onExportComplete?: (fileName: string) => void;
  onExportError?: (error: Error) => void;
}

export function ExportFilters({
  requests,
  onFilter,
  onExportComplete,
  onExportError
}: ExportFiltersProps) {
  const [filteredRequests, setFilteredRequests] = useState<any[]>(requests);
  const [isFiltering, setIsFiltering] = useState(false);

  // Define the statuses and priorities that are available
  const statuses = ['draft', 'pending', 'approved', 'rejected', 'changes_requested'];
  const priorities = ['low', 'normal', 'high', 'urgent'];
  
  // Extract unique departments and purpose types from the requests
  const departments = Array.from(new Set(requests.map(r => 
    r.requester?.department || 'Unknown').filter(Boolean)));
  
  const purposeTypes = Array.from(new Set(requests.map(r => 
    r.purposeType || 'Unknown').filter(Boolean)));

  // Initialize the form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: [],
      priority: [],
      department: [],
      purposeType: undefined,
      includeAttachments: true,
      includeApprovals: true,
    }
  });

  const applyFilters = (values: FormValues) => {
    setIsFiltering(true);
    
    try {
      // Filter the requests based on the form values
      let filtered = [...requests];
      
      // Filter by date range
      if (values.startDate) {
        filtered = filtered.filter(r => {
          const createdAt = r.createdAt ? new Date(r.createdAt) : null;
          return createdAt && createdAt >= values.startDate!;
        });
      }
      
      if (values.endDate) {
        // Add one day to include the end date
        const endDate = new Date(values.endDate);
        endDate.setDate(endDate.getDate() + 1);
        
        filtered = filtered.filter(r => {
          const createdAt = r.createdAt ? new Date(r.createdAt) : null;
          return createdAt && createdAt < endDate;
        });
      }
      
      // Filter by status
      if (values.status && values.status.length > 0) {
        filtered = filtered.filter(r => values.status!.includes(r.status));
      }
      
      // Filter by priority
      if (values.priority && values.priority.length > 0) {
        filtered = filtered.filter(r => values.priority!.includes(r.priority));
      }
      
      // Filter by department
      if (values.department && values.department.length > 0) {
        filtered = filtered.filter(r => 
          r.requester?.department && values.department!.includes(r.requester.department)
        );
      }
      
      // Filter by purpose type
      if (values.purposeType) {
        filtered = filtered.filter(r => r.purposeType === values.purposeType);
      }
      
      // Update the filtered requests state
      setFilteredRequests(filtered);
      onFilter(filtered);
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setIsFiltering(false);
    }
  };

  const resetFilters = () => {
    form.reset({
      startDate: undefined,
      endDate: undefined,
      status: [],
      priority: [],
      department: [],
      purposeType: undefined,
      includeAttachments: true,
      includeApprovals: true,
    });
    
    setFilteredRequests(requests);
    onFilter(requests);
  };

  // Watch for status changes to show selected badges
  const selectedStatuses = form.watch('status') || [];
  const selectedPriorities = form.watch('priority') || [];
  const selectedDepartments = form.watch('department') || [];
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Export Purchase Requests</CardTitle>
        <CardDescription>
          Filter and export purchase requests in various formats
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(applyFilters)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Range */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Date Range</h3>
                <div className="grid grid-cols-2 gap-4">
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
                                variant="outline"
                                className="w-full pl-3 text-left font-normal"
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span className="text-muted-foreground">Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || (form.getValues('endDate') ? date > form.getValues('endDate')! : false)
                              }
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
                                variant="outline"
                                className="w-full pl-3 text-left font-normal"
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span className="text-muted-foreground">Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || (form.getValues('startDate') ? date < form.getValues('startDate')! : false)
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Status and Priority */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Status and Priority</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            const current = field.value || [];
                            const newValue = current.includes(value)
                              ? current.filter(item => item !== value)
                              : [...current, value];
                            field.onChange(newValue);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statuses.map(status => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedStatuses.map(status => (
                            <Badge 
                              key={status} 
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => {
                                const newValue = field.value?.filter(s => s !== status) || [];
                                field.onChange(newValue);
                              }}
                            >
                              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')} ×
                            </Badge>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            const current = field.value || [];
                            const newValue = current.includes(value)
                              ? current.filter(item => item !== value)
                              : [...current, value];
                            field.onChange(newValue);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {priorities.map(priority => (
                              <SelectItem key={priority} value={priority}>
                                {priority.charAt(0).toUpperCase() + priority.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedPriorities.map(priority => (
                            <Badge 
                              key={priority} 
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => {
                                const newValue = field.value?.filter(p => p !== priority) || [];
                                field.onChange(newValue);
                              }}
                            >
                              {priority.charAt(0).toUpperCase() + priority.slice(1)} ×
                            </Badge>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Department and Purpose Type */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Department and Purpose</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            const current = field.value || [];
                            const newValue = current.includes(value)
                              ? current.filter(item => item !== value)
                              : [...current, value];
                            field.onChange(newValue);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map(dept => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedDepartments.map(dept => (
                            <Badge 
                              key={dept} 
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() => {
                                const newValue = field.value?.filter(d => d !== dept) || [];
                                field.onChange(newValue);
                              }}
                            >
                              {dept} ×
                            </Badge>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="purposeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select purpose type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Any</SelectItem>
                            {purposeTypes.map(purpose => (
                              <SelectItem key={purpose} value={purpose}>
                                {purpose}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Export Options */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Export Options</h3>
                <div className="flex flex-col space-y-2">
                  <FormField
                    control={form.control}
                    name="includeAttachments"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Include Attachments</FormLabel>
                          <FormDescription>
                            Include file attachments in ZIP exports (may increase file size)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="includeApprovals"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Include Approvals</FormLabel>
                          <FormDescription>
                            Include approval history in exports
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <Button type="submit" disabled={isFiltering}>
                  Apply Filters
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={resetFilters}
                  className="ml-2"
                >
                  Reset
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {filteredRequests.length} of {requests.length} requests selected
              </div>
            </div>
          </form>
        </Form>
        
        <Separator className="my-6" />
        
        <div className="flex flex-col space-y-4">
          <h3 className="text-sm font-medium">Export</h3>
          <div className="flex justify-between items-center">
            <div className="text-sm">
              Select format to export {filteredRequests.length} requests
            </div>
            
            <BulkExportButton
              requests={filteredRequests}
              isLoading={isFiltering}
              onSuccess={onExportComplete}
              onError={onExportError}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}