import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Check, Image, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PDFBrandingSettings {
  headerImage: string | null;
  footerImage: string | null;
  logo: string | null;
  headerTitle: string;
  headerSubtitle: string;
  headerColor: string;
  footerText: string;
  footerColor: string;
  pageNumbering: boolean;
}

export default function PDFBrandingUploader() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for file inputs
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [footerFile, setFooterFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("upload");

  // Fetch current settings if they exist
  const { data: settings, isLoading: isLoadingSettings } = useQuery<PDFBrandingSettings>({
    queryKey: ["/api/pdf/print-settings"],
    queryFn: async () => {
      const response = await fetch("/api/pdf/print-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch PDF settings");
      }
      return response.json();
    }
  });

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void, type: string) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a JPEG or PNG image",
          variant: "destructive",
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast({
          title: "File too large",
          description: "File size should be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setter(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrls(prev => ({ ...prev, [type]: url }));
      
      toast({
        title: "File selected",
        description: `${file.name} has been selected`,
      });
    }
  }, [toast]);

  // Handle uploads
  const { mutate: uploadImages, isPending } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (headerFile) formData.append("headerImage", headerFile);
      if (footerFile) formData.append("footerImage", footerFile);
      if (logoFile) formData.append("logo", logoFile);
      
      const response = await fetch("/api/pdf/upload-images", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload images");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Clear file inputs
      setHeaderFile(null);
      setFooterFile(null);
      setLogoFile(null);
      
      // Clean up preview URLs
      Object.values(previewUrls).forEach(URL.revokeObjectURL);
      setPreviewUrls({});
      
      // Refresh settings
      queryClient.invalidateQueries({ queryKey: ["/api/pdf/print-settings"] });
      
      toast({
        title: "Success",
        description: "PDF branding images uploaded successfully",
      });
      
      // Switch to preview tab
      setActiveTab("preview");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      // Clean up any object URLs to prevent memory leaks
      Object.values(previewUrls).forEach(URL.revokeObjectURL);
    };
  }, [previewUrls]);

  // Handle save
  const handleSave = useCallback(() => {
    // Only upload if there are files to upload
    if (headerFile || footerFile || logoFile) {
      uploadImages();
    } else {
      toast({
        title: "No files selected",
        description: "Please select at least one image to upload",
        variant: "destructive",
      });
    }
  }, [headerFile, footerFile, logoFile, uploadImages, toast]);

  // Handle tab change
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  // Print preview function
  const handlePrintPreview = useCallback(() => {
    window.print();
  }, []);
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">PDF Branding Configuration</CardTitle>
        <CardDescription>
          Customize the appearance of PDF exports with your branding elements.
          Images will be displayed in the header and footer of PDF documents.
        </CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="upload" value={activeTab} onValueChange={handleTabChange}>
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Images</TabsTrigger>
            <TabsTrigger value="preview">Preview Layout</TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent className="p-6">
          <TabsContent value="upload" className="space-y-6">
            <div className="grid gap-6">
              {/* Header Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="header-image">Header Image</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Input
                      id="header-image"
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleFileChange(e, setHeaderFile, 'header')}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Recommended size: 1000 × 150 pixels (PNG or JPEG, max 5MB)
                    </p>
                  </div>
                  {(previewUrls.header || (settings && settings.headerImage)) && (
                    <div className="w-24 h-24 border rounded-lg overflow-hidden flex items-center justify-center bg-muted">
                      <img 
                        src={previewUrls.header || (settings && settings.headerImage) || ''} 
                        alt="Header preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Footer Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="footer-image">Footer Image</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Input
                      id="footer-image"
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleFileChange(e, setFooterFile, 'footer')}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Recommended size: 1000 × 100 pixels (PNG or JPEG, max 5MB)
                    </p>
                  </div>
                  {(previewUrls.footer || (settings && settings.footerImage)) && (
                    <div className="w-24 h-24 border rounded-lg overflow-hidden flex items-center justify-center bg-muted">
                      <img 
                        src={previewUrls.footer || (settings && settings.footerImage) || ''} 
                        alt="Footer preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label htmlFor="logo-image">Company Logo</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Input
                      id="logo-image"
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleFileChange(e, setLogoFile, 'logo')}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Recommended size: 200 × 200 pixels (PNG or JPEG, max 5MB)
                    </p>
                  </div>
                  {(previewUrls.logo || (settings && settings.logo)) && (
                    <div className="w-24 h-24 border rounded-lg overflow-hidden flex items-center justify-center bg-muted">
                      <img 
                        src={previewUrls.logo || (settings && settings.logo) || ''} 
                        alt="Logo preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="space-y-6">
            <div className="border rounded-lg p-4 overflow-hidden bg-white">
              <div className="pdf-preview relative" style={{ width: '100%', height: '842px', maxWidth: '595px', margin: '0 auto', border: '1px solid #ddd' }}>
                {/* Header */}
                <div className="pdf-header border-b p-4 bg-gray-50">
                  <div className="flex justify-between items-center">
                    {settings && settings.logo && (
                      <div className="logo-container h-16 w-16 overflow-hidden">
                        <img 
                          src={settings.logo} 
                          alt="Company logo" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="text-center flex-1">
                      <h1 className="text-lg font-bold" style={{ color: settings ? settings.headerColor : '#1a365d' }}>
                        {settings ? settings.headerTitle : "EVENTS & ENTERTAINMENT ENTERPRISES"}
                      </h1>
                      <h2 className="text-sm font-medium">
                        {settings ? settings.headerSubtitle : "PURCHASE REQUEST"}
                      </h2>
                    </div>
                  </div>
                  {settings && settings.headerImage && (
                    <div className="w-full h-24 mt-2 overflow-hidden flex justify-center items-center">
                      <img 
                        src={settings.headerImage} 
                        alt="Header" 
                        className="max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>
                
                {/* Body (Sample Content) */}
                <div className="pdf-body p-4 overflow-y-auto" style={{ height: 'calc(100% - 200px)' }}>
                  <div className="sample-content space-y-4">
                    <h3 className="font-bold text-lg">Purchase Request #12345</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Requester:</p>
                        <p className="text-sm">John Smith</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Department:</p>
                        <p className="text-sm">Engineering</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Date:</p>
                        <p className="text-sm">2025-03-03</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Status:</p>
                        <p className="text-sm">Pending</p>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <h4 className="font-bold">Items</h4>
                      <table className="w-full border-collapse mt-2">
                        <thead>
                          <tr className="bg-gray-100 text-sm">
                            <th className="border p-2 text-left">Item</th>
                            <th className="border p-2 text-left">Qty</th>
                            <th className="border p-2 text-left">Price</th>
                            <th className="border p-2 text-left">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          <tr>
                            <td className="border p-2">Laptop Computer</td>
                            <td className="border p-2">2</td>
                            <td className="border p-2">$1,200.00</td>
                            <td className="border p-2">$2,400.00</td>
                          </tr>
                          <tr>
                            <td className="border p-2">Office Chair</td>
                            <td className="border p-2">3</td>
                            <td className="border p-2">$350.00</td>
                            <td className="border p-2">$1,050.00</td>
                          </tr>
                          <tr>
                            <td className="border p-2">Desk</td>
                            <td className="border p-2">2</td>
                            <td className="border p-2">$500.00</td>
                            <td className="border p-2">$1,000.00</td>
                          </tr>
                        </tbody>
                        <tfoot className="text-sm font-bold">
                          <tr>
                            <td colSpan={3} className="border p-2 text-right">Total:</td>
                            <td className="border p-2">$4,450.00</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    
                    <div className="mt-6">
                      <h4 className="font-bold">Approvals</h4>
                      <div className="grid grid-cols-3 gap-4 mt-2">
                        <div className="border p-2 rounded">
                          <p className="text-sm font-medium">Department Head</p>
                          <p className="text-sm">Status: Approved</p>
                          <p className="text-sm">Date: 2025-03-02</p>
                        </div>
                        <div className="border p-2 rounded">
                          <p className="text-sm font-medium">Finance</p>
                          <p className="text-sm">Status: Pending</p>
                          <p className="text-sm">Date: -</p>
                        </div>
                        <div className="border p-2 rounded">
                          <p className="text-sm font-medium">CEO Office</p>
                          <p className="text-sm">Status: Pending</p>
                          <p className="text-sm">Date: -</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Footer */}
                <div className="pdf-footer border-t p-4 absolute bottom-0 left-0 right-0 bg-gray-50">
                  <div className="flex flex-col items-center">
                    {settings && settings.footerImage && (
                      <div className="w-full h-12 mb-2 overflow-hidden flex justify-center">
                        <img 
                          src={settings.footerImage} 
                          alt="Footer" 
                          className="max-h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="w-full flex justify-between items-center">
                      <p className="text-sm" style={{ color: settings ? settings.footerColor : '#1a365d' }}>
                        {settings ? settings.footerText : "ALL RIGHTS RESERVED BY E3"}
                      </p>
                      {settings && settings.pageNumbering && (
                        <p className="text-sm">Page 1 of 1</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <Button variant="outline" onClick={handlePrintPreview} className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Print Preview
              </Button>
            </div>
          </TabsContent>
        </CardContent>
        
        <CardFooter className="flex justify-end space-x-2 px-6 pb-6">
          {activeTab === "upload" && (
            <Button 
              onClick={handleSave}
              disabled={!headerFile && !footerFile && !logoFile || isPending}
              className="flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Images
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Tabs>
      
      {/* Print styles (hidden in normal view) */}
      <style jsx>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .pdf-preview, .pdf-preview * {
              visibility: visible;
            }
            .pdf-preview {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              border: none;
            }
          }
        `}
      </style>
    </Card>
  );
}