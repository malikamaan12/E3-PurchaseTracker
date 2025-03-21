import React, { useState, useEffect } from 'react';
import PDFSettingsWithPreview from '../components/PDFSettingsWithPreview';
import { pdfService, PdfSettings } from '../services/pdfService';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

const PDFDesignerPage: React.FC = () => {
  const [settings, setSettings] = useState<Partial<PdfSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    // Load PDF settings on component mount
    const loadSettings = async () => {
      try {
        setLoading(true);
        const loadedSettings = await pdfService.getPdfSettings();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Failed to load PDF settings:', error);
        toast({
          title: "Error loading settings",
          description: "Failed to load PDF settings. Using default settings instead.",
          variant: "destructive",
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, [toast]);

  const handleSaveSettings = async (updatedSettings: PdfSettings) => {
    try {
      const result = await pdfService.savePdfSettings(updatedSettings);
      setSettings(result);
      return result;
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="w-full max-w-md p-6">
          <CardContent className="flex flex-col items-center">
            <Spinner size="lg" />
            <p className="mt-4 text-center text-muted-foreground">
              Loading PDF designer...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">PDF Document Designer</h1>
      
      <PDFSettingsWithPreview
        initialSettings={settings || undefined}
        onSave={handleSaveSettings}
      />
    </div>
  );
};

export default PDFDesignerPage;