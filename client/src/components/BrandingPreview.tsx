import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HeaderConfig, FooterConfig } from "@db/schema";

interface BrandingPreviewProps {
  logo: string | null;
  logoMimeType?: string | null;
  headerConfig: HeaderConfig;
  footerConfig: FooterConfig;
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  theme: "light" | "dark";
  fontFamily: string;
  headerImage?: string | null;
  headerImageMimeType?: string | null;
  footerImage?: string | null;
  footerImageMimeType?: string | null;
}

export default function BrandingPreview({
  logo,
  logoMimeType,
  headerConfig,
  footerConfig,
  companyName,
  primaryColor,
  secondaryColor,
  accentColor,
  theme,
  fontFamily,
  headerImage,
  headerImageMimeType,
  footerImage,
  footerImageMimeType,
}: BrandingPreviewProps) {
  const previewStyles = {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
    '--accent-color': accentColor,
    fontFamily,
  } as React.CSSProperties;

  const headerClasses = {
    modern: "flex items-center justify-between p-4 bg-gradient-to-r from-[var(--primary-color)] to-[var(--accent-color)]",
    classic: "flex items-center justify-between p-4 bg-[var(--primary-color)] border-b-4 border-[var(--accent-color)]",
    minimal: "flex items-center justify-between p-4 bg-white border-b border-[var(--primary-color)]"
  };

  return (
    <Card className={cn("w-full overflow-hidden", theme === "dark" ? "dark" : "")}>
      <CardHeader className="pb-0">
        <h3 className="text-lg font-semibold">Branding Preview</h3>
      </CardHeader>
      <CardContent className="space-y-4 pt-4" style={previewStyles}>
        {/* Header Preview */}
        <div className={cn(
          "rounded-t-lg shadow",
          headerClasses[headerConfig.style],
          `text-${headerConfig.textAlignment}`
        )}>
          <div className="flex items-center gap-3">
            {headerConfig.showLogo && logo && (
              <img
                src={`data:${logoMimeType};base64,${logo}`}
                alt="Company Logo"
                className="h-12 w-auto object-contain"
              />
            )}
            {headerImage && (
              <img
                src={`data:${headerImageMimeType};base64,${headerImage}`}
                alt="Header Image"
                className="h-12 w-auto object-contain"
              />
            )}
            <div className="flex-1" style={{ fontSize: `${headerConfig.fontSize}px` }}>
              <h1 className={cn(
                "font-bold",
                headerConfig.style === "minimal" ? "text-[var(--primary-color)]" : "text-white"
              )}>
                {companyName}
              </h1>
              {headerConfig.customText && (
                <p className={cn(
                  "text-sm mt-1",
                  headerConfig.style === "minimal" ? "text-gray-600" : "text-white/80"
                )}>
                  {headerConfig.customText}
                </p>
              )}
            </div>
            <div className="text-right text-sm">
              {headerConfig.showDate && (
                <div className={headerConfig.style === "minimal" ? "text-gray-600" : "text-white/80"}>
                  {new Date().toLocaleDateString()}
                </div>
              )}
              {headerConfig.showPageNumber && (
                <div className={headerConfig.style === "minimal" ? "text-gray-600" : "text-white/80"}>
                  Page 1
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-6 bg-[var(--secondary-color)] rounded-lg">
          <h2 className="text-[var(--primary-color)] font-semibold mb-3">
            Document Preview
          </h2>
          <div className="space-y-2">
            <div className="h-3 bg-gray-300 rounded w-full"></div>
            <div className="h-3 bg-gray-300 rounded w-4/5"></div>
            <div className="h-3 bg-gray-300 rounded w-3/4"></div>
          </div>
        </div>

        {/* Footer Preview */}
        <div className={cn(
          "p-4 border-t border-gray-200",
          `text-${footerConfig.textAlignment}`,
          "text-gray-600"
        )}>
          <div className="flex items-center justify-between" style={{ fontSize: `${footerConfig.fontSize}px` }}>
            <div className="flex items-center gap-2">
              {footerConfig.showLogo && logo && (
                <img
                  src={`data:${logoMimeType};base64,${logo}`}
                  alt="Footer Logo"
                  className="h-8 w-auto object-contain"
                />
              )}
              {footerImage && (
                <img
                  src={`data:${footerImageMimeType};base64,${footerImage}`}
                  alt="Footer Image"
                  className="h-8 w-auto object-contain"
                />
              )}
              {footerConfig.customText && (
                <span>{footerConfig.customText}</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {footerConfig.showCopyright && (
                <span>© {new Date().getFullYear()} {companyName}</span>
              )}
              {footerConfig.showPageNumber && (
                <span>Page 1</span>
              )}
            </div>
          </div>
        </div>

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