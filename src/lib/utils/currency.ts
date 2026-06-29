/**
 * Currency Utility for Enterprise QAR Conversions
 */

export async function getExchangeRateToQAR(currency: string): Promise<number> {
  if (!currency) return 1.0;
  
  const code = currency.toUpperCase().trim();
  if (code === 'QAR') return 1.0;
  
  // Enterprise stable fallback rates. 
  // USD -> QAR is pegged. Others are approximate safe averages.
  const fallbacks: Record<string, number> = {
    'USD': 3.64,
    'EUR': 3.95,
    'GBP': 4.60,
    'AED': 0.99,
    'SAR': 0.97,
    'CNY': 0.51,
    'INR': 0.043,
  };

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${code}`, { 
      next: { revalidate: 3600 } // Cache for 1 hour to prevent rate limiting
    });
    if (!res.ok) throw new Error("Failed to fetch exchange rate");
    const data = await res.json();
    
    // open.er-api returns the rates relative to the base currency
    // So data.rates["QAR"] will give us how many QAR is 1 unit of `code`
    if (data && data.rates && data.rates["QAR"]) {
      return data.rates["QAR"];
    }
    
    return fallbacks[code] || 1.0;
  } catch (error) {
    console.warn(`[Currency] Failed to fetch live rate for ${code}, using fallback`);
    return fallbacks[code] || 1.0;
  }
}
