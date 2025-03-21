import React from 'react';
import { PdfSettings } from '../services/pdfService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface PDFSettingsPanelProps {
  settings: Partial<PdfSettings>;
  onSettingsChange: (settings: Partial<PdfSettings>) => void;
  loading?: boolean;
}

const PDFSettingsPanel: React.FC<PDFSettingsPanelProps> = ({
  settings,
  onSettingsChange,
  loading = false
}) => {
  const handleChange = (field: keyof PdfSettings, value: any) => {
    onSettingsChange({ [field]: value });
  };

  return (
    <div className="pdf-settings-panel">
      <h2 className="text-lg font-bold mb-4">PDF Template Settings</h2>
      
      <Tabs defaultValue="header" className="w-full">
        <TabsList className="mb-4 w-full grid grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="header">Header</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
          <TabsTrigger value="page">Page</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="watermark">Watermark</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>
        
        {/* Header Settings */}
        <TabsContent value="header" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="headerTitle">Header Title</Label>
                    <Input
                      id="headerTitle"
                      value={settings.headerTitle || ''}
                      onChange={(e) => handleChange('headerTitle', e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="headerSubtitle">Header Subtitle</Label>
                    <Input
                      id="headerSubtitle"
                      value={settings.headerSubtitle || ''}
                      onChange={(e) => handleChange('headerSubtitle', e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="headerColor">Header Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="headerColor"
                        type="color"
                        value={settings.headerColor || '#0066cc'}
                        onChange={(e) => handleChange('headerColor', e.target.value)}
                        className="w-12 h-8"
                        disabled={loading}
                      />
                      <Input 
                        value={settings.headerColor || '#0066cc'}
                        onChange={(e) => handleChange('headerColor', e.target.value)}
                        className="flex-1"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="headerHeight">Header Height (px)</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        id="headerHeight"
                        value={[settings.headerHeight || 60]}
                        min={20}
                        max={120}
                        step={5}
                        onValueChange={(value) => handleChange('headerHeight', value[0])}
                        disabled={loading}
                        className="flex-1"
                      />
                      <span className="w-12 text-center">{settings.headerHeight || 60}</span>
                    </div>
                  </div>
                </div>

                <Separator />
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showLogo">Show Logo</Label>
                    <Switch
                      id="showLogo"
                      checked={settings.showLogo}
                      onCheckedChange={(checked) => handleChange('showLogo', checked)}
                      disabled={loading}
                    />
                  </div>
                  
                  {settings.showLogo && (
                    <div>
                      <Label htmlFor="logoPosition">Logo Position</Label>
                      <Select
                        value={settings.logoPosition || 'left'}
                        onValueChange={(value) => handleChange('logoPosition', value)}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Footer Settings */}
        <TabsContent value="footer" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input
                    id="footerText"
                    value={settings.footerText || ''}
                    onChange={(e) => handleChange('footerText', e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="footerColor">Footer Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="footerColor"
                      type="color"
                      value={settings.footerColor || '#eeeeee'}
                      onChange={(e) => handleChange('footerColor', e.target.value)}
                      className="w-12 h-8"
                      disabled={loading}
                    />
                    <Input 
                      value={settings.footerColor || '#eeeeee'}
                      onChange={(e) => handleChange('footerColor', e.target.value)}
                      className="flex-1"
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="footerHeight">Footer Height (px)</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      id="footerHeight"
                      value={[settings.footerHeight || 30]}
                      min={20}
                      max={80}
                      step={5}
                      onValueChange={(value) => handleChange('footerHeight', value[0])}
                      disabled={loading}
                      className="flex-1"
                    />
                    <span className="w-12 text-center">{settings.footerHeight || 30}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="pageNumbering">Show Page Numbers</Label>
                  <Switch
                    id="pageNumbering"
                    checked={settings.pageNumbering}
                    onCheckedChange={(checked) => handleChange('pageNumbering', checked)}
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Page Settings */}
        <TabsContent value="page" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fontSize">Font Size (px)</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      id="fontSize"
                      value={[settings.fontSize || 10]}
                      min={8}
                      max={16}
                      step={1}
                      onValueChange={(value) => handleChange('fontSize', value[0])}
                      disabled={loading}
                      className="flex-1"
                    />
                    <span className="w-12 text-center">{settings.fontSize || 10}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="marginTop">Top Margin (px)</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        id="marginTop"
                        value={[settings.marginTop || 25]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(value) => handleChange('marginTop', value[0])}
                        disabled={loading}
                        className="flex-1"
                      />
                      <span className="w-12 text-center">{settings.marginTop || 25}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="marginBottom">Bottom Margin (px)</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        id="marginBottom"
                        value={[settings.marginBottom || 25]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(value) => handleChange('marginBottom', value[0])}
                        disabled={loading}
                        className="flex-1"
                      />
                      <span className="w-12 text-center">{settings.marginBottom || 25}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="marginLeft">Left Margin (px)</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        id="marginLeft"
                        value={[settings.marginLeft || 25]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(value) => handleChange('marginLeft', value[0])}
                        disabled={loading}
                        className="flex-1"
                      />
                      <span className="w-12 text-center">{settings.marginLeft || 25}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="marginRight">Right Margin (px)</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        id="marginRight"
                        value={[settings.marginRight || 25]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(value) => handleChange('marginRight', value[0])}
                        disabled={loading}
                        className="flex-1"
                      />
                      <span className="w-12 text-center">{settings.marginRight || 25}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Content Settings */}
        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="showBasicInfo">Show Basic Info</Label>
                  <Switch
                    id="showBasicInfo"
                    checked={settings.showBasicInfo}
                    onCheckedChange={(checked) => handleChange('showBasicInfo', checked)}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showRequesterDetails">Show Requester Details</Label>
                  <Switch
                    id="showRequesterDetails"
                    checked={settings.showRequesterDetails}
                    onCheckedChange={(checked) => handleChange('showRequesterDetails', checked)}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showPurposeInfo">Show Purpose Information</Label>
                  <Switch
                    id="showPurposeInfo"
                    checked={settings.showPurposeInfo}
                    onCheckedChange={(checked) => handleChange('showPurposeInfo', checked)}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showVendorDetails">Show Vendor Details</Label>
                  <Switch
                    id="showVendorDetails"
                    checked={settings.showVendorDetails}
                    onCheckedChange={(checked) => handleChange('showVendorDetails', checked)}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showItems">Show Items</Label>
                  <Switch
                    id="showItems"
                    checked={settings.showItems}
                    onCheckedChange={(checked) => handleChange('showItems', checked)}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showApprovals">Show Approval Flow</Label>
                  <Switch
                    id="showApprovals"
                    checked={settings.showApprovals}
                    onCheckedChange={(checked) => handleChange('showApprovals', checked)}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showAttachments">Show Attachments</Label>
                  <Switch
                    id="showAttachments"
                    checked={settings.showAttachments}
                    onCheckedChange={(checked) => handleChange('showAttachments', checked)}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showAuditInfo">Show Audit Information</Label>
                  <Switch
                    id="showAuditInfo"
                    checked={settings.showAuditInfo}
                    onCheckedChange={(checked) => handleChange('showAuditInfo', checked)}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showSignatures">Show Signature Lines</Label>
                  <Switch
                    id="showSignatures"
                    checked={settings.showSignatures}
                    onCheckedChange={(checked) => handleChange('showSignatures', checked)}
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Watermark Settings */}
        <TabsContent value="watermark" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="useWatermark">Use Watermark</Label>
                  <Switch
                    id="useWatermark"
                    checked={settings.useWatermark}
                    onCheckedChange={(checked) => handleChange('useWatermark', checked)}
                    disabled={loading}
                  />
                </div>
                
                {settings.useWatermark && (
                  <>
                    <div>
                      <Label htmlFor="watermarkText">Watermark Text</Label>
                      <Input
                        id="watermarkText"
                        value={settings.watermarkText || 'CONFIDENTIAL'}
                        onChange={(e) => handleChange('watermarkText', e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="watermarkOpacity">Opacity</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          id="watermarkOpacity"
                          value={[settings.watermarkOpacity ? settings.watermarkOpacity * 100 : 15]}
                          min={5}
                          max={50}
                          step={5}
                          onValueChange={(value) => handleChange('watermarkOpacity', value[0] / 100)}
                          disabled={loading}
                          className="flex-1"
                        />
                        <span className="w-12 text-center">{settings.watermarkOpacity ? Math.round(settings.watermarkOpacity * 100) : 15}%</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="watermarkPosition">Position</Label>
                      <Select
                        value={settings.watermarkPosition || 'center'}
                        onValueChange={(value) => handleChange('watermarkPosition', value)}
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="tile">Tiled</SelectItem>
                          <SelectItem value="corner">Corner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="watermarkRotation">Rotation (degrees)</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          id="watermarkRotation"
                          value={[settings.watermarkRotation || 45]}
                          min={0}
                          max={90}
                          step={5}
                          onValueChange={(value) => handleChange('watermarkRotation', value[0])}
                          disabled={loading}
                          className="flex-1"
                        />
                        <span className="w-12 text-center">{settings.watermarkRotation || 45}°</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Company Info Settings */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="companyAddress">Company Address</Label>
                  <Input
                    id="companyAddress"
                    value={settings.companyAddress || ''}
                    onChange={(e) => handleChange('companyAddress', e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="companyPhone">Phone Number</Label>
                  <Input
                    id="companyPhone"
                    value={settings.companyPhone || ''}
                    onChange={(e) => handleChange('companyPhone', e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="companyEmail">Email Address</Label>
                  <Input
                    id="companyEmail"
                    value={settings.companyEmail || ''}
                    onChange={(e) => handleChange('companyEmail', e.target.value)}
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="companyWebsite">Website</Label>
                  <Input
                    id="companyWebsite"
                    value={settings.companyWebsite || ''}
                    onChange={(e) => handleChange('companyWebsite', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => onSettingsChange(settings)}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Apply Changes'}
        </Button>
      </div>
    </div>
  );
};

export default PDFSettingsPanel;