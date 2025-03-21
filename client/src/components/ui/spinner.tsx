import React from 'react';
import { cn } from "@/lib/utils";
import { Loader2 } from 'lucide-react';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label,
  className,
  ...props
}) => {
  // Map size to dimensions
  const sizeMap = {
    'sm': 'w-4 h-4',
    'md': 'w-6 h-6',
    'lg': 'w-8 h-8',
    'xl': 'w-12 h-12'
  };
  
  return (
    <div className={cn("flex flex-col items-center justify-center", className)} {...props}>
      <Loader2 className={cn("animate-spin", sizeMap[size])} />
      {label && (
        <span className="mt-2 text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
};

export default Spinner;