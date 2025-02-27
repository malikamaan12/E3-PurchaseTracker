import React, { createContext, useContext, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from "lucide-react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastContextType {
  showToast: (options: {
    title?: string;
    description: string;
    variant?: ToastVariant;
    duration?: number;
    action?: ToastActionElement;
  }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  const showToast = useCallback(({ 
    title, 
    description, 
    variant = 'info',
    duration = 5000,
    action
  }: {
    title?: string;
    description: string;
    variant?: ToastVariant;
    duration?: number;
    action?: ToastActionElement;
  }) => {
    const icons: Record<ToastVariant, React.ReactNode> = {
      success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      error: <AlertCircle className="h-5 w-5 text-destructive" />,
      warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
      info: <Info className="h-5 w-5 text-blue-500" />,
      loading: <Loader2 className="h-5 w-5 animate-spin" />
    };

    const styles: Record<ToastVariant, string> = {
      success: "border-green-500 bg-green-50 dark:bg-green-950",
      error: "border-destructive bg-destructive/10",
      warning: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
      info: "border-blue-500 bg-blue-50 dark:bg-blue-950",
      loading: "border-gray-500 bg-gray-50 dark:bg-gray-950"
    };

    // Convert our variant to shadcn/ui toast variant
    const toastVariant: ToastProps['variant'] = variant === 'error' ? 'destructive' : 'default';

    // Add debugging
    console.log('[ToastContext] Showing toast:', { title, description, variant, duration });

    const result = toast({
      variant: toastVariant,
      title,
      description,
      duration: variant === 'error' ? 7000 : duration,
      className: cn(
        "flex gap-3 border-2",
        styles[variant],
        {
          'animate-in slide-in-from-top-full': true,
        }
      ),
      icon: icons[variant],
      action
    });

    console.log('[ToastContext] Toast result:', result);
    return result;
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};