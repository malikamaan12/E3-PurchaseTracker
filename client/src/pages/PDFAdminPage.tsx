import React, { useState, useEffect } from 'react';
import { SimplePDFSettings } from '@/components/SimplePDFSettings';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Settings, Save, Download, Eye } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

export default function PDFAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/pdf-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading PDF settings:', error);
    }
  };

  const handleSaveSettings = async (newSettings: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/pdf-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      
      if (response.ok) {
        setSettings(newSettings);
        toast({
          title: "Success",
          description: "PDF settings have been saved successfully.",
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      toast({
        title: "Error",
        description: "Failed to save PDF settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'header' | 'footer' | 'logo') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch('/api/upload-pdf-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: `${type} image uploaded successfully.`,
        });
        loadSettings(); // Reload settings to get updated image URLs
      } else {
        throw new Error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const generatePreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await fetch('/api/pdf/audit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/pdf'
        },
        body: JSON.stringify({ preview: true }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pdf-preview.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Preview Generated",
          description: "PDF preview has been downloaded.",
        });
      } else {
        throw new Error('Failed to generate preview');
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF preview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">PDF Configuration</h1>
        </div>
        <Button 
          onClick={generatePreview}
          disabled={previewLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          {previewLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              Generating...
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Preview PDF
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SimplePDFSettings 
            onSave={handleSaveSettings}
            loading={loading}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Image Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="headerImage">Header Image</Label>
                <Input
                  id="headerImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'header')}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Upload a header image for PDFs
                </p>
              </div>

              <div>
                <Label htmlFor="footerImage">Footer Image</Label>
                <Input
                  id="footerImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'footer')}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Upload a footer image for PDFs
                </p>
              </div>

              <div>
                <Label htmlFor="logoImage">Logo</Label>
                <Input
                  id="logoImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'logo')}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Upload a logo for PDFs
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={() => loadSettings()} 
                variant="outline" 
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Reload Settings
              </Button>
              
              <Button 
                onClick={generatePreview}
                disabled={previewLoading}
                variant="outline"
                className="w-full"
              >
                {previewLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Generate Preview
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p><strong>Current Status:</strong> {settings ? 'Configured' : 'Using Defaults'}</p>
                <p><strong>Font Family:</strong> {settings?.fontFamily || 'Helvetica'}</p>
                <p><strong>Font Size:</strong> {settings?.fontSize || 11}px</p>
                <p><strong>Page Numbers:</strong> {settings?.pageNumbering ? 'Enabled' : 'Disabled'}</p>
                <p><strong>Watermark:</strong> {settings?.watermarkText || 'None'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}