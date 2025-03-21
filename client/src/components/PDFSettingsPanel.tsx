/**
 * PDF Settings Panel
 * 
 * A component for configuring PDF template settings
 */

import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  PdfTemplateSettings,
  TemplateConfig,
  fetchPdfSettings,
  savePdfSettings,
  getDefaultTemplateConfig,
  hexToRgb,
  rgbToHex
} from '@/lib/pdfTemplateSettings';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ChromePicker } from 'react-color';

// Validation schema for the PDF settings form
const pdfSettingsSchema = z.object({
  headerTitle: z.string().min(1, 'Header title is required'),
  headerSubtitle: z.string().optional(),
  headerColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format'),
  footerText: z.string().optional(),
  footerColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format'),
  pageNumbering: z.boolean().default(true),
  watermarkOpacity: z.number().min(0).max(100),
  marginTop: z.number().min(0).max(50).optional(),
  marginBottom: z.number().min(0).max(50).optional(),
  marginLeft: z.number().min(0).max(50).optional(),
  marginRight: z.number().min(0).max(50).optional(),
  fontSize: z.number().min(8).max(18).optional(),
  headerHeight: z.number().min(10).max(200).optional(),
  footerHeight: z.number().min(10).max(200).optional(),
});

// Validation schema for template configuration
const templateConfigSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  type: z.string().min(1, 'Template type is required'),
  layout: z.string().min(1, 'Layout is required'),
  showHeader: z.boolean().default(true),
  showFooter: z.boolean().default(true),
  showLogo: z.boolean().default(true),
  showWatermark: z.boolean().default(true),
  securityLevel: z.string().min(1, 'Security level is required'),
  watermarkOpacity: z.number().min(0).max(1),
  watermarkText: z.string().optional(),
  showApprovalFlow: z.boolean().default(true),
  showSignatureLines: z.boolean().default(true),
  showAttachments: z.boolean().default(true),
  showTotalsTable: z.boolean().default(true),
});

