import { toast } from "sonner";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Standardized API Client for PurchaseTracker
 * Handles automated 401 redirection and domain-specific routing.
 */
class ApiClient {
  private baseUrl = "/api";

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401 || response.status === 403) {
      if (typeof window !== "undefined") {
        window.location.href = "/auth?expired=true";
      }
      throw new ApiError(response.status, "Session expired. Please login again.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.message || "An unexpected error occurred",
        errorData
      );
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  // Auth Domain
  public auth = {
    login: (data: any) => this.request<any>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    register: (data: any) => this.request<any>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    logout: () => this.request<any>("/auth/logout", { method: "POST" }),
    getUser: () => this.request<any>("/auth/user"),
  };

  // Requests Domain
  public requests = {
    list: (params: Record<string, any> = {}) => {
      const search = new URLSearchParams(params).toString();
      return this.request<any[]>(`/requests?${search}`);
    },
    get: (id: number) => this.request<any>(`/requests/${id}`),
    update: (id: number, data: any) => this.request<any>(`/requests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    approve: (id: number, data: { status: string; comments?: string }) => 
      this.request<any>(`/requests/${id}/approvals`, { method: "POST", body: JSON.stringify(data) }),
    analytics: () => this.request<any>("/requests/analytics"),
    bulkApprove: (data: { requestIds: number[]; comments?: string }) => 
      this.request<any>("/requests/bulk-approve", { method: "POST", body: JSON.stringify(data) }),
  };

  // Vendors Domain
  public vendors = {
    list: () => this.request<any[]>("/vendors"),
    get: (id: number) => this.request<any>(`/vendors/${id}`),
    patchStatus: (id: number, status: "active" | "blocked" | "frozen") => 
      this.request<any>(`/vendors/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onboard: (data: any) => this.request<any>("/vendors", { method: "POST", body: JSON.stringify(data) }),
  };

  // Documents & Exports
  public documents = {
    downloadPdf: (id: number) => {
      window.open(`${this.baseUrl}/requests/${id}/pdf`, "_blank");
    },
    downloadZip: (id: number) => {
      window.open(`${this.baseUrl}/requests/${id}/zip`, "_blank");
    },
    exportExcel: (params: Record<string, any> = {}) => {
      const search = new URLSearchParams({ ...params, format: "excel" }).toString();
      window.open(`${this.baseUrl}/requests/export?${search}`, "_blank");
    },
  };

  // Admin Domain
  public admin = {
    auditLogs: () => this.request<any[]>("/admin/audit-logs"),
  };
}

export const apiClient = new ApiClient();
