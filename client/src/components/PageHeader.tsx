import React from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface PageHeaderProps {
  title: string;
  description?: string;
  backLink?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, backLink, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col space-y-3 md:space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {backLink && (
            <Link href={backLink}>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="text-muted-foreground max-w-3xl">
          {description}
        </p>
      )}
    </div>
  );
}

export default PageHeader;