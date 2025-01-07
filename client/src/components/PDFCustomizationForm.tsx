import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const pdfSettingsSchema = z.object({
  headerTitle: z.string().min(1, "Header title is required"),
  headerSubtitle: z.string().optional(),
  headerColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  footerText: z.string().min(1, "Footer text is required"),
  footerColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  companyLogo: z.string().optional(),
  pageNumbering: z.boolean().default(true),
  watermarkText: z.string().optional(),
  watermarkOpacity: z.number().min(0).max(1).default(0.1),
  marginTop: z.number().min(0).default(20),
  marginBottom: z.number().min(0).default(20),
  marginLeft: z.number().min(0).default(25),
  marginRight: z.number().min(0).default(25),
  fontSize: z.number().min(8).max(16).default(11),
});

type PDFSettings = z.infer<typeof pdfSettingsSchema>;

export function PDFCustomizationForm() {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<PDFSettings>({
    resolver: zodResolver(pdfSettingsSchema),
    defaultValues: {
      headerTitle: "EVENTS & ENTERTAINMENT ENTERPRISES",
      headerSubtitle: "PURCHASE REQUEST",
      headerColor: "#1a365d",
      footerText: "ALL RIGHTS RESERVED BY E3",
      footerColor: "#1a365d",
      pageNumbering: true,
      watermarkOpacity: 0.1,
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 25,
      marginRight: 25,
      fontSize: 11,
    },
  });

  const { data: currentSettings } = useQuery({
    queryKey: ["/api/pdf-settings"],
  });

  const { mutate: savePDFSettings, isPending } = useMutation({
    mutationFn: async (data: PDFSettings) => {
      const response = await fetch("/api/pdf-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save PDF settings");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "PDF settings saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: PDFSettings) => {
    try {
      // Use Deepseek API to validate and enhance the settings
      const enhancedSettings = await fetch('/api/enhance-pdf-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json());

      savePDFSettings(enhancedSettings);
    } catch (error) {
      console.error('Error enhancing settings:', error);
      // Fallback to original settings if enhancement fails
      savePDFSettings(data);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>PDF Template Settings</CardTitle>
        <CardDescription>Customize the appearance of your PDF exports</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">Basic Settings</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <TabsContent value="basic">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
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

                    <FormField
                      control={form.control}
                      name="headerSubtitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Header Subtitle</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
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
                            <Input type="color" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="footerText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Footer Text</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
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
                            <Input type="color" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="watermarkText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Watermark Text</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="watermarkOpacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Watermark Opacity</FormLabel>
                          <FormControl>
                            <Input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="pageNumbering"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Show Page Numbers</FormLabel>
                          </div>
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="ml-2"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Alert>
                      <AlertDescription>
                        Advanced settings allow you to customize the appearance of your PDF documents.
                        Changes will apply to all newly generated PDFs.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview">
                <div className="border rounded-lg p-4">
                  <div className="aspect-[1/1.4142] bg-white shadow-lg relative">
                    {/* Preview content will be implemented */}
                    <div className="pdf-container">
                      <div 
                        className="pdf-header"
                        style={{ 
                          backgroundColor: `${form.watch('headerColor')}10`,
                          borderColor: form.watch('headerColor')
                        }}
                      >
                        <h1 className="text-2xl font-bold" style={{ color: form.watch('headerColor') }}>
                          {form.watch('headerTitle')}
                        </h1>
                        <h2 className="text-xl mt-2">
                          {form.watch('headerSubtitle')}
                        </h2>
                      </div>

                      <div className="pdf-content">
                        {form.watch('watermarkText') && (
                          <div 
                            className="pdf-watermark"
                            style={{ opacity: form.watch('watermarkOpacity') }}
                          >
                            {form.watch('watermarkText')}
                          </div>
                        )}
                        <p className="text-sm text-gray-600">Sample content will appear here...</p>
                      </div>

                      <div 
                        className="pdf-footer"
                        style={{ 
                          backgroundColor: `${form.watch('footerColor')}10`,
                          borderColor: form.watch('footerColor')
                        }}
                      >
                        <p className="text-sm" style={{ color: form.watch('footerColor') }}>
                          {form.watch('footerText')}
                        </p>
                        {form.watch('pageNumbering') && (
                          <div className="text-sm text-gray-500">Page 1</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <div className="flex justify-end mt-6">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save PDF Settings"}
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </CardContent>
    </Card>
  );
}