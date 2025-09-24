export const API = process.env.NEXT_PUBLIC_API_URL!;

function authHeaders(): Record<string,string> {
  if (typeof window === 'undefined') return {};
  const sid = sessionStorage.getItem('sid');
  return sid ? { Authorization: `Bearer sid:${sid}` } : {};
}

export async function apiGet<T>(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: "include",
    headers: { ...(opts.headers || {}), ...authHeaders() }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: any) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}
