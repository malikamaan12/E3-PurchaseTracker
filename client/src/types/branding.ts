import { z } from 'zod';

// Branding schema definition
export const brandingSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  headerStyle: z.enum(["modern", "classic", "minimal"]),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  accentColor: z.string(),
  footerText: z.string().optional(),
  logo: z.string().optional(),
  logoMimeType: z.string().optional(),
  headerImage: z.string().optional(),
  headerImageMimeType: z.string().optional(),
  footerImage: z.string().optional(),
  footerImageMimeType: z.string().optional(),
});

// Types derived from the schema
export type BrandingData = z.infer<typeof brandingSchema>;
export type BrandingFormData = Omit<BrandingData, 'id'>;

// Form validation schema
export const brandingFormSchema = brandingSchema.extend({
  logo: z.any().optional(),
  headerImage: z.any().optional(),
  footerImage: z.any().optional(),
});

// Preview props interface
export interface BrandingPreviewProps {
  logo: string | null;
  logoMimeType?: string | null;
  headerImage?: string | null;
  headerImageMimeType?: string | null;
  footerImage?: string | null;
  footerImageMimeType?: string | null;
  headerStyle: "modern" | "classic" | "minimal";
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText?: string;
}