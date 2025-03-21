import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ChromePicker } from 'react-color';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

// Define schema for PDF settings
const pdfSettingsSchema = z.object({
  // Header settings
  headerTitle: z.string().optional(),
  headerSubtitle: z.string().optional(),
  headerColor: z.string().optional(),
  headerHeight: z.number().min(10).max(100).default(40),
  showLogo: z.boolean().default(true),
  logoPosition: z.enum(['left', 'center', 'right']).default('left'),
  
  // Footer settings
  footerText: z.string().optional(),
  footerColor: z.string().optional(),
  footerHeight: z.number().min(10).max(100).default(30),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().optional(),
  companyWebsite: z.string().optional(),
  
  // Layout settings
  marginTop: z.number().min(0).max(50).default(15),
  marginBottom: z.number().min(0).max(50).default(15),
  marginLeft: z.number().min(0).max(50).default(15),
  marginRight: z.number().min(0).max(50).default(15),
  pageNumbering: z.boolean().default(true),
  fontFamily: z.enum(['helvetica', 'times', 'courier']).default('helvetica'),
  fontSize: z.number().min(6).max(14).default(10),
  
  // Content settings
  showBasicInfo: z.boolean().default(true),
  showRequesterDetails: z.boolean().default(true),
  showDateOfRequest: z.boolean().default(true),
  showPurposeInfo: z.boolean().default(true),
  showVendorDetails: z.boolean().default(true),
  showItems: z.boolean().default(true),
  showApprovals: z.boolean().default(true),
  showAttachments: z.boolean().default(true),
  showAuditInfo: z.boolean().default(false),
  showSignatures: z.boolean().default(true),
  
  // Watermark settings
  useWatermark: z.boolean().default(false),
  watermarkText: z.string().optional(),
  watermarkOpacity: z.number().min(0.1).max(1).default(0.2),
  watermarkPosition: z.enum(['center', 'tile', 'corner']).default('center'),
  watermarkRotation: z.number().min(0).max(90).default(45),
});

type PDFSettingsFormValues = z.infer<typeof pdfSettingsSchema>;

interface PDFSettingsProps {
  onSettingsSaved?: (settings: PDFSettingsFormValues) => void;
}

