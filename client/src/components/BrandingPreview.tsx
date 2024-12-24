import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BrandingPreviewProps {
  logo: string | null;
  logoMimeType?: string;
  headerStyle: "modern" | "classic" | "minimal";
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText?: string;
}

export default function BrandingPreview({
  logo,
  logoMimeType,
  headerStyle,
  companyName,
  primaryColor,
  secondaryColor,
  accentColor,
  footerText
}: BrandingPreviewProps) {
  const previewStyles = {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
    '--accent-color': accentColor,
  } as React.CSSProperties;

  const headerClasses = {
    modern: "flex items-center justify-between p-4 bg-gradient-to-r from-[var(--primary-color)] to-[var(--accent-color)]",
    classic: "flex items-center justify-between p-4 bg-[var(--primary-color)] border-b-4 border-[var(--accent-color)]",
    minimal: "flex items-center justify-between p-4 bg-white border-b border-[var(--primary-color)]"
  };

  const logoClasses = {
    modern: "h-12 w-auto",
    classic: "h-16 w-auto",
    minimal: "h-10 w-auto"
  };

  const titleClasses = {
    modern: "text-white text-2xl font-bold",
    classic: "text-white text-2xl font-serif",
    minimal: "text-[var(--primary-color)] text-xl font-medium"
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-0">
        <h3 className="text-lg font-semibold">Branding Preview</h3>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Header Preview */}
        <div className={cn("rounded-t-lg shadow", headerClasses[headerStyle])}>
          <div className="flex items-center gap-3">
            {logo && (
              <img
                src={`data:${logoMimeType};base64,${logo}`}
                alt="Company Logo"
                className={logoClasses[headerStyle]}
              />
            )}
            <h1 className={titleClasses[headerStyle]}>{companyName}</h1>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-4 bg-[var(--secondary-color)] rounded-lg">
          <h2 className="text-[var(--primary-color)] font-semibold mb-2">
            Sample Content
          </h2>
          <p className="text-gray-600">
            This preview shows how your branding colors will appear throughout the application.
            The primary color is used for important elements, while the secondary color provides
            contrast and the accent color adds visual interest.
          </p>
          <button
            className="mt-3 px-4 py-2 bg-[var(--primary-color)] text-white rounded-md hover:bg-[var(--accent-color)] transition-colors"
          >
            Sample Button
          </button>
        </div>

        {/* Footer Preview */}
        {footerText && (
          <div className="mt-4 p-3 text-center text-sm text-gray-500 border-t border-gray-200">
            {footerText}
          </div>
        )}

        {/* Color Palette */}
        <div className="flex gap-4 pt-4">
          <div className="flex-1 space-y-1">
            <div
              className="h-8 rounded"
              style={{ backgroundColor: primaryColor }}
            />
            <p className="text-xs text-center">Primary Color</p>
          </div>
          <div className="flex-1 space-y-1">
            <div
              className="h-8 rounded"
              style={{ backgroundColor: secondaryColor }}
            />
            <p className="text-xs text-center">Secondary Color</p>
          </div>
          <div className="flex-1 space-y-1">
            <div
              className="h-8 rounded"
              style={{ backgroundColor: accentColor }}
            />
            <p className="text-xs text-center">Accent Color</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
