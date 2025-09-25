"use client";
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Capture ?sid=... after redirect and stash it (for header-based auth)
    try {
      const url = new URL(window.location.href);
      const sid = url.searchParams.get("sid");
      if (sid) {
        sessionStorage.setItem("sid", sid);
        url.searchParams.delete("sid");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {}

    (async () => {
      try {
        const p = await apiGet<any>("/me/profile");
        setData(p);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Dashboard (stub)</h2>
      {err && <pre>ERROR: {err}</pre>}
      {!err && !data && <p>Loading...</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
