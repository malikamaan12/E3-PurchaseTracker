import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, FileText, FileArchive, Download, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { pdfService } from '../services/pdfService';

interface EnhancedPdfExportProps {
  requestId: number;
  includePdf?: boolean;
  includeZip?: boolean;
  includeAttachments?: boolean;
  title?: string;
  userType?: 'user' | 'approver' | 'admin';
}

export default function EnhancedPdfExport({
  requestId,
  includePdf = true,
  includeZip = true,
  includeAttachments = true,
  title = 'Export Options',
  userType = 'user'
}: EnhancedPdfExportProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pdf');
  const [errorDetails, setErrorDetails] = useState<{
    visible: boolean;
    message: string;
    recommendations: string[];
  }>({
    visible: false,
    message: '',
    recommendations: []
  });

  const handleExportPdf = async () => {
    setIsLoading(true);
    setErrorDetails({ visible: false, message: '', recommendations: [] });

    try {
      // Log the PDF generation attempt
      await pdfService.logPdfAudit(requestId, 'pdf_generated', {
        userType,
        timestamp: new Date().toISOString()
      });

      // Generate and download the PDF
      const pdfUrl = await pdfService.exportRequestToPdf(requestId, userType);
      
      // Create a temporary anchor element to download the file
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.setAttribute('download', `request-${requestId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Log the successful download
      await pdfService.logPdfAudit(requestId, 'pdf_downloaded', {
        userType,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "PDF Export Successful",
        description: "Your document has been exported successfully.",
        variant: "success"
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);

      // Get error analysis from AI
      let errorAnalysis = {
        analysis: 'An error occurred during PDF export. Please try again later.',
        recommendations: [
          'Check your network connection',
          'Verify that the request exists',
          'Try again in a few minutes'
        ]
      };
      
      try {
        // Use AI-powered error analysis if available
        if (pdfService.analyzePdfError) {
          errorAnalysis = await pdfService.analyzePdfError(error, requestId);
        }
      } catch (analyzeError) {
        console.error('Error analyzing PDF error:', analyzeError);
      }

      // Log the error
      await pdfService.logPdfAudit(requestId, 'pdf_analyzed', {
        userType, 
        error: error instanceof Error ? error.message : String(error),
        analysis: errorAnalysis.analysis,
        timestamp: new Date().toISOString()
      });

      // Show error details to the user
      setErrorDetails({
        visible: true,
        message: errorAnalysis.analysis,
        recommendations: errorAnalysis.recommendations
      });

      toast({
        title: "PDF Export Failed",
        description: "There was an error exporting your document. See details for more information.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportZip = async () => {
    setIsLoading(true);
    setErrorDetails({ visible: false, message: '', recommendations: [] });

    try {
      // Export as ZIP
      const zipUrl = await pdfService.exportRequestToZip(requestId, includeAttachments);
      
      // Create a temporary anchor element to download the file
      const link = document.createElement('a');
      link.href = zipUrl;
      link.setAttribute('download', `request-${requestId}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "ZIP Export Successful",
        description: "Your files have been exported successfully.",
        variant: "success"
      });
    } catch (error) {
      console.error('Error exporting ZIP:', error);

      // Show error details to the user
      setErrorDetails({
        visible: true,
        message: error instanceof Error ? error.message : String(error),
        recommendations: [
          'Check your network connection',
          'Verify that the request exists',
          'Try again in a few minutes'
        ]
      });

      toast({
        title: "ZIP Export Failed",
        description: "There was an error exporting your files. See details for more information.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePdfSettings = () => {
    // Navigate to PDF settings page or open modal
    // This is a placeholder for future functionality
    toast({
      title: "PDF Settings",
      description: "PDF settings functionality is not implemented yet.",
      variant: "default"
    });
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePdfSettings}
            title="PDF Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          Export your purchase request in various formats
        </CardDescription>
      </CardHeader>
      <CardContent>
        {errorDetails.visible && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Export Error</AlertTitle>
            <AlertDescription>
              <p>{errorDetails.message}</p>
              {errorDetails.recommendations.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold">Recommendations:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {errorDetails.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            {includePdf && <TabsTrigger value="pdf">PDF Export</TabsTrigger>}
            {includeZip && <TabsTrigger value="zip">ZIP Export</TabsTrigger>}
          </TabsList>
          
          {includePdf && (
            <TabsContent value="pdf" className="mt-4">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">Purchase Request PDF</span>
                <Badge variant="outline">Document</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Export your purchase request as a professionally formatted PDF document.
              </p>
              {isLoading && activeTab === 'pdf' ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : null}
            </TabsContent>
          )}
          
          {includeZip && (
            <TabsContent value="zip" className="mt-4">
              <div className="flex items-center space-x-2 mb-2">
                <FileArchive className="h-5 w-5 text-primary" />
                <span className="font-medium">Purchase Request ZIP</span>
                <Badge variant="outline">Archive</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Export your purchase request and {includeAttachments ? 'attachments' : 'details'} as a ZIP archive.
              </p>
              {isLoading && activeTab === 'zip' ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : null}
              
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>
                  {includeAttachments 
                    ? 'Includes all request attachments' 
                    : 'Attachments not included'}
                </span>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          variant="outline"
          className="mr-2"
          disabled={isLoading}
          onClick={() => {
            setErrorDetails({ visible: false, message: '', recommendations: [] });
          }}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          disabled={isLoading}
          onClick={activeTab === 'pdf' ? handleExportPdf : handleExportZip}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export {activeTab.toUpperCase()}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// No need for module declaration now since analyzePdfError is now a public method