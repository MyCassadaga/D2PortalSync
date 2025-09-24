import { Router } from 'express';

const r = Router();

// Simple estimator (v1). You can refine later.
function estimateForecast(input: {
  power: number; recommendedLight: number; difficulty: number; modifiers: string[]; featuredCount: number;
}) {
  const { power, recommendedLight, difficulty, modifiers, featuredCount } = input;
  const delta = power - (recommendedLight || 0);
  const base = 5000 + difficulty * 1500;
  const powerMult = Math.max(0, Math.min(0.25, delta * 0.005));
  const modMult = Math.min(0.5, (modifiers?.length || 0) * 0.05);
  const gearMult = Math.min(0.20, (featuredCount || 0) * 0.04);
  const score = Math.round(base * (1 + powerMult + modMult + gearMult));

  let grade = 'C';
  if (score >= 9000) grade = 'B';
  if (score >= 11000) grade = 'B+';
  if (score >= 13000) grade = 'A';
  if (score >= 15000) grade = 'A+';

  return { score, grade, components: { base, powerMult, modMult, gearMult, delta } };
}

r.post('/forecast/compute', async (req, res) => {
  const { power, recommendedLight = 0, difficulty, modifiers = [], featuredCount = 0 } = req.body || {};
  if (typeof power !== 'number' || typeof difficulty !== 'number') {
    res.status(400).json({ error: 'invalid body' }); return;
  }
  const out = estimateForecast({ power, recommendedLight, difficulty, modifiers, featuredCount });
  res.json(out);
});

r.post('/fireteam/compare', async (req, res) => {
  const { activity, difficulty, modifiers = [], members = [] } = req.body || {};
  if (!activity || typeof difficulty !== 'number' || !Array.isArray(members)) {
    res.status(400).json({ error: 'invalid body' }); return;
  }
  const recLight = activity.recommendedLight ?? 0;
  const rows = members.map((m: any) => ({
    name: m.name,
    ...estimateForecast({
      power: Number(m.power) || 0,
      recommendedLight: recLight,
      difficulty,
      modifiers,
      featuredCount: Number(m.featuredCount) || 0
    })
  }));
  res.json({ results: rows });
});

export default r;
