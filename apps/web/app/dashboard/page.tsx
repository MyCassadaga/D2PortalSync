"use client";
import { useEffect, useState, useMemo } from "react";
import { apiGet, apiPost } from "../lib/api";

type Activity = {
  hash?: number;
  name?: string;
  recommendedLight?: number;
  group?: string;
  modifiers?: string[] | any[];
};

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [customName, setCustomName] = useState("");
  const [customLight, setCustomLight] = useState<string>("");
  const [difficulty, setDifficulty] = useState<number>(1);
  const [mods, setMods] = useState<string[]>([]);
  const [result, setResult] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // derive available modifiers from selected activity (fallback to a small list)
  const availableMods = useMemo(() => {
    const fromAct =
      (selected?.modifiers || [])
        .map((m: any) => (typeof m === "string" ? m : m?.displayProperties?.name))
        .filter(Boolean) as string[];
    if (fromAct.length) return fromAct;
    return ["Match Game", "Attrition", "Chaff", "Grounded", "Extinguish"];
  }, [selected]);

  function toggleMod(name: string) {
    setResult(null);
    setMods((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  }

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

  async function computeMeOnly() {
    setErr(null);
    setResult(null);
    if (!selected || !profile) {
      setErr("Pick an activity first.");
      return;
    }
    try {
      const body = {
        activity: { name: selected.name, recommendedLight: selected.recommendedLight, hash: selected.hash },
        difficulty,
        modifiers: mods,
        members: [{ name: "You", power: Number(profile.highestPower) || 0, featuredCount: 0 }]
      };
      const out = await apiPost<{ results: any[] }>("/fireteam/compare", body);
      setResult(out.results?.[0] ?? null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

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
                    <button onClick={() => { setSelected(a); setMods([]); setResult(null); }}>Select</button>
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
              onClick={() => {
                setSelected({ name: customName, recommendedLight: Number(customLight) || 0 });
                setMods([]);
                setResult(null);
              }}
            >
              Use custom
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3>One-click: Compute grade (you only)</h3>
        {!selected ? (
          <p>Select an activity above first.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label>
                Difficulty:{" "}
                <select
                  value={difficulty}
                  onChange={(e) => { setDifficulty(Number(e.target.value)); setResult(null); }}
                >
                  <option value={0}>Easy</option>
                  <option value={1}>Normal</option>
                  <option value={2}>Hero</option>
                  <option value={3}>Legend</option>
                  <option value={4}>Master</option>
                  <option value={5}>Grandmaster</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {availableMods.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMod(m)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    background: mods.includes(m) ? "#eee" : "white",
                    cursor: "pointer"
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <div>
              <button onClick={computeMeOnly}>Compute</button>
            </div>
            {result && (
              <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <div><b>Score:</b> {result.score}</div>
                <div><b>Grade:</b> {result.grade}</div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>
                  ΔPower vs rec: {result.components?.delta} • base {result.components?.base}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
