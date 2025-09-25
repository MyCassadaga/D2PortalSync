// apps/web/app/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const sid = sessionStorage.getItem("sid");
  return sid ? { Authorization: "Bearer sid:" + sid } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (typeof window !== "undefined" && res.status === 401) {
    // Preserve current path + query through the OAuth login hop
    const next = window.location.pathname + window.location.search;
    const loginUrl = `${API_BASE}/auth/login?next=${encodeURIComponent(next)}`;
    // Redirect immediately; also throw to stop any further UI work
    window.location.href = loginUrl;
    throw new Error("Redirecting to login…");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      ...authHeaders(),
    },
    credentials: "include",
  });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}
