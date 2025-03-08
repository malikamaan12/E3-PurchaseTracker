import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, Upload, Download, Save, PlusCircle, X, FileImage, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { generateRequestPDF } from '@/lib/pdfGenerator';

// Define schema for the form
const pdfSettingsSchema = z.object({
  headerTitle: z.string().min(1, "Header title is required"),
  headerSubtitle: z.string().optional(),
  headerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  footerText: z.string().optional(),
  footerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  pageNumbering: z.boolean().default(true),
  marginTop: z.number().min(10).max(50).default(20),
  marginBottom: z.number().min(10).max(50).default(20),
  marginLeft: z.number().min(15).max(50).default(25),
  marginRight: z.number().min(15).max(50).default(25),
  fontSize: z.number().min(8).max(16).default(11),
  headerHeight: z.number().min(20).max(200).default(100),
  footerHeight: z.number().min(20).max(200).default(50),
});

type PDFSettingsFormValues = z.infer<typeof pdfSettingsSchema>;

interface PDFDesignPanelProps {
  onSave?: (settings: any) => void;
}

export default function PDFDesignPanel({ onSave }: PDFDesignPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('general');
  const [headerImage, setHeaderImage] = useState<File | null>(null);
  const [footerImage, setFooterImage] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<File | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [footerImagePreview, setFooterImagePreview] = useState<string | null>(null);
  const [logoImagePreview, setLogoImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Fetch existing PDF settings
  const { data: pdfSettings, isLoading } = useQuery({
    queryKey: ['/api/pdf/print-settings'],
    queryFn: async () => {
      const response = await fetch('/api/pdf/print-settings');
      if (!response.ok) {
        throw new Error('Failed to fetch PDF settings');
      }
      return response.json();
    }
  });

  // Form for PDF settings
  const form = useForm<PDFSettingsFormValues>({
    resolver: zodResolver(pdfSettingsSchema),
    defaultValues: {
      headerTitle: "EVENTS & ENTERTAINMENT ENTERPRISES",
      headerSubtitle: "PURCHASE REQUEST",
      headerColor: "#1a365d",
      footerText: "ALL RIGHTS RESERVED BY E3",
      footerColor: "#1a365d",
      pageNumbering: true,
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 25,
      marginRight: 25,
      fontSize: 11,
      headerHeight: 100,
      footerHeight: 50,
    }
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (pdfSettings) {
      // Set form values
      form.reset({
        headerTitle: pdfSettings.headerTitle,
        headerSubtitle: pdfSettings.headerSubtitle || "",
        headerColor: pdfSettings.headerColor,
        footerText: pdfSettings.footerText || "",
        footerColor: pdfSettings.footerColor,
        pageNumbering: pdfSettings.pageNumbering,
        marginTop: pdfSettings.marginTop,
        marginBottom: pdfSettings.marginBottom,
        marginLeft: pdfSettings.marginLeft,
        marginRight: pdfSettings.marginRight,
        fontSize: pdfSettings.fontSize,
        headerHeight: pdfSettings.headerHeight || 100,
        footerHeight: pdfSettings.footerHeight || 50,
      });
      
      // Set image previews if available
      if (pdfSettings.headerImage) {
        setHeaderImagePreview(pdfSettings.headerImage);
      }
      if (pdfSettings.footerImage) {
        setFooterImagePreview(pdfSettings.footerImage);
      }
      if (pdfSettings.logo) {
        setLogoImagePreview(pdfSettings.logo);
      }
    }
  }, [pdfSettings, form]);

  // Mutation for saving PDF settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: PDFSettingsFormValues) => {
      const response = await fetch('/api/pdf/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          headerImage: headerImagePreview,
          footerImage: footerImagePreview,
          logo: logoImagePreview,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save PDF settings');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'PDF settings saved successfully',
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pdf/print-settings'] });
      if (onSave) {
        onSave(form.getValues());
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to save PDF settings: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Mutation for uploading images
  const uploadImagesMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      
      if (headerImage) {
        formData.append('headerImage', headerImage);
      }
      if (footerImage) {
        formData.append('footerImage', footerImage);
      }
      if (logoImage) {
        formData.append('logo', logoImage);
      }
      
      const response = await fetch('/api/pdf/upload-images', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload images');
      }
      
      return response.json();
    },
    onMutate: () => {
      setIsUploading(true);
    },
    onSuccess: (data) => {
      setIsUploading(false);
      
      if (data.files) {
        // Set the new image URLs
        if (data.files.headerImage) {
          setHeaderImagePreview(data.files.headerImage);
        }
        if (data.files.footerImage) {
          setFooterImagePreview(data.files.footerImage);
        }
        if (data.files.logo) {
          setLogoImagePreview(data.files.logo);
        }
      }
      
      toast({
        title: 'Success',
        description: 'Images uploaded successfully',
        variant: 'default',
      });
      
      // Reset the file inputs
      setHeaderImage(null);
      setFooterImage(null);
      setLogoImage(null);
      
      queryClient.invalidateQueries({ queryKey: ['/api/pdf/print-settings'] });
    },
    onError: (error) => {
      setIsUploading(false);
      toast({
        title: 'Error',
        description: `Failed to upload images: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Handle file change
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'File size exceeds the 5MB limit',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast({
        title: 'Error',
        description: 'Only JPEG and PNG images are allowed',
        variant: 'destructive',
      });
      return;
    }
    
    setFile(file);
    
    // Create a preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        setPreview(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle submit for the form
  const onSubmit = (data: PDFSettingsFormValues) => {
    // Save settings
    saveSettingsMutation.mutate(data);
  };

  // Handle image upload
  const handleUploadImages = () => {
    if (!headerImage && !footerImage && !logoImage) {
      toast({
        title: 'Info',
        description: 'No images selected for upload',
        variant: 'default',
      });
      return;
    }
    
    uploadImagesMutation.mutate();
  };

  // Handle preview PDF download
  const handleDownloadPreview = async () => {
    setIsGeneratingPreview(true);
    
    try {
      // Get current form values
      const currentSettings = form.getValues();
      
      // Sample request data for preview
      const sampleRequest = {
        id: 999,
        title: "Sample Purchase Request",
        description: "This is a preview of your PDF design settings",
        requestNumber: "PR-PREVIEW",
        status: "preview",
        priority: "medium",
        createdAt: new Date().toISOString(),
        items: [
          {
            name: "Sample Item 1",
            quantity: 2,
            estimatedCost: 100,
            description: "Sample item description"
          },
          {
            name: "Sample Item 2",
            quantity: 1,
            estimatedCost: 200,
            description: "Another sample item"
          }
        ],
        totalEstimatedCost: 300,
        pdfSettings: {
          ...currentSettings,
          headerImage: headerImagePreview,
          footerImage: footerImagePreview,
          logo: logoImagePreview,
          showHeaderText: true,
          showHeaderImage: !!headerImagePreview,
          showFooterText: true,
          showFooterImage: !!footerImagePreview,
          showLogo: !!logoImagePreview
        }
      };
      
      // Generate the PDF
      const doc = await generateRequestPDF(sampleRequest);
      
      // Save the PDF
      doc.save('pdf-design-preview.pdf');
      
      toast({
        title: 'Success',
        description: 'Preview PDF generated and downloaded',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error generating preview PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate preview PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Handle removing an image
  const handleRemoveImage = (
    imageType: 'header' | 'footer' | 'logo',
    setPreview: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    setPreview(null);
    
    // Update form values
    if (imageType === 'header') {
      setHeaderImage(null);
    } else if (imageType === 'footer') {
      setFooterImage(null);
    } else if (imageType === 'logo') {
      setLogoImage(null);
    }
    
    toast({
      title: 'Info',
      description: `${imageType.charAt(0).toUpperCase() + imageType.slice(1)} image removed`,
      variant: 'default',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>PDF Design Settings</CardTitle>
        <CardDescription>
          Customize the look and feel of your PDF documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <TabsContent value="general">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="headerTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          Main title in the header of your PDF
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
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          Subtitle displayed in the header
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="headerColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Color</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="color" className="w-12 h-10" />
                          </FormControl>
                          <Input
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                        <FormDescription>
                          Color used for the header background
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Text</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          Text displayed in the footer
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
                        <FormLabel>Footer Color</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="color" className="w-12 h-10" />
                          </FormControl>
                          <Input
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                        <FormDescription>
                          Color used for the footer background
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="fontSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Font Size: {field.value}pt</FormLabel>
                        <FormControl>
                          <Slider
                            min={8}
                            max={16}
                            step={0.5}
                            value={[field.value]}
                            onValueChange={(values) => field.onChange(values[0])}
                          />
                        </FormControl>
                        <FormDescription>
                          Base font size for PDF text (8-16pt)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="pageNumbering"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Page Numbering</FormLabel>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="images">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <FormLabel>Header Image</FormLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={(e) => handleFileChange(e, setHeaderImage, setHeaderImagePreview)}
                          className="flex-1"
                        />
                        <FileImage className="h-4 w-4" />
                      </div>
                      {headerImagePreview && (
                        <div className="relative">
                          <img
                            src={headerImagePreview}
                            alt="Header preview"
                            className="w-full h-20 object-contain border rounded-md"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => handleRemoveImage('header', setHeaderImagePreview)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <FormLabel>Footer Image</FormLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={(e) => handleFileChange(e, setFooterImage, setFooterImagePreview)}
                          className="flex-1"
                        />
                        <FileImage className="h-4 w-4" />
                      </div>
                      {footerImagePreview && (
                        <div className="relative">
                          <img
                            src={footerImagePreview}
                            alt="Footer preview"
                            className="w-full h-20 object-contain border rounded-md"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => handleRemoveImage('footer', setFooterImagePreview)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <FormLabel>Logo Image</FormLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={(e) => handleFileChange(e, setLogoImage, setLogoImagePreview)}
                          className="flex-1"
                        />
                        <FileImage className="h-4 w-4" />
                      </div>
                      {logoImagePreview && (
                        <div className="relative">
                          <img
                            src={logoImagePreview}
                            alt="Logo preview"
                            className="w-full h-20 object-contain border rounded-md"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => handleRemoveImage('logo', setLogoImagePreview)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    onClick={handleUploadImages}
                    disabled={isUploading || (!headerImage && !footerImage && !logoImage)}
                    className="mt-4"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Images
                      </>
                    )}
                  </Button>
                  
                  {(headerImagePreview || footerImagePreview) && (
                    <div className="mt-6 space-y-4">
                      <h3 className="text-md font-medium">Image Size Settings</h3>
                      
                      {headerImagePreview && (
                        <FormField
                          control={form.control}
                          name="headerHeight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Header Height: {field.value}px</FormLabel>
                              <FormControl>
                                <Slider
                                  min={20}
                                  max={200}
                                  step={5}
                                  value={[field.value]}
                                  onValueChange={(values) => field.onChange(values[0])}
                                />
                              </FormControl>
                              <FormDescription>
                                Adjust the height of the header image (20-200px)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      
                      {footerImagePreview && (
                        <FormField
                          control={form.control}
                          name="footerHeight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Footer Height: {field.value}px</FormLabel>
                              <FormControl>
                                <Slider
                                  min={20}
                                  max={200}
                                  step={5}
                                  value={[field.value]}
                                  onValueChange={(values) => field.onChange(values[0])}
                                />
                              </FormControl>
                              <FormDescription>
                                Adjust the height of the footer image (20-200px)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="layout">
                <div className="space-y-6">
                  <h3 className="text-md font-medium">Margin Settings</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="marginTop"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Top Margin: {field.value}mm</FormLabel>
                          <FormControl>
                            <Slider
                              min={10}
                              max={50}
                              step={1}
                              value={[field.value]}
                              onValueChange={(values) => field.onChange(values[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Space between the top of the page and content (10-50mm)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="marginBottom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bottom Margin: {field.value}mm</FormLabel>
                          <FormControl>
                            <Slider
                              min={10}
                              max={50}
                              step={1}
                              value={[field.value]}
                              onValueChange={(values) => field.onChange(values[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Space between the bottom of the page and content (10-50mm)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="marginLeft"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Left Margin: {field.value}mm</FormLabel>
                          <FormControl>
                            <Slider
                              min={15}
                              max={50}
                              step={1}
                              value={[field.value]}
                              onValueChange={(values) => field.onChange(values[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Space between the left edge of the page and content (15-50mm)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="marginRight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Right Margin: {field.value}mm</FormLabel>
                          <FormControl>
                            <Slider
                              min={15}
                              max={50}
                              step={1}
                              value={[field.value]}
                              onValueChange={(values) => field.onChange(values[0])}
                            />
                          </FormControl>
                          <FormDescription>
                            Space between the right edge of the page and content (15-50mm)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="preview">
                <div className="space-y-6">
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg h-96 overflow-auto flex flex-col items-center justify-center">
                    <div className="bg-white rounded-lg shadow-lg w-[595px] h-[842px] scale-75 transform origin-top overflow-hidden">
                      {/* Header */}
                      <div className="w-full" style={{ 
                        backgroundColor: form.watch('headerColor'), 
                        height: `${headerImagePreview ? form.watch('headerHeight') : 100}px` 
                      }}>
                        {headerImagePreview ? (
                          <img
                            src={headerImagePreview}
                            alt="Header"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-white">
                            <h1 className="text-2xl font-bold">{form.watch('headerTitle')}</h1>
                            <h2 className="text-lg">{form.watch('headerSubtitle')}</h2>
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="px-6 py-4 flex-1" style={{
                        minHeight: `calc(842px - ${form.watch('headerHeight') || 100}px - ${form.watch('footerHeight') || 50}px)`,
                        marginTop: `${form.watch('marginTop')}px`,
                        marginBottom: `${form.watch('marginBottom')}px`,
                        marginLeft: `${form.watch('marginLeft')}px`,
                        marginRight: `${form.watch('marginRight')}px`,
                      }}>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 h-full flex items-center justify-center">
                          <p className="text-gray-500 text-center">
                            Content area<br />
                            (Purchase request details will appear here)
                          </p>
                        </div>
                      </div>
                      
                      {/* Footer */}
                      <div 
                        className="w-full absolute bottom-0 px-4 py-2 flex justify-between items-center" 
                        style={{ 
                          backgroundColor: form.watch('footerColor'),
                          height: `${footerImagePreview ? form.watch('footerHeight') : 50}px`,
                          color: 'white'
                        }}
                      >
                        {footerImagePreview ? (
                          <img
                            src={footerImagePreview}
                            alt="Footer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>
                            <span>{form.watch('footerText')}</span>
                            {form.watch('pageNumbering') && (
                              <span>Page 1 of 1</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    onClick={handleDownloadPreview}
                    disabled={isGeneratingPreview}
                  >
                    {isGeneratingPreview ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Preview...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download Preview PDF
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              <div className="flex justify-end">
                <Button type="submit" disabled={saveSettingsMutation.isPending}>
                  {saveSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </CardContent>
      <CardFooter className="border-t pt-4 flex justify-between">
        <p className="text-sm text-gray-500">
          These settings will apply to all PDF documents generated by the system.
        </p>
      </CardFooter>
    </Card>
  );
}