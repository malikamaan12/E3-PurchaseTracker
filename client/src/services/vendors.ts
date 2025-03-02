import { z } from 'zod';

// Vendor schema matches the database schema
export const vendorSchema = z.object({
  id: z.number(),
  companyName: z.string(),
  contactPerson: z.string(),
  contactNumber: z.string(),
  email: z.string().email(),
  address: z.string(),
  taxNumber: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  bankName: z.string(),
  accountNumber: z.string(),
  ibanNumber: z.string(),
  branchName: z.string(),
  category: z.string().optional(),
  payment_currency: z.string().optional(),
  rating: z.number().optional().nullable().default(0),
  status: z.string(),
  remarks: z.string().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export type Vendor = z.infer<typeof vendorSchema>;

export type CreateVendorInput = Omit<Vendor, "id" | "createdAt" | "updatedAt">;

export async function getVendors(): Promise<Vendor[]> {
  const response = await fetch("/api/vendors", {
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch vendors');
  }

  const data = await response.json();
  return data.map((vendor: any) => ({
    ...vendor,
    createdAt: vendor.createdAt ? new Date(vendor.createdAt) : null,
    updatedAt: vendor.updatedAt ? new Date(vendor.updatedAt) : null,
  }));
}

export async function getVendorById(id: number): Promise<Vendor> {
  const response = await fetch(`/api/vendors/${id}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch vendor');
  }

  const vendor = await response.json();
  return {
    ...vendor,
    createdAt: vendor.createdAt ? new Date(vendor.createdAt) : null,
    updatedAt: vendor.updatedAt ? new Date(vendor.updatedAt) : null,
  };
}

export async function createVendor(data: CreateVendorInput): Promise<Vendor> {
  const response = await fetch("/api/vendors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to create vendor');
  }

  const vendor = await response.json();
  return {
    ...vendor,
    createdAt: vendor.createdAt ? new Date(vendor.createdAt) : null,
    updatedAt: vendor.updatedAt ? new Date(vendor.updatedAt) : null,
  };
}

export async function updateVendor(id: number, data: Partial<CreateVendorInput> & { id?: number }): Promise<Vendor> {
  // Make sure we have a valid ID
  if (!id || isNaN(id)) {
    console.error('[updateVendor] Invalid vendor ID:', id);
    throw new Error('Invalid vendor ID');
  }

  console.log('[updateVendor] Raw input data:', data);
  console.log('[updateVendor] Vendor ID from parameter:', id);
  
  // Format data properly for the API
  // We'll explicitly include ID in both the URL and the body for extra certainty
  const formattedData = {
    ...data,
    // Make sure ID is set correctly 
    id: id,
    // We don't send these values directly
    createdAt: undefined,
    updatedAt: undefined
  };

  console.log(`[updateVendor] Updating vendor ${id} with data:`, formattedData);

  try {
    // Add timestamp to URL to prevent caching issues
    const timestamp = new Date().getTime();
    const url = `/api/vendors/${id}?_t=${timestamp}`;
    
    // Store raw response for debugging
    const rawResponse = await fetch(url, {
      method: "PATCH", // Using PATCH for partial updates
      headers: {
        "Content-Type": "application/json",
        // Add cache control headers
        "Cache-Control": "no-cache, no-store",
        "Pragma": "no-cache"
      },
      body: JSON.stringify(formattedData),
      credentials: "include",
    });

    // Clone the response for debugging purposes
    const responseClone = rawResponse.clone();
    const responseStatus = rawResponse.status;
    const responseStatusText = rawResponse.statusText;
    
    console.log(`[updateVendor] PATCH request to ${url}`);
    console.log(`[updateVendor] Response status: ${responseStatus} ${responseStatusText}`);
    console.log(`[updateVendor] Response headers:`, Object.fromEntries([...rawResponse.headers.entries()]));

    if (!rawResponse.ok) {
      let errorMessage = `Failed to update vendor: HTTP ${responseStatus} ${responseStatusText}`;
      
      try {
        // Try to parse as JSON first
        const errorData = await responseClone.json();
        console.error('[updateVendor] Error data (JSON):', errorData);
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch (jsonError) {
        // If not JSON, get as text
        try {
          const errorText = await responseClone.text();
          console.error('[updateVendor] Error text:', errorText);
          errorMessage = errorText || errorMessage;
        } catch (textError) {
          console.error('[updateVendor] Failed to get error text:', textError);
        }
      }
      
      console.error('[updateVendor] Final error message:', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const vendor = await rawResponse.json();
      console.log('[updateVendor] Success! Received updated vendor:', vendor);
      
      return {
        ...vendor,
        createdAt: vendor.createdAt ? new Date(vendor.createdAt) : null,
        updatedAt: vendor.updatedAt ? new Date(vendor.updatedAt) : null,
      };
    } catch (parseError) {
      console.error('[updateVendor] Failed to parse successful response:', parseError);
      
      // Fallback response if we can't parse the JSON
      return {
        id: id,
        companyName: data.companyName || 'Unknown',
        contactPerson: data.contactPerson || 'Unknown',
        contactNumber: data.contactNumber || 'Unknown',
        email: data.email || 'unknown@example.com',
        address: data.address || 'Unknown',
        taxNumber: data.taxNumber || null,
        registrationNumber: data.registrationNumber || null,
        bankName: data.bankName || 'Unknown',
        accountNumber: data.accountNumber || 'Unknown',
        ibanNumber: data.ibanNumber || 'Unknown',
        branchName: data.branchName || 'Unknown',
        status: data.status || 'active',
        createdAt: null,
        updatedAt: new Date(),
      };
    }
  } catch (error) {
    console.error('[updateVendor] Caught exception:', error);
    
    // Add more context to the error
    if (error instanceof Error) {
      throw new Error(`Vendor update failed: ${error.message}`);
    } else {
      throw new Error('Vendor update failed with an unknown error');
    }
  }
}