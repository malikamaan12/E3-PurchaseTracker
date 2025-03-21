import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { PdfSettings } from '../services/pdfService';
import { Button } from '@/components/ui/button';
import { UploadIcon } from 'lucide-react';

interface PDFSettingsPanelProps {
  settings: Partial<PdfSettings>;
  onSettingsChange: (settings: Partial<PdfSettings>) => void;
  loading?: boolean;
}

const fontFamilies = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Georgia',
  'Calibri',
  'Tahoma'
];

const PDFSettingsPanel: React.FC<PDFSettingsPanelProps> = ({ 
  settings,
  onSettingsChange,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState('general');
  
  const handleChange = (field: keyof PdfSettings, value: any) => {
    onSettingsChange({
      ...settings,
      [field]: value
    });
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'headerImage' | 'footerImage') => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Create a temporary URL for preview
    const url = URL.createObjectURL(file);
    
    // In a real implementation, you would upload the file to the server
    // and get back a permanent URL
    onSettingsChange({
      ...settings,
      [field]: url
    });
  };
  
  return (
    <div className="pdf-settings-panel">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-6">
          <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
          <TabsTrigger value="header" className="flex-1">Header & Footer</TabsTrigger>
          <TabsTrigger value="content" className="flex-1">Content</TabsTrigger>
          <TabsTrigger value="watermark" className="flex-1">Watermark</TabsTrigger>
          <TabsTrigger value="company" className="flex-1">Company</TabsTrigger>
        </TabsList>
        
        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fontFamily">Font Family</Label>
              <Select 
                value={settings.fontFamily} 
                onValueChange={(value) => handleChange('fontFamily', value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a font family" />
                </SelectTrigger>
                <SelectContent>
                  {fontFamilies.map((font) => (
                    <SelectItem key={font} value={font}>{font}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fontSize">Font Size ({settings.fontSize}pt)</Label>
              <Slider 
                id="fontSize" 
                min={8} 
                max={16}
                step={1}
                value={[settings.fontSize || 10]} 
                onValueChange={(value) => handleChange('fontSize', value[0])}
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marginTop">Top Margin ({settings.marginTop}px)</Label>
              <Slider 
                id="marginTop" 
                min={0} 
                max={100}
                step={1}
                value={[settings.marginTop || 25]} 
                onValueChange={(value) => handleChange('marginTop', value[0])}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="marginBottom">Bottom Margin ({settings.marginBottom}px)</Label>
              <Slider 
                id="marginBottom" 
                min={0} 
                max={100}
                step={1}
                value={[settings.marginBottom || 25]} 
                onValueChange={(value) => handleChange('marginBottom', value[0])}
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marginLeft">Left Margin ({settings.marginLeft}px)</Label>
              <Slider 
                id="marginLeft" 
                min={0} 
                max={100}
                step={1}
                value={[settings.marginLeft || 25]} 
                onValueChange={(value) => handleChange('marginLeft', value[0])}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="marginRight">Right Margin ({settings.marginRight}px)</Label>
              <Slider 
                id="marginRight" 
                min={0} 
                max={100}
                step={1}
                value={[settings.marginRight || 25]} 
                onValueChange={(value) => handleChange('marginRight', value[0])}
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="pt-2 border-t mt-4">
            <h3 className="text-sm font-medium mb-2">Display Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="showHeader"
                  checked={settings.showHeader !== false}
                  onCheckedChange={(checked) => handleChange('showHeader', checked)}
                  disabled={loading}
                />
                <Label htmlFor="showHeader">Show Header</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="showFooter"
                  checked={settings.showFooter !== false}
                  onCheckedChange={(checked) => handleChange('showFooter', checked)}
                  disabled={loading}
                />
                <Label htmlFor="showFooter">Show Footer</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="showLogo"
                  checked={settings.showLogo !== false}
                  onCheckedChange={(checked) => handleChange('showLogo', checked)}
                  disabled={loading}
                />
                <Label htmlFor="showLogo">Show Logo</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="pageNumbering"
                  checked={settings.pageNumbering !== false}
                  onCheckedChange={(checked) => handleChange('pageNumbering', checked)}
                  disabled={loading}
                />
                <Label htmlFor="pageNumbering">Page Numbering</Label>
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Header & Footer Settings */}
        <TabsContent value="header" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="headerTitle">Header Title</Label>
              <Input 
                id="headerTitle" 
                value={settings.headerTitle || ''} 
                onChange={(e) => handleChange('headerTitle', e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="headerSubtitle">Header Subtitle</Label>
              <Input 
                id="headerSubtitle" 
                value={settings.headerSubtitle || ''} 
                onChange={(e) => handleChange('headerSubtitle', e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="headerColor">Header Color</Label>
              <div className="flex items-center space-x-2">
                <Input 
                  type="color"
                  id="headerColor" 
                  value={settings.headerColor || '#0066cc'} 
                  onChange={(e) => handleChange('headerColor', e.target.value)}
                  className="w-24"
                  disabled={loading}
                />
                <Input 
                  type="text"
                  value={settings.headerColor || '#0066cc'} 
                  onChange={(e) => handleChange('headerColor', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="headerHeight">Header Height ({settings.headerHeight}px)</Label>
              <Slider 
                id="headerHeight" 
                min={20} 
                max={150}
                step={1}
                value={[settings.headerHeight || 60]} 
                onValueChange={(value) => handleChange('headerHeight', value[0])}
                disabled={loading}
              />
            </div>
            
            <div className="mt-2 space-y-2">
              <Label htmlFor="headerImageUpload">Header Image</Label>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                  onClick={() => document.getElementById('headerImageUpload')?.click()}
                >
                  <UploadIcon className="w-4 h-4 mr-2" />
                  Upload Header Image
                </Button>
                <input
                  id="headerImageUpload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'headerImage')}
                  style={{ display: 'none' }}
                  disabled={loading}
                />
              </div>
              {settings.headerImage && (
                <div className="mt-2">
                  <img
                    src={settings.headerImage}
                    alt="Header"
                    className="h-10 object-contain border rounded"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-4">Footer Settings</h3>
            
            <div className="space-y-2">
              <Label htmlFor="footerText">Footer Text</Label>
              <Input 
                id="footerText" 
                value={settings.footerText || ''} 
                onChange={(e) => handleChange('footerText', e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2 mt-4">
              <Label htmlFor="footerColor">Footer Color</Label>
              <div className="flex items-center space-x-2">
                <Input 
                  type="color"
                  id="footerColor" 
                  value={settings.footerColor || '#f5f5f5'} 
                  onChange={(e) => handleChange('footerColor', e.target.value)}
                  className="w-24"
                  disabled={loading}
                />
                <Input 
                  type="text"
                  value={settings.footerColor || '#f5f5f5'} 
                  onChange={(e) => handleChange('footerColor', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="space-y-2 mt-4">
              <Label htmlFor="footerHeight">Footer Height ({settings.footerHeight}px)</Label>
              <Slider 
                id="footerHeight" 
                min={20} 
                max={100}
                step={1}
                value={[settings.footerHeight || 30]} 
                onValueChange={(value) => handleChange('footerHeight', value[0])}
                disabled={loading}
              />
            </div>
            
            <div className="mt-4 space-y-2">
              <Label htmlFor="footerImageUpload">Footer Image</Label>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                  onClick={() => document.getElementById('footerImageUpload')?.click()}
                >
                  <UploadIcon className="w-4 h-4 mr-2" />
                  Upload Footer Image
                </Button>
                <input
                  id="footerImageUpload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'footerImage')}
                  style={{ display: 'none' }}
                  disabled={loading}
                />
              </div>
              {settings.footerImage && (
                <div className="mt-2">
                  <img
                    src={settings.footerImage}
                    alt="Footer"
                    className="h-10 object-contain border rounded"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-4">Logo Settings</h3>
            
            <div className="space-y-2">
              <Label htmlFor="logoPositon">Logo Position</Label>
              <Select 
                value={settings.logoPosition} 
                onValueChange={(value) => handleChange('logoPosition', value as 'left' | 'center' | 'right')}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select logo position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="mt-4 space-y-2">
              <Label htmlFor="logoUpload">Logo Image</Label>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                  onClick={() => document.getElementById('logoUpload')?.click()}
                >
                  <UploadIcon className="w-4 h-4 mr-2" />
                  Upload Logo
                </Button>
                <input
                  id="logoUpload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'logo')}
                  style={{ display: 'none' }}
                  disabled={loading}
                />
              </div>
              {settings.logo && (
                <div className="mt-2">
                  <img
                    src={settings.logo}
                    alt="Logo"
                    className="h-10 object-contain border rounded"
                  />
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        {/* Content Visibility Settings */}
        <TabsContent value="content" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="showBasicInfo"
                checked={settings.showBasicInfo !== false}
                onCheckedChange={(checked) => handleChange('showBasicInfo', checked)}
                disabled={loading}
              />
              <Label htmlFor="showBasicInfo">Show Basic Information</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showRequesterDetails"
                checked={settings.showRequesterDetails !== false}
                onCheckedChange={(checked) => handleChange('showRequesterDetails', checked)}
                disabled={loading}
              />
              <Label htmlFor="showRequesterDetails">Show Requester Details</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showDateOfRequest"
                checked={settings.showDateOfRequest !== false}
                onCheckedChange={(checked) => handleChange('showDateOfRequest', checked)}
                disabled={loading}
              />
              <Label htmlFor="showDateOfRequest">Show Request Date</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showPurposeInfo"
                checked={settings.showPurposeInfo !== false}
                onCheckedChange={(checked) => handleChange('showPurposeInfo', checked)}
                disabled={loading}
              />
              <Label htmlFor="showPurposeInfo">Show Purpose Information</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showVendorDetails"
                checked={settings.showVendorDetails !== false}
                onCheckedChange={(checked) => handleChange('showVendorDetails', checked)}
                disabled={loading}
              />
              <Label htmlFor="showVendorDetails">Show Vendor Details</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showItems"
                checked={settings.showItems !== false}
                onCheckedChange={(checked) => handleChange('showItems', checked)}
                disabled={loading}
              />
              <Label htmlFor="showItems">Show Items List</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showApprovals"
                checked={settings.showApprovals !== false}
                onCheckedChange={(checked) => handleChange('showApprovals', checked)}
                disabled={loading}
              />
              <Label htmlFor="showApprovals">Show Approvals</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showAttachments"
                checked={settings.showAttachments !== false}
                onCheckedChange={(checked) => handleChange('showAttachments', checked)}
                disabled={loading}
              />
              <Label htmlFor="showAttachments">Show Attachments</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showSignatures"
                checked={settings.showSignatures !== false}
                onCheckedChange={(checked) => handleChange('showSignatures', checked)}
                disabled={loading}
              />
              <Label htmlFor="showSignatures">Show Signature Lines</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="showAuditInfo"
                checked={settings.showAuditInfo === true}
                onCheckedChange={(checked) => handleChange('showAuditInfo', checked)}
                disabled={loading}
              />
              <Label htmlFor="showAuditInfo">Show Audit Information</Label>
            </div>
          </div>
        </TabsContent>
        
        {/* Watermark Settings */}
        <TabsContent value="watermark" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              id="useWatermark"
              checked={settings.useWatermark === true}
              onCheckedChange={(checked) => handleChange('useWatermark', checked)}
              disabled={loading}
            />
            <Label htmlFor="useWatermark">Enable Watermark</Label>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="watermarkText">Watermark Text</Label>
              <Input 
                id="watermarkText" 
                value={settings.watermarkText || ''} 
                onChange={(e) => handleChange('watermarkText', e.target.value)}
                disabled={loading || settings.useWatermark !== true}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="watermarkOpacity">Opacity ({settings.watermarkOpacity && Math.round(settings.watermarkOpacity * 100)}%)</Label>
              <Slider 
                id="watermarkOpacity" 
                min={0.05} 
                max={0.5}
                step={0.01}
                value={[settings.watermarkOpacity || 0.15]} 
                onValueChange={(value) => handleChange('watermarkOpacity', value[0])}
                disabled={loading || settings.useWatermark !== true}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="watermarkPosition">Watermark Position</Label>
              <Select 
                value={settings.watermarkPosition} 
                onValueChange={(value) => handleChange('watermarkPosition', value as 'center' | 'tile' | 'corner')}
                disabled={loading || settings.useWatermark !== true}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select watermark position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="tile">Tiled</SelectItem>
                  <SelectItem value="corner">Corner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="watermarkRotation">Rotation ({settings.watermarkRotation}°)</Label>
              <Slider 
                id="watermarkRotation" 
                min={0} 
                max={90}
                step={1}
                value={[settings.watermarkRotation || 45]} 
                onValueChange={(value) => handleChange('watermarkRotation', value[0])}
                disabled={loading || settings.useWatermark !== true}
              />
            </div>
          </div>
        </TabsContent>
        
        {/* Company Information */}
        <TabsContent value="company" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Company Address</Label>
              <Input 
                id="companyAddress" 
                value={settings.companyAddress || ''} 
                onChange={(e) => handleChange('companyAddress', e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="companyPhone">Company Phone</Label>
              <Input 
                id="companyPhone" 
                value={settings.companyPhone || ''} 
                onChange={(e) => handleChange('companyPhone', e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="companyEmail">Company Email</Label>
              <Input 
                id="companyEmail" 
                value={settings.companyEmail || ''} 
                onChange={(e) => handleChange('companyEmail', e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="companyWebsite">Company Website</Label>
              <Input 
                id="companyWebsite" 
                value={settings.companyWebsite || ''} 
                onChange={(e) => handleChange('companyWebsite', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PDFSettingsPanel;