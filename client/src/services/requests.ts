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
  vendorId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
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
    console.log('Saving draft with data:', data);
    
    // For drafts, we're extremely lenient - allow saving almost anything
    // The only minimal check is to make sure we have at least some data to save
    if (!data) {
      throw new Error('Cannot save empty draft');
    }

    // Format data to ensure it's valid even if incomplete
    // Handle potential null or undefined items array
    const formattedItems = Array.isArray(data.items) 
      ? data.items.map(item => ({
          name: item?.name || "",
          quantity: item?.quantity != null && !isNaN(Number(item.quantity)) 
            ? Number(item.quantity) 
            : 0,
          estimatedCost: item?.estimatedCost != null && !isNaN(Number(item.estimatedCost)) 
            ? Number(item.estimatedCost) 
            : 0,
          description: item?.description || ""
        })) 
      : [{ name: "", quantity: 0, estimatedCost: 0, description: "" }]; // Default item if none provided

    // Special handling for draft requests - ensure all required fields have valid values
    // even if they're empty defaults
    const draftData = {
      ...data,
      title: data.title || "",
      description: data.description || "",
      status: "draft", // Always ensure status is draft
      items: formattedItems,
      purposeType: data.purposeType || "E3 EVENT",
      priority: data.priority || "medium",
      currency: data.currency || "QAR",
      freightAmount: data.freightAmount != null && !isNaN(Number(data.freightAmount)) 
        ? Number(data.freightAmount) 
        : 0,
      // Allow null values for optional fields in drafts
      vendorId: data.vendorId || null,
      subPurposeId: data.subPurposeId || null,
      additionalApprovers: Array.isArray(data.additionalApprovers) ? data.additionalApprovers : [],
      isLocked: false,
      updatedAt: new Date().toISOString()
    };

    console.log('Saving draft with formatted data:', {
      title: draftData.title ? 'set' : 'empty',
      itemCount: draftData.items.length,
      hasVendor: !!draftData.vendorId,
      itemsData: draftData.items.map(i => ({ 
        name: i.name ? (i.name.length > 10 ? i.name.substring(0, 10) + '...' : i.name) : 'empty',
        qty: i.quantity,
        cost: i.estimatedCost
      }))
    });

    // Use AI to analyze and potentially fix draft data before saving
    try {
      // Only run analysis if we have the Anthropic API configured
      if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
        const { analyzeValidationContext } = await import('./anthropicService');
        const aiAnalysis = await analyzeValidationContext(
          draftData,
          [], // No validation errors for drafts
          'draft'
        );
        
        if (aiAnalysis.fixedData) {
          console.log('AI suggested improvements for draft data');
          // Use the AI-enhanced data if provided
          return await updateRequest({
            id,
            data: {
              ...aiAnalysis.fixedData,
              status: "draft" // Ensure status is still draft
            }
          });
        }
      }
    } catch (aiError) {
      // If AI analysis fails, just continue with the original data
      console.warn('AI analysis for draft failed, continuing with original data:', aiError);
    }

    return await updateRequest({
      id,
      data: draftData
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    
    // Log the error for debugging
    try {
      fetch('/api/error-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error instanceof Error ? error.message : 'Unknown error saving draft',
          severity: 'error',
          path: '/client/src/services/requests.ts:saveDraft',
          details: JSON.stringify({
            requestId: id,
            dataSnapshot: {
              hasItems: !!data?.items,
              itemsLength: data?.items?.length || 0,
              hasTitle: !!data?.title,
              hasVendor: !!data?.vendorId
            },
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack
            } : 'Unknown error'
          })
        })
      }).catch(logError => {
        console.error('Failed to log error:', logError);
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
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
    // Only require sub-purpose for PROJECT type, based on user needs
    if (data.purposeType === 'PROJECT' && !data.subPurposeId) {
      validationErrors.push('Sub-purpose is required for PROJECT type');
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
      // Let the component handle the validation errors and AI integration
      // This allows the component to use the analyzeValidationContext function
      // with the specific validation errors
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