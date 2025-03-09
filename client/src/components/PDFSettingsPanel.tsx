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
  companyName: z.string().min(1, "Company name is required"),
  headerHeight: z.number().min(0).max(100).optional(),
  footerHeight: z.number().min(0).max(100).optional(),
  primaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Must be a valid hex color"),
  secondaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Must be a valid hex color"),
  accentColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Must be a valid hex color"),
  headerStyle: z.enum(["modern", "classic", "minimal"]).optional(),
  footerText: z.string().optional(),
  showLogo: z.boolean().default(true),
  showDates: z.boolean().default(true),
  showPurposeInfo: z.boolean().default(true),
  showVendorDetails: z.boolean().default(true),
  showItems: z.boolean().default(true),
  showApprovals: z.boolean().default(true),
  showAttachments: z.boolean().default(true),
  showAuditInfo: z.boolean().default(false),
  fontFamily: z.string().optional(),
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
      companyName: "",
      primaryColor: "#7156a2",
      secondaryColor: "#2f2f2f",
      accentColor: "#9c86c3",
      headerStyle: "modern",
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
        companyName: pdfSettings.companyName || "",
        primaryColor: pdfSettings.primaryColor || "#7156a2",
        secondaryColor: pdfSettings.secondaryColor || "#2f2f2f",
        accentColor: pdfSettings.accentColor || "#9c86c3",
        headerStyle: pdfSettings.headerStyle || "modern",
        footerText: pdfSettings.footerText || "",
        showLogo: pdfSettings.showLogo ?? true,
        headerHeight: pdfSettings.headerHeight,
        footerHeight: pdfSettings.footerHeight,
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
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter company name" {...field} />
                      </FormControl>
                      <FormDescription>
                        This name will appear in the header of your PDF documents.
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

                <div className="space-y-4">
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
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Color</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              onClick={() => setActivePicker("primaryColor")}
                            />
                            <div
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border cursor-pointer"
                              style={{ backgroundColor: field.value }}
                              onClick={() => setActivePicker("primaryColor")}
                            />
                            {activePicker === "primaryColor" && (
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
                          Primary color for headers and titles.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="secondaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Color</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              onClick={() => setActivePicker("secondaryColor")}
                            />
                            <div
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border cursor-pointer"
                              style={{ backgroundColor: field.value }}
                              onClick={() => setActivePicker("secondaryColor")}
                            />
                            {activePicker === "secondaryColor" && (
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
                          Secondary color for backgrounds and sections.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accentColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accent Color</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              onClick={() => setActivePicker("accentColor")}
                            />
                            <div
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border cursor-pointer"
                              style={{ backgroundColor: field.value }}
                              onClick={() => setActivePicker("accentColor")}
                            />
                            {activePicker === "accentColor" && (
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
                          Accent color for highlights and buttons.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="headerStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Style</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select header style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="modern">Modern</SelectItem>
                            <SelectItem value="classic">Classic</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Style of the PDF document header.
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