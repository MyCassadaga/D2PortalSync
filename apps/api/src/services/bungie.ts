type FetchOpts = { path: string; accessToken?: string; apiKey?: string; method?: string; body?: any };

export async function bungieFetch<T>({ path, accessToken, apiKey, method = "GET", body }: FetchOpts): Promise<T> {
  const url = `https://www.bungie.net/Platform${path}`;
  const headers: Record<string,string> = {
    "X-API-Key": apiKey || process.env.BUNGIE_API_KEY!,
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  if (body) headers["Content-Type"] = "application/json";

  // simple retry x3
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) throw new Error(`Bungie ${res.status} ${res.statusText}`);
      const j = await res.json();
      return j as T;
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 250 * (i+1))); }
  }
  throw lastErr;
}
