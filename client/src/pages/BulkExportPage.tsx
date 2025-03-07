import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Container } from "@/components/ui/container";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, FileText, Settings } from "lucide-react";
import { RequestFilters } from "@/services/requests";
import ExportFilters, { FilterValues } from "@/components/ExportFilters";
import BulkExportButton from "@/components/BulkExportButton";

interface RequestStats {
  total: number;
  filteredCount: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byDepartment: Record<string, number>;
}

export default function BulkExportPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"excel" | "csv" | "pdf" | "zip" | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    status: [],
    priority: [],
    department: [],
    purposeType: [],
    subPurposeId: null,
    vendorId: null,
    startDate: null,
    endDate: null,
    searchTerm: "",
  });

  // Fetch all purchase requests
  const { data: requests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const response = await fetch("/api/requests");
      if (!response.ok) throw new Error("Failed to fetch requests");
      return response.json();
    },
  });

  // Filter the requests based on the filters
  const filteredRequests = useMemo(() => {
    if (!requests.length) return [];
    
    return requests.filter((request: any) => {
      // Filter by status
      if (filters.status.length && !filters.status.includes(request.status)) {
        return false;
      }
      
      // Filter by priority
      if (filters.priority.length && !filters.priority.includes(request.priority)) {
        return false;
      }
      
      // Filter by department
      if (filters.department.length && 
          (!request.requester || !filters.department.includes(request.requester.department))) {
        return false;
      }
      
      // Filter by purpose type
      if (filters.purposeType.length && !filters.purposeType.includes(request.purposeType)) {
        return false;
      }
      
      // Filter by sub purpose
      if (filters.subPurposeId && request.subPurposeId !== filters.subPurposeId) {
        return false;
      }
      
      // Filter by vendor
      if (filters.vendorId && request.vendorId !== filters.vendorId) {
        return false;
      }
      
      // Filter by date range
      if (filters.startDate) {
        const requestDate = new Date(request.createdAt);
        const startDate = new Date(filters.startDate);
        if (requestDate < startDate) {
          return false;
        }
      }
      
      if (filters.endDate) {
        const requestDate = new Date(request.createdAt);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // End of the day
        if (requestDate > endDate) {
          return false;
        }
      }
      
      // Filter by search term
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const matchesTitle = request.title?.toLowerCase().includes(searchTerm);
        const matchesDescription = request.description?.toLowerCase().includes(searchTerm);
        const matchesRequestNumber = request.requestNumber?.toLowerCase().includes(searchTerm);
        const matchesId = request.id?.toString().includes(searchTerm);
        
        if (!matchesTitle && !matchesDescription && !matchesRequestNumber && !matchesId) {
          return false;
        }
      }
      
      return true;
    });
  }, [requests, filters]);

  // Calculate statistics for the filtered requests
  const stats: RequestStats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    
    filteredRequests.forEach((request: any) => {
      // Count by status
      byStatus[request.status] = (byStatus[request.status] || 0) + 1;
      
      // Count by priority
      byPriority[request.priority] = (byPriority[request.priority] || 0) + 1;
      
      // Count by department
      if (request.requester?.department) {
        byDepartment[request.requester.department] = (byDepartment[request.requester.department] || 0) + 1;
      }
    });
    
    return {
      total: requests.length,
      filteredCount: filteredRequests.length,
      byStatus,
      byPriority,
      byDepartment
    };
  }, [filteredRequests, requests.length]);

  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    setFilters(newFilters);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      status: [],
      priority: [],
      department: [],
      purposeType: [],
      subPurposeId: null,
      vendorId: null,
      startDate: null,
      endDate: null,
      searchTerm: "",
    });
  }, []);

  const handleExportComplete = (fileName: string) => {
    toast({
      title: "Export Complete",
      description: `Exported to ${fileName}`,
      duration: 5000,
    });
    setExportFormat(null);
    setIsLoading(false);
  };

  const handleExportError = (error: Error) => {
    toast({
      title: "Export Error",
      description: error.message,
      variant: "destructive",
    });
    setExportFormat(null);
    setIsLoading(false);
  };

  return (
    <Container className="py-6">
      <PageHeader
        title="Bulk Export"
        description="Export multiple purchase requests at once in different formats"
        backLink="/dashboard"
        actions={
          <BulkExportButton
            requests={filteredRequests}
            filters={filters as RequestFilters}
            onExportComplete={handleExportComplete}
            onExportError={handleExportError}
            disabled={isLoading || filteredRequests.length === 0}
          />
        }
      />

      <Tabs defaultValue="export" className="mt-6">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="export">Export Options</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Requests</CardTitle>
                <CardDescription>
                  Showing {filteredRequests.length} of {requests.length} requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Filtered:</span>
                    <span className="font-medium">{filteredRequests.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{requests.length}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Active Filters:</span>
                    <div className="flex flex-wrap gap-2">
                      {filters.status.length > 0 && <Badge variant="outline">Status</Badge>}
                      {filters.priority.length > 0 && <Badge variant="outline">Priority</Badge>}
                      {filters.department.length > 0 && <Badge variant="outline">Department</Badge>}
                      {filters.purposeType.length > 0 && <Badge variant="outline">Purpose</Badge>}
                      {filters.subPurposeId && <Badge variant="outline">Sub-purpose</Badge>}
                      {filters.vendorId && <Badge variant="outline">Vendor</Badge>}
                      {filters.startDate || filters.endDate ? <Badge variant="outline">Date Range</Badge> : null}
                      {filters.searchTerm && <Badge variant="outline">Search</Badge>}
                      {!filters.status.length && 
                       !filters.priority.length && 
                       !filters.department.length && 
                       !filters.purposeType.length && 
                       !filters.subPurposeId && 
                       !filters.vendorId && 
                       !filters.startDate && 
                       !filters.endDate && 
                       !filters.searchTerm && 
                       <span className="text-sm text-muted-foreground">None</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Status</CardTitle>
                <CardDescription>
                  Request breakdown by status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.byStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">{status}:</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(stats.byStatus).length === 0 && (
                    <span className="text-sm text-muted-foreground">No data available</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Priority</CardTitle>
                <CardDescription>
                  Request breakdown by priority
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.byPriority).map(([priority, count]) => (
                    <div key={priority} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">{priority}:</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(stats.byPriority).length === 0 && (
                    <span className="text-sm text-muted-foreground">No data available</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Export Formats</CardTitle>
              <CardDescription>
                Choose how to export the filtered requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center"
                  onClick={() => setExportFormat("excel")}
                  disabled={isLoading || filteredRequests.length === 0}
                >
                  <FileText className="h-10 w-10 mb-2" />
                  <span className="font-medium">Excel (.xlsx)</span>
                  <span className="text-xs text-muted-foreground mt-1">Comprehensive with multiple sheets</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center"
                  onClick={() => setExportFormat("csv")}
                  disabled={isLoading || filteredRequests.length === 0}
                >
                  <FileText className="h-10 w-10 mb-2" />
                  <span className="font-medium">CSV</span>
                  <span className="text-xs text-muted-foreground mt-1">Simple tabular format</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center"
                  onClick={() => setExportFormat("pdf")}
                  disabled={isLoading || filteredRequests.length === 0}
                >
                  <FileText className="h-10 w-10 mb-2" />
                  <span className="font-medium">PDF</span>
                  <span className="text-xs text-muted-foreground mt-1">Professional document format</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center"
                  onClick={() => setExportFormat("zip")}
                  disabled={isLoading || filteredRequests.length === 0}
                >
                  <FileDown className="h-10 w-10 mb-2" />
                  <span className="font-medium">ZIP</span>
                  <span className="text-xs text-muted-foreground mt-1">With attachments and files</span>
                </Button>
                
                {exportFormat && (
                  <BulkExportButton
                    requests={filteredRequests}
                    filters={filters as RequestFilters}
                    format={exportFormat}
                    onExportComplete={handleExportComplete}
                    onExportError={handleExportError}
                    className="hidden"
                  />
                )}
              </div>
            </CardContent>
          </Card>
          
          {isLoadingRequests && (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading requests...</span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="filters" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Export Filters</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="ml-auto"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Reset All
                </Button>
              </CardTitle>
              <CardDescription>
                Filter the requests to export based on multiple criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExportFilters 
                onFilterChange={handleFilterChange}
                initialFilters={filters}
                onReset={resetFilters}
                disabled={isLoadingRequests}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Container>
  );
}