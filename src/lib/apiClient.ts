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
      credentials: "include", // Force inclusion of auth_token cookie
      headers: {
        "Content-Type": "application/json",
        "X-Client-Version": "1.0.4-native-final",
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
    create: (data: any) => this.request<any>("/requests", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => this.request<any>(`/requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    approve: (id: number, data: { status: string; comments?: string }) => 
      this.request<any>(`/requests/${id}/approvals`, { method: "POST", body: JSON.stringify(data) }),
    submitApproval: (id: number, data: { status: string; comments: string }) =>
      this.request<any>(`/requests/${id}/approvals`, { method: "POST", body: JSON.stringify(data) }),
    analytics: () => this.request<any>("/requests/analytics"),
    bulkApprove: (data: { requestIds: number[]; comments?: string }) => 
      this.request<any>("/requests/bulk-approve", { method: "POST", body: JSON.stringify(data) }),
    subPurposes: {
      list: (params: Record<string, any> = {}) => {
        const search = new URLSearchParams(params).toString();
        return this.request<any[]>(`/requests/sub-purposes?${search}`);
      }
    },
    analyzeAi: (requestDetails: any) => 
      this.request<any>("/ai/analyze-request", { method: "POST", body: JSON.stringify({ requestDetails }) }),
    recommendVendors: (requestDetails: any, vendorOptions: any[]) => 
      this.request<any>("/ai/recommend-vendors", { method: "POST", body: JSON.stringify({ requestDetails, vendorOptions }) }),
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
      window.open(`/api/requests/${id}/pdf`, "_blank");
    },
    downloadZip: (id: number) => {
      window.open(`/api/requests/${id}/zip`, "_blank");
    },
    exportExcel: (params: Record<string, any> = {}) => {
      const search = new URLSearchParams({ ...params, format: "excel" }).toString();
      window.open(`/api/requests/export?${search}`, "_blank");
    },
  };

  // Departments Domain
  public departments = {
    list: () => this.request<any[]>("/departments"),
  };

  // Notifications Domain
  public notifications = {
    list: (params: { includeRead?: boolean } = {}) => {
      const search = new URLSearchParams(params as any).toString();
      return this.request<any[]>(`/notifications${search ? '?' + search : ''}`);
    },
    markRead: (id: number) => this.request<any>(`/notifications/${id}/read`, { method: "PATCH" }),
    markAllRead: () => this.request<any>("/notifications/mark-all-read", { method: "PATCH" }),
    getUnreadCount: () => this.request<{ count: number}>("/notifications/unread-count"),
    getPreferences: () => this.request<any[]>("/notification-preferences"),
    updatePreference: (id: number, data: any) => this.request<any>(`/notification-preferences/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    getMetadata: () => this.request<any>("/notification-preferences/metadata"),
  };

  // Admin Domain
  public admin = {
    auditLogs: () => this.request<any[]>("/admin/audit-logs"),
    users: {
      list: () => this.request<any[]>("/admin/users"),
      updateRole: (id: number, role: string) => this.request<any>(`/admin/users/${id}/update-role`, { method: "POST", body: JSON.stringify({ role }) }),
      toggleActivation: (id: number, isActive: boolean) => this.request<any>(`/admin/users/${id}/toggle-activation`, { method: "POST", body: JSON.stringify({ isActive }) }),
      updatePermissions: (id: number, permissions: { canManageVendors: boolean }) => 
        this.request<any>(`/admin/users/${id}/permissions`, { method: "PATCH", body: JSON.stringify(permissions) }),
    },
    accountRequests: {
      list: (params: Record<string, any> = {}) => {
        const search = new URLSearchParams(params).toString();
        return this.request<any[]>(`/admin/account-requests?${search}`);
      },
      approve: (id: number) => this.request<any>(`/admin/account-requests/${id}/approve`, { method: "POST" }),
      reject: (id: number) => this.request<any>(`/admin/account-requests/${id}/reject`, { method: "POST" })
    },
    subPurposes: {
      list: () => this.request<any[]>("/admin/sub-purposes"),
      create: (data: any) => this.request<any>("/admin/sub-purposes", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) => this.request<any>(`/admin/sub-purposes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      delete: (id: number) => this.request<any>(`/admin/sub-purposes/${id}`, { method: "DELETE" })
    },
    systemSettings: {
      get: () => this.request<Record<string, string>>("/admin/system-settings"),
      update: (data: Record<string, string>) => this.request<any>("/admin/system-settings", { method: "POST", body: JSON.stringify(data) })
    },
    vendors: {
      updateStatus: (id: number, status: string) => this.request<any>(`/admin/vendors/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })
    },
    analytics: {
      get: () => this.request<any[]>("/admin/analytics")
    },
    pdfSettings: {
      get: () => this.request<any>("/admin/pdf-settings"),
      update: (data: any) => this.request<any>("/admin/pdf-settings", { method: "PATCH", body: JSON.stringify(data) })
    },
    departments: {
      list: () => this.request<any[]>("/departments"),
      create: (data: any) => this.request<any>("/departments", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) => this.request<any>(`/departments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      delete: (id: number) => this.request<any>(`/departments/${id}`, { method: "DELETE" }),
    }
  };
}

export const apiClient = new ApiClient();
