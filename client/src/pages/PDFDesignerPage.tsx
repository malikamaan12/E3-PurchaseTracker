import React from 'react';
import { PDFSettingsWithPreview } from '../components/PDFSettingsWithPreview';
import { Container } from '@/components/ui/container';

/**
 * PDF Designer Page
 * 
 * A comprehensive PDF template customization interface that provides:
 * 1. Real-time preview of PDF settings changes
 * 2. Organized settings panels for different aspects of the PDF
 * 3. Side-by-side view mode for simultaneous editing and previewing
 * 4. Mobile-responsive design with adaptive preview scaling
 */
export default function PDFDesignerPage() {
  return (
    <Container>
      <div className="py-6">
        <h1 className="text-3xl font-bold mb-2">PDF Template Designer</h1>
        <p className="text-muted-foreground mb-6">
          Customize your PDF template design with real-time preview. Changes are saved automatically.
        </p>
        
        <PDFSettingsWithPreview />
      </div>
    </Container>
  );
}