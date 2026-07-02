// In dev, sibling apps get auto-assigned ports per session (see
// dev-servers/register-port.js), which mirrors the live registry into
// public/dev-ports.json so we can discover the api's actual port at
// runtime. NEXT_PUBLIC_API_URL still wins when explicitly set (prod).
let apiBasePromise: Promise<string> | null = null;
function resolveApiBase(): Promise<string> {
  if (process.env.NEXT_PUBLIC_API_URL) return Promise.resolve(process.env.NEXT_PUBLIC_API_URL);
  if (typeof window === "undefined") return Promise.resolve("http://localhost:4000");
  if (!apiBasePromise) {
    apiBasePromise = fetch("/dev-ports.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((ports) => (ports?.api ? `http://localhost:${ports.api}` : "http://localhost:4000"))
      .catch(() => "http://localhost:4000");
  }
  return apiBasePromise;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...rest } = options ?? {};
  const BASE = await resolveApiBase();
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
