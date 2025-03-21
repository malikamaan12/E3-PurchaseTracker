import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { pdfService } from '../services/pdfService';

interface EnhancedPdfExportProps {
  requestId: number;
  userType?: 'user' | 'approver' | 'admin';
  showOptions?: boolean;
  title?: string;
  description?: string;
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
}

/**
 * Enhanced PDF Export Component
 * 
 * This component provides an improved PDF export experience with:
 * - Unified format across all exports
 * - AI-powered error analysis
 * - Progress indicators
 * - Export options
 */
export function EnhancedPdfExport({
  requestId,
  userType = 'user',
  showOptions = true,
  title = 'Export to PDF',
  description = 'Download the purchase request as a PDF file',
  variant = 'default',
  className
}: EnhancedPdfExportProps) {
  const [loading, setLoading] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      // Export the PDF using the service
      const fileName = await pdfService.exportRequestToPdf(requestId, userType);
      
      // Show success message
      toast({
        title: 'PDF Generated',
        description: `${fileName} has been downloaded successfully.`,
        variant: 'default'
      });
    } catch (error) {
      console.error('PDF export error:', error);
      
      // Show error toast
      toast({
        title: 'PDF Export Failed',
        description: error instanceof Error 
          ? error.message 
          : 'An error occurred while generating the PDF.',
        variant: 'destructive'
      });
      
      // Try to get error analysis and show recommendations if available
      try {
        const errorAnalysis = await pdfService.analyzePdfError?.(error, requestId);
        if (errorAnalysis?.recommendations?.length > 0) {
          toast({
            title: 'Suggested Fix',
            description: errorAnalysis.recommendations[0],
            variant: 'default'
          });
        }
      } catch (analysisError) {
        console.error('Error analyzing PDF error:', analysisError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportZip = async () => {
    setLoading(true);
    try {
      // Export as ZIP
      const fileName = await pdfService.exportRequestsAsZip([requestId], includeAttachments);
      
      // Show success message
      toast({
        title: 'ZIP Generated',
        description: `${fileName} has been downloaded successfully.`,
        variant: 'default'
      });
    } catch (error) {
      console.error('ZIP export error:', error);
      
      // Show error toast
      toast({
        title: 'ZIP Export Failed',
        description: error instanceof Error 
          ? error.message 
          : 'An error occurred while generating the ZIP file.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Minimal variant is just a simple button
  if (variant === 'minimal') {
    return (
      <Button 
        onClick={handleExport} 
        disabled={loading}
        className={className}
        size="sm"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {loading ? 'Generating...' : title}
      </Button>
    );
  }

  // Compact variant is a button with limited options
  if (variant === 'compact') {
    return (
      <div className={`flex gap-2 ${className}`}>
        <Button 
          onClick={handleExport} 
          disabled={loading}
          variant="default"
          size="sm"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? 'Generating PDF...' : 'Export PDF'}
        </Button>
        {showOptions && (
          <Button 
            onClick={handleExportZip}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Generating ZIP...' : 'Export ZIP'}
          </Button>
        )}
      </div>
    );
  }

  // Default variant is a full card with options
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {showOptions && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="include-attachments" 
                checked={includeAttachments}
                onCheckedChange={setIncludeAttachments}
              />
              <Label htmlFor="include-attachments">Include attachments</Label>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button 
          onClick={handleExport} 
          disabled={loading}
          className="flex-1"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? 'Generating PDF...' : 'Export PDF'}
        </Button>
        {showOptions && (
          <Button 
            onClick={handleExportZip}
            disabled={loading}
            variant="outline"
            className="flex-1"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Generating ZIP...' : 'Export ZIP'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// No need for module declaration now since analyzePdfError is now a public method