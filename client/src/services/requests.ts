import type { PurchaseRequest } from "@db/schema";
import ToastService from "./toast.service";

interface RequestError extends Error {
  status?: number;
  code?: string;
}

export interface RequestFilters {
  status?: string[];
  priority?: string[];
  department?: string[];
  purposeType?: string;
  subPurposeId?: number | null;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
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
      currency: data.currency || 'QAR',
      additionalApprovers: data.additionalApprovers || [] // Ensure additionalApprovers is included
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
    const response = await fetch(`/api/requests/${id}?include=vendor,subPurpose,attachments,approvals`, {
      credentials: "include",
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch request details';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || `Failed to fetch request: ${response.status}`;
      }

      // Show toast for fetch errors
      ToastService.error(
        "Error Loading Request",
        errorMessage,
        7000
      );

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Log error for debugging
    console.error('Error fetching request:', error);

    // If it's not already a handled error, show a toast
    if (!(error instanceof Error && error.message.includes('Failed to fetch request'))) {
      ToastService.error(
        "Error Loading Request",
        "There was a problem loading the request details. Please try again.",
        7000
      );
    }

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

    // Handle draft requests specially
    const isDraft = data.status === 'draft';
    
    // Ensure arrays are properly formatted
    const formattedData = {
      ...data,
      // For draft requests, we'll be more lenient with validation
      items: Array.isArray(data.items) ? data.items : (data.items || []),
      attachments: data.attachments || [],
      // For draft requests, allow null values for optional fields
      vendorId: isDraft ? (data.vendorId || null) : data.vendorId,
      subPurposeId: isDraft ? (data.subPurposeId || null) : data.subPurposeId,
      freightAmount: data.freightAmount || 0,
      currency: data.currency || 'QAR',
      additionalApprovers: data.additionalApprovers || [] // Ensure additionalApprovers is included
    };
    
    console.log('Formatted draft data for server:', isDraft, formattedData);

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

    // Special handling for draft requests - make sure all required fields are set
    // even if they're empty or have default values
    const draftData = {
      ...data,
      status: "draft",
      isLocked: false,
      updatedAt: new Date().toISOString()
    };

    return await updateRequest({
      id,
      data: draftData
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    throw error;
  }
}

export async function submitRequest(id: number, data: Partial<CreateRequestData>): Promise<PurchaseRequest> {
  try {
    console.log('Validating submission data:', data);
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
    if (!data.subPurposeId) {
      validationErrors.push('Sub-purpose is required');
    }
    if (!data.vendorId) {
      validationErrors.push('Vendor selection is required');
    }
    
    // Validate each item
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        if (!item.name || !item.name.trim()) {
          validationErrors.push(`Item ${index + 1} name is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          validationErrors.push(`Item ${index + 1} quantity must be greater than 0`);
        }
        if (typeof item.estimatedCost !== 'number' || item.estimatedCost <= 0) {
          validationErrors.push(`Item ${index + 1} estimated cost must be greater than 0`);
        }
      });
    }

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }

    return await updateRequest({
      id,
      data: { 
        ...data, 
        status: "pending",
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

export async function getRequests(filters?: RequestFilters) {
  try {
    // Build query string from filters
    const queryParams = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v));
          } else {
            queryParams.append(key, String(value));
          }
        }
      });
    }

    const queryString = queryParams.toString();
    const url = `/api/requests${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include'
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch requests';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || `Failed to fetch requests: ${response.status}`;
      }

      // Show toast for fetch errors
      ToastService.error(
        "Error Loading Requests",
        errorMessage,
        7000 // longer duration for error messages
      );

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Log error for debugging
    console.error('Error fetching requests:', error);

    // If it's not already a handled error, show a toast
    if (!(error instanceof Error && error.message.includes('Failed to fetch requests'))) {
      ToastService.error(
        "Error Loading Requests",
        "There was a problem loading the requests. Please try again.",
        7000
      );
    }

    throw error;
  }
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
  vendorId?: number | null;
  purposeType: string;
  subPurposeId?: number | null;
  priority: string;
  freightAmount?: number;
  currency?: string;
  additionalApprovers?: string[]; // Add additionalApprovers to the type
  attachments?: Array<{
    id: number;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  }>;
  isLocked?: boolean; // Add isLocked to the type to fix LSP issues
  totalEstimatedCost?: number;
  updatedAt?: string; // Add updatedAt to the type to fix LSP issues
  submittedAt?: string; // Add submittedAt to the type to fix LSP issues
}