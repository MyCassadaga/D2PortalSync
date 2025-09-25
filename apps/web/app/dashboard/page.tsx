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
        <div style={{ color: "crimson" }}>
          <b>Error:</b> {err}
        </div>
      )}

      {!profile && !err && <p>Loading profile…</p>}

      {profile && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div><b>Highest Power:</b> {profile.highestPower}</div>
          <div><b>Membership:</b> {profile.membershipId} (type {profile.membershipType})</div>
        </div>
      )}

      <section>
        <h3>Portal Activities</h3>
        {activities.length === 0 ? (
          <p style={{ opacity: 0.8 }}>
            No activities loaded yet. Use the <b>Custom activity</b> form below to continue testing.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Group</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Rec. Light</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a, idx) => (
                <tr key={(a.hash ?? idx) as any}>
                  <td style={{ padding: 8 }}>{a.name ?? "(unknown)"}</td>
                  <td style={{ padding: 8 }}>{a.group ?? "-"}</td>
                  <td style={{ padding: 8 }}>{a.recommendedLight ?? "?"}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => setSelected(a)}>Select</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h4 style={{ marginTop: 0 }}>Custom activity</h4>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              placeholder="Name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <input
              placeholder="Recommended Light"
              type="number"
              value={customLight}
              onChange={(e) => setCustomLight(e.target.value)}
              style={{ width: 160 }}
            />
            <button
              disabled={!customName || customLight === ""}
              onClick={() =>
                setSelected({ name: customName, recommendedLight: Number(customLight) || 0 })
              }
            >
              Use custom
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3>Selected</h3>
        {selected ? (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <div><b>Name:</b> {selected.name ?? "(unknown)"}</div>
            <div><b>Rec. Light:</b> {selected.recommendedLight ?? "?"}</div>
            <div style={{ opacity: 0.7, marginTop: 8 }}>
              Next step will add difficulty/modifiers and fireteam compare.
            </div>
          </div>
        ) : (
          <p>No activity selected yet.</p>
        )}
      </section>
    </div>
  );
}
