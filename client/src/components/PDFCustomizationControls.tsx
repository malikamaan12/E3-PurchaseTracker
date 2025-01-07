import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ChromePicker } from "react-color";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PDFCustomizationProps {
  defaultConfig?: PDFConfig;
  onConfigChange: (config: PDFConfig) => void;
  onReset: () => void;
  onPreview?: () => void;
}

export interface PDFConfig {
  header: {
    title: string;
    subtitle: string;
    showLogo: boolean;
    color: string;
    fontSize: number;
  };
  content: {
    fontFamily: string;
    fontSize: number;
    spacing: number;
  };
  footer: {
    text: string;
    showPageNumbers: boolean;
    color: string;
    fontSize: number;
  };
}

const defaultPDFConfig: PDFConfig = {
  header: {
    title: "EVENTS & ENTERTAINMENT ENTERPRISES",
    subtitle: "PURCHASE REQUEST",
    showLogo: true,
    color: "#000000",
    fontSize: 16
  },
  content: {
    fontFamily: "Arial",
    fontSize: 12,
    spacing: 1.5
  },
  footer: {
    text: "ALL RIGHTS RESERVED BY E3",
    showPageNumbers: true,
    color: "#666666",
    fontSize: 12
  }
};

export function PDFCustomizationControls({
  defaultConfig = defaultPDFConfig,
  onConfigChange,
  onReset,
  onPreview
}: PDFCustomizationProps) {
  const [config, setConfig] = useState<PDFConfig>(defaultConfig);
  const { toast } = useToast();

  const handleConfigChange = (
    section: keyof PDFConfig,
    field: string,
    value: any
  ) => {
    const newConfig = {
      ...config,
      [section]: {
        ...config[section],
        [field]: value
      }
    };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const fontFamilies = [
    "Arial",
    "Times New Roman",
    "Helvetica",
    "Georgia",
    "Verdana"
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <Tabs defaultValue="header" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="header">Header</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="footer">Footer</TabsTrigger>
          </TabsList>

          <TabsContent value="header" className="space-y-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="headerTitle">Title</Label>
                <Input
                  id="headerTitle"
                  value={config.header.title}
                  onChange={(e) =>
                    handleConfigChange("header", "title", e.target.value)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="headerSubtitle">Subtitle</Label>
                <Input
                  id="headerSubtitle"
                  value={config.header.subtitle}
                  onChange={(e) =>
                    handleConfigChange("header", "subtitle", e.target.value)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="headerShowLogo">Show Logo</Label>
                <Switch
                  id="headerShowLogo"
                  checked={config.header.showLogo}
                  onCheckedChange={(checked) =>
                    handleConfigChange("header", "showLogo", checked)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label>Header Color</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[220px] justify-start text-left font-normal"
                    >
                      <div
                        className="w-4 h-4 rounded mr-2"
                        style={{ background: config.header.color }}
                      />
                      {config.header.color}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <ChromePicker
                      color={config.header.color}
                      onChange={(color) =>
                        handleConfigChange("header", "color", color.hex)
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label>Font Size: {config.header.fontSize}px</Label>
                <Slider
                  value={[config.header.fontSize]}
                  min={12}
                  max={24}
                  step={1}
                  onValueChange={([value]) =>
                    handleConfigChange("header", "fontSize", value)
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="contentFontFamily">Font Family</Label>
                <Select
                  value={config.content.fontFamily}
                  onValueChange={(value) =>
                    handleConfigChange("content", "fontFamily", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select font family" />
                  </SelectTrigger>
                  <SelectContent>
                    {fontFamilies.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Font Size: {config.content.fontSize}px</Label>
                <Slider
                  value={[config.content.fontSize]}
                  min={10}
                  max={16}
                  step={1}
                  onValueChange={([value]) =>
                    handleConfigChange("content", "fontSize", value)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label>Line Spacing: {config.content.spacing}</Label>
                <Slider
                  value={[config.content.spacing]}
                  min={1}
                  max={2}
                  step={0.1}
                  onValueChange={([value]) =>
                    handleConfigChange("content", "spacing", value)
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="footer" className="space-y-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="footerText">Footer Text</Label>
                <Input
                  id="footerText"
                  value={config.footer.text}
                  onChange={(e) =>
                    handleConfigChange("footer", "text", e.target.value)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="footerShowPageNumbers">Show Page Numbers</Label>
                <Switch
                  id="footerShowPageNumbers"
                  checked={config.footer.showPageNumbers}
                  onCheckedChange={(checked) =>
                    handleConfigChange("footer", "showPageNumbers", checked)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label>Footer Color</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[220px] justify-start text-left font-normal"
                    >
                      <div
                        className="w-4 h-4 rounded mr-2"
                        style={{ background: config.footer.color }}
                      />
                      {config.footer.color}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <ChromePicker
                      color={config.footer.color}
                      onChange={(color) =>
                        handleConfigChange("footer", "color", color.hex)
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label>Font Size: {config.footer.fontSize}px</Label>
                <Slider
                  value={[config.footer.fontSize]}
                  min={10}
                  max={16}
                  step={1}
                  onValueChange={([value]) =>
                    handleConfigChange("footer", "fontSize", value)
                  }
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onReset}>
            Reset to Default
          </Button>
          {onPreview && (
            <Button variant="outline" onClick={onPreview}>
              Preview
            </Button>
          )}
          <Button
            onClick={() => {
              toast({
                title: "Settings Saved",
                description: "PDF customization settings have been saved.",
              });
            }}
          >
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}