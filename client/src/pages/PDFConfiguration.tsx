import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
  Printer
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Define the types for our PDF Settings
interface PDFSettings {
  // Header settings
  headerTitle: string;
  headerSubtitle: string;
  headerColor: string;
  logo: string | null;
  
  // Footer settings
  footerText: string;
  footerColor: string;
  pageNumbering: boolean;
  
  // Contact info
  contactInfo: {
    phone: string;
    email: string;
    website: string;
    address: string;
  };
  
  // Layout settings
  templateMode: string;
  orientation: 'portrait' | 'landscape';
  pageSize: 'a4' | 'letter' | 'legal';
  fontFamily: string;
  tableStyle: 'striped' | 'grid' | 'plain';
  
  // Section display settings
  showApprovals: boolean;
  showAttachments: boolean;
  showVendorDetails: boolean;
  showAuditInfo: boolean;
  showSignatures: boolean;
}

export default function PDFConfiguration() {
  const { toast } = useToast();
  
  // State for managing the component
  const [activeTab, setActiveTab] = useState('appearance');
  const [previewKey, setPreviewKey] = useState(0);
  const [formData, setFormData] = useState<Partial<PDFSettings>>({});
  const [zoom, setZoom] = useState(100);
  
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
      // Initialize form data with fetched settings
      setFormData(data);
      return data;
    }
  });
  
  // Save PDF settings mutation
  const { mutate: savePDFSettings, isPending: isSaving } = useMutation({
    mutationFn: async (data: Partial<PDFSettings>) => {
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
      setPreviewKey(prev => prev + 1); // Refresh preview
    },
    onError: (error) => {
      toast({
        title: "Error Saving Settings",
        description: error.message || "An error occurred while saving your settings.",
        variant: "destructive",
      });
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
    setPreviewKey(prev => prev + 1);
  }, []);
  
  // Default template options
  const templates = [
    { id: 'standard', name: 'Standard', description: 'Default E3 document layout' },
    { id: 'compact', name: 'Compact', description: 'Condensed layout with smaller margins' },
    { id: 'detailed', name: 'Detailed', description: 'Expanded layout with extra information' },
    { id: 'minimal', name: 'Minimal', description: 'Clean layout with essential information only' },
  ];
  
  // Zoom in and out for preview
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 20, 40));
  
  return (
    <div className="container mx-auto py-8">
      {/* Header with title and global actions */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">PDF Configuration</h1>
          <p className="text-muted-foreground">Customize how your PDF documents look and feel</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" onClick={handleRefreshPreview}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Preview
          </Button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel: Settings */}
        <div className="flex flex-col">
          <Card className="flex-1 mb-4">
            <CardHeader>
              <CardTitle>PDF Configuration Settings</CardTitle>
              <CardDescription>
                Configure how PDF documents are generated and displayed across the application.
                Changes will affect all future PDFs generated by the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="appearance">
                    <Settings className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Appearance</span>
                  </TabsTrigger>
                  <TabsTrigger value="branding">
                    <Palette className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Branding</span>
                  </TabsTrigger>
                  <TabsTrigger value="layout">
                    <Layout className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Layout</span>
                  </TabsTrigger>
                  <TabsTrigger value="sections">
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Sections</span>
                  </TabsTrigger>
                </TabsList>

                {/* Appearance Tab */}
                <TabsContent value="appearance" className="space-y-4 mt-4">
                  <Select 
                    value={formData.templateMode || 'standard'} 
                    onValueChange={value => handleInputChange('templateMode', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          <div>
                            <span className="font-medium">{template.name}</span>
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pageSize">Page Size</Label>
                      <Select 
                        id="pageSize"
                        value={formData.pageSize || 'a4'} 
                        onValueChange={value => handleInputChange('pageSize', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select page size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a4">A4</SelectItem>
                          <SelectItem value="letter">US Letter</SelectItem>
                          <SelectItem value="legal">US Legal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="orientation">Orientation</Label>
                      <Select 
                        id="orientation"
                        value={formData.orientation || 'portrait'} 
                        onValueChange={value => handleInputChange('orientation', value as 'portrait' | 'landscape')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select orientation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="portrait">Portrait</SelectItem>
                          <SelectItem value="landscape">Landscape</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="fontFamily">Font Family</Label>
                      <Select 
                        id="fontFamily"
                        value={formData.fontFamily || 'helvetica'} 
                        onValueChange={value => handleInputChange('fontFamily', value)}
                      >
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
                    
                    <div>
                      <Label htmlFor="tableStyle">Table Style</Label>
                      <Select 
                        id="tableStyle"
                        value={formData.tableStyle || 'striped'} 
                        onValueChange={value => handleInputChange('tableStyle', value as 'striped' | 'grid' | 'plain')}
                      >
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
                  </div>
                </TabsContent>
                
                {/* Branding Tab */}
                <TabsContent value="branding" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <h3 className="font-medium text-lg">Header Branding</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="headerTitle">Header Title</Label>
                        <Input 
                          id="headerTitle"
                          value={formData.headerTitle || 'EVENTS & ENTERTAINMENT'} 
                          onChange={e => handleInputChange('headerTitle', e.target.value)}
                          placeholder="Main header text"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="headerSubtitle">Header Subtitle</Label>
                        <Input 
                          id="headerSubtitle"
                          value={formData.headerSubtitle || 'ENTERPRISES'} 
                          onChange={e => handleInputChange('headerSubtitle', e.target.value)}
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
                            onChange={e => handleInputChange('headerColor', e.target.value)}
                            className="w-20 h-10 p-1"
                          />
                          <Input 
                            value={formData.headerColor || '#6F2AE6'} 
                            onChange={e => handleInputChange('headerColor', e.target.value)}
                            className="flex-1"
                            maxLength={7}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="logoUpload">Logo</Label>
                        <div className="mt-1">
                          <div className="flex items-center">
                            <Button variant="outline" type="button" className="w-full">
                              Upload Logo
                            </Button>
                          </div>
                          {formData.logo && (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground">Logo uploaded</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <h3 className="font-medium text-lg">Footer Branding</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="footerText">Footer Text</Label>
                        <Input 
                          id="footerText"
                          value={formData.footerText || 'ALL RIGHTS RESERVED BY E3'} 
                          onChange={e => handleInputChange('footerText', e.target.value)}
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
                            onChange={e => handleInputChange('footerColor', e.target.value)}
                            className="w-20 h-10 p-1"
                          />
                          <Input 
                            value={formData.footerColor || '#6F2AE6'} 
                            onChange={e => handleInputChange('footerColor', e.target.value)}
                            className="flex-1"
                            maxLength={7}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="pageNumbering" 
                          checked={formData.pageNumbering !== false}
                          onCheckedChange={value => handleInputChange('pageNumbering', value)}
                        />
                        <Label htmlFor="pageNumbering">Show Page Numbers</Label>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <h3 className="font-medium text-lg">Company Contact Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contactPhone">Phone Number</Label>
                        <Input 
                          id="contactPhone"
                          value={formData.contactInfo?.phone || '+974 44332340 / 55255417'} 
                          onChange={e => handleContactInfoChange('phone', e.target.value)}
                          placeholder="Contact phone number"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="contactEmail">Email</Label>
                        <Input 
                          id="contactEmail"
                          value={formData.contactInfo?.email || 'info@e3corp.com'} 
                          onChange={e => handleContactInfoChange('email', e.target.value)}
                          placeholder="Contact email"
                          type="email"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="contactWebsite">Website</Label>
                        <Input 
                          id="contactWebsite"
                          value={formData.contactInfo?.website || 'www.e3corp.com'} 
                          onChange={e => handleContactInfoChange('website', e.target.value)}
                          placeholder="Company website"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <Label htmlFor="contactAddress">Address</Label>
                        <Textarea 
                          id="contactAddress"
                          value={formData.contactInfo?.address || 'Floor 36, Office 3602, Palm Tower B, Marina 41, Port Area, P.O.Box 55821, Doha'} 
                          onChange={e => handleContactInfoChange('address', e.target.value)}
                          placeholder="Company address"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Layout Tab */}
                <TabsContent value="layout" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <h3 className="font-medium text-lg">Layout Options</h3>
                    <p className="text-sm text-muted-foreground">
                      These settings control spacing, margins, and the overall layout of your PDF documents.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="margins">Margin Preset</Label>
                        <Select 
                          id="margins"
                          value={'standard'} 
                          onValueChange={() => {}}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select margins" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="narrow">Narrow</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="wide">Wide</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="spacing">Content Spacing</Label>
                        <Select 
                          id="spacing"
                          value={'standard'} 
                          onValueChange={() => {}}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select spacing" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="compact">Compact</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="relaxed">Relaxed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="bg-muted p-4 rounded-md">
                      <h4 className="font-medium mb-2">Custom Margins (mm)</h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor="topMargin" className="text-xs">Top</Label>
                          <Input 
                            id="topMargin"
                            type="number"
                            min="0"
                            max="50"
                            defaultValue="15"
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label htmlFor="rightMargin" className="text-xs">Right</Label>
                          <Input 
                            id="rightMargin"
                            type="number"
                            min="0"
                            max="50"
                            defaultValue="15"
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label htmlFor="bottomMargin" className="text-xs">Bottom</Label>
                          <Input 
                            id="bottomMargin"
                            type="number"
                            min="0"
                            max="50"
                            defaultValue="15"
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label htmlFor="leftMargin" className="text-xs">Left</Label>
                          <Input 
                            id="leftMargin"
                            type="number"
                            min="0"
                            max="50"
                            defaultValue="15"
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Sections Tab */}
                <TabsContent value="sections" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <h3 className="font-medium text-lg">Section Display</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose which sections to include in your PDF documents.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="showApprovals" 
                          checked={formData.showApprovals !== false}
                          onCheckedChange={value => handleInputChange('showApprovals', value)}
                        />
                        <Label htmlFor="showApprovals">Approval History</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="showAttachments" 
                          checked={formData.showAttachments !== false}
                          onCheckedChange={value => handleInputChange('showAttachments', value)}
                        />
                        <Label htmlFor="showAttachments">Attachments List</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="showVendorDetails" 
                          checked={formData.showVendorDetails !== false}
                          onCheckedChange={value => handleInputChange('showVendorDetails', value)}
                        />
                        <Label htmlFor="showVendorDetails">Vendor Details</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="showAuditInfo" 
                          checked={formData.showAuditInfo !== false}
                          onCheckedChange={value => handleInputChange('showAuditInfo', value)}
                        />
                        <Label htmlFor="showAuditInfo">Audit Information</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="showSignatures" 
                          checked={formData.showSignatures !== false}
                          onCheckedChange={value => handleInputChange('showSignatures', value)}
                        />
                        <Label htmlFor="showSignatures">Digital Signatures</Label>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="space-y-2">
                      <h3 className="font-medium text-lg">Section Order</h3>
                      <p className="text-sm text-muted-foreground">
                        Drag and drop to change the order of sections in your PDF documents. 
                        (Coming soon)
                      </p>
                      
                      <div className="bg-muted p-4 rounded-md space-y-2">
                        <div className="bg-background p-2 rounded border flex justify-between items-center">
                          <span>Basic Information</span>
                          <span className="text-muted-foreground text-sm">Required</span>
                        </div>
                        <div className="bg-background p-2 rounded border flex justify-between items-center">
                          <span>Items</span>
                          <span className="text-muted-foreground text-sm">Required</span>
                        </div>
                        <div className="bg-background p-2 rounded border flex justify-between items-center">
                          <span>Vendor Information</span>
                          <span className="text-muted-foreground text-sm">Optional</span>
                        </div>
                        <div className="bg-background p-2 rounded border flex justify-between items-center">
                          <span>Approvals</span>
                          <span className="text-muted-foreground text-sm">Optional</span>
                        </div>
                        <div className="bg-background p-2 rounded border flex justify-between items-center">
                          <span>Attachments</span>
                          <span className="text-muted-foreground text-sm">Optional</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="justify-between">
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
          
          {/* Document Preview Settings */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Preview Controls</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleZoomOut}
                    disabled={zoom <= 40}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{zoom}%</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleZoomIn}
                    disabled={zoom >= 200}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    <span>Download</span>
                  </Button>
                  <Button variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-1" />
                    <span>Print</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right panel: Preview */}
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle>PDF Preview</CardTitle>
            <CardDescription>
              This is a live preview of how your PDF documents will appear with the current settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 relative overflow-hidden bg-muted rounded">
            {isLoadingSettings ? (
              <div className="h-full flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p>Loading PDF settings...</p>
              </div>
            ) : (
              <div className="relative h-full overflow-auto bg-muted">
                <div 
                  style={{ 
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                    width: '100%',
                    height: '100%',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <div 
                    className="bg-white shadow-lg"
                    style={{ 
                      width: formData.orientation === 'landscape' ? '842px' : '595px',
                      height: formData.orientation === 'landscape' ? '595px' : '842px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Preview Header */}
                    <div 
                      className="p-4 bg-white"
                      style={{ 
                        borderBottom: '1px solid #f0f0f0',
                        height: '80px',
                        position: 'relative'
                      }}
                    >
                      <div style={{ position: 'absolute', left: '20px', top: '20px' }}>
                        <span className="inline-block w-12 h-12 rounded bg-primary/20 text-center text-xs pt-4">E3 Logo</span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold text-primary">{formData.headerTitle || 'EVENTS & ENTERTAINMENT'}</h3>
                        <h4 className="text-sm font-semibold text-primary">{formData.headerSubtitle || 'ENTERPRISES'}</h4>
                        <p className="text-xs">PURCHASE REQUEST</p>
                      </div>
                      <div className="w-full h-1 absolute bottom-0 left-0 right-0 overflow-hidden flex">
                        <div className="flex-1 bg-primary"></div>
                        <div className="flex-1 bg-cyan-400"></div>
                      </div>
                    </div>
                    
                    {/* Preview Content */}
                    <div className="p-6">
                      <h2 className="text-sm font-bold mb-4">Purchase Request #12345</h2>
                      
                      {/* Basic Information */}
                      <div className="grid grid-cols-2 gap-y-1 gap-x-4 mb-4 text-xs">
                        <div>
                          <span className="font-semibold">Requester:</span> John Smith
                        </div>
                        <div>
                          <span className="font-semibold">Department:</span> Engineering
                        </div>
                        <div>
                          <span className="font-semibold">Date:</span> 2025-03-04
                        </div>
                        <div>
                          <span className="font-semibold">Status:</span> Pending
                        </div>
                      </div>
                      
                      {/* Section Title */}
                      <div className="bg-gray-100 px-2 py-1 mb-2">
                        <h3 className="text-xs font-bold text-gray-700">Items</h3>
                      </div>
                      
                      {/* Items Table */}
                      <table className="w-full text-xs mb-4">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-1 text-left">Item</th>
                            <th className="p-1 text-left">Qty</th>
                            <th className="p-1 text-right">Price</th>
                            <th className="p-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-1">Laptop Computer</td>
                            <td className="p-1">2</td>
                            <td className="p-1 text-right">$1,200.00</td>
                            <td className="p-1 text-right">$2,400.00</td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="p-1">Office Chair</td>
                            <td className="p-1">3</td>
                            <td className="p-1 text-right">$350.00</td>
                            <td className="p-1 text-right">$1,050.00</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-1">Desk</td>
                            <td className="p-1">2</td>
                            <td className="p-1 text-right">$500.00</td>
                            <td className="p-1 text-right">$1,000.00</td>
                          </tr>
                          <tr className="font-bold">
                            <td colSpan={3} className="p-1 text-right">Total:</td>
                            <td className="p-1 text-right">$4,450.00</td>
                          </tr>
                        </tbody>
                      </table>
                      
                      {/* Approvals Section */}
                      {formData.showApprovals !== false && (
                        <>
                          <div className="bg-gray-100 px-2 py-1 mb-2">
                            <h3 className="text-xs font-bold text-gray-700">Approvals</h3>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                            <div className="border p-2 rounded">
                              <p><span className="font-semibold">Department Head</span></p>
                              <p>Status: Approved</p>
                              <p>Date: 2025-03-02</p>
                            </div>
                            <div className="border p-2 rounded">
                              <p><span className="font-semibold">Finance</span></p>
                              <p>Status: Pending</p>
                              <p>Date: -</p>
                            </div>
                            <div className="border p-2 rounded">
                              <p><span className="font-semibold">CEO Office</span></p>
                              <p>Status: Pending</p>
                              <p>Date: -</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Preview Footer */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-white"
                      style={{ 
                        borderTop: '1px solid #f0f0f0',
                        height: '60px'
                      }}
                    >
                      <div className="w-full h-1 absolute top-1 left-0 right-0 overflow-hidden flex">
                        <div className="flex-1 bg-primary"></div>
                        <div className="flex-1 bg-cyan-400"></div>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-gray-600">
                        <div>
                          <p>☎ {formData.contactInfo?.phone || '+974 44332340 / 55255417'}</p>
                          <p>✉ {formData.contactInfo?.email || 'info@e3corp.com'}</p>
                        </div>
                        <div>
                          <p>📍 {formData.contactInfo?.address || 'Floor 36, Office 3602, Palm Tower B, Marina 41...'}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between absolute bottom-1 left-4 right-4 text-xs text-gray-600">
                        <span>{formData.footerText || 'ALL RIGHTS RESERVED BY E3'}</span>
                        {formData.pageNumbering !== false && (
                          <span>Page 1 of 1</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}