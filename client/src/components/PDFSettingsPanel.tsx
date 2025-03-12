import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HexColorPicker } from "react-colorful";
import { Loader2, Upload, FileImage, CheckCircle, AlertCircle } from "lucide-react";
import { FileUploadMultiple } from "@/components/FileUploadMultiple";

// Define schema for PDF settings
const pdfSettingsSchema = z.object({
  // Header settings
  headerTitle: z.string().min(1, "Header title is required"),
  headerSubtitle: z.string().optional(),
  headerColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Must be a valid hex color"),
  headerHeight: z.number().min(0).max(150).optional().default(100),
  headerImage: z.string().optional(),
  
  // Footer settings
  footerText: z.string().optional(),
  footerColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Must be a valid hex color"),
  footerHeight: z.number().min(0).max(100).optional().default(50),
  footerImage: z.string().optional(),
  
  // Page settings
  marginTop: z.number().min(0).max(100).default(20),
  marginBottom: z.number().min(0).max(100).default(20),
  marginLeft: z.number().min(0).max(100).default(25),
  marginRight: z.number().min(0).max(100).default(25),
  fontSize: z.number().min(8).max(16).default(11),
  
  // Display controls
  pageNumbering: z.boolean().default(true),
  watermarkOpacity: z.number().min(0).max(100).default(10),
  logo: z.string().optional(),
  loginLogo: z.string().optional(),
  
  // Content settings - client-side only
  showLogo: z.boolean().default(true),
  showDates: z.boolean().default(true),
  showPurposeInfo: z.boolean().default(true),
  showVendorDetails: z.boolean().default(true),
  showItems: z.boolean().default(true),
  showApprovals: z.boolean().default(true),
  showAttachments: z.boolean().default(true),
  showAuditInfo: z.boolean().default(false),
  fontFamily: z.string().default("Arial"),
});

type PDFSettings = z.infer<typeof pdfSettingsSchema>;

