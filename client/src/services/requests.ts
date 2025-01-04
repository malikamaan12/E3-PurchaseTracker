import type { PurchaseRequest, Vendor, SubPurpose } from "@db/schema";

interface RequestError extends Error {
  status?: number;
  code?: string;
}

interface CreateRequestData {
  title: string;
  description: string;
  status: string;
  items: Array<{
    name: string;
    quantity: number;
    description?: string;
    estimatedCost: number;
  }>;
  vendorId?: number;
  purposeType: string;
  subPurposeId?: number;
  priority: string;
  freightAmount?: number;
  currency?: string;
  attachments?: Array<{
    id: number;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  }>;
}

export async function createRequest(data: Partial<CreateRequestData>): Promise<PurchaseRequest> {
  try {
    console.log('Creating request with data:', data);

    // Ensure arrays are properly formatted
    const formattedData = {
      ...data,
      items: data.items || [],
      attachments: data.attachments || [],
      vendorId: data.vendorId || null,
      subPurposeId: data.subPurposeId || null,
      freightAmount: data.freightAmount || 0,
      currency: data.currency || 'QAR'
    };

    const response = await fetch("/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: formattedData,
        action: formattedData.status === 'draft' ? 'draft' : 'submit'
      }),
      credentials: "include",
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create request';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }

      const error = new Error(errorMessage) as RequestError;
      error.status = response.status;
      throw error;
    }

    return response.json();
  } catch (error) {
    console.error('Error in createRequest:', error);
    throw error;
  }
}

export async function getRequest(id: number): Promise<PurchaseRequest> {
  try {
    console.log('Fetching request:', id);

    const response = await fetch(`/api/requests/${id}?include=vendor,subPurpose,attachments,approvals`, {
      credentials: "include",
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch request';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Received request data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching request:', error);
    throw error;
  }
}

export async function updateRequest({
  id,
  data,
}: {
  id: number;
  data: Partial<CreateRequestData>;
}): Promise<PurchaseRequest> {
  try {
    console.log('Updating request:', id, 'with data:', data);

    // Ensure arrays are properly formatted
    const formattedData = {
      ...data,
      items: data.items || [],
      attachments: data.attachments || [],
      vendorId: data.vendorId || null,
      subPurposeId: data.subPurposeId || null,
      freightAmount: data.freightAmount || 0,
      currency: data.currency || 'QAR'
    };

    const response = await fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formattedData),
      credentials: "include",
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update request';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    console.error('Update request error:', error);
    throw error;
  }
}

export async function saveDraft(id: number, data: Partial<CreateRequestData>): Promise<PurchaseRequest> {
  try {
    // Basic validation for draft
    if (!data.title && !data.description && (!data.items || data.items.length === 0)) {
      throw new Error('Draft must contain at least one field (title, description, or items)');
    }

    return await updateRequest({
      id,
      data: { 
        ...data, 
        status: "draft",
        isLocked: false,
        updatedAt: new Date().toISOString()
      },
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    throw error;
  }
}

export async function submitRequest(id: number, data: Partial<CreateRequestData>): Promise<PurchaseRequest> {
  try {
    // Validate required fields for submission
    const validationErrors = [];

    if (!data.title?.trim()) {
      validationErrors.push('Title is required');
    }
    if (!data.description?.trim() || data.description.length < 10) {
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

    return await updateRequest({
      id,
      data: { 
        ...data, 
        status: "pending",
        isLocked: true,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
    });
  } catch (error) {
    console.error('Error submitting request:', error);
    throw error;
  }
}

export async function deleteRequest(id: number): Promise<void> {
  try {
    console.log('Deleting request:', id);

    const response = await fetch(`/api/requests/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      let errorMessage = 'Failed to delete request';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    console.error('Delete request error:', error);
    throw error;
  }
}