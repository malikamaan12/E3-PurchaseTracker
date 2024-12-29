import type { PurchaseRequest } from "@db/schema";

export async function updateRequest({
  id,
  data,
}: {
  id: number;
  data: Partial<PurchaseRequest>;
}) {
  const response = await fetch(`/api/requests/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function createRequest(data: FormData) {
  const response = await fetch("/api/requests", {
    method: "POST",
    body: data,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function deleteRequest(id: number) {
  const response = await fetch(`/api/requests/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function saveDraft(id: number, data: Partial<PurchaseRequest>) {
  return updateRequest({
    id,
    data: { ...data, status: "draft" },
  });
}

export async function submitRequest(id: number, data: Partial<PurchaseRequest>) {
  return updateRequest({
    id,
    data: { ...data, status: "pending" },
  });
}