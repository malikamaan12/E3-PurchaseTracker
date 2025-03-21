import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PdfSettings } from '../services/pdfService';
import PDFPreview from './PDFPreview';
import PDFSettingsPanel from './PDFSettingsPanel';
import { pdfAnalysisService, TemplateAnalysisResult } from '../services/pdfAnalysisService';
import { toast } from '@/hooks/use-toast';

interface PDFSettingsWithPreviewProps {
  initialSettings: Partial<PdfSettings>;
  onSave: (settings: Partial<PdfSettings>) => Promise<void>;
  onAnalyze?: (settings: Partial<PdfSettings>) => Promise<TemplateAnalysisResult>;
}

const PDFSettingsWithPreview: React.FC<PDFSettingsWithPreviewProps> = ({
  initialSettings,
  onSave,
  onAnalyze
}) => {
  const [settings, setSettings] = useState<Partial<PdfSettings>>(initialSettings);
  const [originalSettings, setOriginalSettings] = useState<Partial<PdfSettings>>(initialSettings);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TemplateAnalysisResult | null>(null);
  const [previewKey, setPreviewKey] = useState(0); // To force preview refresh

  const handleSettingsChange = (newSettingsPartial: Partial<PdfSettings>) => {
    setSettings(prevSettings => {
      const updatedSettings = { ...prevSettings, ...newSettingsPartial };
      
      // Force preview to update
      setTimeout(() => setPreviewKey(prev => prev + 1), 0);
      
      return updatedSettings;
    });
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      await onSave(settings);
      setOriginalSettings(settings);
      toast({
        title: 'Success',
        description: 'PDF settings saved successfully',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save PDF settings',
        variant: 'destructive',
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!onAnalyze) return;
    
    try {
      setAnalyzeLoading(true);
      const result = await onAnalyze(settings);
      setAnalysisResult(result);
      
      if (result.fixedTemplate) {
        // Apply fixed template to settings
        handleSettingsChange({
          templateConfig: result.fixedTemplate
        });
        
        toast({
          title: 'Analysis Complete',
          description: 'Recommendations applied to template',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Analysis Complete',
          description: 'No changes needed to template',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error analyzing PDF template:', error);
      toast({
        title: 'Error',
        description: 'Failed to analyze PDF template',
        variant: 'destructive',
      });
    } finally {
      setAnalyzeLoading(false);
    }
  };
  
  const handleReset = () => {
    setSettings(originalSettings);
    setPreviewKey(prev => prev + 1);
    setAnalysisResult(null);
    toast({
      title: 'Reset',
      description: 'PDF settings reset to saved values',
      variant: 'default',
    });
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  return (
    <div className="pdf-settings-with-preview grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="settings-panel">
        <Card className="p-4">
          {analysisResult && (
            <Alert className="mb-4">
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Analysis Results:</p>
                  <p>{analysisResult.analysis}</p>
                  {analysisResult.recommendations.length > 0 && (
                    <div>
                      <p className="font-semibold mt-2">Recommendations:</p>
                      <ul className="list-disc pl-6">
                        {analysisResult.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <PDFSettingsPanel 
            settings={settings} 
            onSettingsChange={handleSettingsChange}
            loading={loading || saveLoading} 
          />
          
          <div className="flex justify-between mt-6">
            <div>
              {onAnalyze && (
                <Button 
                  onClick={handleAnalyze} 
                  variant="outline" 
                  disabled={analyzeLoading}
                >
                  {analyzeLoading ? 'Analyzing...' : 'Analyze Template'}
                </Button>
              )}
            </div>
            <div className="space-x-2">
              {hasChanges && (
                <Button 
                  onClick={handleReset} 
                  variant="outline" 
                  disabled={saveLoading}
                >
                  Reset
                </Button>
              )}
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges || saveLoading}
              >
                {saveLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
      
      <div className="preview-panel">
        <Card className="h-full p-4">
          <h2 className="text-lg font-bold mb-4">PDF Preview</h2>
          <div className="h-[calc(100%-2rem)]">
            <PDFPreview 
              key={previewKey}
              settings={settings}
              loading={loading} 
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PDFSettingsWithPreview;