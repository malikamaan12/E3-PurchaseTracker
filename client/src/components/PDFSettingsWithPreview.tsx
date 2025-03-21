import React, { useState, useEffect } from 'react';
import PDFSettingsPanel from './PDFSettingsPanel';
import PDFPreview from './PDFPreview';
import { PdfSettings } from '../services/pdfService';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface PDFSettingsWithPreviewProps {
  requestId?: number;
  defaultSettings?: Partial<PdfSettings>;
  onSettingsSaved?: (settings: Partial<PdfSettings>) => void;
}

export function PDFSettingsWithPreview({ 
  requestId, 
  defaultSettings,
  onSettingsSaved
}: PDFSettingsWithPreviewProps) {
  const [activeTab, setActiveTab] = useState<string>('settings');
  const [settings, setSettings] = useState<Partial<PdfSettings>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();
  
  // Fetch settings on component mount
  useEffect(() => {
    fetchSettings();
  }, []);
  
  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/pdf/print-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        throw new Error('Failed to load PDF settings');
      }
    } catch (error) {
      console.error('Error fetching PDF settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load PDF settings. Using default values.',
        variant: 'destructive',
      });
      // Use default settings if available
      if (defaultSettings) {
        setSettings(defaultSettings);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSettingsChange = (updatedSettings: Partial<PdfSettings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...updatedSettings
    }));
    
    if (onSettingsSaved) {
      onSettingsSaved(updatedSettings);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">PDF Document Settings</h2>
      
      <Tabs defaultValue="settings" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Live Preview</TabsTrigger>
          <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings">
          <PDFSettingsPanel 
            onSettingsSaved={handleSettingsChange}
            defaultSettings={settings}
          />
        </TabsContent>
        
        <TabsContent value="preview">
          <PDFPreview 
            settings={settings}
            isLoading={isLoading}
            requestId={requestId}
            onRefresh={fetchSettings}
          />
        </TabsContent>
        
        <TabsContent value="side-by-side">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-1">
              <PDFSettingsPanel 
                onSettingsSaved={handleSettingsChange}
                defaultSettings={settings}
                compact={true}
              />
            </div>
            <div className="lg:col-span-1">
              <PDFPreview 
                settings={settings}
                isLoading={isLoading}
                requestId={requestId}
                onRefresh={fetchSettings}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}