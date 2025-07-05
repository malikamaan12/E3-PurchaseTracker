import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Settings, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface SimplePDFSettingsProps {
  onSave?: (settings: any) => void;
  loading?: boolean;
}

export function SimplePDFSettings({ onSave, loading }: SimplePDFSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    headerTitle: "EVENTS & ENTERTAINMENT ENTERPRISES",
    headerSubtitle: "PURCHASE REQUEST",
    headerColor: "#1a365d",
    footerText: "ALL RIGHTS RESERVED BY E3",
    footerColor: "#1a365d",
    pageNumbering: true,
    fontSize: 11,
    fontFamily: "helvetica",
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 25,
    marginRight: 25,
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companyWebsite: "",
    watermarkText: "CONFIDENTIAL",
    watermarkOpacity: 10,
    showBasicInfo: true,
    showVendorInfo: true,
    showItemsTable: true,
    showAttachments: true,
    showSignatures: true,
  });

  const handleSave = async () => {
    try {
      const response = await fetch('/api/pdf-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "PDF settings have been updated successfully.",
        });
        onSave?.(settings);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving PDF settings:', error);
      toast({
        title: "Error",
        description: "Failed to save PDF settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-xl font-semibold">PDF Settings</h2>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>

      <Tabs defaultValue="header" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="header">Header</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
        </TabsList>

        <TabsContent value="header" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Header Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="headerTitle">Header Title</Label>
                  <Input
                    id="headerTitle"
                    value={settings.headerTitle}
                    onChange={(e) => updateSetting('headerTitle', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="headerSubtitle">Header Subtitle</Label>
                  <Input
                    id="headerSubtitle"
                    value={settings.headerSubtitle}
                    onChange={(e) => updateSetting('headerSubtitle', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="headerColor">Header Color</Label>
                  <Input
                    id="headerColor"
                    type="color"
                    value={settings.headerColor}
                    onChange={(e) => updateSetting('headerColor', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="fontFamily">Font Family</Label>
                  <Select value={settings.fontFamily} onValueChange={(value) => updateSetting('fontFamily', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="helvetica">Helvetica</SelectItem>
                      <SelectItem value="times">Times New Roman</SelectItem>
                      <SelectItem value="courier">Courier New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fontSize">Font Size</Label>
                  <Input
                    id="fontSize"
                    type="number"
                    min="8"
                    max="16"
                    value={settings.fontSize}
                    onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="watermarkText">Watermark Text</Label>
                  <Input
                    id="watermarkText"
                    value={settings.watermarkText}
                    onChange={(e) => updateSetting('watermarkText', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="watermarkOpacity">Watermark Opacity (%)</Label>
                  <Input
                    id="watermarkOpacity"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.watermarkOpacity}
                    onChange={(e) => updateSetting('watermarkOpacity', parseInt(e.target.value))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="pageNumbering"
                    checked={settings.pageNumbering}
                    onCheckedChange={(checked) => updateSetting('pageNumbering', checked)}
                  />
                  <Label htmlFor="pageNumbering">Page Numbering</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="marginTop">Top Margin</Label>
                  <Input
                    id="marginTop"
                    type="number"
                    min="10"
                    value={settings.marginTop}
                    onChange={(e) => updateSetting('marginTop', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="marginBottom">Bottom Margin</Label>
                  <Input
                    id="marginBottom"
                    type="number"
                    min="10"
                    value={settings.marginBottom}
                    onChange={(e) => updateSetting('marginBottom', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="marginLeft">Left Margin</Label>
                  <Input
                    id="marginLeft"
                    type="number"
                    min="15"
                    value={settings.marginLeft}
                    onChange={(e) => updateSetting('marginLeft', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="marginRight">Right Margin</Label>
                  <Input
                    id="marginRight"
                    type="number"
                    min="15"
                    value={settings.marginRight}
                    onChange={(e) => updateSetting('marginRight', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="footer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Footer Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input
                    id="footerText"
                    value={settings.footerText}
                    onChange={(e) => updateSetting('footerText', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="footerColor">Footer Color</Label>
                  <Input
                    id="footerColor"
                    type="color"
                    value={settings.footerColor}
                    onChange={(e) => updateSetting('footerColor', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="companyAddress">Company Address</Label>
                  <Input
                    id="companyAddress"
                    value={settings.companyAddress}
                    onChange={(e) => updateSetting('companyAddress', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="companyPhone">Company Phone</Label>
                  <Input
                    id="companyPhone"
                    value={settings.companyPhone}
                    onChange={(e) => updateSetting('companyPhone', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input
                    id="companyEmail"
                    value={settings.companyEmail}
                    onChange={(e) => updateSetting('companyEmail', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="companyWebsite">Company Website</Label>
                  <Input
                    id="companyWebsite"
                    value={settings.companyWebsite}
                    onChange={(e) => updateSetting('companyWebsite', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Section Visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showBasicInfo"
                    checked={settings.showBasicInfo}
                    onCheckedChange={(checked) => updateSetting('showBasicInfo', checked)}
                  />
                  <Label htmlFor="showBasicInfo">Show Basic Information</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showVendorInfo"
                    checked={settings.showVendorInfo}
                    onCheckedChange={(checked) => updateSetting('showVendorInfo', checked)}
                  />
                  <Label htmlFor="showVendorInfo">Show Vendor Information</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showItemsTable"
                    checked={settings.showItemsTable}
                    onCheckedChange={(checked) => updateSetting('showItemsTable', checked)}
                  />
                  <Label htmlFor="showItemsTable">Show Items Table</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showAttachments"
                    checked={settings.showAttachments}
                    onCheckedChange={(checked) => updateSetting('showAttachments', checked)}
                  />
                  <Label htmlFor="showAttachments">Show Attachments</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="showSignatures"
                    checked={settings.showSignatures}
                    onCheckedChange={(checked) => updateSetting('showSignatures', checked)}
                  />
                  <Label htmlFor="showSignatures">Show Signatures</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}