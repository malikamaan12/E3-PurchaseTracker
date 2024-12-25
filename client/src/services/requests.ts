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
