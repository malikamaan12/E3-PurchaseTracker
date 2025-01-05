import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import BrandingPreview from "./BrandingPreview";
import type { CompanyBranding, HeaderConfig, FooterConfig } from "@db/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const defaultHeaderConfig: HeaderConfig = {
  style: "modern",
  textAlignment: "left",
  showLogo: true,
  showDate: true,
  showPageNumber: true,
  customText: "",
  fontSize: 12
};

const defaultFooterConfig: FooterConfig = {
  showLogo: false,
  textAlignment: "center",
  showPageNumber: true,
  showCopyright: true,
  customText: "",
  fontSize: 10
};

interface BrandingManagerProps {
  onSuccess?: () => void;
}

export default function BrandingManager({ onSuccess }: BrandingManagerProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<CompanyBranding>>({
    companyName: "",
    description: "",
    primaryColor: "#71569E",
    secondaryColor: "#F0F0FA",
    accentColor: "#191160",
    fontFamily: "Arial",
    theme: "light" as const,
    headerConfig: {
      ...defaultHeaderConfig,
      customText: ""
    },
    footerConfig: {
      ...defaultFooterConfig,
      customText: ""
    }
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoMimeType, setLogoMimeType] = useState<string | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [headerImageMimeType, setHeaderImageMimeType] = useState<string | null>(null);
  const [footerImagePreview, setFooterImagePreview] = useState<string | null>(null);
  const [footerImageMimeType, setFooterImageMimeType] = useState<string | null>(null);

  const { data: branding } = useQuery({
    queryKey: ["/api/branding"],
    onSuccess: (data) => {
      if (data) {
        setFormData(data);
        if (data.logo) {
          setLogoPreview(data.logo);
          setLogoMimeType(data.logoMimeType || null);
        }
        if (data.headerImage) {
          setHeaderImagePreview(data.headerImage);
          setHeaderImageMimeType(data.headerImageMimeType || null);
        }
        if (data.footerImage) {
          setFooterImagePreview(data.footerImage);
          setFooterImageMimeType(data.footerImageMimeType || null);
        }
      }
    },
  });

  const updateBranding = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/branding", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Branding settings updated successfully",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update branding settings",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'header' | 'footer'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image file size must be less than 5MB",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Error",
          description: "Only JPEG and PNG files are allowed",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];

        switch (type) {
          case 'logo':
            setLogoPreview(base64Data);
            setLogoMimeType(file.type);
            break;
          case 'header':
            setHeaderImagePreview(base64Data);
            setHeaderImageMimeType(file.type);
            break;
          case 'footer':
            setFooterImagePreview(base64Data);
            setFooterImageMimeType(file.type);
            break;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formDataToSend = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          formDataToSend.append(key, JSON.stringify(value));
        } else {
          formDataToSend.append(key, value.toString());
        }
      }
    });

    if (logoPreview) {
      formDataToSend.append('logo', logoPreview);
      if (logoMimeType) formDataToSend.append('logoMimeType', logoMimeType);
    }

    if (headerImagePreview) {
      formDataToSend.append('headerImage', headerImagePreview);
      if (headerImageMimeType) formDataToSend.append('headerImageMimeType', headerImageMimeType);
    }

    if (footerImagePreview) {
      formDataToSend.append('footerImage', footerImagePreview);
      if (footerImageMimeType) formDataToSend.append('footerImageMimeType', footerImageMimeType);
    }

    updateBranding.mutate(formDataToSend);
  };

  const updateHeaderConfig = (key: keyof HeaderConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      headerConfig: {
        ...(prev.headerConfig || defaultHeaderConfig),
        [key]: value,
        customText: (prev.headerConfig?.customText || "") as string
      }
    }));
  };

  const updateFooterConfig = (key: keyof FooterConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      footerConfig: {
        ...(prev.footerConfig || defaultFooterConfig),
        [key]: value,
        customText: (prev.footerConfig?.customText || "") as string
      }
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Branding Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="general" className="space-y-6">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="header">Header</TabsTrigger>
                  <TabsTrigger value="footer">Footer</TabsTrigger>
                  <TabsTrigger value="theme">Theme</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={formData.description || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="flex items-center gap-4">
                      {logoPreview && (
                        <img
                          src={`data:${logoMimeType};base64,${logoPreview}`}
                          alt="Logo Preview"
                          className="h-16 w-16 object-contain"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('logo-input')?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Logo
                      </Button>
                      <Input
                        id="logo-input"
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => handleImageUpload(e, 'logo')}
                        className="hidden"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="header" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Header Style</Label>
                    <Select
                      value={formData.headerConfig?.style}
                      onValueChange={(value) => updateHeaderConfig('style', value)}
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
                    <Label>Text Alignment</Label>
                    <Select
                      value={formData.headerConfig?.textAlignment}
                      onValueChange={(value) => updateHeaderConfig('textAlignment', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      min="8"
                      max="24"
                      value={formData.headerConfig?.fontSize}
                      onChange={(e) => updateHeaderConfig('fontSize', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Show Logo</Label>
                      <Switch
                        checked={formData.headerConfig?.showLogo}
                        onCheckedChange={(checked) => updateHeaderConfig('showLogo', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Show Date</Label>
                      <Switch
                        checked={formData.headerConfig?.showDate}
                        onCheckedChange={(checked) => updateHeaderConfig('showDate', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Show Page Number</Label>
                      <Switch
                        checked={formData.headerConfig?.showPageNumber}
                        onCheckedChange={(checked) => updateHeaderConfig('showPageNumber', checked)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Text</Label>
                    <Input
                      value={formData.headerConfig?.customText}
                      onChange={(e) => updateHeaderConfig('customText', e.target.value)}
                      placeholder="Enter custom header text"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Header Image</Label>
                    <div className="flex items-center gap-4">
                      {headerImagePreview && (
                        <img
                          src={`data:${headerImageMimeType};base64,${headerImagePreview}`}
                          alt="Header Image Preview"
                          className="h-16 w-32 object-contain"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('header-input')?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Header Image
                      </Button>
                      <Input
                        id="header-input"
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => handleImageUpload(e, 'header')}
                        className="hidden"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="footer" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Text Alignment</Label>
                    <Select
                      value={formData.footerConfig?.textAlignment}
                      onValueChange={(value) => updateFooterConfig('textAlignment', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      min="8"
                      max="24"
                      value={formData.footerConfig?.fontSize}
                      onChange={(e) => updateFooterConfig('fontSize', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Show Logo</Label>
                      <Switch
                        checked={formData.footerConfig?.showLogo}
                        onCheckedChange={(checked) => updateFooterConfig('showLogo', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Show Copyright</Label>
                      <Switch
                        checked={formData.footerConfig?.showCopyright}
                        onCheckedChange={(checked) => updateFooterConfig('showCopyright', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Show Page Number</Label>
                      <Switch
                        checked={formData.footerConfig?.showPageNumber}
                        onCheckedChange={(checked) => updateFooterConfig('showPageNumber', checked)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Text</Label>
                    <Input
                      value={formData.footerConfig?.customText}
                      onChange={(e) => updateFooterConfig('customText', e.target.value)}
                      placeholder="Enter custom footer text"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Footer Image</Label>
                    <div className="flex items-center gap-4">
                      {footerImagePreview && (
                        <img
                          src={`data:${footerImageMimeType};base64,${footerImagePreview}`}
                          alt="Footer Image Preview"
                          className="h-16 w-32 object-contain"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('footer-input')?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Footer Image
                      </Button>
                      <Input
                        id="footer-input"
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => handleImageUpload(e, 'footer')}
                        className="hidden"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="theme" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={formData.primaryColor}
                          onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                          className="w-16"
                        />
                        <Input
                          value={formData.primaryColor}
                          onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={formData.secondaryColor}
                          onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          className="w-16"
                        />
                        <Input
                          value={formData.secondaryColor}
                          onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Accent Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={formData.accentColor}
                          onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                          className="w-16"
                        />
                        <Input
                          value={formData.accentColor}
                          onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Font Family</Label>
                      <Select
                        value={formData.fontFamily}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, fontFamily: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arial">Arial</SelectItem>
                          <SelectItem value="Helvetica">Helvetica</SelectItem>
                          <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                          <SelectItem value="Georgia">Georgia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select
                      value={formData.theme}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, theme: value as "light" | "dark" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                type="submit"
                className="w-full mt-6"
                disabled={updateBranding.isPending}
              >
                {updateBranding.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Branding Settings
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>

      {/* Live Preview */}
      <div className="space-y-6">
        <BrandingPreview
          logo={logoPreview}
          logoMimeType={logoMimeType}
          headerImage={headerImagePreview}
          headerImageMimeType={headerImageMimeType}
          footerImage={footerImagePreview}
          footerImageMimeType={footerImageMimeType}
          headerConfig={formData.headerConfig || defaultHeaderConfig}
          footerConfig={formData.footerConfig || defaultFooterConfig}
          companyName={formData.companyName || "Company Name"}
          primaryColor={formData.primaryColor || "#71569E"}
          secondaryColor={formData.secondaryColor || "#F0F0FA"}
          accentColor={formData.accentColor || "#191160"}
          theme={formData.theme || "light"}
          fontFamily={formData.fontFamily || "Arial"}
        />
      </div>
    </div>
  );
}