export default function PDFSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("general");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");

  // Fetch existing PDF settings
  const { data: pdfSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/pdf/print-settings"],
    queryFn: async () => {
      const response = await fetch("/api/pdf/print-settings", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch PDF settings");
      return response.json();
    },
  });

  // Setup form with default values
  const form = useForm<PDFSettings>({
    resolver: zodResolver(pdfSettingsSchema),
    defaultValues: {
      // Header settings
      headerTitle: "Purchase Request",
      headerSubtitle: "",
      headerColor: "#7156a2",
      headerHeight: 100,
      headerImage: "",
      
      // Footer settings
      footerText: "Confidential - For internal use only",
      footerColor: "#2f2f2f",
      footerHeight: 50,
      footerImage: "",
      
      // Page settings
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 25,
      marginRight: 25,
      fontSize: 11,
      
      // Display controls
      pageNumbering: true,
      watermarkOpacity: 10,
      logo: "",
      loginLogo: "",
      
      // Content settings
      showLogo: true,
      showDates: true,
      showPurposeInfo: true,
      showVendorDetails: true,
      showItems: true,
      showApprovals: true,
      showAttachments: true,
      showAuditInfo: false,
      fontFamily: "Arial",
    },
  });

  // Update form when settings are loaded
  React.useEffect(() => {
    if (pdfSettings) {
      form.reset({
        // Header settings
        headerTitle: pdfSettings.headerTitle || "Purchase Request",
        headerSubtitle: pdfSettings.headerSubtitle || "",
        headerColor: pdfSettings.headerColor || "#7156a2",
        headerHeight: pdfSettings.headerHeight || 100,
        headerImage: pdfSettings.headerImage || "",
        
        // Footer settings
        footerText: pdfSettings.footerText || "Confidential - For internal use only",
        footerColor: pdfSettings.footerColor || "#2f2f2f",
        footerHeight: pdfSettings.footerHeight || 50,
        footerImage: pdfSettings.footerImage || "",
        
        // Page settings
        marginTop: pdfSettings.marginTop || 20,
        marginBottom: pdfSettings.marginBottom || 20,
        marginLeft: pdfSettings.marginLeft || 25,
        marginRight: pdfSettings.marginRight || 25,
        fontSize: pdfSettings.fontSize || 11,
        
        // Display controls
        pageNumbering: pdfSettings.pageNumbering ?? true,
        watermarkOpacity: pdfSettings.watermarkOpacity || 10,
        logo: pdfSettings.logo || "",
        loginLogo: pdfSettings.loginLogo || "",
        
        // Content settings - client-side only
        showLogo: pdfSettings.showLogo ?? true,
        showDates: pdfSettings.showDates ?? true,
        showPurposeInfo: pdfSettings.showPurposeInfo ?? true,
        showVendorDetails: pdfSettings.showVendorDetails ?? true,
        showItems: pdfSettings.showItems ?? true,
        showApprovals: pdfSettings.showApprovals ?? true,
        showAttachments: pdfSettings.showAttachments ?? true,
        showAuditInfo: pdfSettings.showAuditInfo ?? false,
        fontFamily: pdfSettings.fontFamily || "Arial",
      });
    }
  }, [pdfSettings, form]);

  // Save PDF settings mutation
  const saveSettings = useMutation({
    mutationFn: async (data: PDFSettings) => {
      const response = await fetch("/api/pdf/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to save PDF settings");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdf/print-settings"] });
      toast({
        title: "Success",
        description: "PDF settings saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload logo mutation
  const uploadLogo = useMutation({
    mutationFn: async (fileData: FormData) => {
      setUploadStatus("uploading");
      const response = await fetch("/api/pdf/upload-images", {
        method: "POST",
        body: fileData,
        credentials: "include",
      });

      if (!response.ok) {
        setUploadStatus("error");
        throw new Error("Failed to upload images");
      }

      setUploadStatus("success");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdf/print-settings"] });
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
      setFiles([]);
      setTimeout(() => {
        setUploadStatus("idle");
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setUploadStatus("error");
      setTimeout(() => {
        setUploadStatus("idle");
      }, 3000);
    },
  });

  // State for login logo files
  const [loginLogoFiles, setLoginLogoFiles] = useState<File[]>([]);
  const [loginLogoUploadStatus, setLoginLogoUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");

  // Handle file upload
  const handleFileUpload = () => {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("type", "logo");

    uploadLogo.mutate(formData);
  };
  
  // Upload login logo mutation
  const uploadLoginLogo = useMutation({
    mutationFn: async (fileData: FormData) => {
      setLoginLogoUploadStatus("uploading");
      const response = await fetch("/api/pdf/upload-images", {
        method: "POST",
        body: fileData,
        credentials: "include",
      });

      if (!response.ok) {
        setLoginLogoUploadStatus("error");
        throw new Error("Failed to upload login logo");
      }

      setLoginLogoUploadStatus("success");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdf/print-settings"] });
      toast({
        title: "Success",
        description: "Login logo uploaded successfully",
      });
      setLoginLogoFiles([]);
      setTimeout(() => {
        setLoginLogoUploadStatus("idle");
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoginLogoUploadStatus("error");
      setTimeout(() => {
        setLoginLogoUploadStatus("idle");
      }, 3000);
    },
  });
  
  // Handle login logo upload
  const handleLoginLogoUpload = () => {
    if (loginLogoFiles.length === 0) return;

    const formData = new FormData();
    loginLogoFiles.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("type", "loginLogo");

    uploadLoginLogo.mutate(formData);
  };
  
  // Handle login logo file change
  const handleLoginLogoFileChange = (newFiles: File[]) => {
    setLoginLogoFiles(newFiles);
  };

  // Handle form submission
  const onSubmit = form.handleSubmit((data) => {
    saveSettings.mutate(data);
  });

  // Handle file change
  const handleFileChange = (newFiles: File[]) => {
    setFiles(newFiles);
  };

  if (isLoadingSettings) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PDF Document Settings</CardTitle>
        <CardDescription>
          Customize how your PDF documents appear when exported
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="content">Content Elements</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-6">
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
                        This title will appear in the header of your PDF documents.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                            <SelectValue placeholder="Select a font" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Arial">Arial</SelectItem>
                          <SelectItem value="Helvetica">Helvetica</SelectItem>
                          <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                          <SelectItem value="Courier">Courier</SelectItem>
                          <SelectItem value="Verdana">Verdana</SelectItem>
                          <SelectItem value="Georgia">Georgia</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the font family for all text in the PDF.
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
                        <Input placeholder="Enter footer text" {...field} />
                      </FormControl>
                      <FormDescription>
                        Custom text displayed in the footer of each page.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-8">
                  <div className="mt-6">
                    <h3 className="text-lg font-medium">Logo Upload</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Upload your company logo for the PDF header
                    </p>
                    <div className="flex flex-col space-y-4">
                      <FileUploadMultiple
                        maxFiles={1}
                        maxSizeBytes={2 * 1024 * 1024} // 2MB
                        accept="image/jpeg,image/png,image/svg+xml"
                        onFilesSelected={handleFileChange}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={handleFileUpload}
                          disabled={files.length === 0 || uploadStatus === "uploading"}
                          className="mt-2"
                        >
                          {uploadStatus === "uploading" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : uploadStatus === "success" ? (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Uploaded
                            </>
                          ) : uploadStatus === "error" ? (
                            <>
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Failed
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Logo
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium">Login Page Logo</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Upload a custom logo to display on the login page
                    </p>
                    <div className="flex flex-col space-y-4">
                      <FileUploadMultiple
                        maxFiles={1}
                        maxSizeBytes={2 * 1024 * 1024} // 2MB
                        accept="image/jpeg,image/png,image/svg+xml"
                        onFilesSelected={handleLoginLogoFileChange}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={handleLoginLogoUpload}
                          disabled={loginLogoFiles.length === 0 || loginLogoUploadStatus === "uploading"}
                          className="mt-2"
                        >
                          {loginLogoUploadStatus === "uploading" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : loginLogoUploadStatus === "success" ? (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Uploaded
                            </>
                          ) : loginLogoUploadStatus === "error" ? (
                            <>
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Failed
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Login Logo
                            </>
                          )}
                        </Button>
                      </div>
                      {pdfSettings?.loginLogo && (
                        <div className="mt-2 flex items-center space-x-2">
                          <FileImage className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Current login logo is set</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button type="submit" className="mt-4">
                  {saveSettings.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="appearance">
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="headerColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Color</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              onClick={() => setActivePicker("headerColor")}
                            />
                            <div
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border cursor-pointer"
                              style={{ backgroundColor: field.value }}
                              onClick={() => setActivePicker("headerColor")}
                            />
                            {activePicker === "headerColor" && (
                              <div className="absolute z-10 mt-2">
                                <div
                                  className="fixed inset-0"
                                  onClick={() => setActivePicker(null)}
                                />
                                <HexColorPicker
                                  color={field.value}
                                  onChange={field.onChange}
                                />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Color for the PDF header.
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
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              onClick={() => setActivePicker("footerColor")}
                            />
                            <div
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border cursor-pointer"
                              style={{ backgroundColor: field.value }}
                              onClick={() => setActivePicker("footerColor")}
                            />
                            {activePicker === "footerColor" && (
                              <div className="absolute z-10 mt-2">
                                <div
                                  className="fixed inset-0"
                                  onClick={() => setActivePicker(null)}
                                />
                                <HexColorPicker
                                  color={field.value}
                                  onChange={field.onChange}
                                />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Color for the PDF footer.
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
                        <FormLabel>Watermark Opacity (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Opacity level for watermarks (0-100%).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="templateStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Style</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select template style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="modern">Modern</SelectItem>
                            <SelectItem value="classic">Classic</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Overall style of the PDF document.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Height of the header section in millimeters.
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
                        <FormLabel>Footer Height (mm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Height of the footer section in millimeters.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="mt-4">
                  {saveSettings.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="content">
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="showLogo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Company Logo</FormLabel>
                          <FormDescription>
                            Display company logo in the header.
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
                    name="showDates"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Request Dates</FormLabel>
                          <FormDescription>
                            Display creation and processing dates.
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Purpose Information</FormLabel>
                          <FormDescription>
                            Display purpose and sub-purpose details.
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Vendor Details</FormLabel>
                          <FormDescription>
                            Display vendor information.
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Item Details</FormLabel>
                          <FormDescription>
                            Display item list and costs.
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Approval Information</FormLabel>
                          <FormDescription>
                            Display approval flow details.
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Attachments List</FormLabel>
                          <FormDescription>
                            Display list of attached files.
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Audit Information</FormLabel>
                          <FormDescription>
                            Display audit trail and timestamps.
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

                <Button type="submit" className="mt-4">
                  {saveSettings.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}