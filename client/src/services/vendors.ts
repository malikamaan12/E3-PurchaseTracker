import type { Vendor } from "@db/schema";

export async function getVendors() {
  const response = await fetch("/api/vendors", {
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch vendors');
  }

  return response.json();
}

export async function getVendorById(id: number) {
  const response = await fetch(`/api/vendors/${id}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch vendor');
  }

  return response.json();
}

export async function createVendor(data: Omit<Vendor, "id" | "createdAt" | "updatedAt" | "rating" | "status">) {
  const response = await fetch("/api/vendors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...data, status: "active" }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to create vendor');
  }

  return response.json();
}