export default function PDFSettingsPanel({ onSettingsSaved }: PDFSettingsProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [footerImageFile, setFooterImageFile] = useState<File | null>(null);
  const [headerColorPickerOpen, setHeaderColorPickerOpen] = useState(false);
  const [footerColorPickerOpen, setFooterColorPickerOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [footerPreview, setFooterPreview] = useState<string | null>(null);
  const { toast } = useToast();

  // Initialize form with default values
  const form = useForm<PDFSettingsFormValues>({
    resolver: zodResolver(pdfSettingsSchema),
    defaultValues: {
      headerTitle: "EVENTS & ENTERTAINMENT",
      headerSubtitle: "ENTERPRISES",
      headerColor: "#6F2AE6", // E3 purple
      headerHeight: 40,
      showLogo: true,
      logoPosition: "left",
      
      footerText: "Designed By Team E3",
      footerColor: "#1FD3DB", // E3 teal
      footerHeight: 30,
      companyAddress: "Doha, Qatar",
      companyPhone: "+974 XXX XXXXX",
      companyEmail: "info@e3.qa",
      companyWebsite: "www.e3.qa",
      
      marginTop: 15,
      marginBottom: 15,
      marginLeft: 15,
      marginRight: 15,
      pageNumbering: true,
      fontFamily: "helvetica",
      fontSize: 10,
      
      showBasicInfo: true,
      showRequesterDetails: true,
      showDateOfRequest: true,
      showPurposeInfo: true,
      showVendorDetails: true,
      showItems: true,
      showApprovals: true,
      showAttachments: true,
      showAuditInfo: false,
      showSignatures: true,
      
      useWatermark: false,
      watermarkText: "CONFIDENTIAL",
      watermarkOpacity: 0.2,
      watermarkPosition: "center",
      watermarkRotation: 45,
    }
  });

  // Load existing settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/pdf/print-settings');
        if (response.ok) {
          const settings = await response.json();
          
          // Update form with fetched settings
          Object.keys(settings).forEach((key) => {
            if (key in form.getValues()) {
              // @ts-ignore - we're checking if the key exists
              form.setValue(key as keyof PDFSettingsFormValues, settings[key]);
            }
          });
          
          // Handle images/previews if available
          if (settings.headerImage) {
            setLogoPreview(settings.headerImage);
          }
          
          if (settings.footerImage) {
            setFooterPreview(settings.footerImage);
          }
        }
      } catch (error) {
        console.error('Error fetching PDF settings:', error);
        toast({
          title: "Error",
          description: "Failed to load PDF settings. Using default values.",
          variant: "destructive",
        });
      }
    };
    
    fetchSettings();
  }, [form, toast]);

  // Handler for logo file changes
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.includes('image/')) {
        toast({
          title: "Invalid File",
          description: "Please upload an image file for the logo.",
          variant: "destructive",
        });
        return;
      }
      
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler for footer image file changes
  const handleFooterImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.includes('image/')) {
        toast({
          title: "Invalid File",
          description: "Please upload an image file for the footer.",
          variant: "destructive",
        });
        return;
      }
      
      setFooterImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setFooterPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const onSubmit = async (data: PDFSettingsFormValues) => {
    // First, upload the images if any
    try {
      let headerImage = logoPreview;
      let footerImage = footerPreview;
      
      if (logoFile) {
        const formData = new FormData();
        formData.append('files', logoFile);
        
        const logoUploadResponse = await fetch('/api/pdf/upload-images', {
          method: 'POST',
          body: formData,
        });
        
        if (logoUploadResponse.ok) {
          const result = await logoUploadResponse.json();
          if (result.success && result.files && result.files.length > 0) {
            headerImage = result.files[0].fileUrl;
          }
        }
      }
      
      if (footerImageFile) {
        const formData = new FormData();
        formData.append('files', footerImageFile);
        
        const footerUploadResponse = await fetch('/api/pdf/upload-images', {
          method: 'POST',
          body: formData,
        });
        
        if (footerUploadResponse.ok) {
          const result = await footerUploadResponse.json();
          if (result.success && result.files && result.files.length > 0) {
            footerImage = result.files[0].fileUrl;
          }
        }
      }
      
      // Now save the settings
      const saveSettingsResponse = await fetch('/api/pdf/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          headerImage,
          footerImage,
        }),
      });
      
      if (saveSettingsResponse.ok) {
        toast({
          title: "Success",
          description: "PDF settings saved successfully.",
        });
        
        if (onSettingsSaved) {
          onSettingsSaved({
            ...data,
          });
        }
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
    }
  };

  return (
    <div className="pb-10">
      <div className="container mx-auto">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>PDF Template Settings</CardTitle>
            <CardDescription>
              Customize how your purchase request PDFs look and what information they display.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Tabs defaultValue="header" className="w-full">
                  <TabsList className="grid grid-cols-5 mb-4">
                    <TabsTrigger value="header">Header</TabsTrigger>
                    <TabsTrigger value="footer">Footer</TabsTrigger>
                    <TabsTrigger value="layout">Layout</TabsTrigger>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="watermark">Watermark</TabsTrigger>
                  </TabsList>
                  
                  {/* Header Settings */}
                  <TabsContent value="header" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="headerTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Header Title</FormLabel>
                              <FormControl>
                                <Input placeholder="Company name" {...field} />
                              </FormControl>
                              <FormDescription>
                                Primary text displayed in the header
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
                                <Input placeholder="Tagline or department" {...field} />
                              </FormControl>
                              <FormDescription>
                                Secondary text displayed in the header
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
                              <FormControl>
                                <div className="flex items-center space-x-3">
                                  <div
                                    className="h-10 w-10 cursor-pointer rounded-md border"
                                    style={{ backgroundColor: field.value }}
                                    onClick={() => setHeaderColorPickerOpen(!headerColorPickerOpen)}
                                  />
                                  <Input 
                                    value={field.value} 
                                    onChange={field.onChange}
                                    placeholder="#RRGGBB" 
                                  />
                                </div>
                              </FormControl>
                              {headerColorPickerOpen && (
                                <div className="absolute z-10 mt-2">
                                  <div 
                                    className="fixed inset-0" 
                                    onClick={() => setHeaderColorPickerOpen(false)}
                                  />
                                  <ChromePicker
                                    color={field.value}
                                    onChange={(color) => field.onChange(color.hex)}
                                  />
                                </div>
                              )}
                              <FormDescription>
                                Color used for header elements
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
                              <FormLabel>Header Height (mm): {field.value}</FormLabel>
                              <FormControl>
                                <Slider
                                  min={10}
                                  max={100}
                                  step={1}
                                  defaultValue={[field.value]}
                                  onValueChange={(vals) => field.onChange(vals[0])}
                                />
                              </FormControl>
                              <FormDescription>
                                Set the height of the header section
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="showLogo"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Show Logo</FormLabel>
                                <FormDescription>
                                  Display company logo in the header
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
                        
                        <FormField
                          control={form.control}
                          name="logoPosition"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Logo Position</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select logo position" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="left">Left</SelectItem>
                                  <SelectItem value="center">Center</SelectItem>
                                  <SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Position of the logo in the header
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormItem>
                          <FormLabel>Upload Logo</FormLabel>
                          <FormControl>
                            <Input type="file" onChange={handleLogoChange} accept="image/*" />
                          </FormControl>
                          <FormDescription>
                            Upload your company logo (PNG, JPG, SVG formats)
                          </FormDescription>
                        </FormItem>
                        
                        {logoPreview && (
                          <div className="mt-4">
                            <Label>Logo Preview</Label>
                            <div className="mt-2 border rounded-md p-2 max-w-xs overflow-hidden">
                              <img
                                src={logoPreview}
                                alt="Logo preview"
                                className="max-h-24 max-w-full object-contain"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Footer Settings */}
                  <TabsContent value="footer" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="footerText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Footer Text</FormLabel>
                              <FormControl>
                                <Input placeholder="Copyright information" {...field} />
                              </FormControl>
                              <FormDescription>
                                Text displayed at the bottom of each page
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <h3 className="text-lg font-medium mt-6">Company Information</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          This information may appear in headers, footers, or other sections of your PDF
                        </p>
                        
                        <FormField
                          control={form.control}
                          name="companyAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Address</FormLabel>
                              <FormControl>
                                <Input placeholder="Company address" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="companyPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="Phone number" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="companyEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Email</FormLabel>
                              <FormControl>
                                <Input placeholder="Email address" {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="companyWebsite"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Website</FormLabel>
                              <FormControl>
                                <Input placeholder="Website URL" {...field} value={field.value || ''} />
                              </FormControl>
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
                              <FormControl>
                                <div className="flex items-center space-x-3">
                                  <div
                                    className="h-10 w-10 cursor-pointer rounded-md border"
                                    style={{ backgroundColor: field.value }}
                                    onClick={() => setFooterColorPickerOpen(!footerColorPickerOpen)}
                                  />
                                  <Input 
                                    value={field.value} 
                                    onChange={field.onChange}
                                    placeholder="#RRGGBB" 
                                  />
                                </div>
                              </FormControl>
                              {footerColorPickerOpen && (
                                <div className="absolute z-10 mt-2">
                                  <div 
                                    className="fixed inset-0" 
                                    onClick={() => setFooterColorPickerOpen(false)} 
                                  />
                                  <ChromePicker
                                    color={field.value}
                                    onChange={(color) => field.onChange(color.hex)}
                                  />
                                </div>
                              )}
                              <FormDescription>
                                Color used for footer elements
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
                              <FormLabel>Footer Height (mm): {field.value}</FormLabel>
                              <FormControl>
                                <Slider
                                  min={10}
                                  max={100}
                                  step={1}
                                  defaultValue={[field.value]}
                                  onValueChange={(vals) => field.onChange(vals[0])}
                                />
                              </FormControl>
                              <FormDescription>
                                Set the height of the footer section
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormItem>
                          <FormLabel>Upload Footer Image</FormLabel>
                          <FormControl>
                            <Input 
                              type="file" 
                              onChange={handleFooterImageChange} 
                              accept="image/*" 
                            />
                          </FormControl>
                          <FormDescription>
                            Upload a custom footer image (PNG, JPG formats)
                          </FormDescription>
                        </FormItem>
                        
                        {footerPreview && (
                          <div className="mt-4">
                            <Label>Footer Image Preview</Label>
                            <div className="mt-2 border rounded-md p-2 max-w-xs overflow-hidden">
                              <img
                                src={footerPreview}
                                alt="Footer preview"
                                className="max-h-24 max-w-full object-contain"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <div className="border p-4 rounded-md bg-muted/20">
                          <h3 className="text-lg font-medium">Preview</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            Here's how your footer will look in the PDF
                          </p>
                          
                          <div className="mt-4 border rounded-lg p-3 bg-white">
                            <div className="flex justify-between items-start">
                              <div className="text-xs text-muted-foreground">
                                <p>{form.watch('footerText') || 'Footer Text'}</p>
                              </div>
                              <div className="text-xs text-right">
                                <p className="font-medium">Page 1 of 1</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Layout Settings */}
                  <TabsContent value="layout" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Margins (mm)</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="marginTop"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Top Margin: {field.value}mm</FormLabel>
                                <FormControl>
                                  <Slider
                                    min={0}
                                    max={50}
                                    step={1}
                                    defaultValue={[field.value]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
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
                                <FormLabel>Bottom Margin: {field.value}mm</FormLabel>
                                <FormControl>
                                  <Slider
                                    min={0}
                                    max={50}
                                    step={1}
                                    defaultValue={[field.value]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
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
                                <FormLabel>Left Margin: {field.value}mm</FormLabel>
                                <FormControl>
                                  <Slider
                                    min={0}
                                    max={50}
                                    step={1}
                                    defaultValue={[field.value]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
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
                                <FormLabel>Right Margin: {field.value}mm</FormLabel>
                                <FormControl>
                                  <Slider
                                    min={0}
                                    max={50}
                                    step={1}
                                    defaultValue={[field.value]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Typography</h3>
                        <FormField
                          control={form.control}
                          name="fontFamily"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Font Family</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select font" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="helvetica">Helvetica</SelectItem>
                                  <SelectItem value="times">Times</SelectItem>
                                  <SelectItem value="courier">Courier</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Main font used in the document
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
                              <FormLabel>Base Font Size: {field.value}pt</FormLabel>
                              <FormControl>
                                <Slider
                                  min={6}
                                  max={14}
                                  step={0.5}
                                  defaultValue={[field.value]}
                                  onValueChange={(vals) => field.onChange(vals[0])}
                                />
                              </FormControl>
                              <FormDescription>
                                Base font size for regular text
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="pageNumbering"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-6">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Page Numbering</FormLabel>
                                <FormDescription>
                                  Show page numbers at the bottom of each page
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
                    </div>
                  </TabsContent>
                  
                  {/* Content Settings */}
                  <TabsContent value="content" className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Sections Visibility</h3>
                        <p className="text-sm text-muted-foreground">
                          Control which sections appear in the PDF document
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="showBasicInfo"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Basic Information</FormLabel>
                                  <FormDescription className="text-xs">
                                    Title, status, description
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
                          
                          <FormField
                            control={form.control}
                            name="showRequesterDetails"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Requester Details</FormLabel>
                                  <FormDescription className="text-xs">
                                    Name, department, contact
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
                          
                          <FormField
                            control={form.control}
                            name="showDateOfRequest"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Request Date</FormLabel>
                                  <FormDescription className="text-xs">
                                    Creation and submission dates
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
                          
                          <FormField
                            control={form.control}
                            name="showPurposeInfo"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Purpose Information</FormLabel>
                                  <FormDescription className="text-xs">
                                    Purpose type and sub-purpose
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
                          
                          <FormField
                            control={form.control}
                            name="showVendorDetails"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Vendor Details</FormLabel>
                                  <FormDescription className="text-xs">
                                    Vendor name, contact, address
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
                          
                          <FormField
                            control={form.control}
                            name="showItems"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Items Section</FormLabel>
                                  <FormDescription className="text-xs">
                                    Items list with costs
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
                          
                          <FormField
                            control={form.control}
                            name="showApprovals"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Approval Status</FormLabel>
                                  <FormDescription className="text-xs">
                                    Approval chain and status
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
                          
                          <FormField
                            control={form.control}
                            name="showAttachments"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Attachments List</FormLabel>
                                  <FormDescription className="text-xs">
                                    Documents attached to request
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
                          
                          <FormField
                            control={form.control}
                            name="showSignatures"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Signature Lines</FormLabel>
                                  <FormDescription className="text-xs">
                                    For physical signature spaces
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
                          
                          <FormField
                            control={form.control}
                            name="showAuditInfo"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Audit Information</FormLabel>
                                  <FormDescription className="text-xs">
                                    System audit trail details
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
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Watermark Settings */}
                  <TabsContent value="watermark" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="useWatermark"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Enable Watermark</FormLabel>
                                <FormDescription>
                                  Add watermark text across all pages
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
                        
                        {form.watch("useWatermark") && (
                          <>
                            <FormField
                              control={form.control}
                              name="watermarkText"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Watermark Text</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., CONFIDENTIAL" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    Text that will appear as watermark
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="watermarkOpacity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Opacity: {(field.value * 100).toFixed(0)}%</FormLabel>
                                  <FormControl>
                                    <Slider
                                      min={0.1}
                                      max={1}
                                      step={0.05}
                                      defaultValue={[field.value]}
                                      onValueChange={(vals) => field.onChange(vals[0])}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Adjust watermark transparency
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div className="flex flex-col space-y-2">
                              <Label>Watermark Position</Label>
                              <Select
                                value={form.watch("watermarkPosition") as string || "center"}
                                onValueChange={(value) => form.setValue("watermarkPosition", value as "center" | "tile" | "corner")}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select position" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="center">Center</SelectItem>
                                  <SelectItem value="tile">Repeated Tile</SelectItem>
                                  <SelectItem value="corner">Corners Only</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-sm text-muted-foreground">
                                How the watermark is positioned on the page
                              </p>
                            </div>
                            
                            <div className="flex flex-col space-y-2">
                              <Label>Watermark Angle: {form.watch("watermarkRotation") || 45}°</Label>
                              <Slider
                                min={0}
                                max={90}
                                step={5}
                                defaultValue={[form.watch("watermarkRotation") as number || 45]}
                                onValueChange={(vals) => form.setValue("watermarkRotation", vals[0])}
                              />
                              <p className="text-sm text-muted-foreground">
                                Rotation angle for the watermark text
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <div className="h-64 border rounded-md flex items-center justify-center bg-white">
                          {form.watch("useWatermark") && (
                            <div 
                              className="relative w-full h-full flex items-center justify-center overflow-hidden"
                              style={{ 
                                backgroundColor: "#f8f8f8",
                                border: "1px solid #e0e0e0"
                              }}
                            >
                              <div
                                className="absolute select-none"
                                style={{
                                  opacity: form.watch("watermarkOpacity") || 0.2,
                                  fontSize: "2rem",
                                  fontFamily: "Arial",
                                  color: "#00000077",
                                  fontWeight: "bold",
                                  transform: `rotate(${form.watch("watermarkRotation") || 45}deg)`,
                                  pointerEvents: "none",
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {form.watch("watermarkText") || "CONFIDENTIAL"}
                              </div>
                              <div className="z-10 px-4 py-2 bg-white/90 rounded border">
                                Watermark Preview
                              </div>
                            </div>
                          )}
                          {!form.watch("useWatermark") && (
                            <p className="text-muted-foreground">
                              Enable watermark to see preview
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => form.reset()}
                  >
                    Reset to Defaults
                  </Button>
                  <Button type="submit">Save Settings</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}