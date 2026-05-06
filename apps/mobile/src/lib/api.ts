import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const BASE: string =
  (Constants.expoConfig?.extra as any)?.apiUrl ?? "http://localhost:4000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await SecureStore.getItemAsync("accessToken");

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    const refresh = await SecureStore.getItemAsync("refreshToken");
    if (refresh) {
      const refreshRes = await fetch(`${BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (refreshRes.ok) {
        const { data } = await refreshRes.json();
        await SecureStore.setItemAsync("accessToken", data.accessToken);
        return apiFetch<T>(path, options);
      }
    }
    throw new Error("Unauthorised");
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export const mobileApi = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ data: { accessToken: string; refreshToken: string; user: import("@blessed-ave/types").User } }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      ),
  },
  reports: {
    summary: () =>
      apiFetch<{ data: { todayOrders: number; weekRevenue: number; pendingOrders: number; lowStockItems: number } }>(
        "/api/reports/summary"
      ),
  },
  orders: {
    kitchen: () =>
      apiFetch<{ data: import("@blessed-ave/types").Order[] }>("/api/orders/kitchen"),
    updateStatus: (id: string, status: string) =>
      apiFetch<{ data: import("@blessed-ave/types").Order }>(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    list: (params?: Record<string, string>) =>
      apiFetch<{ data: import("@blessed-ave/types").Order[] }>(
        `/api/orders?${new URLSearchParams(params ?? {})}`
      ),
  },
  inventory: {
    list: () =>
      apiFetch<{ data: import("@blessed-ave/types").InventoryItem[] }>("/api/inventory"),
    lowStock: () =>
      apiFetch<{ data: import("@blessed-ave/types").InventoryItem[] }>("/api/inventory/low-stock"),
    adjust: (id: string, body: unknown) =>
      apiFetch(`/api/inventory/${id}/adjust`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
};
