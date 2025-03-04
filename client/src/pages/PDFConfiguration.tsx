import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { PDFPreview } from '@/components/PDFPreview';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Settings, 
  Palette, 
  Layout, 
  FileText,
  Loader2, 
  RefreshCw, 
  Save,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  Info,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define the types for our PDF Settings
interface PDFSettings {
  // Header settings
  headerTitle?: string;
  headerSubtitle?: string;
  headerColor?: string;
  logo?: string | null;
  headerImage?: string | null;
  showHeaderText?: boolean;
  showHeaderImage?: boolean;
  showLogo?: boolean;
  
  // Footer settings
  footerText?: string;
  footerColor?: string;
  pageNumbering?: boolean;
  footerImage?: string | null;
  showFooterText?: boolean;
  showFooterImage?: boolean;
  
  // Contact info
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
  showContactInfo?: boolean;
  
  // Layout settings
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter' | 'legal';
  fontFamily?: string;
  
  // Section display settings
  showBasicInfo?: boolean;
  showRequesterDetails?: boolean;
  showDateOfRequest?: boolean;
  showPurposeInfo?: boolean;
  showVendorDetails?: boolean;
  showItems?: boolean;
  showApprovals?: boolean;
  showAttachments?: boolean;
  showAuditInfo?: boolean;
  showSignatures?: boolean;
}

