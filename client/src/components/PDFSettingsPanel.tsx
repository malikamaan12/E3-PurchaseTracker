/**
 * PDF Settings Panel
 * 
 * A panel for configuring PDF template settings including:
 * - Header title and color
 * - Footer text and color
 * - Watermark options
 * - Content visibility options
 */

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorPicker } from './ColorPicker';
import { fetchPdfSettings, savePdfSettings, PdfTemplateSettings, TemplateConfig } from '@/lib/pdfTemplateSettings';

export default function PDFSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PdfTemplateSettings | null>(null);
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | null>(null);
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);
  
  // Load settings from the server
  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchPdfSettings();
      
      // Parse template config if needed
      let config = data.templateConfig;
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (e) {
          console.error('Failed to parse template config', e);
        }
      }
      
      setSettings(data);
      setTemplateConfig(config as TemplateConfig || null);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load PDF settings', error);
      toast({
        title: 'Error',
        description: 'Failed to load PDF settings',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };
  
  // Save settings to the server
  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      
      // Prepare settings with template config
      const dataToSave = {
        ...settings,
        templateConfig: templateConfig
      };
      
      await savePdfSettings(dataToSave);
      
      toast({
        title: 'Success',
        description: 'PDF settings saved successfully',
        variant: 'default'
      });
      
      setSaving(false);
    } catch (error) {
      console.error('Failed to save PDF settings', error);
      toast({
        title: 'Error',
        description: 'Failed to save PDF settings',
        variant: 'destructive'
      });
      setSaving(false);
    }
  };
  
  // Handle input changes
  const handleInputChange = (field: keyof PdfTemplateSettings, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [field]: value
    });
  };
  
  // Handle template config changes
  const handleConfigChange = (field: keyof TemplateConfig, value: any) => {
    if (!templateConfig) return;
    
    setTemplateConfig({
      ...templateConfig,
      [field]: value
    });
  };
  
  // Handle custom fields changes
  const handleCustomFieldChange = (field: string, value: boolean) => {
    if (!templateConfig || !templateConfig.customFields) return;
    
    setTemplateConfig({
      ...templateConfig,
      customFields: {
        ...templateConfig.customFields,
        [field]: value
      }
    });
  };
  
  if (loading) {
    return <div className="flex justify-center p-8">Loading PDF settings...</div>;
  }
  
  if (!settings || !templateConfig) {
    return <div className="flex justify-center p-8">No PDF settings found</div>;
  }
  
  return (
    <div className="container max-w-4xl mx-auto py-4">
      <Card>
        <CardHeader>
          <CardTitle>PDF Template Settings</CardTitle>
          <CardDescription>
            Configure how your PDF documents look and what content they include
          </CardDescription>
        </CardHeader>
        
        <Tabs defaultValue="header">
          <div className="px-6">
            <TabsList className="w-full">
              <TabsTrigger value="header" className="flex-1">Header</TabsTrigger>
              <TabsTrigger value="footer" className="flex-1">Footer</TabsTrigger>
              <TabsTrigger value="watermark" className="flex-1">Watermark</TabsTrigger>
              <TabsTrigger value="content" className="flex-1">Content</TabsTrigger>
              <TabsTrigger value="security" className="flex-1">Security</TabsTrigger>
            </TabsList>
          </div>
          
          <CardContent className="space-y-4 pt-4">
            {/* Header Settings */}
            <TabsContent value="header" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headerTitle">Header Title</Label>
                  <Input
                    id="headerTitle"
                    value={settings.headerTitle}
                    onChange={(e) => handleInputChange('headerTitle', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="headerSubtitle">Header Subtitle</Label>
                  <Input
                    id="headerSubtitle"
                    value={settings.headerSubtitle || ''}
                    onChange={(e) => handleInputChange('headerSubtitle', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Header Color</Label>
                  <div className="flex items-center space-x-2">
                    <ColorPicker
                      color={settings.headerColor}
                      onChange={(color) => handleInputChange('headerColor', color)}
                    />
                    <Input
                      value={settings.headerColor}
                      onChange={(e) => handleInputChange('headerColor', e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="headerHeight">Header Height (mm)</Label>
                  <Input
                    id="headerHeight"
                    type="number"
                    value={settings.headerHeight || 40}
                    onChange={(e) => handleInputChange('headerHeight', parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="showHeader"
                  checked={templateConfig.showHeader}
                  onCheckedChange={(checked) => handleConfigChange('showHeader', checked)}
                />
                <Label htmlFor="showHeader">Show Header</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="showLogo"
                  checked={templateConfig.showLogo}
                  onCheckedChange={(checked) => handleConfigChange('showLogo', checked)}
                />
                <Label htmlFor="showLogo">Show Logo in Header</Label>
              </div>
            </TabsContent>
            
            {/* Footer Settings */}
            <TabsContent value="footer" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input
                    id="footerText"
                    value={settings.footerText || ''}
                    onChange={(e) => handleInputChange('footerText', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Footer Color</Label>
                  <div className="flex items-center space-x-2">
                    <ColorPicker
                      color={settings.footerColor}
                      onChange={(color) => handleInputChange('footerColor', color)}
                    />
                    <Input
                      value={settings.footerColor}
                      onChange={(e) => handleInputChange('footerColor', e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="footerHeight">Footer Height (mm)</Label>
                  <Input
                    id="footerHeight"
                    type="number"
                    value={settings.footerHeight || 20}
                    onChange={(e) => handleInputChange('footerHeight', parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="showFooter"
                  checked={templateConfig.showFooter}
                  onCheckedChange={(checked) => handleConfigChange('showFooter', checked)}
                />
                <Label htmlFor="showFooter">Show Footer</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="pageNumbering"
                  checked={settings.pageNumbering}
                  onCheckedChange={(checked) => handleInputChange('pageNumbering', checked)}
                />
                <Label htmlFor="pageNumbering">Show Page Numbers</Label>
              </div>
            </TabsContent>
            
            {/* Watermark Settings */}
            <TabsContent value="watermark" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="watermarkText">Watermark Text</Label>
                <Input
                  id="watermarkText"
                  value={templateConfig.watermarkText || ''}
                  onChange={(e) => handleConfigChange('watermarkText', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="watermarkOpacity">Watermark Opacity ({Math.round((templateConfig.watermarkOpacity || 0.08) * 100)}%)</Label>
                <Slider
                  id="watermarkOpacity"
                  min={0}
                  max={0.3}
                  step={0.01}
                  value={[templateConfig.watermarkOpacity || 0.08]}
                  onValueChange={(value) => handleConfigChange('watermarkOpacity', value[0])}
                />
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="showWatermark"
                  checked={templateConfig.showWatermark}
                  onCheckedChange={(checked) => handleConfigChange('showWatermark', checked)}
                />
                <Label htmlFor="showWatermark">Show Watermark</Label>
              </div>
            </TabsContent>
            
            {/* Content Settings */}
            <TabsContent value="content" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showApprovalFlow"
                    checked={templateConfig.showApprovalFlow !== false}
                    onCheckedChange={(checked) => handleConfigChange('showApprovalFlow', checked)}
                  />
                  <Label htmlFor="showApprovalFlow">Show Approval Flow</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showSignatureLines"
                    checked={templateConfig.showSignatureLines !== false}
                    onCheckedChange={(checked) => handleConfigChange('showSignatureLines', checked)}
                  />
                  <Label htmlFor="showSignatureLines">Show Signature Lines</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showAttachments"
                    checked={templateConfig.showAttachments !== false}
                    onCheckedChange={(checked) => handleConfigChange('showAttachments', checked)}
                  />
                  <Label htmlFor="showAttachments">Show Attachments</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showTotalsTable"
                    checked={templateConfig.showTotalsTable !== false}
                    onCheckedChange={(checked) => handleConfigChange('showTotalsTable', checked)}
                  />
                  <Label htmlFor="showTotalsTable">Show Totals Table</Label>
                </div>
                
                {templateConfig.customFields && Object.entries(templateConfig.customFields).map(([field, value]) => (
                  <div key={field} className="flex items-center space-x-2">
                    <Switch
                      id={field}
                      checked={value}
                      onCheckedChange={(checked) => handleCustomFieldChange(field, checked)}
                    />
                    <Label htmlFor={field}>{formatFieldName(field)}</Label>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="layout">Page Layout</Label>
                  <Select
                    value={templateConfig.layout}
                    onValueChange={(value) => handleConfigChange('layout', value)}
                  >
                    <SelectTrigger id="layout">
                      <SelectValue placeholder="Select layout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fontSize">Font Size (pt)</Label>
                  <Input
                    id="fontSize"
                    type="number"
                    value={settings.fontSize || 11}
                    onChange={(e) => handleInputChange('fontSize', parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marginLeft">Left Margin (mm)</Label>
                  <Input
                    id="marginLeft"
                    type="number"
                    value={settings.marginLeft || 25}
                    onChange={(e) => handleInputChange('marginLeft', parseInt(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="marginRight">Right Margin (mm)</Label>
                  <Input
                    id="marginRight"
                    type="number"
                    value={settings.marginRight || 25}
                    onChange={(e) => handleInputChange('marginRight', parseInt(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="marginTop">Top Margin (mm)</Label>
                  <Input
                    id="marginTop"
                    type="number"
                    value={settings.marginTop || 20}
                    onChange={(e) => handleInputChange('marginTop', parseInt(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="marginBottom">Bottom Margin (mm)</Label>
                  <Input
                    id="marginBottom"
                    type="number"
                    value={settings.marginBottom || 20}
                    onChange={(e) => handleInputChange('marginBottom', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* Security Settings */}
            <TabsContent value="security" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="securityLevel">Security Level</Label>
                <Select
                  value={templateConfig.securityLevel}
                  onValueChange={(value) => handleConfigChange('securityLevel', value)}
                >
                  <SelectTrigger id="securityLevel">
                    <SelectValue placeholder="Select security level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="internal">Internal Use</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  {getSecurityLevelDescription(templateConfig.securityLevel)}
                </p>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
        
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={loadSettings} disabled={loading || saving}>
            Reset
          </Button>
          <Button onClick={saveSettings} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Helper function to format field names
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .replace(/^show/, 'Show'); // Handle 'show' prefix
}

// Helper function to get security level descriptions
function getSecurityLevelDescription(level: string): string {
  switch (level) {
    case 'public':
      return 'No watermark, suitable for general distribution.';
    case 'internal':
      return 'Adds "INTERNAL USE" watermark with subtle appearance.';
    case 'confidential':
      return 'Adds "CONFIDENTIAL" watermark with stronger appearance.';
    default:
      return '';
  }
}