/**
 * Utility functions for security masking of banking and financial credentials.
 */

export function maskAccountNumber(accountNumber?: string | null): string {
  if (!accountNumber) return "";
  const cleaned = accountNumber.trim();
  if (cleaned.length <= 4) return "••••";
  const lastFour = cleaned.slice(-4);
  return `•••• •••• ${lastFour}`;
}

export function maskIban(iban?: string | null): string {
  if (!iban) return "";
  const cleaned = iban.replace(/\s+/g, "").toUpperCase();
  if (cleaned.length <= 6) return "•••• ••••";
  
  const countryCode = cleaned.substring(0, 2);
  const lastFour = cleaned.slice(-4);
  
  // Format with standard 4-character grouping
  return `${countryCode}•• •••• •••• •••• •••• ${lastFour}`;
}

export function maskVendorBanking<T extends Record<string, any>>(vendor: T): T & { isBankingMasked: boolean } {
  if (!vendor) return vendor;
  return {
    ...vendor,
    accountNumber: maskAccountNumber(vendor.accountNumber),
    ibanNumber: maskIban(vendor.ibanNumber),
    isBankingMasked: true
  };
}

export function maskVendorList<T extends Record<string, any>>(vendors: T[]): (T & { isBankingMasked: boolean })[] {
  if (!Array.isArray(vendors)) return [];
  return vendors.map(v => maskVendorBanking(v));
}
