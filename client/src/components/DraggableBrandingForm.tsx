import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { AlertCircle, Upload, Move, Maximize, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DraggableElement {
  id: string;
  type: 'logo' | 'headerImage' | 'headerText' | 'footerImage' | 'footerText';
  content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  fontSize?: number;
  src?: string;
}

interface PDFBrandingSettings {
  headerImage: string | null;
  footerImage: string | null;
  logo: string | null;
  headerTitle: string;
  headerSubtitle: string;
  headerColor: string;
  footerText: string;
  footerColor: string;
  pageNumbering: boolean;
  showHeaderText: boolean;
  showHeaderImage: boolean;
  showFooterText: boolean;
  showFooterImage: boolean;
  showLogo: boolean;
  showContactInfo: boolean;
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
}

interface DraggableBrandingFormProps {
  settings: PDFBrandingSettings;
  onSettingsChange: (settings: PDFBrandingSettings) => void;
  onSave: () => void;
}

export default function DraggableBrandingForm({
  settings,
  onSettingsChange,
  onSave
}: DraggableBrandingFormProps) {
  const [activeTab, setActiveTab] = useState("design");
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [resizingElementId, setResizingElementId] = useState<string | null>(null);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });
  const { toast } = useToast();
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Initialize draggable elements based on settings
  const [elements, setElements] = useState<DraggableElement[]>([
    {
      id: 'logo',
      type: 'logo',
      x: 20,
      y: 20,
      width: 100,
      height: 60,
      src: settings.logo || '/placeholder-logo.png'
    },
    {
      id: 'headerText',
      type: 'headerText',
      content: settings.headerTitle,
      x: 140,
      y: 30,
      width: 400,
      height: 60,
      color: settings.headerColor,
      fontSize: 18
    },
    {
      id: 'headerImage',
      type: 'headerImage',
      x: 0,
      y: 0,
      width: 595,
      height: 100,
      src: settings.headerImage || '/placeholder-header.png'
    },
    {
      id: 'footerText',
      type: 'footerText',
      content: settings.footerText,
      x: 200,
      y: 800,
      width: 200,
      height: 30,
      color: settings.footerColor,
      fontSize: 12
    },
    {
      id: 'footerImage',
      type: 'footerImage',
      x: 0,
      y: 780,
      width: 595,
      height: 60,
      src: settings.footerImage || '/placeholder-footer.png'
    }
  ]);

  // Update elements when settings change
  useEffect(() => {
    const updatedElements = [...elements];
    
    const logoElement = updatedElements.find(el => el.id === 'logo');
    if (logoElement) {
      logoElement.src = settings.logo || '/placeholder-logo.png';
    }
    
    const headerTextElement = updatedElements.find(el => el.id === 'headerText');
    if (headerTextElement) {
      headerTextElement.content = settings.headerTitle;
      headerTextElement.color = settings.headerColor;
    }
    
    const headerImageElement = updatedElements.find(el => el.id === 'headerImage');
    if (headerImageElement) {
      headerImageElement.src = settings.headerImage || '/placeholder-header.png';
    }
    
    const footerTextElement = updatedElements.find(el => el.id === 'footerText');
    if (footerTextElement) {
      footerTextElement.content = settings.footerText;
      footerTextElement.color = settings.footerColor;
    }
    
    const footerImageElement = updatedElements.find(el => el.id === 'footerImage');
    if (footerImageElement) {
      footerImageElement.src = settings.footerImage || '/placeholder-footer.png';
    }
    
    setElements(updatedElements);
  }, [settings]);

  // Handle element visibility based on settings
  const visibleElements = elements.filter(element => {
    switch (element.type) {
      case 'logo':
        return settings.showLogo;
      case 'headerText':
        return settings.showHeaderText;
      case 'headerImage':
        return settings.showHeaderImage;
      case 'footerText':
        return settings.showFooterText;
      case 'footerImage':
        return settings.showFooterImage;
      default:
        return true;
    }
  });

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    setDraggedElementId(elementId);
    setStartPoint({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse down for resizing
  const handleResizeStart = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingElementId(elementId);
    setStartPoint({ x: e.clientX, y: e.clientY });
    
    const element = elements.find(el => el.id === elementId);
    if (element) {
      setInitialSize({ width: element.width, height: element.height });
    }
  };

  // Handle mouse move for dragging and resizing
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedElementId) {
      const dx = e.clientX - startPoint.x;
      const dy = e.clientY - startPoint.y;
      
      setElements(prevElements => 
        prevElements.map(element => 
          element.id === draggedElementId
            ? { ...element, x: element.x + dx, y: element.y + dy }
            : element
        )
      );
      
      setStartPoint({ x: e.clientX, y: e.clientY });
    } else if (resizingElementId) {
      const dx = e.clientX - startPoint.x;
      const dy = e.clientY - startPoint.y;
      
      setElements(prevElements => 
        prevElements.map(element => 
          element.id === resizingElementId
            ? { 
                ...element, 
                width: Math.max(20, initialSize.width + dx),
                height: Math.max(20, initialSize.height + dy) 
              }
            : element
        )
      );
    }
  };

  // Handle mouse up to end dragging or resizing
  const handleMouseUp = () => {
    setDraggedElementId(null);
    setResizingElementId(null);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'headerImage' | 'footerImage') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      
      // Update settings based on file type
      const updatedSettings = { ...settings };
      if (type === 'logo') {
        updatedSettings.logo = dataUrl;
      } else if (type === 'headerImage') {
        updatedSettings.headerImage = dataUrl;
      } else if (type === 'footerImage') {
        updatedSettings.footerImage = dataUrl;
      }
      
      onSettingsChange(updatedSettings);
      
      // Also update elements state for immediate display
      setElements(prevElements => 
        prevElements.map(element => 
          element.type === type
            ? { ...element, src: dataUrl }
            : element
        )
      );
      
      toast({
        title: "Image Uploaded",
        description: `The ${type} has been updated successfully.`,
      });
    };
    
    reader.readAsDataURL(file);
  };

  // Handle text updates
  const handleTextChange = (value: string, type: 'headerTitle' | 'headerSubtitle' | 'footerText') => {
    const updatedSettings = { ...settings };
    updatedSettings[type] = value;
    onSettingsChange(updatedSettings);
  };

  // Handle color updates
  const handleColorChange = (value: string, type: 'headerColor' | 'footerColor') => {
    const updatedSettings = { ...settings };
    updatedSettings[type] = value;
    onSettingsChange(updatedSettings);
  };

  // Handle toggle switches
  const handleToggle = (value: boolean, field: keyof PDFBrandingSettings) => {
    const updatedSettings = { ...settings } as Record<keyof PDFBrandingSettings, any>;
    updatedSettings[field] = value;
    onSettingsChange(updatedSettings as PDFBrandingSettings);
  };

  // Generate actual PDF settings from elements positions
  const updatePDFSettingsFromLayout = () => {
    // Here we would translate element positions to PDF settings
    // This is a placeholder - in a real implementation, you'd convert the positions
    // to actual PDF layout settings
    toast({
      title: "Layout Saved",
      description: "Your layout settings have been saved successfully.",
    });
    
    onSave();
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="design">Design Elements</TabsTrigger>
          <TabsTrigger value="layout">Visual Layout</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        
        {/* Design Elements Tab */}
        <TabsContent value="design" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Logo Settings</h3>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showLogo"
                    checked={settings.showLogo}
                    onCheckedChange={(value) => handleToggle(Boolean(value), 'showLogo')}
                  />
                  <Label htmlFor="showLogo">Show Logo</Label>
                </div>
                
                {settings.showLogo && (
                  <div className="space-y-2">
                    <Label htmlFor="logoUpload">Upload Logo</Label>
                    <Input
                      id="logoUpload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'logo')}
                    />
                    {settings.logo && (
                      <div className="mt-2 border rounded-md p-2">
                        <img
                          src={settings.logo}
                          alt="Logo"
                          className="max-h-16 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <h3 className="text-lg font-medium mt-6">Header Settings</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showHeaderText"
                      checked={settings.showHeaderText}
                      onCheckedChange={(value) => handleToggle(Boolean(value), 'showHeaderText')}
                    />
                    <Label htmlFor="showHeaderText">Show Header Text</Label>
                  </div>
                  
                  {settings.showHeaderText && (
                    <>
                      <div>
                        <Label htmlFor="headerTitle">Header Title</Label>
                        <Input
                          id="headerTitle"
                          value={settings.headerTitle}
                          onChange={(e) => handleTextChange(e.target.value, 'headerTitle')}
                          placeholder="Enter header title"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="headerSubtitle">Header Subtitle</Label>
                        <Input
                          id="headerSubtitle"
                          value={settings.headerSubtitle}
                          onChange={(e) => handleTextChange(e.target.value, 'headerSubtitle')}
                          placeholder="Enter header subtitle"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="headerColor">Header Text Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="headerColor"
                            type="color"
                            value={settings.headerColor}
                            onChange={(e) => handleColorChange(e.target.value, 'headerColor')}
                            className="w-20 h-10 p-1"
                          />
                          <Input
                            value={settings.headerColor}
                            onChange={(e) => handleColorChange(e.target.value, 'headerColor')}
                            maxLength={7}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showHeaderImage"
                      checked={settings.showHeaderImage}
                      onCheckedChange={(value) => handleToggle(Boolean(value), 'showHeaderImage')}
                    />
                    <Label htmlFor="showHeaderImage">Show Header Image</Label>
                  </div>
                  
                  {settings.showHeaderImage && (
                    <div className="space-y-2">
                      <Label htmlFor="headerImageUpload">Upload Header Image</Label>
                      <Input
                        id="headerImageUpload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'headerImage')}
                      />
                      {settings.headerImage && (
                        <div className="mt-2 border rounded-md p-2">
                          <img
                            src={settings.headerImage}
                            alt="Header"
                            className="max-h-20 w-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-medium mt-6">Footer Settings</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showFooterText"
                      checked={settings.showFooterText}
                      onCheckedChange={(value) => handleToggle(Boolean(value), 'showFooterText')}
                    />
                    <Label htmlFor="showFooterText">Show Footer Text</Label>
                  </div>
                  
                  {settings.showFooterText && (
                    <>
                      <div>
                        <Label htmlFor="footerText">Footer Text</Label>
                        <Input
                          id="footerText"
                          value={settings.footerText}
                          onChange={(e) => handleTextChange(e.target.value, 'footerText')}
                          placeholder="Enter footer text"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="footerColor">Footer Text Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="footerColor"
                            type="color"
                            value={settings.footerColor}
                            onChange={(e) => handleColorChange(e.target.value, 'footerColor')}
                            className="w-20 h-10 p-1"
                          />
                          <Input
                            value={settings.footerColor}
                            onChange={(e) => handleColorChange(e.target.value, 'footerColor')}
                            maxLength={7}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showFooterImage"
                      checked={settings.showFooterImage}
                      onCheckedChange={(value) => handleToggle(Boolean(value), 'showFooterImage')}
                    />
                    <Label htmlFor="showFooterImage">Show Footer Image</Label>
                  </div>
                  
                  {settings.showFooterImage && (
                    <div className="space-y-2">
                      <Label htmlFor="footerImageUpload">Upload Footer Image</Label>
                      <Input
                        id="footerImageUpload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'footerImage')}
                      />
                      {settings.footerImage && (
                        <div className="mt-2 border rounded-md p-2">
                          <img
                            src={settings.footerImage}
                            alt="Footer"
                            className="max-h-20 w-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Visual Layout Tab */}
        <TabsContent value="layout" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Visual Layout Editor</h3>
                <Button onClick={updatePDFSettingsFromLayout}>Save Layout</Button>
              </div>
              
              <div 
                ref={canvasRef}
                className="border rounded-md bg-white h-[842px] w-[595px] mx-auto relative overflow-hidden"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Blank PDF page background */}
                <img 
                  src="/blank-pdf-page.svg" 
                  alt="PDF Page" 
                  className="w-full h-full object-cover absolute top-0 left-0 pointer-events-none"
                />
                
                {/* Draggable elements */}
                {visibleElements.map(element => (
                  <div 
                    key={element.id}
                    className="absolute border border-blue-500 bg-white/80 cursor-move shadow-sm"
                    style={{ 
                      top: `${element.y}px`, 
                      left: `${element.x}px`,
                      width: `${element.width}px`,
                      height: `${element.height}px`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, element.id)}
                  >
                    {/* Content based on element type */}
                    {element.type === 'logo' && element.src && (
                      <img 
                        src={element.src} 
                        alt="Logo" 
                        className="w-full h-full object-contain"
                      />
                    )}
                    
                    {element.type === 'headerImage' && element.src && (
                      <img 
                        src={element.src} 
                        alt="Header" 
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {element.type === 'footerImage' && element.src && (
                      <img 
                        src={element.src} 
                        alt="Footer" 
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {element.type === 'headerText' && (
                      <div 
                        className="w-full h-full p-2 flex flex-col justify-center"
                        style={{ color: element.color }}
                      >
                        <div className="font-bold text-lg">{settings.headerTitle}</div>
                        <div className="text-sm">{settings.headerSubtitle}</div>
                      </div>
                    )}
                    
                    {element.type === 'footerText' && (
                      <div 
                        className="w-full h-full p-2 flex items-center justify-center"
                        style={{ color: element.color }}
                      >
                        <div className="text-sm">{settings.footerText}</div>
                      </div>
                    )}
                    
                    {/* Drag handle */}
                    <div className="absolute top-0 left-0 bg-blue-500 text-white p-1 text-[10px] flex items-center">
                      <Move className="h-3 w-3 mr-1" />
                      {element.type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </div>
                    
                    {/* Resize handle */}
                    <div 
                      className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize flex items-center justify-center rounded-sm"
                      onMouseDown={(e) => handleResizeStart(e, element.id)}
                    >
                      <ArrowUpDown className="h-3 w-3 text-white" />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Element Visibility</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button 
                      variant={settings.showLogo ? "default" : "outline"} 
                      size="sm"
                      onClick={() => handleToggle(!settings.showLogo, 'showLogo')}
                    >
                      Logo
                    </Button>
                    <Button 
                      variant={settings.showHeaderText ? "default" : "outline"} 
                      size="sm"
                      onClick={() => handleToggle(!settings.showHeaderText, 'showHeaderText')}
                    >
                      Header Text
                    </Button>
                    <Button 
                      variant={settings.showHeaderImage ? "default" : "outline"} 
                      size="sm"
                      onClick={() => handleToggle(!settings.showHeaderImage, 'showHeaderImage')}
                    >
                      Header Image
                    </Button>
                    <Button 
                      variant={settings.showFooterText ? "default" : "outline"} 
                      size="sm"
                      onClick={() => handleToggle(!settings.showFooterText, 'showFooterText')}
                    >
                      Footer Text
                    </Button>
                    <Button 
                      variant={settings.showFooterImage ? "default" : "outline"} 
                      size="sm"
                      onClick={() => handleToggle(!settings.showFooterImage, 'showFooterImage')}
                    >
                      Footer Image
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">PDF Preview</h3>
                <Button onClick={onSave}>Save Configuration</Button>
              </div>
              
              <div className="border rounded-md bg-white h-[842px] w-[595px] mx-auto relative overflow-hidden">
                {/* Header area */}
                {settings.showHeaderImage && settings.headerImage && (
                  <div className="absolute top-0 left-0 right-0" style={{ height: '100px' }}>
                    <img 
                      src={settings.headerImage} 
                      alt="Header" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {settings.showLogo && settings.logo && (
                  <div className="absolute" style={{ left: '20px', top: '20px', width: '100px', height: '60px' }}>
                    <img 
                      src={settings.logo} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                
                {settings.showHeaderText && (
                  <div 
                    className="absolute"
                    style={{ 
                      left: '140px', 
                      top: '30px',
                      color: settings.headerColor,
                      fontWeight: 'bold'
                    }}
                  >
                    <div style={{ fontSize: '18px' }}>{settings.headerTitle}</div>
                    <div style={{ fontSize: '14px' }}>{settings.headerSubtitle}</div>
                  </div>
                )}
                
                {/* Main content area (placeholder) */}
                <div className="absolute inset-0 pt-[120px] pb-[80px] px-[40px]">
                  <div className="border border-dashed border-gray-300 rounded-md h-full w-full flex items-center justify-center text-gray-400">
                    Purchase Request Content Area
                  </div>
                </div>
                
                {/* Footer area */}
                {settings.showFooterImage && settings.footerImage && (
                  <div className="absolute bottom-0 left-0 right-0" style={{ height: '60px' }}>
                    <img 
                      src={settings.footerImage} 
                      alt="Footer" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {settings.showFooterText && (
                  <div 
                    className="absolute"
                    style={{ 
                      left: '200px', 
                      bottom: '30px', 
                      color: settings.footerColor,
                      fontSize: '12px',
                      textAlign: 'center',
                      width: '200px'
                    }}
                  >
                    {settings.footerText}
                  </div>
                )}
                
                {settings.pageNumbering && (
                  <div 
                    className="absolute bottom-4 right-4 text-sm text-gray-500"
                  >
                    Page 1
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}