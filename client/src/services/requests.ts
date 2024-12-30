import type { PurchaseRequest } from "@db/schema";
import { ERROR_MESSAGES } from "@/config/notification";

interface RequestError extends Error {
  status?: number;
  code?: string;
}

export async function createRequest(data: FormData) {
  try {
    const response = await fetch("/api/requests", {
      method: "POST",
      body: data,
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText || 'Failed to create request') as RequestError;
      error.status = response.status;
      throw error;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error in createRequest:', error);
    throw error;
  }
}

export async function updateRequest({
  id,
  data,
}: {
  id: number;
  data: Partial<PurchaseRequest>;
}) {
  try {
    const response = await fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to update request');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Update request error:', error);
    throw error;
  }
}

export async function saveDraft(id: number, data: Partial<PurchaseRequest>) {
  try {
    // Basic validation for draft
    if (!data.title && !data.description && (!data.items || data.items.length === 0)) {
      throw new Error('Draft must contain at least one field (title, description, or items)');
    }

    const result = await updateRequest({
      id,
      data: { 
        ...data, 
        status: "draft",
        isLocked: false,
        updatedAt: new Date().toISOString()
      },
    });
    return result;
  } catch (error) {
    console.error('Error saving draft:', error);
    throw error;
  }
}

export async function submitRequest(id: number, data: Partial<PurchaseRequest>) {
  try {
    // Validate required fields for submission
    const validationErrors = [];

    if (!data.title?.trim()) {
      validationErrors.push('Title is required');
    }
    if (!data.description?.trim()) {
      validationErrors.push('Description must be at least 10 characters');
    }
    if (!data.items || data.items.length === 0) {
      validationErrors.push('At least one item is required');
    }
    if (!data.purposeType) {
      validationErrors.push('Purpose type is required');
    }

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }

    const result = await updateRequest({
      id,
      data: { 
        ...data, 
        status: "pending",
        isLocked: true,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
    });
    return result;
  } catch (error) {
    console.error('Error submitting request:', error);
    throw error;
  }
}

export async function deleteRequest(id: number) {
  console.log('Deleting request:', id);
  const response = await fetch(`/api/requests/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to delete request:', errorText);
    throw new Error(errorText || 'Failed to delete request');
  }

  return response.json();
}