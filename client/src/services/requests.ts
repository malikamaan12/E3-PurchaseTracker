import type { PurchaseRequest } from "@db/schema";

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update request:', errorText);
      throw new Error(errorText || 'Failed to update request');
    }

    const result = await response.json();
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Request creation failed:', errorText);
      throw new Error(errorText || 'Failed to create request');
    }

    const result = await response.json();
    console.log('Request created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in createRequest:', error);
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

export async function saveDraft(id: number, data: Partial<PurchaseRequest>) {
  console.log('Saving draft:', { id, data });
  try {
    const result = await updateRequest({
      id,
      data: { 
        ...data, 
        status: "draft",
        isLocked: false 
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
    const result = await updateRequest({
      id,
      data: { 
        ...data, 
        status: "pending",
        isLocked: false
      },
    });
    console.log('Request submitted successfully:', result);
    return result;
  } catch (error) {
    console.error('Error submitting request:', error);
    throw error;
  }
}