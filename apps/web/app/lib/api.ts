export const API = process.env.NEXT_PUBLIC_API_URL!;

export async function apiGet<T>(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: any) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}
