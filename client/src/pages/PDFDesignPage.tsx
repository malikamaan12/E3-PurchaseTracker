import React from 'react';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/ui/header';
import { Container } from '@/components/ui/container';
import PDFDesignPanel from '@/components/PDFDesignPanel';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function PDFDesignPage() {
  const { user, isLoading } = useUser();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    toast({
      title: 'Access Denied',
      description: 'You do not have permission to access this page',
      variant: 'destructive',
    });
    
    // Redirect to home page
    setLocation('/');
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="PDF Design Settings" description="Customize the look and feel of PDF documents" />
      
      <Container className="flex-1 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">PDF Design Settings</h1>
          <Button variant="outline" onClick={() => setLocation('/admin')}>
            Back to Admin
          </Button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <PDFDesignPanel
            onSave={(settings) => {
              toast({
                title: 'Settings Saved',
                description: 'PDF design settings have been updated successfully',
                variant: 'default',
              });
            }}
          />
        </div>
      </Container>
    </div>
  );
}