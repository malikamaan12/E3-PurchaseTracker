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
  status: z.string(),
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