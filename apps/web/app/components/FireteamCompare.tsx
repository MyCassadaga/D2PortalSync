"use client";
import { useEffect, useState } from "react";
import { apiPost } from "../lib/api";

type Member = { name: string; power: number; featuredCount?: number };

export default function FireteamCompare({
  activity,
  difficulty,
  modifiers,
  myPower
}: {
  activity: any | null;
  difficulty: number;
  modifiers: string[];
  myPower: number | null;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill you as Member 1
  useEffect(() => {
    if (myPower && members.length === 0) {
      setMembers([{ name: "You", power: myPower, featuredCount: 0 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPower]);

  function addMember() {
    setMembers([...members, { name: "Teammate", power: 0, featuredCount: 0 }]);
  }
  function update(i: number, patch: Partial<Member>) {
    const next = [...members];
    next[i] = { ...next[i], ...patch };
    setMembers(next);
  }
  function remove(i: number) {
    const next = [...members];
    next.splice(i, 1);
    setMembers(next);
  }

  async function compute() {
    setError(null);
    setResults(null);
    if (!activity) { setError("Pick an activity first."); return; }
    try {
      const body = { activity, difficulty, modifiers, members };
      const out = await apiPost<{ results: any[] }>("/fireteam/compare", body);
      setResults(out.results);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3>Fireteam Compare</h3>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Power</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Featured Count</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={i}>
              <td style={{ padding: 8 }}>
                <input value={m.name} onChange={(e) => update(i, { name: e.target.value })} />
              </td>
              <td style={{ padding: 8 }}>
                <input
                  type="number"
                  value={m.power}
                  onChange={(e) => update(i, { power: Number(e.target.value) || 0 })}
                  style={{ width: 120 }}
                />
              </td>
              <td style={{ padding: 8 }}>
                <input
                  type="number"
                  value={m.featuredCount ?? 0}
                  onChange={(e) => update(i, { featuredCount: Number(e.target.value) || 0 })}
                  style={{ width: 120 }}
                />
              </td>
              <td style={{ padding: 8 }}>
                <button onClick={() => remove(i)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button onClick={addMember}>Add teammate</button>
        <button onClick={compute} disabled={!activity || members.length === 0}>Compute grades</button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {results && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Score</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Grade</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: 8 }}>{r.name}</td>
                <td style={{ padding: 8 }}>{r.score}</td>
                <td style={{ padding: 8 }}><b>{r.grade}</b></td>
                <td style={{ padding: 8 }}>
                  ΔPower vs rec: {r.components.delta} • base {r.components.base}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
