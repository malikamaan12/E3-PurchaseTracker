import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from './ui/form';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Loader2, Upload } from 'lucide-react';
import { PDFImageUploader } from '../components/PDFImageUploader';
import { useToast } from '../hooks/use-toast';

// Define the PDF settings schema
const pdfSettingsSchema = z.object({
  headerTitle: z.string().min(1, 'Header title is required'),
  headerSubtitle: z.string().optional(),
  headerColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Must be a valid hex color'),
  footerText: z.string().optional(),
  footerColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Must be a valid hex color'),
  pageNumbering: z.boolean().default(true),
  fontSize: z.number().min(8).max(16).default(11),
  marginTop: z.number().min(10).max(50).default(20),
  marginBottom: z.number().min(10).max(50).default(20),
  marginLeft: z.number().min(10).max(50).default(25),
  marginRight: z.number().min(10).max(50).default(25),
  headerHeight: z.number().min(0).max(200).default(60),
  footerHeight: z.number().min(0).max(200).default(40),
  headerImage: z.string().nullable().optional(),
  footerImage: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
});

// PDF settings type from the schema
type PDFSettings = z.infer<typeof pdfSettingsSchema>;

// Default PDF settings
const defaultSettings: PDFSettings = {
  headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
  headerSubtitle: 'PURCHASE REQUEST',
  headerColor: '#1a365d',
  footerText: 'ALL RIGHTS RESERVED BY E3',
  footerColor: '#1a365d',
  pageNumbering: true,
  fontSize: 11,
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 25,
  marginRight: 25,
  headerHeight: 60,
  footerHeight: 40,
  headerImage: null,
  footerImage: null,
  logo: null,
};

interface PDFDesignPanelProps {
  onSave?: (settings: PDFSettings) => void;
}

