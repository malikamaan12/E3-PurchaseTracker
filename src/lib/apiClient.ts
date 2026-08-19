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

    if (response.status === 401) {
      const isAuthPage = typeof window !== "undefined" && (window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/signup"));
      let errorMessage = "Session expired. Please login again.";
      
      const errorData = await response.json().catch(() => ({}));
      
      // If we are on the login page, it's likely a bad password, read the actual message
      if (isAuthPage) {
        errorMessage = errorData.message || errorData.error || "Invalid email or password";
      } else if (errorData.error && errorData.error !== "Not authenticated") {
        errorMessage = errorData.error;
      }
      
      throw new ApiError(response.status, errorMessage);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.error || errorData.message || "An unexpected error occurred",
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
    delete: (id: number) => this.request<any>(`/requests/${id}`, { method: "DELETE" }),
    approve: (id: number, data: { status: string; comments?: string; approvalId?: number | null; department?: string }) => 
      this.request<any>(`/requests/${id}/approvals`, { method: "POST", body: JSON.stringify(data) }),
    submitApproval: (id: number, data: { status: string; comments?: string; approvalId?: number | null; department?: string }) =>
      this.request<any>(`/requests/${id}/approvals`, { method: "POST", body: JSON.stringify(data) }),
    updatePayment: (id: number, paymentId: number, data: any) =>
      this.request<any>(`/requests/${id}/payments/${paymentId}`, { method: "PATCH", body: JSON.stringify(data) }),
    analytics: (params: Record<string, string> = {}) => {
      const search = new URLSearchParams(params).toString();
      return this.request<any>(`/requests/analytics${search ? '?' + search : ''}`);
    },
    bulkApprove: (data: { requestIds: number[]; comments?: string }) => 
      this.request<any>("/requests/bulk-approve", { method: "POST", body: JSON.stringify(data) }),
    getSubPurposes: (purposeCategoryId?: number) => {
      const qs = purposeCategoryId ? `?purposeCategoryId=${purposeCategoryId}` : '';
      return this.request<any[]>(`/requests/sub-purposes${qs}`);
    },
    analyzeAi: (requestDetails: any) => 
      this.request<any>("/ai/analyze-request", { method: "POST", body: JSON.stringify({ requestDetails }) }),
    recommendVendors: (requestDetails: any, vendorOptions: any[]) => 
      this.request<any>("/ai/recommend-vendors", { method: "POST", body: JSON.stringify({ requestDetails, vendorOptions }) }),
    dashboardAnalytics: (params: Record<string, any> = {}) => {
      const search = new URLSearchParams(params).toString();
      return this.request<any>(`/analytics/dashboard?${search}`);
    },
    getComplianceOverride: (id: number) =>
      this.request<{ success: boolean; override: any }>(`/requests/${id}/compliance-override`),
    requestComplianceOverride: (id: number, data: { vendorId: number; justification: string }) =>
      this.request<any>(`/requests/${id}/compliance-override`, { method: "POST", body: JSON.stringify(data) }),
    reviewComplianceOverride: (id: number, data: { overrideId: number; action: string; rejectionReason?: string }) =>
      this.request<any>(`/requests/${id}/compliance-override`, { method: "PATCH", body: JSON.stringify(data) }),
  };

  // Vendors Domain
  public vendors = {
    list: () => this.request<any[]>("/vendors"),
    get: (id: number) => this.request<any>(`/vendors/${id}`),
    patchStatus: (id: number, status: "active" | "blocked" | "frozen") => 
      this.request<any>(`/vendors/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onboard: (data: any) => this.request<any>("/vendors", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => this.request<any>(`/vendors/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    rate: (id: number, rating: number) => 
      this.request<any>(`/vendors/${id}/rate`, { method: "POST", body: JSON.stringify({ rating }) }),
    listComplianceCases: (vendorId: number) =>
      this.request<{ success: boolean; cases: any[] }>(`/vendors/${vendorId}/compliance-cases`),
    createComplianceCase: (vendorId: number, data: any) =>
      this.request<any>(`/vendors/${vendorId}/compliance-cases`, { method: "POST", body: JSON.stringify(data) }),
    extendGracePeriod: (vendorId: number, data: { days: number; reason: string }) =>
      this.request<any>(`/vendors/${vendorId}/grace-period`, { method: "POST", body: JSON.stringify(data) }),
    documents: {
      list: (vendorId: number) => this.request<any[]>(`/vendors/${vendorId}/documents`),
      upload: (vendorId: number, data: any) => this.request<any>(`/vendors/${vendorId}/documents`, { method: "POST", body: JSON.stringify(data) }),
      update: (vendorId: number, docId: number, data: any) => this.request<any>(`/vendors/${vendorId}/documents/${docId}`, { method: "PATCH", body: JSON.stringify(data) }),
      delete: (vendorId: number, docId: number) => this.request<any>(`/vendors/${vendorId}/documents/${docId}`, { method: "DELETE" }),
    }
  };

  // Documents & Exports
  public documents = {
    downloadPdf: (id: number) => {
      window.open(`/api/requests/${id}/pdf`, "_blank");
    },
    downloadZip: (id: number) => {
      window.open(`/api/export/bundle/${id}`, "_blank");
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

  // Purposes Domain (Public/User)
  public purposes = {
    list: () => this.request<any[]>("/purposes"),
  };

  // Notifications Domain
  public notifications = {
    list: (params: { includeRead?: boolean } = {}) => {
      const search = new URLSearchParams(params as any).toString();
      return this.request<any[]>(`/notifications${search ? '?' + search : ''}`);
    },
    markRead: (id: number) => this.request<any>(`/notifications/${id}/read`, { method: "PATCH" }),
    markAsRead: (id: number) => this.request<any>(`/notifications/${id}/read`, { method: "PATCH" }),
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
      create: (data: any) => this.request<any>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) => this.request<any>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      updatePassword: (id: number, data: { password: string }) => 
        this.request<any>(`/admin/users/${id}/update-password`, { method: "PATCH", body: JSON.stringify(data) }),
      // Legacy compatibility / Aliases
      updateRole: (id: number, role: string) => this.request<any>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }),
      toggleActivation: (id: number, isActive: boolean) => this.request<any>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
      updatePermissions: (id: number, permissions: { canManageVendors: boolean }) => 
        this.request<any>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(permissions) }),
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
    purposes: {
      list: () => this.request<any[]>("/admin/purposes"),
      create: (data: any) => this.request<any>("/admin/purposes", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) => this.request<any>(`/admin/purposes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    },
    catalog: {
      list: () => this.request<any[]>("/admin/catalog"),
    },
    analytics: {
      get: () => this.request<any[]>("/admin/analytics")
    },
    pdfSettings: {
      get: () => this.request<any>("/admin/pdf-settings"),
      update: (data: any) => this.request<any>("/admin/pdf-settings", { method: "PATCH", body: JSON.stringify(data) })
    },
    departments: {
      list: () => this.request<any[]>("/admin/departments"),
      create: (data: any) => this.request<any>("/admin/departments", { method: "POST", body: JSON.stringify(data) }),
      update: (id: number, data: any) => this.request<any>(`/admin/departments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      delete: (id: number) => this.request<any>(`/admin/departments/${id}`, { method: "DELETE" }),
    }
  };
}

export const apiClient = new ApiClient();
