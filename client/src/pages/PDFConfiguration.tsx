import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PDFCustomizationForm } from '@/components/PDFCustomizationForm';
import PDFBrandingUploader from '@/components/PDFBrandingUploader';
import { PDFPreview } from '@/components/PDFPreview';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Settings, 
  Palette, 
  Layout, 
  Loader2, 
  RefreshCw, 
  Save 
} from 'lucide-react';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function PDFConfiguration() {
  const { toast } = useToast();
  
  // State for managing UI
  const [activeTab, setActiveTab] = useState('appearance');
  const [previewKey, setPreviewKey] = useState(0);
  const [templateMode, setTemplateMode] = useState('standard');
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  
  // Fetch current PDF settings
  const { 
    data: pdfSettings, 
    isLoading: isLoadingSettings, 
    refetch 
  } = useQuery({
    queryKey: ["/api/pdf/print-settings"],
    queryFn: async () => {
      const response = await fetch("/api/pdf/print-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch PDF settings");
      }
      return response.json();
    }
  });

  // Handle refresh of preview
  const handleRefreshPreview = useCallback(() => {
    setPreviewKey(prev => prev + 1);
  }, []);
  
  // Save layout configuration template
  const saveLayoutTemplate = useCallback(async () => {
    setIsSaving(true);
    
    try {
      // Here you would save the template settings to an API endpoint
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "Template Saved",
        description: `Layout template "${templateMode}" has been saved as default.`,
      });
    } catch (error) {
      toast({
        title: "Failed to Save Template",
        description: "An error occurred while saving the layout template.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [templateMode, toast]);
  
  // Available template options
  const templates = [
    { id: 'standard', name: 'Standard', description: 'Default E3 document layout' },
    { id: 'compact', name: 'Compact', description: 'Condensed layout with smaller margins' },
    { id: 'detailed', name: 'Detailed', description: 'Expanded layout with extra information' },
    { id: 'minimal', name: 'Minimal', description: 'Clean layout with essential information only' },
  ];
  
  // Toggle settings panel visibility
  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);
  
  return (
    <div className="container mx-auto py-8">
      {/* Header with title and controls */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">PDF Configuration</h1>
          <p className="text-muted-foreground">Customize how your PDF documents look and feel</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Template Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Layout className="h-4 w-4 mr-2" />
                Template: {templates.find(t => t.id === templateMode)?.name || 'Standard'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Layout Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {templates.map(template => (
                <DropdownMenuItem 
                  key={template.id}
                  onClick={() => setTemplateMode(template.id)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{template.name}</span>
                    <span className="text-xs text-muted-foreground">{template.description}</span>
                  </div>
                  {templateMode === template.id && (
                    <Badge variant="outline" className="ml-2">Active</Badge>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={saveLayoutTemplate} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Current Template'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Toggle Settings Button */}
          <Button 
            variant="outline" 
            onClick={toggleSettings}
          >
            {showSettings ? 'Hide Settings' : 'Show Settings'}
          </Button>
          
          {/* Refresh button */}
          <Button onClick={handleRefreshPreview}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Preview
          </Button>
        </div>
      </div>

      {/* Main layout using simple grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[700px]">
        {/* Left panel: Settings */}
        {showSettings && (
          <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>PDF Generation Settings</CardTitle>
              <CardDescription>
                Configure how PDF documents are generated and displayed across the application.
                Changes will affect all future PDFs generated by the system.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="appearance">
                    <Settings className="h-4 w-4 mr-2" />
                    Appearance
                  </TabsTrigger>
                  <TabsTrigger value="branding">
                    <Palette className="h-4 w-4 mr-2" />
                    Branding
                  </TabsTrigger>
                  <TabsTrigger value="advanced">
                    <Layout className="h-4 w-4 mr-2" />
                    Layout
                  </TabsTrigger>
                </TabsList>
                
                {/* Appearance Tab */}
                <TabsContent value="appearance" className="p-4">
                  <PDFCustomizationForm />
                </TabsContent>
                
                {/* Branding Tab */}
                <TabsContent value="branding" className="p-4">
                  <PDFBrandingUploader />
                </TabsContent>
                
                {/* Advanced Tab */}
                <TabsContent value="advanced" className="p-4 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Layout Settings</CardTitle>
                      <CardDescription>
                        Advanced layout options for PDF documents
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Document Type</label>
                        <Select defaultValue="purchase_request">
                          <SelectTrigger>
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="purchase_request">Purchase Request</SelectItem>
                            <SelectItem value="quote">Quote</SelectItem>
                            <SelectItem value="invoice">Invoice</SelectItem>
                            <SelectItem value="report">Report</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Page Size</label>
                        <Select defaultValue="a4">
                          <SelectTrigger>
                            <SelectValue placeholder="Select page size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="a4">A4 (Portrait)</SelectItem>
                            <SelectItem value="a4_landscape">A4 (Landscape)</SelectItem>
                            <SelectItem value="letter">US Letter</SelectItem>
                            <SelectItem value="legal">US Legal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Font Family</label>
                        <Select defaultValue="helvetica">
                          <SelectTrigger>
                            <SelectValue placeholder="Select font family" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="helvetica">Helvetica</SelectItem>
                            <SelectItem value="times">Times New Roman</SelectItem>
                            <SelectItem value="courier">Courier</SelectItem>
                            <SelectItem value="arial">Arial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Table Style</label>
                        <Select defaultValue="striped">
                          <SelectTrigger>
                            <SelectValue placeholder="Select table style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="striped">Striped</SelectItem>
                            <SelectItem value="grid">Grid</SelectItem>
                            <SelectItem value="plain">Plain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Section Display</CardTitle>
                      <CardDescription>
                        Choose which sections to include in your PDF documents
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-approvals"
                            defaultChecked
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor="show-approvals" className="text-sm font-medium">
                            Approval History
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-attachments"
                            defaultChecked
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor="show-attachments" className="text-sm font-medium">
                            Attachments List
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-vendor-details"
                            defaultChecked
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor="show-vendor-details" className="text-sm font-medium">
                            Vendor Details
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-audit-info"
                            defaultChecked
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor="show-audit-info" className="text-sm font-medium">
                            Audit Information
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-signatures"
                            defaultChecked
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor="show-signatures" className="text-sm font-medium">
                            Digital Signatures
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="page-numbers"
                            defaultChecked
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor="page-numbers" className="text-sm font-medium">
                            Page Numbers
                          </label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
        
        {/* Right panel: Preview */}
        <Card className={`h-full overflow-hidden ${!showSettings ? "md:col-span-2" : ""}`}>
          <CardHeader>
            <CardTitle>PDF Preview</CardTitle>
            <CardDescription>
              This is a live preview of how your PDF documents will appear with the current settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 h-[calc(100%-5rem)] overflow-hidden">
            {isLoadingSettings ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p>Loading PDF settings...</p>
              </div>
            ) : (
              <PDFPreview 
                key={previewKey}
                pdfSettings={{
                  ...pdfSettings,
                  templateMode: templateMode // Pass the template mode to the preview
                }} 
                onRefresh={refetch}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}