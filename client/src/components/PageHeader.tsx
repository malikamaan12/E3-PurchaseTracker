import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  description, 
  actions,
  className,
  ...props 
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 pb-6 md:flex-row md:items-center md:justify-between", className)} {...props}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="mt-4 flex items-center gap-2 md:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
}