import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { z } from "zod";
import { Loader2, Upload } from "lucide-react";

const brandingFormSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color format"),
  footerText: z.string().min(1, "Footer text is required"),
  headerStyle: z.string().default('modern'),
});

type BrandingFormValues = z.infer<typeof brandingFormSchema>;

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]); // Remove the data:image/jpeg;base64, part
      }
    };
    reader.onerror = error => reject(error);
  });
};

export default function CompanyBrandingForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [footerFile, setFooterFile] = useState<File | null>(null);

  // Fetch existing branding settings
  const { data: brandingSettings, isLoading } = useQuery({
    queryKey: ["/api/branding"],
    queryFn: async () => {
      const response = await fetch("/api/branding", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch branding settings");
      return response.json();
    },
  });

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: {
      companyName: "",
      primaryColor: "#71569E",
      secondaryColor: "#F0F0FA",
      accentColor: "#191160",
      footerText: "Confidential Document",
      headerStyle: "modern",
    },
  });

  // Update form defaults when data is loaded
  useEffect(() => {
    if (brandingSettings) {
      form.reset({
        companyName: brandingSettings.companyName,
        primaryColor: brandingSettings.primaryColor,
        secondaryColor: brandingSettings.secondaryColor,
        accentColor: brandingSettings.accentColor,
        footerText: brandingSettings.footerText,
        headerStyle: brandingSettings.headerStyle || 'modern',
      });
    }
  }, [brandingSettings, form]);

  // Handle file change with proper validation
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      if (file.type === "image/jpeg" || file.type === "image/png") {
        if (file.size <= 5 * 1024 * 1024) { // 5MB limit
          setter(file);
          toast({
            title: "File selected",
            description: `${file.name} has been selected`,
          });
        } else {
          toast({
            title: "Error",
            description: "File size must be less than 5MB",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Please upload a valid JPEG or PNG file",
          variant: "destructive",
        });
      }
    }
  };

  // Update branding mutation with proper file handling
  const updateBranding = useMutation({
    mutationFn: async (values: BrandingFormValues) => {
      // Convert files to base64 if they exist
      const logoBase64 = logoFile ? await fileToBase64(logoFile) : null;
      const headerBase64 = headerFile ? await fileToBase64(headerFile) : null;
      const footerBase64 = footerFile ? await fileToBase64(footerFile) : null;

      const requestData = {
        ...values,
        logo: logoBase64,
        logoMimeType: logoFile?.type,
        headerImageUrl: headerBase64,
        headerImageMimeType: headerFile?.type,
        footerImageUrl: footerBase64,
        footerImageMimeType: footerFile?.type,
      };

      const response = await fetch("/api/branding", {
        method: "POST",
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      toast({
        title: "Success",
        description: "Branding settings updated successfully",
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

  // Form submission handler
  const onSubmit = (values: BrandingFormValues) => {
    updateBranding.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter company name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="primaryColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Color</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input type="color" {...field} className="w-12 h-10 p-1" />
                    <Input {...field} placeholder="#71569E" />
                  </div>
                </FormControl>
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
                  <div className="flex gap-2">
                    <Input type="color" {...field} className="w-12 h-10 p-1" />
                    <Input {...field} placeholder="#F0F0FA" />
                  </div>
                </FormControl>
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
                  <div className="flex gap-2">
                    <Input type="color" {...field} className="w-12 h-10 p-1" />
                    <Input {...field} placeholder="#191160" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormItem>
            <FormLabel>Company Logo</FormLabel>
            <FormControl>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => handleFileChange(e, setLogoFile)}
                  className="flex-1"
                />
                <Upload className="h-4 w-4" />
              </div>
            </FormControl>
            <FormDescription>Upload logo (JPEG/PNG, max 5MB)</FormDescription>
          </FormItem>

          <FormItem>
            <FormLabel>Header Image</FormLabel>
            <FormControl>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => handleFileChange(e, setHeaderFile)}
                  className="flex-1"
                />
                <Upload className="h-4 w-4" />
              </div>
            </FormControl>
            <FormDescription>Upload header image (JPEG/PNG, max 5MB)</FormDescription>
          </FormItem>

          <FormItem>
            <FormLabel>Footer Image</FormLabel>
            <FormControl>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => handleFileChange(e, setFooterFile)}
                  className="flex-1"
                />
                <Upload className="h-4 w-4" />
              </div>
            </FormControl>
            <FormDescription>Upload footer image (JPEG/PNG, max 5MB)</FormDescription>
          </FormItem>
        </div>

        <FormField
          control={form.control}
          name="footerText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Footer Text</FormLabel>
              <FormControl>
                <Input placeholder="Enter footer text" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={updateBranding.isPending}
        >
          {updateBranding.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Updating...
            </>
          ) : (
            "Save Branding Settings"
          )}
        </Button>
      </form>
    </Form>
  );
}