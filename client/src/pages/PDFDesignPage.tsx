/**
 * PDF Design Page
 * 
 * Page for configuring PDF template settings
 */

import React, { useEffect } from 'react';
import PDFSettingsPanel from '@/components/PDFSettingsPanel';

export default function PDFDesignPage() {
  useEffect(() => {
    document.title = "PDF Template Settings | E3 Purchase Management";
  }, []);
  
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">PDF Template Settings</h1>
        <p className="text-muted-foreground">
          Configure the appearance and behavior of generated PDF documents.
        </p>
      </div>
      
      <PDFSettingsPanel />
    </div>
  );
}