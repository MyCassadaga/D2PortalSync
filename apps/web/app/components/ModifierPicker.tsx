"use client";
import { useMemo } from "react";

type Modifier = { displayProperties?: { name?: string } } | string;

export default function ModifierPicker({
  activity,
  difficulty,
  setDifficulty,
  selected,
  setSelected
}: {
  activity: any | null;
  difficulty: number;
  setDifficulty: (n: number) => void;
  selected: string[];
  setSelected: (arr: string[]) => void;
}) {
  // Try to derive modifier names from activity.defs; fall back to a small list
  const available: string[] = useMemo(() => {
    const mods: Modifier[] = activity?.modifiers ?? [];
    const names = mods
      .map((m: any) => (typeof m === "string" ? m : m?.displayProperties?.name))
      .filter(Boolean) as string[];
    if (names.length) return names;
    return ["Match Game", "Attrition", "Chaff", "Grounded", "Extinguish"]; // fallback examples
  }, [activity]);

  function toggle(name: string) {
    if (selected.includes(name)) setSelected(selected.filter((x) => x !== name));
    else setSelected([...selected, name]);
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3>Difficulty & Modifiers</h3>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8 }}>
        <label>
          Difficulty:&nbsp;
          <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
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
        {available.map((name) => (
          <button
            key={name}
            onClick={() => toggle(name)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: selected.includes(name) ? "#eee" : "white"
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </section>
  );
}
