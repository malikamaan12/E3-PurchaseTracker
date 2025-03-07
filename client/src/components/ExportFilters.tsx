import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, FileText, FileSpreadsheet, Search, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BulkExportButton } from './BulkExportButton';
import { exportMultipleRequestsToExcel, exportMultipleRequestsToCSV } from '@/lib/exportUtils';

interface ExportFiltersProps {
  requests: any[];
  onFilter: (filteredRequests: any[]) => void;
  onExportComplete: (fileName: string) => void;
  onExportError: (error: Error) => void;
}

// Filters interface to maintain consistent types across the component
interface Filters {
  status: string[];
  priority: string[];
  department: string[];
  purposeType: string | null;
  subPurposeId: number | null;
  vendorId: number | null;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  searchTerm: string;
}

export function ExportFilters({ 
  requests, 
  onFilter,
  onExportComplete,
  onExportError 
}: ExportFiltersProps) {
  // State for all filters in a single object for better consistency
  const [filters, setFilters] = useState<Filters>({
    status: [],
    priority: [],
    department: [],
    purposeType: null,
    subPurposeId: null,
    vendorId: null,
    dateRange: {
      from: undefined,
      to: undefined,
    },
    searchTerm: ''
  });
  
  // State for UI interactions
  const [activeTab, setActiveTab] = useState<string>('basic');
  
  // Fetch vendors and sub-purposes for advanced filtering
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await fetch('/api/vendors');
      if (!response.ok) throw new Error('Failed to fetch vendors');
      return response.json();
    }
  });
  
  const { data: subPurposes = [], isLoading: subPurposesLoading } = useQuery({
    queryKey: ['subpurposes'],
    queryFn: async () => {
      const response = await fetch('/api/sub-purposes');
      if (!response.ok) throw new Error('Failed to fetch sub-purposes');
      return response.json();
    }
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
  
  // Filter sub-purposes based on selected purpose type
  const filteredSubPurposes = filters.purposeType 
    ? subPurposes.filter((sp: any) => sp.purpose_type === filters.purposeType)
    : subPurposes;

  // Handler for updating any filter value
  const updateFilter = useCallback((key: keyof Filters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Apply filters to requests
  useEffect(() => {
    const filtered = requests.filter(request => {
      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(request.status)) {
        return false;
      }
      
      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(request.priority)) {
        return false;
      }
      
      // Department filter
      if (filters.department.length > 0 && 
         (!request.requester || !request.requester.department || 
          !filters.department.includes(request.requester.department))) {
        return false;
      }
      
      // Purpose type filter
      if (filters.purposeType && request.purposeType !== filters.purposeType) {
        return false;
      }
      
      // Sub-purpose filter
      if (filters.subPurposeId && request.subPurposeId !== filters.subPurposeId) {
        return false;
      }
      
      // Vendor filter
      if (filters.vendorId && request.vendorId !== filters.vendorId) {
        return false;
      }
      
      // Date range filter
      if (filters.dateRange.from) {
        const requestDate = new Date(request.createdAt);
        if (requestDate < filters.dateRange.from) {
          return false;
        }
      }
      
      if (filters.dateRange.to) {
        const requestDate = new Date(request.createdAt);
        if (requestDate > filters.dateRange.to) {
          return false;
        }
      }
      
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const titleMatch = request.title?.toLowerCase().includes(searchLower);
        const descMatch = request.description?.toLowerCase().includes(searchLower);
        const numberMatch = request.requestNumber?.toLowerCase().includes(searchLower);
        const requesterMatch = request.requester?.username?.toLowerCase().includes(searchLower);
        const vendorMatch = request.vendor?.companyName?.toLowerCase().includes(searchLower) || 
                           request.vendor?.contactPerson?.toLowerCase().includes(searchLower);
        
        if (!(titleMatch || descMatch || numberMatch || requesterMatch || vendorMatch)) {
          return false;
        }
      }
      
      return true;
    });
    
    onFilter(filtered);
  }, [requests, filters, onFilter]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters({
      status: [],
      priority: [],
      department: [],
      purposeType: null,
      subPurposeId: null,
      vendorId: null,
      dateRange: {
        from: undefined,
        to: undefined,
      },
      searchTerm: ''
    });
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Export Filters</span>
          <span className="text-sm text-muted-foreground">
            {requests.length} requests available
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 grid grid-cols-3 w-full">
            <TabsTrigger value="basic">Basic Filters</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Filters</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          {/* Basic Filters Tab */}
          <TabsContent value="basic" className="space-y-4">
            {/* Search Filter */}
            <div className="flex w-full max-w-full items-center space-x-2 pb-4">
              <Input
                placeholder="Search requests by title, number, vendor..."
                className="flex-1"
                value={filters.searchTerm}
                onChange={e => updateFilter('searchTerm', e.target.value)}
              />
              {filters.searchTerm && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => updateFilter('searchTerm', '')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status filter */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Status</h3>
                <ScrollArea className="h-52 rounded-md border">
                  <div className="p-4 space-y-2">
                    {statusOptions.map(status => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`status-${status}`}
                          checked={filters.status.includes(status)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFilter('status', [...filters.status, status]);
                            } else {
                              updateFilter('status', filters.status.filter(s => s !== status));
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
                          checked={filters.priority.includes(priority)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFilter('priority', [...filters.priority, priority]);
                            } else {
                              updateFilter('priority', filters.priority.filter(p => p !== priority));
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
                          checked={filters.department.includes(department)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFilter('department', [...filters.department, department]);
                            } else {
                              updateFilter('department', filters.department.filter(d => d !== department));
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
            </div>
            
            {/* Date Range Filter */}
            <div className="pt-4">
              <h3 className="text-sm font-medium mb-2">Date Range</h3>
              <DatePickerWithRange 
                date={filters.dateRange}
                onDateChange={(range) => updateFilter('dateRange', range)}
              />
            </div>
          </TabsContent>
          
          {/* Advanced Filters Tab */}
          <TabsContent value="advanced" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {filters.purposeType
                        ? purposeOptions.find(purpose => purpose === filters.purposeType)
                        : "Select purpose type..."}
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
                              updateFilter('purposeType', purpose === filters.purposeType ? null : purpose);
                              // Clear sub-purpose when changing purpose type
                              if (purpose !== filters.purposeType) {
                                updateFilter('subPurposeId', null);
                              }
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                filters.purposeType === purpose ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {purpose}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Sub-Purpose filter - only enabled if purpose type is selected */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Sub-Purpose</h3>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={!filters.purposeType || subPurposesLoading}
                    >
                      {subPurposesLoading ? (
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </div>
                      ) : filters.subPurposeId ? (
                        filteredSubPurposes.find((sp: any) => sp.id === filters.subPurposeId)?.name || "Select sub-purpose..."
                      ) : (
                        "Select sub-purpose..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search sub-purpose..." />
                      <CommandEmpty>No sub-purpose found.</CommandEmpty>
                      <CommandGroup>
                        {filteredSubPurposes.map((subPurpose: any) => (
                          <CommandItem
                            key={subPurpose.id}
                            value={subPurpose.name}
                            onSelect={() => {
                              updateFilter('subPurposeId', subPurpose.id === filters.subPurposeId ? null : subPurpose.id);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                filters.subPurposeId === subPurpose.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {subPurpose.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Vendor filter */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Vendor</h3>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={vendorsLoading}
                    >
                      {vendorsLoading ? (
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </div>
                      ) : filters.vendorId ? (
                        vendors.find((v: any) => v.id === filters.vendorId)?.companyName || "Select vendor..."
                      ) : (
                        "Select vendor..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search vendor..." />
                      <CommandEmpty>No vendor found.</CommandEmpty>
                      <CommandGroup>
                        {vendors.map((vendor: any) => (
                          <CommandItem
                            key={vendor.id}
                            value={vendor.companyName}
                            onSelect={() => {
                              updateFilter('vendorId', vendor.id === filters.vendorId ? null : vendor.id);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                filters.vendorId === vendor.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {vendor.companyName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </TabsContent>
          
          {/* Preview Tab */}
          <TabsContent value="preview">
            <div className="border rounded-md p-4">
              <div className="text-sm text-muted-foreground mb-2">
                Applied filters:
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {filters.status.length > 0 && (
                  <Badge variant="outline" className="flex gap-1 items-center">
                    Status: {filters.status.join(', ')}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => updateFilter('status', [])}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {filters.priority.length > 0 && (
                  <Badge variant="outline" className="flex gap-1 items-center">
                    Priority: {filters.priority.join(', ')}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => updateFilter('priority', [])}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {filters.department.length > 0 && (
                  <Badge variant="outline" className="flex gap-1 items-center">
                    Department: {filters.department.join(', ')}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => updateFilter('department', [])}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {filters.purposeType && (
                  <Badge variant="outline" className="flex gap-1 items-center">
                    Purpose: {filters.purposeType}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => updateFilter('purposeType', null)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {filters.subPurposeId && (
                  <Badge variant="outline" className="flex gap-1 items-center">
                    Sub-Purpose: {filteredSubPurposes.find((sp: any) => sp.id === filters.subPurposeId)?.name}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => updateFilter('subPurposeId', null)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {filters.vendorId && (
                  <Badge variant="outline" className="flex gap-1 items-center">
                    Vendor: {vendors.find((v: any) => v.id === filters.vendorId)?.companyName}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => updateFilter('vendorId', null)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {(filters.dateRange.from || filters.dateRange.to) && (
                  <Badge variant="outline" className="flex gap-1 items-center">
                    Date: {filters.dateRange.from?.toLocaleDateString() || 'Any'} to {filters.dateRange.to?.toLocaleDateString() || 'Any'}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => updateFilter('dateRange', { from: undefined, to: undefined })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {filters.searchTerm && (
                  <Badge variant="outline" className="flex gap-1 items-center">
                    Search: {filters.searchTerm}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => updateFilter('searchTerm', '')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                )}
                
                {!filters.status.length && 
                 !filters.priority.length && 
                 !filters.department.length && 
                 !filters.purposeType && 
                 !filters.subPurposeId && 
                 !filters.vendorId && 
                 !filters.dateRange.from && 
                 !filters.dateRange.to && 
                 !filters.searchTerm && (
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
            filters={filters}
            onExportComplete={onExportComplete}
            onExportError={onExportError}
          />
        </div>
      </CardFooter>
    </Card>
  );
}