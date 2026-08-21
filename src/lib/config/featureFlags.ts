/**
 * PurchaseTracker Feature Flags Configuration
 * 
 * Provides centralized toggle controls for progressive rollout, canary testing,
 * and emergency non-destructive rollback capabilities.
 */

export interface VendorFeatureFlags {
  FF_QUICK_VENDOR_CREATE: boolean;
  FF_DYNAMIC_COMPLIANCE_ENGINE: boolean;
  FF_NON_BLOCKING_PR: boolean;
  FF_COMPLIANCE_MATRIX_UI: boolean;
}

function parseBooleanEnv(val: string | undefined, defaultValue: boolean): boolean {
  if (val === undefined || val === "") return defaultValue;
  return val.toLowerCase() === "true" || val === "1";
}

export const featureFlags: VendorFeatureFlags = {
  // Enables Universal Fast Vendor Creation dialog and API
  FF_QUICK_VENDOR_CREATE: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_QUICK_VENDOR_CREATE, true),

  // Enables Multi-Dimensional dynamic compliance evaluation and versioned rule matrix
  FF_DYNAMIC_COMPLIANCE_ENGINE: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_DYNAMIC_COMPLIANCE_ENGINE, true),

  // Enforces non-blocking Purchase Request flow with advisory warning notices & immutable snapshots
  FF_NON_BLOCKING_PR: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_NON_BLOCKING_PR, true),

  // Renders the Vendor Compliance Matrix Spreadsheet Grid tab in the UI
  FF_COMPLIANCE_MATRIX_UI: parseBooleanEnv(process.env.NEXT_PUBLIC_FF_COMPLIANCE_MATRIX_UI, true),
};
