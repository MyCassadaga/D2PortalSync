"use client";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

type Activity = {
  hash?: number;
  name?: string;
  recommendedLight?: number;
  group?: string;
  modifiers?: string[] | any[];
};

type Member = { name: string; power: number; featuredCount?: number };

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [customName, setCustomName] = useState("");
  const [customLight, setCustomLight] = useState<string>("");

  const [difficulty, setDifficulty] = useState<number>(1);
  const [mods, setMods] = useState<string[]>([]);

  const [meResult, setMeResult] = useState<any | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [teamResults, setTeamResults] = useState<any[] | null>(null);

  const [err, setErr] = useState<string | null>(null);

  async function logout() {
    try { await apiPost("/auth/logout", {}); } catch {}
    sessionStorage.removeItem("sid");
    window.location.href = "/login";
  }

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
    setMeResult(null);
    setTeamResults(null);
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
        // prefill you in fireteam
        setTeam([{ name: "You", power: Number(p?.highestPower) || 0, featuredCount: 0 }]);
        const a = await apiGet<{ activities: Activity[] }>("/portal/activities");
        setActivities(a.activities || []);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  async function computeMeOnly() {
    setErr(null);
    setMeResult(null);
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
      setMeResult(out.results?.[0] ?? null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  // --- Fireteam helpers ---
  function addMember() {
    setTeamResults(null);
    setTeam([...team, { name: "Teammate", power: 0, featuredCount: 0 }]);
  }
  function updateMember(i: number, patch: Partial<Member>) {
    setTeamResults(null);
    const next = [...team];
    next[i] = { ...next[i], ...patch };
    setTeam(next);
  }
  function removeMember(i: number) {
    setTeamResults(null);
    const next = [...team];
    next.splice(i, 1);
    setTeam(next);
  }

  async function computeTeam() {
    setErr(null);
    setTeamResults(null);
    if (!selected || team.length === 0) {
      setErr("Pick an activity and add at least one member.");
      return;
    }
    try {
      const body = {
        activity: { name: selected.name, recommendedLight: selected.recommendedLight, hash: selected.hash },
        difficulty,
        modifiers: mods,
        members: team.map((m) => ({
          name: m.name || "Member",
          power: Number(m.power) || 0,
          featuredCount: Number(m.featuredCount) || 0
        }))
      };
      const out = await apiPost<{ results: any[] }>("/fireteam/compare", body);
      setTeamResults(out.results || []);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Dashboard</h2>
        <button onClick={logout}>Logout</button>
      </header>

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
                    <button onClick={() => { setSelected(a); setMods([]); setMeResult(null); setTeamResults(null); }}>
                      Select
                    </button>
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
                setMeResult(null);
                setTeamResults(null);
              }}
            >
              Use custom
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3>Difficulty & Modifiers</h3>
        {!selected ? (
          <p>Select an activity above first.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label>
                Difficulty:{" "}
                <select
                  value={difficulty}
                  onChange={(e) => { setDifficulty(Number(e.target.value)); setMeResult(null); setTeamResults(null); }}
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
              <button onClick={computeMeOnly}>Compute (me only)</button>
            </div>
            {meResult && (
              <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <div><b>Score:</b> {meResult.score}</div>
                <div><b>Grade:</b> {meResult.grade}</div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>
                  ΔPower vs rec: {meResult.components?.delta} • base {meResult.components?.base}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h3>Fireteam</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8, minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Power</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Featured Count</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.map((m, i) => (
                <tr key={i}>
                  <td style={{ padding: 8 }}>
                    <input value={m.name} onChange={(e) => updateMember(i, { name: e.target.value })} />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      value={m.power}
                      onChange={(e) => updateMember(i, { power: Number(e.target.value) || 0 })}
                      style={{ width: 120 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      type="number"
                      value={m.featuredCount ?? 0}
                      onChange={(e) => updateMember(i, { featuredCount: Number(e.target.value) || 0 })}
                      style={{ width: 140 }}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => removeMember(i)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={addMember}>Add teammate</button>
          <button onClick={computeTeam} disabled={!selected || team.length === 0}>
            Compute (fireteam)
          </button>
        </div>

        {teamResults && teamResults.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Score</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Grade</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {teamResults.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8 }}>{r.name}</td>
                    <td style={{ padding: 8 }}>{r.score}</td>
                    <td style={{ padding: 8 }}><b>{r.grade}</b></td>
                    <td style={{ padding: 8 }}>
                      ΔPower vs rec: {r.components?.delta} • base {r.components?.base}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
