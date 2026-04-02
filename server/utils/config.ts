/**
 * PurchaseTracker Centralized Configuration
 * This ensures that both the Native Next.js API routes and the Express bridge 
 * use the exact same secrets and environment.
 */

// JWT Secret: Fallback is provided ONLY for development stability. 
// In production, the Vercel JWT_SECRET environment variable is MANDATORY.
export const JWT_SECRET = process.env.JWT_SECRET || "purchase-management-system-v1-secret-key";

// Authentication Cookie Name
export const TOKEN_COOKIE_NAME = "auth_token";

// Environment Check
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';