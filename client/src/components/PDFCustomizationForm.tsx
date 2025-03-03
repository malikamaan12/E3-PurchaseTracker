import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { SketchPicker } from "react-color";
import { Loader2, Save } from "lucide-react";

// Define schema for PDF settings
const pdfSettingsSchema = z.object({
  headerTitle: z.string().min(1, "Header title is required"),
  headerSubtitle: z.string().min(1, "Header subtitle is required"),
  headerColor: z.string().regex(/^#([0-9A-Fa-f]{6})$/, "Must be a valid hex color"),
  footerText: z.string().min(1, "Footer text is required"),
  footerColor: z.string().regex(/^#([0-9A-Fa-f]{6})$/, "Must be a valid hex color"),
  pageNumbering: z.boolean(),
  fontSize: z.number().min(8).max(16),
  marginTop: z.number().min(10).max(40),
  marginBottom: z.number().min(10).max(40),
  marginLeft: z.number().min(10).max(40),
  marginRight: z.number().min(10).max(40)
});

type PDFSettings = z.infer<typeof pdfSettingsSchema>;

// Preset colors for color pickers
const presetColors = [
  '#1a365d', // Default dark blue
  '#2B6CB0', // Blue
  '#3182CE', // Medium blue
  '#4299E1', // Light blue
  '#63B3ED', // Sky blue
  '#38A169', // Green
  '#E53E3E', // Red
  '#ED8936', // Orange 
  '#ECC94B', // Yellow
  '#805AD5', // Purple
  '#D53F8C', // Pink
  '#000000'  // Black
];

export function PDFCustomizationForm() {
  const { toast } = useToast();
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  
  // Fetch current settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/pdf/print-settings"],
    queryFn: async () => {
      const response = await fetch("/api/pdf/print-settings");
      if (!response.ok) {
        throw new Error("Failed to fetch PDF settings");
      }
      return response.json();
    }
  });
  
  // Set up form with default values
  const form = useForm<PDFSettings>({
    resolver: zodResolver(pdfSettingsSchema),
    defaultValues: {
      headerTitle: "EVENTS & ENTERTAINMENT ENTERPRISES",
      headerSubtitle: "PURCHASE REQUEST",
      headerColor: "#1a365d",
      footerText: "ALL RIGHTS RESERVED BY E3",
      footerColor: "#1a365d",
      pageNumbering: true,
      fontSize: 11,
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 25,
      marginRight: 25
    }
  });
  
  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      form.reset({
        headerTitle: settings.headerTitle,
        headerSubtitle: settings.headerSubtitle,
        headerColor: settings.headerColor,
        footerText: settings.footerText,
        footerColor: settings.footerColor,
        pageNumbering: settings.pageNumbering,
        fontSize: settings.fontSize || 11,
        marginTop: settings.marginTop || 20,
        marginBottom: settings.marginBottom || 20,
        marginLeft: settings.marginLeft || 25,
        marginRight: settings.marginRight || 25
      });
    }
  }, [settings, form]);
  
  // Handle color picker close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only close if clicking outside of a color picker
      if (colorPickerOpen && !(event.target as Element).closest('.sketch-picker')) {
        setColorPickerOpen(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [colorPickerOpen]);
  
  // Mutation for saving settings
  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: async (data: PDFSettings) => {
      const response = await fetch("/api/pdf/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error("Failed to save PDF settings");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "PDF appearance settings have been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to save settings: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const onSubmit = async (data: PDFSettings) => {
    saveSettings(data);
  };
  
  if (isLoadingSettings) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Header Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3">
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
                  <FormItem className="relative">
                    <FormLabel>Header Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-10 h-10 rounded border cursor-pointer"
                          style={{ backgroundColor: field.value }}
                          onClick={() => setColorPickerOpen(colorPickerOpen === "header" ? null : "header")}
                        />
                        <Input {...field} />
                      </div>
                    </FormControl>
                    {colorPickerOpen === "header" && (
                      <Card className="absolute z-10 mt-1">
                        <CardContent className="p-2">
                          <SketchPicker
                            color={field.value}
                            onChange={(color) => {
                              field.onChange(color.hex);
                            }}
                            disableAlpha={true}
                            presetColors={presetColors}
                          />
                        </CardContent>
                      </Card>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium">Footer Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3">
              <FormField
                control={form.control}
                name="footerText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Footer Text</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="footerColor"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>Footer Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-10 h-10 rounded border cursor-pointer"
                          style={{ backgroundColor: field.value }}
                          onClick={() => setColorPickerOpen(colorPickerOpen === "footer" ? null : "footer")}
                        />
                        <Input {...field} />
                      </div>
                    </FormControl>
                    {colorPickerOpen === "footer" && (
                      <Card className="absolute z-10 mt-1">
                        <CardContent className="p-2">
                          <SketchPicker
                            color={field.value}
                            onChange={(color) => {
                              field.onChange(color.hex);
                            }}
                            disableAlpha={true}
                            presetColors={presetColors}
                          />
                        </CardContent>
                      </Card>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pageNumbering"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <FormLabel>Show Page Numbers</FormLabel>
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
          </div>
          
          <div>
            <h3 className="text-lg font-medium">Page Layout</h3>
            <div className="space-y-6 mt-3">
              <FormField
                control={form.control}
                name="fontSize"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Font Size: {field.value}pt</FormLabel>
                    </div>
                    <FormControl>
                      <Slider
                        min={8}
                        max={16}
                        step={1}
                        defaultValue={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="marginTop"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between">
                        <FormLabel>Top Margin: {field.value}mm</FormLabel>
                      </div>
                      <FormControl>
                        <Slider
                          min={10}
                          max={40}
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
                      <div className="flex justify-between">
                        <FormLabel>Bottom Margin: {field.value}mm</FormLabel>
                      </div>
                      <FormControl>
                        <Slider
                          min={10}
                          max={40}
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
                      <div className="flex justify-between">
                        <FormLabel>Left Margin: {field.value}mm</FormLabel>
                      </div>
                      <FormControl>
                        <Slider
                          min={10}
                          max={40}
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
                      <div className="flex justify-between">
                        <FormLabel>Right Margin: {field.value}mm</FormLabel>
                      </div>
                      <FormControl>
                        <Slider
                          min={10}
                          max={40}
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
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isPending}
            className="flex items-center gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </form>
    </Form>
  );
}