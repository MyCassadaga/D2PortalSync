import { Router } from 'express';

const r = Router();

/**
 * Temporary: return one sample activity so the UI has something to select.
 * We’ll swap this for real Bungie lookups after we verify the flow.
 */
r.get('/portal/activities', (_req, res) => {
  res.json({
    ok: true,
    activities: [
      {
        hash: 2166136261,
        name: "Example Nightfall",
        group: "fireteamOps",
        recommendedLight: 2000,
        modifiers: ["Match Game", "Attrition"]
      }
    ]
  });
});

export default r;
