import React from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  backLink?: string;
  backLabel?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  children,
  backLink,
  backLabel = "Back",
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        {backLink && (
          <Link href={backLink}>
            <Button
              variant="link"
              className="gap-1 p-0 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          </Link>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-lg text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-4">{children}</div>}
    </div>
  );
}