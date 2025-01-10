import React, { createContext, useContext } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from "lucide-react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';

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

  const showToast = ({ 
    title, 
    description, 
    variant = 'default',
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
      loading: <Loader2 className="h-5 w-5 animate-spin" />,
      default: null
    };

    const styles: Record<ToastVariant, string> = {
      success: "border-green-500 bg-green-50 dark:bg-green-950",
      error: "border-destructive bg-destructive/10",
      warning: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
      info: "border-blue-500 bg-blue-50 dark:bg-blue-950",
      loading: "border-gray-500 bg-gray-50 dark:bg-gray-950",
      default: ""
    };

    const toastProps: ToastProps & { icon?: React.ReactNode } = {
      variant: variant === 'error' ? 'destructive' : 'default',
      title: title,
      description: description,
      duration: variant === 'error' ? 7000 : duration,
      className: cn(
        "flex gap-3 border-2",
        styles[variant],
        {
          'animate-in slide-in-from-top-full': true,
        }
      )
    };

    if (icons[variant]) {
      toastProps.className = cn(toastProps.className, "pl-2");
      toastProps.icon = icons[variant];
    }

    if (action) {
      toastProps.action = action;
    }

    toast(toastProps);
  };

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