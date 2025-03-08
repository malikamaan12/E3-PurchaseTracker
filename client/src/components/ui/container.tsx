import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function Container({ 
  children, 
  className, 
  maxWidth = 'xl' 
}: ContainerProps) {
  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'xs':
        return 'max-w-xs';
      case 'sm':
        return 'max-w-sm';
      case 'md':
        return 'max-w-md';
      case 'lg':
        return 'max-w-lg';
      case 'xl':
        return 'max-w-xl';
      case '2xl':
        return 'max-w-2xl';
      case 'full':
        return 'max-w-full';
      default:
        return 'max-w-7xl';
    }
  };

  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6', getMaxWidthClass(), className)}>
      {children}
    </div>
  );
}