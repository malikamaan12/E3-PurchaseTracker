import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, FileText, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { BulkExportButton } from './BulkExportButton';
import { exportMultipleRequestsToExcel, exportMultipleRequestsToCSV } from '@/lib/exportUtils';

interface ExportFiltersProps {
  requests: any[];
  onFilter: (filteredRequests: any[]) => void;
  onExportComplete: (fileName: string) => void;
  onExportError: (error: Error) => void;
}

export function ExportFilters({ 
  requests, 
  onFilter,
  onExportComplete,
  onExportError 
}: ExportFiltersProps) {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [purposeFilter, setPurposeFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  
  // Extract unique values for filters
  const statusOptions = [...new Set(requests.map(req => req.status))].sort();
  const priorityOptions = [...new Set(requests.map(req => req.priority))].sort();
  
  // Get unique departments from requesters
  const departmentOptions = [...new Set(
    requests
      .filter(req => req.requester && req.requester.department)
      .map(req => req.requester.department)
  )].sort();
  
  // Get unique purpose types
  const purposeOptions = [...new Set(
    requests
      .filter(req => req.purposeType)
      .map(req => req.purposeType)
  )].sort();

  // Apply filters to requests
  useEffect(() => {
    const filtered = requests.filter(request => {
      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(request.status)) {
        return false;
      }
      
      // Priority filter
      if (priorityFilter.length > 0 && !priorityFilter.includes(request.priority)) {
        return false;
      }
      
      // Department filter
      if (departmentFilter.length > 0 && 
         (!request.requester || !request.requester.department || 
          !departmentFilter.includes(request.requester.department))) {
        return false;
      }
      
      // Purpose filter
      if (purposeFilter && request.purposeType !== purposeFilter) {
        return false;
      }
      
      // Date range filter
      if (dateRange.from) {
        const requestDate = new Date(request.createdAt);
        if (requestDate < dateRange.from) {
          return false;
        }
      }
      
      if (dateRange.to) {
        const requestDate = new Date(request.createdAt);
        if (requestDate > dateRange.to) {
          return false;
        }
      }
      
      return true;
    });
    
    onFilter(filtered);
  }, [requests, statusFilter, priorityFilter, departmentFilter, purposeFilter, dateRange, onFilter]);

  // Reset all filters
  const resetFilters = () => {
    setStatusFilter([]);
    setPriorityFilter([]);
    setDepartmentFilter([]);
    setPurposeFilter(null);
    setDateRange({
      from: undefined,
      to: undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="filters" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          <TabsContent value="filters" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Status filter */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Status</h3>
                <ScrollArea className="h-52 rounded-md border">
                  <div className="p-4 space-y-2">
                    {statusOptions.map(status => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`status-${status}`}
                          checked={statusFilter.includes(status)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setStatusFilter(prev => [...prev, status]);
                            } else {
                              setStatusFilter(prev => prev.filter(s => s !== status));
                            }
                          }}
                        />
                        <label 
                          htmlFor={`status-${status}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                        >
                          {status}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Priority filter */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Priority</h3>
                <ScrollArea className="h-52 rounded-md border">
                  <div className="p-4 space-y-2">
                    {priorityOptions.map(priority => (
                      <div key={priority} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`priority-${priority}`}
                          checked={priorityFilter.includes(priority)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPriorityFilter(prev => [...prev, priority]);
                            } else {
                              setPriorityFilter(prev => prev.filter(p => p !== priority));
                            }
                          }}
                        />
                        <label 
                          htmlFor={`priority-${priority}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                        >
                          {priority}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Department filter */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Department</h3>
                <ScrollArea className="h-52 rounded-md border">
                  <div className="p-4 space-y-2">
                    {departmentOptions.map(department => (
                      <div key={department} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`department-${department}`}
                          checked={departmentFilter.includes(department)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setDepartmentFilter(prev => [...prev, department]);
                            } else {
                              setDepartmentFilter(prev => prev.filter(d => d !== department));
                            }
                          }}
                        />
                        <label 
                          htmlFor={`department-${department}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {department}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Purpose Type filter */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Purpose Type</h3>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {purposeFilter
                        ? purposeOptions.find(purpose => purpose === purposeFilter)
                        : "Select purpose..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search purpose..." />
                      <CommandEmpty>No purpose found.</CommandEmpty>
                      <CommandGroup>
                        {purposeOptions.map(purpose => (
                          <CommandItem
                            key={purpose}
                            value={purpose}
                            onSelect={() => {
                              setPurposeFilter(purpose === purposeFilter ? null : purpose);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                purposeFilter === purpose ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {purpose}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Date Range Picker */}
                <div className="pt-4">
                  <h3 className="text-sm font-medium mb-2">Date Range</h3>
                  <DatePickerWithRange 
                    date={dateRange}
                    onDateChange={setDateRange}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview">
            <div className="border rounded-md p-4">
              <div className="text-sm text-muted-foreground mb-2">
                Selected filters:
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {statusFilter.length > 0 && (
                  <div className="bg-muted px-2 py-1 rounded-md text-xs">
                    Status: {statusFilter.join(', ')}
                  </div>
                )}
                {priorityFilter.length > 0 && (
                  <div className="bg-muted px-2 py-1 rounded-md text-xs">
                    Priority: {priorityFilter.join(', ')}
                  </div>
                )}
                {departmentFilter.length > 0 && (
                  <div className="bg-muted px-2 py-1 rounded-md text-xs">
                    Department: {departmentFilter.join(', ')}
                  </div>
                )}
                {purposeFilter && (
                  <div className="bg-muted px-2 py-1 rounded-md text-xs">
                    Purpose: {purposeFilter}
                  </div>
                )}
                {(dateRange.from || dateRange.to) && (
                  <div className="bg-muted px-2 py-1 rounded-md text-xs">
                    Date: {dateRange.from?.toLocaleDateString() || 'Any'} to {dateRange.to?.toLocaleDateString() || 'Any'}
                  </div>
                )}
                {!statusFilter.length && !priorityFilter.length && !departmentFilter.length && !purposeFilter && !dateRange.from && !dateRange.to && (
                  <div className="text-sm text-muted-foreground">No filters applied</div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={resetFilters}>
          Reset Filters
        </Button>
        <div className="flex gap-2">
          <BulkExportButton 
            requests={requests} 
            onExportComplete={onExportComplete}
            onExportError={onExportError}
          />
        </div>
      </CardFooter>
    </Card>
  );
}