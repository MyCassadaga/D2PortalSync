"use client";
import { useState } from "react";

type Activity = {
  hash?: number;
  name?: string;
  recommendedLight?: number;
  rewards?: any[];
  modifiers?: any[];
  group?: string;
};

export default function ActivityTable({
  activities,
  onSelect
}: {
  activities: Activity[];
  onSelect: (a: Activity) => void;
}) {
  const [customName, setCustomName] = useState("");
  const [customLight, setCustomLight] = useState<number | "">("");

  const list = activities ?? [];

  return (
    <section style={{ marginTop: 16 }}>
      <h3>Portal Activities</h3>
      {list.length === 0 && (
        <p style={{ opacity: 0.8 }}>
          No Portal activities loaded yet. You can use a <b>Custom activity</b> below for testing.
        </p>
      )}
      {list.length > 0 && (
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
            {list.map((a) => (
              <tr key={(a.hash ?? a.name) as any}>
                <td style={{ padding: 8 }}>{a.name ?? "(unknown)"}</td>
                <td style={{ padding: 8 }}>{a.group ?? "-"}</td>
                <td style={{ padding: 8 }}>{a.recommendedLight ?? "?"}</td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => onSelect(a)}>Select</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h4 style={{ marginTop: 0 }}>Custom activity (for testing)</h4>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <input
            placeholder="Recommended Light"
            type="number"
            value={customLight}
            onChange={(e) => setCustomLight(e.target.value === "" ? "" : Number(e.target.value))}
            style={{ width: 160 }}
          />
          <button
            disabled={!customName || customLight === ""}
            onClick={() =>
              onSelect({ name: customName, recommendedLight: Number(customLight) })
            }
          >
            Use custom
          </button>
        </div>
      </div>
    </section>
  );
}