export default function PDFConfiguration() {
  const { toast } = useToast();
  
  // State for managing the component
  const [activeTab, setActiveTab] = useState('design-elements');
  const [formData, setFormData] = useState<Partial<PDFSettings>>({});
  const [zoom, setZoom] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  
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
      const data = await response.json();
      setFormData(data);
      return data;
    }
  });
  
  // Save PDF settings mutation
  const { mutate: savePDFSettings } = useMutation({
    mutationFn: async (data: Partial<PDFSettings>) => {
      setIsSaving(true);
      const response = await fetch("/api/pdf/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save PDF settings");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your PDF configuration has been updated successfully.",
      });
      refetch();
      setIsSaving(false);
    },
    onError: (error) => {
      toast({
        title: "Error Saving Settings",
        description: error.message || "An error occurred while saving your settings.",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  });
  
  // Handle form input changes
  const handleInputChange = useCallback((key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);
  
  // Handle nested contact info changes
  const handleContactInfoChange = useCallback((key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      contactInfo: {
        ...(prev.contactInfo || {}),
        [key]: value
      }
    }));
  }, []);
  
  // Handle saving all settings
  const handleSaveSettings = useCallback(() => {
    savePDFSettings(formData);
  }, [formData, savePDFSettings]);
  
  // Handle refreshing preview
  const handleRefreshPreview = useCallback(() => {
    refetch();
  }, [refetch]);
  
  // Zoom in and out for preview
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 20, 40));
  
  return (
    <div className="container max-w-screen-xl mx-auto py-6">
      <div className="flex flex-col gap-4">
        {/* Header with title */}
        <div className="mb-2">
          <h1 className="text-2xl font-semibold">PDF Configuration</h1>
          <p className="text-sm text-muted-foreground">Customize PDF document settings and branding</p>
        </div>
        
        {/* Main content layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Settings Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">PDF Configuration Settings</CardTitle>
                <CardDescription>
                  Configure how PDF documents are displayed across the application
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <Tabs defaultValue="design-elements" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="design-elements">
                      <Palette className="h-4 w-4 mr-2" />
                      Design Elements
                    </TabsTrigger>
                    <TabsTrigger value="visual-layout">
                      <Layout className="h-4 w-4 mr-2" />
                      Visual Layout
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      <FileText className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Design Elements Tab */}
                  <TabsContent value="design-elements" className="pt-4">
                    {isLoadingSettings ? (
                      <div className="flex justify-center items-center h-80">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Header Settings */}
                        <div>
                          <h3 className="text-lg font-medium mb-3">Header Settings</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="headerTitle">Header Title</Label>
                              <Input 
                                id="headerTitle"
                                value={formData.headerTitle || 'EVENTS & ENTERTAINMENT ENTERPRISES'} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('headerTitle', e.target.value)}
                                placeholder="Main header text"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="headerSubtitle">Header Subtitle</Label>
                              <Input 
                                id="headerSubtitle"
                                value={formData.headerSubtitle || 'PURCHASE REQUEST'} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('headerSubtitle', e.target.value)}
                                placeholder="Subtitle text"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="headerColor">Header Color</Label>
                              <div className="flex items-center gap-2">
                                <Input 
                                  id="headerColor"
                                  type="color"
                                  value={formData.headerColor || '#6F2AE6'} 
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('headerColor', e.target.value)}
                                  className="w-20 h-10 p-1"
                                />
                                <Input 
                                  value={formData.headerColor || '#6F2AE6'} 
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('headerColor', e.target.value)}
                                  className="flex-1"
                                  maxLength={7}
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showHeaderText" 
                                checked={formData.showHeaderText !== false}
                                onCheckedChange={value => handleInputChange('showHeaderText', Boolean(value))}
                              />
                              <Label htmlFor="showHeaderText">Header Text</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showHeaderImage" 
                                checked={formData.showHeaderImage !== false}
                                onCheckedChange={value => handleInputChange('showHeaderImage', Boolean(value))}
                              />
                              <Label htmlFor="showHeaderImage">Header Image</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showLogo" 
                                checked={formData.showLogo !== false}
                                onCheckedChange={value => handleInputChange('showLogo', Boolean(value))}
                              />
                              <Label htmlFor="showLogo">Logo</Label>
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        {/* Footer Settings */}
                        <div>
                          <h3 className="text-lg font-medium mb-3">Footer Branding</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="footerText">Footer Text</Label>
                              <Input 
                                id="footerText"
                                value={formData.footerText || 'ALL RIGHTS RESERVED BY E3'} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('footerText', e.target.value)}
                                placeholder="Footer text"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="footerColor">Footer Color</Label>
                              <div className="flex items-center gap-2">
                                <Input 
                                  id="footerColor"
                                  type="color"
                                  value={formData.footerColor || '#6F2AE6'} 
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('footerColor', e.target.value)}
                                  className="w-20 h-10 p-1"
                                />
                                <Input 
                                  value={formData.footerColor || '#6F2AE6'} 
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('footerColor', e.target.value)}
                                  className="flex-1"
                                  maxLength={7}
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showFooterText" 
                                checked={formData.showFooterText !== false}
                                onCheckedChange={value => handleInputChange('showFooterText', Boolean(value))}
                              />
                              <Label htmlFor="showFooterText">Footer Text</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showFooterImage" 
                                checked={formData.showFooterImage !== false}
                                onCheckedChange={value => handleInputChange('showFooterImage', Boolean(value))}
                              />
                              <Label htmlFor="showFooterImage">Footer Image</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="pageNumbering" 
                                checked={formData.pageNumbering !== false}
                                onCheckedChange={value => handleInputChange('pageNumbering', Boolean(value))}
                              />
                              <Label htmlFor="pageNumbering">Page Numbers</Label>
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        {/* Company Contact Information */}
                        <div>
                          <h3 className="text-lg font-medium mb-3">Company Contact Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="contactPhone">Phone</Label>
                              <Input 
                                id="contactPhone"
                                value={formData.contactInfo?.phone || '+974 44332340'} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleContactInfoChange('phone', e.target.value)}
                                placeholder="Company phone"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="contactEmail">Email</Label>
                              <Input 
                                id="contactEmail"
                                value={formData.contactInfo?.email || 'info@e3corp.com'} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleContactInfoChange('email', e.target.value)}
                                placeholder="Company email"
                              />
                            </div>
                            
                            <div className="md:col-span-2">
                              <Label htmlFor="contactAddress">Address</Label>
                              <Textarea 
                                id="contactAddress"
                                value={formData.contactInfo?.address || 'Floor 36, Office 3602, Palm Tower B, Marina 41'} 
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleContactInfoChange('address', e.target.value)}
                                placeholder="Company address"
                                rows={2}
                              />
                            </div>
                          </div>
                          
                          <div className="mt-4 flex items-center space-x-2">
                            <Switch 
                              id="showContactInfo" 
                              checked={formData.showContactInfo !== false}
                              onCheckedChange={value => handleInputChange('showContactInfo', Boolean(value))}
                            />
                            <Label htmlFor="showContactInfo">Show Contact Information in Footer</Label>
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Visual Layout Tab */}
                  <TabsContent value="visual-layout" className="pt-4">
                    {isLoadingSettings ? (
                      <div className="flex justify-center items-center h-80">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-muted/30 p-4 rounded-md">
                          <div className="mb-3 flex items-center">
                            <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              The visual editor lets you control which elements appear in your PDF documents.
                            </span>
                          </div>
                          
                          <div className="border border-dashed border-muted-foreground/50 rounded-md bg-background p-4">
                            <div className="flex items-center justify-center mb-4">
                              <h4 className="text-base font-medium">Header Elements</h4>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                              <div className="border rounded-md p-3 bg-white hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Header Text</span>
                                  <Switch 
                                    id="showHeaderText" 
                                    checked={formData.showHeaderText !== false}
                                    onCheckedChange={value => handleInputChange('showHeaderText', Boolean(value))}
                                  />
                                </div>
                                <div className="h-16 bg-muted/50 rounded flex items-center justify-center text-xs text-center p-2">
                                  {formData.headerTitle || 'EVENTS & ENTERTAINMENT ENTERPRISES'}
                                </div>
                              </div>
                              
                              <div className="border rounded-md p-3 bg-white hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Header Image</span>
                                  <Switch 
                                    id="showHeaderImage" 
                                    checked={formData.showHeaderImage !== false}
                                    onCheckedChange={value => handleInputChange('showHeaderImage', Boolean(value))}
                                  />
                                </div>
                                <div className="h-16 bg-gradient-to-r from-purple-500 to-cyan-400 rounded flex items-center justify-center text-xs text-white">
                                  Header Image
                                </div>
                              </div>
                              
                              <div className="border rounded-md p-3 bg-white hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Logo</span>
                                  <Switch 
                                    id="showLogo" 
                                    checked={formData.showLogo !== false}
                                    onCheckedChange={value => handleInputChange('showLogo', Boolean(value))}
                                  />
                                </div>
                                <div className="h-16 bg-muted/50 rounded flex items-center justify-center text-xs">
                                  E3 Logo
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-center mb-4 mt-6">
                              <h4 className="text-base font-medium">Footer Elements</h4>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="border rounded-md p-3 bg-white hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Footer Text</span>
                                  <Switch 
                                    id="showFooterText" 
                                    checked={formData.showFooterText !== false}
                                    onCheckedChange={value => handleInputChange('showFooterText', Boolean(value))}
                                  />
                                </div>
                                <div className="h-12 bg-muted/50 rounded flex items-center justify-center text-xs text-center p-2">
                                  {formData.footerText || 'ALL RIGHTS RESERVED BY E3'}
                                </div>
                              </div>
                              
                              <div className="border rounded-md p-3 bg-white hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Footer Image</span>
                                  <Switch 
                                    id="showFooterImage" 
                                    checked={formData.showFooterImage !== false}
                                    onCheckedChange={value => handleInputChange('showFooterImage', Boolean(value))}
                                  />
                                </div>
                                <div className="h-12 bg-gradient-to-r from-purple-500 to-cyan-400 rounded flex items-center justify-center text-xs text-white">
                                  Footer Image
                                </div>
                              </div>
                              
                              <div className="border rounded-md p-3 bg-white hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Page Numbers</span>
                                  <Switch 
                                    id="pageNumbering" 
                                    checked={formData.pageNumbering !== false}
                                    onCheckedChange={value => handleInputChange('pageNumbering', Boolean(value))}
                                  />
                                </div>
                                <div className="h-12 bg-muted/50 rounded flex items-center justify-center text-xs">
                                  Page 1 of 1
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Content Section Visibility</h3>
                          <div className="grid grid-cols-2 gap-y-3">
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showBasicInfo" 
                                checked={formData.showBasicInfo !== false}
                                onCheckedChange={value => handleInputChange('showBasicInfo', Boolean(value))}
                              />
                              <Label htmlFor="showBasicInfo">Basic Information</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showRequesterDetails" 
                                checked={formData.showRequesterDetails !== false}
                                onCheckedChange={value => handleInputChange('showRequesterDetails', Boolean(value))}
                              />
                              <Label htmlFor="showRequesterDetails">Requester Details</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showPurposeInfo" 
                                checked={formData.showPurposeInfo !== false}
                                onCheckedChange={value => handleInputChange('showPurposeInfo', Boolean(value))}
                              />
                              <Label htmlFor="showPurposeInfo">Purpose Information</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showVendorDetails" 
                                checked={formData.showVendorDetails !== false}
                                onCheckedChange={value => handleInputChange('showVendorDetails', Boolean(value))}
                              />
                              <Label htmlFor="showVendorDetails">Vendor Information</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showItems" 
                                checked={formData.showItems !== false}
                                onCheckedChange={value => handleInputChange('showItems', Boolean(value))}
                              />
                              <Label htmlFor="showItems">Items</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showApprovals" 
                                checked={formData.showApprovals !== false}
                                onCheckedChange={value => handleInputChange('showApprovals', Boolean(value))}
                              />
                              <Label htmlFor="showApprovals">Approval Information</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showAttachments" 
                                checked={formData.showAttachments !== false}
                                onCheckedChange={value => handleInputChange('showAttachments', Boolean(value))}
                              />
                              <Label htmlFor="showAttachments">Attachments List</Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id="showSignatures" 
                                checked={formData.showSignatures !== false}
                                onCheckedChange={value => handleInputChange('showSignatures', Boolean(value))}
                              />
                              <Label htmlFor="showSignatures">Digital Signatures</Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Preview Tab */}
                  <TabsContent value="preview" className="pt-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">PDF Preview</h3>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleZoomOut}
                            disabled={zoom <= 40}
                            className="h-8 w-8 p-0"
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <span className="text-sm w-12 text-center">{zoom}%</span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleZoomIn}
                            disabled={zoom >= 200}
                            className="h-8 w-8 p-0"
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleRefreshPreview}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Refresh
                          </Button>
                        </div>
                      </div>
                      
                      <div className="border rounded-md overflow-hidden shadow bg-muted/30">
                        {isLoadingSettings ? (
                          <div className="flex justify-center items-center h-96">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div style={{ zoom: `${zoom}%`, transformOrigin: 'top center' }} className="bg-white">
                            <PDFPreview pdfSettings={formData} isDesignMode={true} />
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              
              <CardFooter className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleRefreshPreview}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Preview
                </Button>
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          {/* Right column: PDF Preview */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle>PDF Preview</CardTitle>
                <CardDescription>
                  Live preview of how your PDF will appear
                </CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 relative">
                {isLoadingSettings ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="relative h-full overflow-auto">
                    <div className="flex justify-center py-4">
                      <PDFPreview 
                        pdfSettings={formData} 
                        isDesignMode={true} 
                      />
                    </div>
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="flex justify-between gap-2 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 40}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{zoom}%</span>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 200}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" disabled>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Export sample PDF (coming soon)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" disabled>
                          <Printer className="h-4 w-4 mr-1" />
                          Print
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Print sample PDF (coming soon)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}