export default function PDFSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PdfTemplateSettings | null>(null);
  const [currentTab, setCurrentTab] = useState('general');
  const [headerColorPicker, setHeaderColorPicker] = useState(false);
  const [footerColorPicker, setFooterColorPicker] = useState(false);
  
  // Create form with validation
  const form = useForm<PdfTemplateSettings>({
    resolver: zodResolver(pdfSettingsSchema),
    defaultValues: {
      headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
      headerSubtitle: 'PURCHASE REQUEST',
      headerColor: '#6F2AE6',
      footerText: 'CONFIDENTIAL - ALL RIGHTS RESERVED',
      footerColor: '#6F2AE6',
      pageNumbering: true,
      watermarkOpacity: 10,
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 25,
      marginRight: 25,
      fontSize: 11,
      headerHeight: 40,
      footerHeight: 20,
    }
  });
  
  // Template config form
  const templateForm = useForm({
    defaultValues: getDefaultTemplateConfig(),
  });
  
  // Load settings on component mount
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const loadedSettings = await fetchPdfSettings();
        setSettings(loadedSettings);
        
        // Set form values
        form.reset({
          ...loadedSettings,
          headerColor: loadedSettings.headerColor || '#6F2AE6',
          footerColor: loadedSettings.footerColor || '#6F2AE6',
          watermarkOpacity: loadedSettings.watermarkOpacity || 10,
        });
        
        // Set template form values
        if (loadedSettings.templateConfig) {
          const templateConfig = typeof loadedSettings.templateConfig === 'string'
            ? JSON.parse(loadedSettings.templateConfig)
            : loadedSettings.templateConfig;
          
          templateForm.reset({
            ...templateConfig,
            headerColor: templateConfig.headerColor 
              ? [templateConfig.headerColor[0], templateConfig.headerColor[1], templateConfig.headerColor[2]]
              : [111/255, 42/255, 230/255],
            accentColor: templateConfig.accentColor
              ? [templateConfig.accentColor[0], templateConfig.accentColor[1], templateConfig.accentColor[2]]
              : [31/255, 211/255, 219/255],
            watermarkOpacity: templateConfig.watermarkOpacity || 0.08,
            watermarkText: templateConfig.watermarkText || 'INTERNAL USE',
          });
        }
      } catch (error) {
        console.error('Failed to load PDF settings:', error);
        toast({
          title: 'Failed to load settings',
          description: 'Could not load PDF template settings. Using defaults instead.',
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    }
    
    loadSettings();
  }, []);
  
  // Save settings
  const onSubmit = async (data: PdfTemplateSettings) => {
    setLoading(true);
    try {
      // Get template config from the form
      const templateConfig = templateForm.getValues();
      
      // Prepare data for saving
      const dataToSave = {
        ...data,
        // Ensure templateConfig is included
        templateConfig: typeof data.templateConfig === 'string'
          ? data.templateConfig
          : JSON.stringify({
              ...templateConfig,
              // Convert any RGB array values to the correct format
              headerColor: templateConfig.headerColor,
              accentColor: templateConfig.accentColor,
            }),
      };
      
      const savedSettings = await savePdfSettings(dataToSave);
      setSettings(savedSettings);
      
      toast({
        title: 'Settings saved',
        description: 'PDF template settings have been updated successfully.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to save PDF settings:', error);
      toast({
        title: 'Save failed',
        description: 'Could not save PDF template settings. Please try again.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle section visibility in template config
  const toggleSectionVisibility = (section: string, value: boolean) => {
    const key = `show${section.charAt(0).toUpperCase() + section.slice(1)}`;
    templateForm.setValue(key as any, value);
  };
  
  // Update color in form
  const updateColor = (field: 'headerColor' | 'footerColor', color: string) => {
    form.setValue(field, color);
  };
  
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>PDF Template Settings</CardTitle>
        <CardDescription>
          Configure the appearance and content of PDF exports
        </CardDescription>
      </CardHeader>
      
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="mx-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="header">Header & Footer</TabsTrigger>
          <TabsTrigger value="content">Content Visibility</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <TabsContent value="general">
                <div className="space-y-4 mt-4">
                  {/* Margins */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="marginTop"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Top Margin (mm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="marginBottom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bottom Margin (mm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="marginLeft"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Left Margin (mm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="marginRight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Right Margin (mm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Font Size */}
                  <FormField
                    control={form.control}
                    name="fontSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Font Size</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Layout */}
                  <div className="space-y-2">
                    <Label>PDF Layout</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        type="button"
                        variant={templateForm.getValues('layout') === 'portrait' ? 'default' : 'outline'}
                        onClick={() => templateForm.setValue('layout', 'portrait')}
                        className="h-24 flex flex-col items-center justify-center"
                      >
                        <div className="w-8 h-12 border-2 border-current mb-2"></div>
                        Portrait
                      </Button>
                      
                      <Button
                        type="button"
                        variant={templateForm.getValues('layout') === 'landscape' ? 'default' : 'outline'}
                        onClick={() => templateForm.setValue('layout', 'landscape')}
                        className="h-24 flex flex-col items-center justify-center"
                      >
                        <div className="w-12 h-8 border-2 border-current mb-2"></div>
                        Landscape
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="header">
                <div className="space-y-4 mt-4">
                  {/* Header Title */}
                  <FormField
                    control={form.control}
                    name="headerTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Header Subtitle */}
                  <FormField
                    control={form.control}
                    name="headerSubtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Subtitle</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Header Color */}
                  <FormField
                    control={form.control}
                    name="headerColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Color</FormLabel>
                        <div className="flex items-center gap-4">
                          <div
                            className="w-8 h-8 border cursor-pointer rounded-md"
                            style={{ backgroundColor: field.value }}
                            onClick={() => setHeaderColorPicker(!headerColorPicker)}
                          />
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </div>
                        {headerColorPicker && (
                          <div className="absolute z-10 mt-2">
                            <div 
                              className="fixed inset-0" 
                              onClick={() => setHeaderColorPicker(false)}
                            />
                            <ChromePicker
                              color={field.value}
                              onChange={(color) => updateColor('headerColor', color.hex)}
                            />
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Header Height */}
                  <FormField
                    control={form.control}
                    name="headerHeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Height (mm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="my-4" />
                  
                  {/* Footer Text */}
                  <FormField
                    control={form.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Text</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Footer Color */}
                  <FormField
                    control={form.control}
                    name="footerColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Color</FormLabel>
                        <div className="flex items-center gap-4">
                          <div
                            className="w-8 h-8 border cursor-pointer rounded-md"
                            style={{ backgroundColor: field.value }}
                            onClick={() => setFooterColorPicker(!footerColorPicker)}
                          />
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </div>
                        {footerColorPicker && (
                          <div className="absolute z-10 mt-2">
                            <div 
                              className="fixed inset-0" 
                              onClick={() => setFooterColorPicker(false)}
                            />
                            <ChromePicker
                              color={field.value}
                              onChange={(color) => updateColor('footerColor', color.hex)}
                            />
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Footer Height */}
                  <FormField
                    control={form.control}
                    name="footerHeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Height (mm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Page Numbering */}
                  <FormField
                    control={form.control}
                    name="pageNumbering"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Page Numbers</FormLabel>
                          <FormDescription>
                            Show page numbers in the footer
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="content">
                <div className="space-y-4 mt-4">
                  {/* Section Visibility Toggle */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Section Visibility</h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">Header</Label>
                          <p className="text-sm text-muted-foreground">
                            Show document header with title and logo
                          </p>
                        </div>
                        <Switch
                          checked={templateForm.getValues('showHeader')}
                          onCheckedChange={(checked) => toggleSectionVisibility('Header', checked)}
                        />
                      </div>
                      
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">Footer</Label>
                          <p className="text-sm text-muted-foreground">
                            Show document footer with text and page numbers
                          </p>
                        </div>
                        <Switch
                          checked={templateForm.getValues('showFooter')}
                          onCheckedChange={(checked) => toggleSectionVisibility('Footer', checked)}
                        />
                      </div>
                      
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">Approval Flow</Label>
                          <p className="text-sm text-muted-foreground">
                            Show approval workflow status
                          </p>
                        </div>
                        <Switch
                          checked={templateForm.getValues('showApprovalFlow')}
                          onCheckedChange={(checked) => toggleSectionVisibility('ApprovalFlow', checked)}
                        />
                      </div>
                      
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">Signature Lines</Label>
                          <p className="text-sm text-muted-foreground">
                            Show signature lines for approvers
                          </p>
                        </div>
                        <Switch
                          checked={templateForm.getValues('showSignatureLines')}
                          onCheckedChange={(checked) => toggleSectionVisibility('SignatureLines', checked)}
                        />
                      </div>
                      
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">Attachments</Label>
                          <p className="text-sm text-muted-foreground">
                            Show list of attached files
                          </p>
                        </div>
                        <Switch
                          checked={templateForm.getValues('showAttachments')}
                          onCheckedChange={(checked) => toggleSectionVisibility('Attachments', checked)}
                        />
                      </div>
                      
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">Totals Table</Label>
                          <p className="text-sm text-muted-foreground">
                            Show cost summary table
                          </p>
                        </div>
                        <Switch
                          checked={templateForm.getValues('showTotalsTable')}
                          onCheckedChange={(checked) => toggleSectionVisibility('TotalsTable', checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="security">
                <div className="space-y-4 mt-4">
                  {/* Security Level */}
                  <div className="space-y-2">
                    <Label>Security Classification</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button
                        type="button"
                        variant={templateForm.getValues('securityLevel') === 'public' ? 'default' : 'outline'}
                        onClick={() => templateForm.setValue('securityLevel', 'public')}
                        className="h-16"
                      >
                        Public
                      </Button>
                      
                      <Button
                        type="button"
                        variant={templateForm.getValues('securityLevel') === 'internal' ? 'default' : 'outline'}
                        onClick={() => templateForm.setValue('securityLevel', 'internal')}
                        className="h-16"
                      >
                        Internal
                      </Button>
                      
                      <Button
                        type="button"
                        variant={templateForm.getValues('securityLevel') === 'confidential' ? 'default' : 'outline'}
                        onClick={() => templateForm.setValue('securityLevel', 'confidential')}
                        className="h-16"
                      >
                        Confidential
                      </Button>
                    </div>
                  </div>
                  
                  {/* Watermark Toggle */}
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Watermark</Label>
                      <p className="text-sm text-muted-foreground">
                        Add security watermark to document
                      </p>
                    </div>
                    <Switch
                      checked={templateForm.getValues('showWatermark')}
                      onCheckedChange={(checked) => toggleSectionVisibility('Watermark', checked)}
                    />
                  </div>
                  
                  {/* Watermark Text */}
                  <div className="space-y-2">
                    <Label>Watermark Text</Label>
                    <Input
                      value={templateForm.getValues('watermarkText')}
                      onChange={(e) => templateForm.setValue('watermarkText', e.target.value)}
                    />
                  </div>
                  
                  {/* Watermark Opacity */}
                  <FormField
                    control={form.control}
                    name="watermarkOpacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Watermark Opacity</FormLabel>
                        <FormControl>
                          <div className="pt-2">
                            <Slider
                              value={[field.value || 10]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={(vals) => field.onChange(vals[0])}
                            />
                          </div>
                        </FormControl>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Transparent</span>
                          <span>{field.value || 10}%</span>
                          <span>Visible</span>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              <CardFooter className="flex justify-between mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    templateForm.reset(getDefaultTemplateConfig());
                  }}
                  disabled={loading}
                >
                  Reset to Defaults
                </Button>
                
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Tabs>
    </Card>
  );
}