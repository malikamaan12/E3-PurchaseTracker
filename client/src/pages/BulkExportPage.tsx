import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileArchive, Download, FileSpreadsheet, FileText } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';
import { ExportFilters } from '@/components/ExportFilters';

export default function BulkExportPage() {
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
  const { toast } = useToast();

  // Fetch requests from the API
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['/api/requests'],
    queryFn: async () => {
      const response = await fetch('/api/requests');
      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }
      return response.json();
    }
  });

  // Apply default filtering when requests load
  useEffect(() => {
    setFilteredRequests(requests);
  }, [requests]);

  const handleExportComplete = (fileName: string) => {
    toast({
      title: "Export Complete",
      description: `Your export has been downloaded as ${fileName}`,
      variant: "success"
    });
  };

  const handleExportError = (error: Error) => {
    console.error("Export error:", error);
    toast({
      title: "Export Failed",
      description: error.message || "An error occurred during export",
      variant: "destructive"
    });
  };

  return (
    <Container>
      <PageHeader
        title="Export Purchase Requests"
        description="Filter and export multiple purchase requests in various formats"
        backLink="/dashboard"
      />

      <div className="grid gap-6">
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex h-[300px] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">
                    Loading requests...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex h-[300px] flex-col items-center justify-center gap-2">
                <div className="rounded-full bg-destructive/15 p-3">
                  <FileText className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold">Error Loading Data</h3>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown error occurred"}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-2"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Total Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{requests.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Available for export
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Filtered Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{filteredRequests.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Will be included in export
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Available Formats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2">
                    <div className="flex items-center rounded-md bg-muted p-1.5 text-xs">
                      <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                      Excel
                    </div>
                    <div className="flex items-center rounded-md bg-muted p-1.5 text-xs">
                      <FileText className="mr-1 h-3.5 w-3.5" />
                      CSV
                    </div>
                    <div className="flex items-center rounded-md bg-muted p-1.5 text-xs">
                      <FileArchive className="mr-1 h-3.5 w-3.5" />
                      ZIP
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <ExportFilters
              requests={requests}
              onFilter={setFilteredRequests}
              onExportComplete={handleExportComplete}
              onExportError={handleExportError}
            />

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Request Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative max-h-[400px] overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="sticky top-0 bg-background">
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 border-b">
                          Request Number
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 border-b">
                          Title
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 border-b">
                          Status
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 border-b">
                          Date Created
                        </th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 border-b">
                          Priority
                        </th>
                        <th className="text-right text-xs font-medium text-muted-foreground p-3 border-b">
                          Total Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="h-24 text-center text-muted-foreground">
                            No results to display
                          </td>
                        </tr>
                      ) : (
                        filteredRequests.slice(0, 10).map((request) => (
                          <tr key={request.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">{request.requestNumber}</td>
                            <td className="p-3">{request.title}</td>
                            <td className="p-3">
                              <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                request.status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : request.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : request.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {request.status}
                              </div>
                            </td>
                            <td className="p-3">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                request.priority === 'high'
                                  ? 'bg-red-100 text-red-800'
                                  : request.priority === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {request.priority}
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              {request.currency || '$'}{' '}
                              {request.totalEstimatedCost ? 
                                request.totalEstimatedCost.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }) : '0.00'}
                            </td>
                          </tr>
                        ))
                      )}
                      {filteredRequests.length > 10 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-2 text-center text-xs text-muted-foreground italic">
                            Plus {filteredRequests.length - 10} more requests
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Container>
  );
}