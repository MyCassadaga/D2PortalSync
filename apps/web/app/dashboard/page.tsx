"use client";
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import ActivityTable from "../components/ActivityTable";
import ModifierPicker from "../components/ModifierPicker";
import FireteamCompare from "../components/FireteamCompare";

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [difficulty, setDifficulty] = useState<number>(1);
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await apiGet<any>("/me/profile");
        setProfile(p);
        const a = await apiGet<any>("/portal/activities");
        setActivities(a.activities || []);
      } catch (e: any) { setError(e.message); }
    })();
  }, []);

  if (error) return <main style={{padding:24}}><h2>Error</h2><pre>{error}</pre></main>;
  if (!profile) return <main style={{padding:24}}>Loading…</main>;

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <header>
        <h2>Dashboard</h2>
        <p>Highest Power: <b>{profile.highestPower}</b></p>
        {selectedActivity ? (
          <p>Selected: <b>{selectedActivity.name ?? "(unknown)"}</b> • Rec Light: {selectedActivity.recommendedLight ?? "?"}</p>
        ) : (
          <p>Select an activity or add a Custom activity below.</p>
        )}
      </header>

      <ActivityTable activities={activities} onSelect={setSelectedActivity} />

      <ModifierPicker
        activity={selectedActivity}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        selected={modifiers}
        setSelected={setModifiers}
      />

      <FireteamCompare
        activity={selectedActivity}
        difficulty={difficulty}
        modifiers={modifiers}
        myPower={profile?.highestPower ?? null}
      />
    </main>
  );
}
