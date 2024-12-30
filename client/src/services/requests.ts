import type { PurchaseRequest } from "@db/schema";
import { ERROR_MESSAGES } from "@/config/notification";

interface RequestError extends Error {
  status?: number;
  code?: string;
}

// Helper function to handle API responses
async function handleResponse(response: Response, errorMessage: string) {
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${errorMessage}:`, errorText);
    const error = new Error(errorText || errorMessage) as RequestError;
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function updateRequest({
  id,
  data,
}: {
  id: number;
  data: Partial<PurchaseRequest>;
}) {
  try {
    console.log('Updating request:', { id, data });

    const response = await fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    const result = await handleResponse(response, 'Failed to update request');
    console.log('Request updated successfully:', result);
    return result;
  } catch (error) {
    console.error('Update request error:', error);
    throw error;
  }
}

export async function createRequest(data: FormData) {
  try {
    console.log('Creating request with data:', Object.fromEntries(data.entries()));

    const response = await fetch("/api/requests", {
      method: "POST",
      body: data,
      credentials: "include",
    });

    const result = await handleResponse(response, 'Failed to create request');
    console.log('Request created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in createRequest:', error);
    throw error;
  }
}

export async function saveDraft(id: number, data: Partial<PurchaseRequest>) {
  console.log('Saving draft:', { id, data });
  try {
    // Basic validation for draft - at least one field should be filled
    if (!data.title?.trim() && !data.description?.trim() && (!data.items || data.items.length === 0)) {
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
    console.log('Draft saved successfully:', result);
    return result;
  } catch (error) {
    console.error('Error saving draft:', error);
    throw error;
  }
}

export async function submitRequest(id: number, data: Partial<PurchaseRequest>) {
  console.log('Submitting request:', { id, data });
  try {
    // Validate required fields for submission
    const validationErrors = [];

    if (!data.title?.trim()) {
      validationErrors.push('Title is required');
    }
    if (!data.description?.trim()) {
      validationErrors.push('Description is required');
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
    console.log('Request submitted successfully:', result);
    return result;
  } catch (error) {
    console.error('Error submitting request:', error);
    throw error;
  }
}

export async function deleteRequest(id: number) {
  console.log('Deleting request:', id);
  try {
    const response = await fetch(`/api/requests/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    return await handleResponse(response, 'Failed to delete request');
  } catch (error) {
    console.error('Error deleting request:', error);
    throw error;
  }
}