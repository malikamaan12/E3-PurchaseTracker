import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import BrandingPreview from "./BrandingPreview";
import BrandMoodBoardGenerator from "./BrandMoodBoardGenerator";
import { BrandingData, brandingFormSchema } from "@/types/branding";

type ColorSwatch = {
  id: string;
  color: string;
  type: "primary" | "secondary" | "accent";
  label: string;
};

type StyleOption = {
  id: string;
  style: "modern" | "classic" | "minimal";
  label: string;
};

const defaultColors: ColorSwatch[] = [
  { id: "primary", color: "#71569E", type: "primary", label: "Primary Color" },
  { id: "secondary", color: "#F0F0FA", type: "secondary", label: "Secondary Color" },
  { id: "accent", color: "#191160", type: "accent", label: "Accent Color" },
];

const styleOptions: StyleOption[] = [
  { id: "modern", style: "modern", label: "Modern" },
  { id: "classic", style: "classic", label: "Classic" },
  { id: "minimal", style: "minimal", label: "Minimal" },
];

interface DraggableBrandingFormProps {
  onSuccess?: () => void;
}

export default function DraggableBrandingForm({ onSuccess }: DraggableBrandingFormProps) {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoMimeType, setLogoMimeType] = useState<string | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [headerImageMimeType, setHeaderImageMimeType] = useState<string | null>(null);
  const [footerImagePreview, setFooterImagePreview] = useState<string | null>(null);
  const [footerImageMimeType, setFooterImageMimeType] = useState<string | null>(null);
  const [colorSwatches, setColorSwatches] = useState<ColorSwatch[]>(defaultColors);
  const [selectedStyle, setSelectedStyle] = useState<StyleOption>(styleOptions[0]);

  const [formData, setFormData] = useState<BrandingData>({
    companyName: "",
    headerStyle: "modern",
    primaryColor: "#71569E",
    secondaryColor: "#F0F0FA",
    accentColor: "#191160",
    footerText: "",
  });

  const { data: branding, onSuccess: handleBrandingSuccess } = useQuery<BrandingData>({
    queryKey: ["/api/branding"],
    enabled: true,
    onSuccess: (data) => {
      if (data) {
        setFormData({
          companyName: data.companyName || "",
          headerStyle: data.headerStyle || "modern",
          primaryColor: data.primaryColor || "#71569E",
          secondaryColor: data.secondaryColor || "#F0F0FA",
          accentColor: data.accentColor || "#191160",
          footerText: data.footerText || "",
          headerImage: data.headerImage,
          headerImageMimeType: data.headerImageMimeType,
          footerImage: data.footerImage,
          footerImageMimeType: data.footerImageMimeType,
        });

        if (data.logo) {
          setLogoPreview(data.logo);
          setLogoMimeType(data.logoMimeType || "image/png");
        }

        if (data.headerImage) {
          setHeaderImagePreview(data.headerImage);
          setHeaderImageMimeType(data.headerImageMimeType || "image/png");
        }

        if (data.footerImage) {
          setFooterImagePreview(data.footerImage);
          setFooterImageMimeType(data.footerImageMimeType || "image/png");
        }
      }
    }
  });

  const updateBranding = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/branding", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
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
      toast({
        title: "Error",
        description: error.message || "Failed to update branding settings",
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    if (result.type === "COLOR_SWATCH") {
      const items = Array.from(colorSwatches);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      setColorSwatches(items);

      // Update form data with new color order
      const newFormData = {
        ...formData,
        primaryColor: items[0].color,
        secondaryColor: items[1].color,
        accentColor: items[2].color,
      };
      setFormData(newFormData);
    }

    if (result.type === "STYLE_OPTION") {
      const style = styleOptions.find(s => s.id === result.draggableId);
      if (style) {
        setSelectedStyle(style);
        setFormData(prev => ({ ...prev, headerStyle: style.style }));
      }
    }
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'header' | 'footer'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image file size must be less than 5MB",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      // Validate file type
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

    // Add all form fields to FormData
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== undefined) {
        formDataToSend.append(key, value.toString());
      }
    });

    // Add images if changed
    if (logoPreview) {
      formDataToSend.append('logo', logoPreview);
      if (logoMimeType) {
        formDataToSend.append('logoMimeType', logoMimeType);
      }
    }

    if (headerImagePreview) {
      formDataToSend.append('headerImage', headerImagePreview);
      if (headerImageMimeType) {
        formDataToSend.append('headerImageMimeType', headerImageMimeType);
      }
    }

    if (footerImagePreview) {
      formDataToSend.append('footerImage', footerImagePreview);
      if (footerImageMimeType) {
        formDataToSend.append('footerImageMimeType', footerImageMimeType);
      }
    }

    updateBranding.mutate(formDataToSend);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <DragDropContext onDragEnd={handleDragEnd}>
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
                  value={formData.companyName}
                  placeholder="Enter company name"
                  required
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4">
                  {(logoPreview || branding?.logo) && (
                    <img
                      src={`data:${logoMimeType || branding?.logoMimeType};base64,${logoPreview || branding?.logo}`}
                      alt="Company Logo"
                      className="h-16 w-16 object-contain"
                    />
                  )}
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 w-full hover:border-primary cursor-pointer"
                    onClick={() => document.getElementById('logo-input')?.click()}
                  >
                    <Input
                      id="logo-input"
                      type="file"
                      name="logo"
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleImageUpload(e, 'logo')}
                      className="hidden"
                    />
                    <p className="text-center text-sm text-gray-500">
                      Drag and drop your logo here, or click to select
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>PDF Header Image</Label>
                <div className="flex items-center gap-4">
                  {(headerImagePreview || branding?.headerImage) && (
                    <img
                      src={`data:${headerImageMimeType || branding?.headerImageMimeType};base64,${headerImagePreview || branding?.headerImage}`}
                      alt="Header Image"
                      className="h-16 w-32 object-contain"
                    />
                  )}
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 w-full hover:border-primary cursor-pointer"
                    onClick={() => document.getElementById('header-input')?.click()}
                  >
                    <Input
                      id="header-input"
                      type="file"
                      name="headerImage"
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleImageUpload(e, 'header')}
                      className="hidden"
                    />
                    <p className="text-center text-sm text-gray-500">
                      Upload PDF header image
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>PDF Footer Image</Label>
                <div className="flex items-center gap-4">
                  {(footerImagePreview || branding?.footerImage) && (
                    <img
                      src={`data:${footerImageMimeType || branding?.footerImageMimeType};base64,${footerImagePreview || branding?.footerImage}`}
                      alt="Footer Image"
                      className="h-16 w-32 object-contain"
                    />
                  )}
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 w-full hover:border-primary cursor-pointer"
                    onClick={() => document.getElementById('footer-input')?.click()}
                  >
                    <Input
                      id="footer-input"
                      type="file"
                      name="footerImage"
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleImageUpload(e, 'footer')}
                      className="hidden"
                    />
                    <p className="text-center text-sm text-gray-500">
                      Upload PDF footer image
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Color Scheme (Drag to Reorder)</Label>
                <Droppable droppableId="color-swatches" type="COLOR_SWATCH">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {colorSwatches.map((swatch, index) => (
                        <Draggable
                          key={swatch.id}
                          draggableId={swatch.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="flex items-center gap-4 p-2 bg-white rounded-lg shadow-sm"
                            >
                              <div
                                className="w-8 h-8 rounded"
                                style={{ backgroundColor: swatch.color }}
                              />
                              <Input
                                type="color"
                                name={`${swatch.type}Color`}
                                value={swatch.color}
                                onChange={(e) => {
                                  const newSwatches = colorSwatches.map(s =>
                                    s.id === swatch.id ? { ...s, color: e.target.value } : s
                                  );
                                  setColorSwatches(newSwatches);
                                  setFormData(prev => ({
                                    ...prev,
                                    [`${swatch.type}Color`]: e.target.value
                                  }));
                                }}
                                className="w-16"
                              />
                              <span className="text-sm font-medium">{swatch.label}</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              <div className="space-y-4">
                <Label>Header Style (Drag to Select)</Label>
                <Droppable droppableId="style-options" type="STYLE_OPTION">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {styleOptions.map((style, index) => (
                        <Draggable
                          key={style.id}
                          draggableId={style.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedStyle.id === style.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary hover:bg-secondary/80"
                              }`}
                            >
                              {style.label}
                              <input
                                type="hidden"
                                name="headerStyle"
                                value={selectedStyle.style}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Input
                  name="footerText"
                  value={formData.footerText}
                  placeholder="Enter custom footer text"
                  onChange={(e) => setFormData(prev => ({ ...prev, footerText: e.target.value }))}
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
      </DragDropContext>

      {/* Preview Panel */}
      <div className="space-y-6">
        <BrandingPreview
          logo={logoPreview}
          logoMimeType={logoMimeType}
          headerImage={headerImagePreview}
          headerImageMimeType={headerImageMimeType}
          footerImage={footerImagePreview}
          footerImageMimeType={footerImageMimeType}
          headerStyle={formData.headerStyle}
          companyName={formData.companyName}
          primaryColor={formData.primaryColor}
          secondaryColor={formData.secondaryColor}
          accentColor={formData.accentColor}
          footerText={formData.footerText}
        />

        <BrandMoodBoardGenerator
          companyName={formData.companyName}
          primaryColor={formData.primaryColor}
          secondaryColor={formData.secondaryColor}
          accentColor={formData.accentColor}
        />
      </div>
    </div>
  );
}