const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...rest } = options ?? {};
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export const api = {
  menu: {
    getAll: () => apiFetch<{ data: import("@blessed-ave/types").MenuCategory[] }>("/api/menu"),
  },
  orders: {
    create: (body: { source: string; tableId?: string; customerName?: string; customerPhone?: string; customerEmail?: string; items: unknown[] }) =>
      apiFetch<{ data: import("@blessed-ave/types").Order }>("/api/orders", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getById: (id: string) =>
      apiFetch<{ data: import("@blessed-ave/types").Order }>(`/api/orders/${id}`),
  },
  tables: {
    getByToken: (token: string) =>
      apiFetch<{ data: { id: string; name: string } }>(`/api/tables/by-token/${token}`),
  },
  payments: {
    qrConfirm: (orderId: string, method: "GCASH" | "MAYA") =>
      apiFetch("/api/payments/qr-confirm", {
        method: "POST",
        body: JSON.stringify({ orderId, method }),
      }),
  },
};
