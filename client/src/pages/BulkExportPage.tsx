import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { ExportFilters } from '@/components/ExportFilters';
import { PageHeader } from '@/components/PageHeader';

export default function BulkExportPage() {
  const { toast } = useToast();
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);

  // Fetch all requests with expanded relations for export
  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['requests', 'export'],
    queryFn: async () => {
      const response = await fetch('/api/requests/export');
      if (!response.ok) {
        throw new Error('Failed to fetch requests for export');
      }
      return response.json();
    }
  });

  useEffect(() => {
    if (requests) {
      setFilteredRequests(requests);
    }
  }, [requests]);

  const handleFilter = (filtered: any[]) => {
    setFilteredRequests(filtered);
  };

  const handleExportComplete = (fileName: string) => {
    toast({
      title: 'Export Complete',
      description: `Successfully exported to ${fileName}`,
      variant: 'success',
    });
  };

  const handleExportError = (error: Error) => {
    toast({
      title: 'Export Failed',
      description: error.message,
      variant: 'destructive',
    });
  };

  if (isLoading) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-lg text-muted-foreground">Loading requests for export...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Error Loading Requests</h2>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Failed to load requests for export'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        title="Bulk Export"
        description="Export multiple purchase requests in various formats"
      />
      
      <div className="space-y-8 py-6">
        {requests && requests.length > 0 ? (
          <ExportFilters
            requests={requests}
            onFilter={handleFilter}
            onExportComplete={handleExportComplete}
            onExportError={handleExportError}
          />
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">No Requests Available</h3>
                <p className="text-muted-foreground mb-4">
                  There are no purchase requests available for export
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Container>
  );
}