import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import BrandingPreview from "./BrandingPreview";

interface CompanyBrandingFormProps {
  onSuccess?: () => void;
}

export default function CompanyBrandingForm({ onSuccess }: CompanyBrandingFormProps) {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    headerStyle: "modern" as "modern" | "classic" | "minimal",
    primaryColor: "#71569E",
    secondaryColor: "#F0F0FA",
    accentColor: "#191160",
    footerText: "",
  });

  const { data: branding, isLoading } = useQuery({
    queryKey: ["/api/branding"],
  });

  const updateBranding = useMutation({
    mutationFn: async (formData: FormData) => {
      console.log("Submitting form data:", Object.fromEntries(formData));
      const response = await fetch("/api/branding", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(errorText || 'Failed to update branding');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company branding updated successfully",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update branding settings",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    // Log form data for debugging
    console.log("Form data before submission:");
    for (const [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    updateBranding.mutate(formData);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Logo file size must be less than 5MB",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Error",
          description: "Only JPEG, PNG and SVG files are allowed",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setLogoPreview(base64Data);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                name="companyName"
                defaultValue={branding?.companyName}
                placeholder="Enter company name"
                required
                onChange={(e) => handleInputChange('companyName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Company Logo (Max 5MB)</Label>
              <div className="flex items-center gap-4">
                {(logoPreview || branding?.logo) && (
                  <img
                    src={`data:${branding?.logoMimeType};base64,${logoPreview || branding?.logo}`}
                    alt="Company Logo"
                    className="h-16 w-16 object-contain"
                  />
                )}
                <Input
                  type="file"
                  name="logo"
                  accept="image/jpeg,image/png,image/svg+xml"
                  onChange={handleLogoChange}
                  className="max-w-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Header Style</Label>
                <Select
                  name="headerStyle"
                  defaultValue={branding?.headerStyle || "modern"}
                  onValueChange={(value) => handleInputChange('headerStyle', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Primary Color *</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    name="primaryColor"
                    defaultValue={branding?.primaryColor || "#71569E"}
                    className="w-16"
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                  />
                  <Input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secondary Color *</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    name="secondaryColor"
                    defaultValue={branding?.secondaryColor || "#F0F0FA"}
                    className="w-16"
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                  />
                  <Input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Accent Color *</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    name="accentColor"
                    defaultValue={branding?.accentColor || "#191160"}
                    className="w-16"
                    onChange={(e) => handleInputChange('accentColor', e.target.value)}
                  />
                  <Input
                    type="text"
                    value={formData.accentColor}
                    onChange={(e) => handleInputChange('accentColor', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Footer Text</Label>
              <Input
                name="footerText"
                defaultValue={branding?.footerText}
                placeholder="Enter custom footer text"
                onChange={(e) => handleInputChange('footerText', e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={updateBranding.isPending}
              className="w-full"
            >
              {updateBranding.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Branding Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      <BrandingPreview
        logo={logoPreview || branding?.logo || null}
        logoMimeType={branding?.logoMimeType}
        headerStyle={formData.headerStyle}
        companyName={formData.companyName || branding?.companyName || "Company Name"}
        primaryColor={formData.primaryColor}
        secondaryColor={formData.secondaryColor}
        accentColor={formData.accentColor}
        footerText={formData.footerText || branding?.footerText}
      />
    </div>
  );
}