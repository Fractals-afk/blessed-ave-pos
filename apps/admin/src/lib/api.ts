const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...rest } = options ?? {};

  // Get token from localStorage if not provided
  const authToken =
    token ?? (typeof window !== "undefined" ? localStorage.getItem("accessToken") : null);

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(rest.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Try to refresh
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      const refreshRes = await fetch(`${BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const { data } = await refreshRes.json();
        localStorage.setItem("accessToken", data.accessToken);
        // Retry
        return apiFetch<T>(path, { ...options, token: data.accessToken });
      }
    }
    // Redirect to login
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorised");
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export const adminApi = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ data: { accessToken: string; refreshToken: string; user: import("@blessed-ave/types").User } }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      ),
    me: () => apiFetch<{ data: import("@blessed-ave/types").User }>("/api/auth/me"),
  },
  orders: {
    list: (params?: Record<string, string>) =>
      apiFetch<{ data: import("@blessed-ave/types").Order[]; total: number }>(
        `/api/orders?${new URLSearchParams(params ?? {})}`
      ),
    kitchen: () =>
      apiFetch<{ data: import("@blessed-ave/types").Order[] }>("/api/orders/kitchen"),
    updateStatus: (id: string, status: string) =>
      apiFetch<{ data: import("@blessed-ave/types").Order }>(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },
  menu: {
    getAll: () =>
      apiFetch<{ data: import("@blessed-ave/types").MenuCategory[] }>("/api/menu/all"),
    createItem: (body: unknown) =>
      apiFetch("/api/menu/items", { method: "POST", body: JSON.stringify(body) }),
    updateItem: (id: string, body: unknown) =>
      apiFetch(`/api/menu/items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteItem: (id: string) =>
      apiFetch(`/api/menu/items/${id}`, { method: "DELETE" }),
    createCategory: (body: unknown) =>
      apiFetch("/api/menu/categories", { method: "POST", body: JSON.stringify(body) }),
    updateCategory: (id: string, body: unknown) =>
      apiFetch(`/api/menu/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteCategory: (id: string) =>
      apiFetch(`/api/menu/categories/${id}`, { method: "DELETE" }),
    createModifierGroup: (body: unknown) =>
      apiFetch("/api/menu/modifier-groups", { method: "POST", body: JSON.stringify(body) }),
    deleteModifierGroup: (id: string) =>
      apiFetch(`/api/menu/modifier-groups/${id}`, { method: "DELETE" }),
  },
  inventory: {
    list: () =>
      apiFetch<{ data: import("@blessed-ave/types").InventoryItem[] }>("/api/inventory"),
    lowStock: () =>
      apiFetch<{ data: import("@blessed-ave/types").InventoryItem[] }>("/api/inventory/low-stock"),
    create: (body: unknown) =>
      apiFetch("/api/inventory", { method: "POST", body: JSON.stringify(body) }),
    adjust: (id: string, body: unknown) =>
      apiFetch(`/api/inventory/${id}/adjust`, { method: "POST", body: JSON.stringify(body) }),
    getLogs: (id: string) =>
      apiFetch<{ data: unknown[] }>(`/api/inventory/${id}/logs`),
  },
  suppliers: {
    list: () =>
      apiFetch<{ data: import("@blessed-ave/types").Supplier[] }>("/api/suppliers"),
    create: (body: unknown) =>
      apiFetch("/api/suppliers", { method: "POST", body: JSON.stringify(body) }),
    listPOs: () =>
      apiFetch<{ data: import("@blessed-ave/types").PurchaseOrder[] }>("/api/suppliers/purchase-orders"),
    createPO: (body: unknown) =>
      apiFetch("/api/suppliers/purchase-orders", { method: "POST", body: JSON.stringify(body) }),
    receivePO: (id: string) =>
      apiFetch(`/api/suppliers/purchase-orders/${id}/receive`, { method: "PATCH" }),
  },
  staff: {
    list: () =>
      apiFetch<{ data: import("@blessed-ave/types").User[] }>("/api/staff"),
    create: (body: unknown) =>
      apiFetch("/api/staff", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      apiFetch(`/api/staff/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    getShifts: (from: string, to: string) =>
      apiFetch<{ data: import("@blessed-ave/types").Shift[] }>(`/api/staff/shifts?from=${from}&to=${to}`),
    createShift: (body: unknown) =>
      apiFetch("/api/staff/shifts", { method: "POST", body: JSON.stringify(body) }),
    deleteShift: (id: string) =>
      apiFetch(`/api/staff/shifts/${id}`, { method: "DELETE" }),
  },
  recipes: {
    get: (menuItemId: string) =>
      apiFetch<{ data: { id: string; menuItemId: string; inventoryItemId: string; quantity: number; inventoryItem: import("@blessed-ave/types").InventoryItem }[] }>(
        `/api/inventory/recipes/${menuItemId}`
      ),
    save: (menuItemId: string, recipes: { inventoryItemId: string; quantity: number }[]) =>
      apiFetch("/api/inventory/recipes", {
        method: "POST",
        body: JSON.stringify({ menuItemId, recipes }),
      }),
  },
  reports: {
    summary: () =>
      apiFetch<{ data: { todayOrders: number; weekRevenue: number; pendingOrders: number; lowStockItems: number } }>(
        "/api/reports/summary"
      ),
    sales: (from: string, to: string) =>
      apiFetch<{ data: unknown }>(`/api/reports/sales?from=${from}&to=${to}`),
  },
  tables: {
    list: () =>
      apiFetch<{ data: import("@blessed-ave/types").CafeTable[] }>("/api/tables"),
    create: (name: string) =>
      apiFetch("/api/tables", { method: "POST", body: JSON.stringify({ name }) }),
    regenerateQr: (id: string) =>
      apiFetch(`/api/tables/${id}/regenerate-qr`, { method: "POST" }),
  },
};
