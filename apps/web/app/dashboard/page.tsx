"use client";
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

type Activity = {
  hash?: number;
  name?: string;
  recommendedLight?: number;
  group?: string;
};

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [customName, setCustomName] = useState("");
  const [customLight, setCustomLight] = useState<string>(""); // keep as string for controlled input
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Capture ?sid=... after redirect and stash it
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
        setProfile(p);
        const a = await apiGet<{ activities: Activity[] }>("/portal/activities");
        setActivities(a.activities || []);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <h2>Dashboard</h2>

      {err && (
