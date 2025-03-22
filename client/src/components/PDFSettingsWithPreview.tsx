import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PDFSettingsPanel from './PDFSettingsPanel';
import PDFPreview from './PDFPreview';
import { PdfSettings, DEFAULT_PDF_SETTINGS } from '../services/pdfService';
import { RotateCcw, Save } from 'lucide-react';

interface PDFSettingsWithPreviewProps {
  initialSettings?: Partial<PdfSettings>;
  onSave: (settings: PdfSettings) => Promise<PdfSettings | void>;
  previewData?: any;
}

const PDFSettingsWithPreview: React.FC<PDFSettingsWithPreviewProps> = ({
  initialSettings = {},
  onSave = async () => { 
    console.warn('onSave function not provided to PDFSettingsWithPreview');
    return null;
  },
  previewData
}) => {
  // Ensure we have safe initial settings
  const safeInitialSettings = initialSettings || {};
  
  const [settings, setSettings] = useState<PdfSettings>({
    ...DEFAULT_PDF_SETTINGS,
    ...safeInitialSettings
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Re-apply settings if initialSettings changes
  useEffect(() => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...safeInitialSettings
    }));
  }, [safeInitialSettings]);
  
  const handleSettingsChange = (updatedSettings: Partial<PdfSettings>) => {
    if (!updatedSettings) {
      console.warn('Received undefined settings update in PDFSettingsWithPreview');
      return;
    }
    
    setSettings(prevSettings => ({
      ...prevSettings,
      ...updatedSettings
    }));
  };
  
  const handleSave = async () => {
    if (typeof onSave !== 'function') {
      console.error('onSave is not a function in PDFSettingsWithPreview');
      toast({
        title: 'Error saving settings',
        description: 'The save function is not properly configured. Please contact support.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setLoading(true);
      await onSave(settings);
      
      toast({
        title: 'Settings saved',
        description: 'PDF settings have been saved successfully.',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      
      toast({
        title: 'Error saving settings',
        description: 'There was an error saving your PDF settings. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleReset = () => {
    setSettings({
      ...DEFAULT_PDF_SETTINGS,
      ...safeInitialSettings
    });
    
    toast({
      title: 'Settings reset',
      description: 'PDF settings have been reset to their initial values.',
      variant: 'default'
    });
  };
  
  return (
    <div className="pdf-settings-with-preview grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="pdf-settings-panel-container">
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <PDFSettingsPanel 
              settings={settings} 
              onSettingsChange={handleSettingsChange}
              loading={loading}
            />
            
            <div className="flex justify-end mt-6 space-x-4">
              <Button 
                variant="outline" 
                onClick={handleReset}
                disabled={loading}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              
              <Button 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="pdf-preview-container">
        <Card className="shadow-lg h-full">
          <CardContent className="p-0 h-full overflow-auto">
            <PDFPreview 
              settings={settings}
              previewData={previewData}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PDFSettingsWithPreview;