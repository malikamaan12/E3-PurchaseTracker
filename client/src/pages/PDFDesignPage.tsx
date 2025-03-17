import React from 'react';
import { useQuery } from '@tanstack/react-query';
import PDFDesignPanel from '../components/PDFDesignPanel';
import { PageHeader } from '../components/ui/page-header';
import { Container } from '../components/ui/container';
import { Button } from '../components/ui/button';
import { Link } from 'wouter';
import { ChevronLeft, FileText, Settings } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function PDFDesignPage() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: 'PDF Settings Saved',
      description: 'PDF branding settings have been updated successfully.',
      variant: 'default',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="PDF Design Configuration"
        description="Customize the appearance of PDF documents in the purchase management system"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Admin Panel
              </Button>
            </Link>
          </div>
        }
      />

      <Container className="py-6">
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Settings className="h-5 w-5 mr-2 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Branding Settings</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/requests/167/pdf" target="_blank">
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-1" />
                  View Sample PDF
                </Button>
              </Link>
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm p-6">
            <PDFDesignPanel onSave={handleSave} />
          </div>
        </div>
      </Container>
    </div>
  );
}