export default function PDFDesignPanel({ onSave }: PDFDesignPanelProps) {
  // State for file uploads and previews
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [footerFile, setFooterFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [footerPreview, setFooterPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // Initialize form with the settings schema
  const form = useForm<PDFSettings>({
    resolver: zodResolver(pdfSettingsSchema),
    defaultValues: defaultSettings,
  });

  // Fetch existing PDF settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['pdf-settings'],
    queryFn: async () => {
      const response = await axios.get('/api/pdf/print-settings');
      return response.data;
    },
  });
  
  // Update form when settings data is loaded
  useEffect(() => {
    if (settings) {
      // Update form with fetched settings
      form.reset({
        ...defaultSettings,
        ...settings,
      });

      // Set image previews if available
      if (settings.headerImage) setHeaderPreview(settings.headerImage);
      if (settings.footerImage) setFooterPreview(settings.footerImage);
      if (settings.logo) setLogoPreview(settings.logo);
    }
  }, [settings, form]);

  // Mutation for saving PDF settings
  const saveMutation = useMutation({
    mutationFn: async (data: PDFSettings) => {
      const response = await axios.post('/api/pdf/settings', data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'PDF settings saved successfully',
        variant: 'default',
      });
      if (onSave && form.getValues()) {
        onSave(form.getValues());
      }
    },
    onError: (error) => {
      console.error('Failed to save PDF settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save PDF settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for uploading images
  const uploadMutation = useMutation({
    mutationFn: async ({ files, type }: { files: File[], type: 'header' | 'footer' | 'logo' }) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('type', type);
      
      const response = await axios.post('/api/pdf/upload-images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      if (data && data.fileUrl) {
        if (variables.type === 'header') {
          form.setValue('headerImage', data.fileUrl);
          setHeaderPreview(data.fileUrl);
        } else if (variables.type === 'footer') {
          form.setValue('footerImage', data.fileUrl);
          setFooterPreview(data.fileUrl);
        } else if (variables.type === 'logo') {
          form.setValue('logo', data.fileUrl);
          setLogoPreview(data.fileUrl);
        }
      }
    },
    onError: (error) => {
      console.error('Failed to upload image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'header' | 'footer' | 'logo') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.includes('image/jpeg') && !file.type.includes('image/png')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload JPG or PNG images only',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload images smaller than 5MB',
          variant: 'destructive',
        });
        return;
      }

      if (type === 'header') {
        setHeaderFile(file);
      } else if (type === 'footer') {
        setFooterFile(file);
      } else if (type === 'logo') {
        setLogoFile(file);
      }
      
      // Upload file immediately
      uploadMutation.mutate({ files: [file], type });
    }
  };

  // Handle form submission
  const onSubmit = (data: PDFSettings) => {
    saveMutation.mutate(data);
  };

  // Generate PDF preview
  const generatePreview = async () => {
    try {
      // First save current settings
      const formData = form.getValues();
      await saveMutation.mutateAsync(formData);
      
      // Log the preview generation action
      await axios.post('/api/pdf/audit', {
        action: 'pdf_viewed',
        resourceId: 1, // Sample request ID
        details: { preview: true, source: 'design_panel' }
      });
      
      // Open a sample PDF in a new tab
      window.open('/api/requests/1/pdf?preview=true', '_blank');
      
    } catch (error) {
      console.error('Failed to generate preview:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF preview. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading PDF settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Tabs defaultValue="header">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="header">Header</TabsTrigger>
              <TabsTrigger value="footer">Footer</TabsTrigger>
              <TabsTrigger value="layout">Layout & Margins</TabsTrigger>
            </TabsList>
            
            <TabsContent value="header" className="space-y-4 py-4">
              <Card>
                <CardHeader>
                  <CardTitle>Header Configuration</CardTitle>
                  <CardDescription>
                    Configure the header appearance for all PDF documents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="headerTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Header Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter header title" {...field} />
                          </FormControl>
                          <FormDescription>
                            The main title displayed in the PDF header
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="headerSubtitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Header Subtitle</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter header subtitle" {...field} />
                          </FormControl>
                          <FormDescription>
                            Secondary text displayed in the header
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="headerColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Text Color</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input
                              type="color"
                              {...field}
                              className="w-12 h-10 p-1"
                            />
                          </FormControl>
                          <Input
                            value={field.value || "#000000"}
                            onChange={field.onChange}
                            className="flex-1"
                          />
                        </div>
                        <FormDescription>
                          Color of the header text
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="headerHeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Height (px): {field.value}</FormLabel>
                        <FormControl>
                          <Slider
                            defaultValue={[field.value || 60]}
                            min={0}
                            max={200}
                            step={1}
                            onValueChange={(values) => field.onChange(values[0])}
                          />
                        </FormControl>
                        <FormDescription>
                          Adjust the height of the header
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-2">
                    <Label htmlFor="headerImage">Header Image</Label>
                    <PDFImageUploader
                      type="header"
                      currentImage={headerPreview}
                      onUploadComplete={(fileUrl: string) => {
                        form.setValue('headerImage', fileUrl);
                        setHeaderPreview(fileUrl);
                      }}
                      maxSizeInMB={5}
                    />
                    <p className="text-sm text-muted-foreground">
                      Upload a JPG or PNG image for the header (max 5MB)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="footer" className="space-y-4 py-4">
              <Card>
                <CardHeader>
                  <CardTitle>Footer Configuration</CardTitle>
                  <CardDescription>
                    Configure the footer appearance for all PDF documents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Text</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter footer text" {...field} />
                        </FormControl>
                        <FormDescription>
                          Text displayed in the PDF footer
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="footerColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Text Color</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input
                              type="color"
                              {...field}
                              className="w-12 h-10 p-1"
                            />
                          </FormControl>
                          <Input
                            value={field.value || "#000000"}
                            onChange={field.onChange}
                            className="flex-1"
                          />
                        </div>
                        <FormDescription>
                          Color of the footer text
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="footerHeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Height (px): {field.value}</FormLabel>
                        <FormControl>
                          <Slider
                            defaultValue={[field.value || 40]}
                            min={0}
                            max={200}
                            step={1}
                            onValueChange={(values) => field.onChange(values[0])}
                          />
                        </FormControl>
                        <FormDescription>
                          Adjust the height of the footer
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="pageNumbering"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Enable Page Numbering</FormLabel>
                          <FormDescription>
                            Show page numbers in the footer (e.g., Page 1 of 3)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-2">
                    <Label htmlFor="footerImage">Footer Image</Label>
                    <PDFImageUploader
                      type="footer"
                      currentImage={footerPreview}
                      onUploadComplete={(fileUrl: string) => {
                        form.setValue('footerImage', fileUrl);
                        setFooterPreview(fileUrl);
                      }}
                      maxSizeInMB={5}
                    />
                    <p className="text-sm text-muted-foreground">
                      Upload a JPG or PNG image for the footer (max 5MB)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="layout" className="space-y-4 py-4">
              <Card>
                <CardHeader>
                  <CardTitle>Layout & Margins</CardTitle>
                  <CardDescription>
                    Configure the page layout and margins for all PDF documents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Page Margins</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="marginTop"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Top Margin (mm): {field.value}</FormLabel>
                            <FormControl>
                              <Slider
                                defaultValue={[field.value || 20]}
                                min={10}
                                max={50}
                                step={1}
                                onValueChange={(values) => field.onChange(values[0])}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="marginBottom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bottom Margin (mm): {field.value}</FormLabel>
                            <FormControl>
                              <Slider
                                defaultValue={[field.value || 20]}
                                min={10}
                                max={50}
                                step={1}
                                onValueChange={(values) => field.onChange(values[0])}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="marginLeft"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Left Margin (mm): {field.value}</FormLabel>
                            <FormControl>
                              <Slider
                                defaultValue={[field.value || 25]}
                                min={10}
                                max={50}
                                step={1}
                                onValueChange={(values) => field.onChange(values[0])}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="marginRight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Right Margin (mm): {field.value}</FormLabel>
                            <FormControl>
                              <Slider
                                defaultValue={[field.value || 25]}
                                min={10}
                                max={50}
                                step={1}
                                onValueChange={(values) => field.onChange(values[0])}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Font Size</h3>
                    <FormField
                      control={form.control}
                      name="fontSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Font Size (pt): {field.value}</FormLabel>
                          <FormControl>
                            <Slider
                              defaultValue={[field.value || 11]}
                              min={8}
                              max={16}
                              step={1}
                              onValueChange={(values) => field.onChange(values[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Adjust the base font size for the PDF content
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="logoImage">Company Logo</Label>
                    <PDFImageUploader
                      type="logo"
                      currentImage={logoPreview}
                      onUploadComplete={(fileUrl: string) => {
                        form.setValue('logo', fileUrl);
                        setLogoPreview(fileUrl);
                      }}
                      maxSizeInMB={5}
                    />
                    <p className="text-sm text-muted-foreground">
                      Upload your company logo (max 5MB)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={generatePreview}
            >
              Generate Preview
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}