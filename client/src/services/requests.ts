import type { PurchaseRequest } from "@db/schema";

export async function updateRequest({
  id,
  data,
}: {
  id: number;
  data: Partial<PurchaseRequest>;
}) {
  // Convert decimal values to proper format before sending
  const formattedData = {
    ...data,
    items: data.items?.map(item => ({
      ...item,
      quantity: Number(Number(item.quantity).toFixed(2)),
      estimatedCost: Number(Number(item.estimatedCost).toFixed(2)),
    })),
    totalEstimatedCost: data.totalEstimatedCost ? Number(Number(data.totalEstimatedCost).toFixed(2)) : undefined,
    freightAmount: data.freightAmount ? Number(Number(data.freightAmount).toFixed(2)) : undefined,
  };

  console.log('Updating request:', { id, formattedData });

  const response = await fetch(`/api/requests/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formattedData),
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
}

export async function createRequest(data: FormData) {
  try {
    // Add console logging for debugging
    const formDataEntries = Object.fromEntries(data.entries());
    console.log('Creating request with data:', formDataEntries);

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
    return await updateRequest({
      id,
      data: { 
        ...data, 
        status: "draft",
        isLocked: false 
      },
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    throw new Error('Failed to save draft: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export async function submitRequest(id: number, data: Partial<PurchaseRequest>) {
  console.log('Submitting request:', { id, data });
  try {
    return await updateRequest({
      id,
      data: { 
        ...data, 
        status: "pending",
        isLocked: false
      },
    });
  } catch (error) {
    console.error('Error submitting request:', error);
    throw new Error('Failed to submit request: ' + (error instanceof Error ? error.message : String(error)));
  }
}