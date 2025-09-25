import { Router } from 'express';

const r = Router();

/**
 * Minimal stub so the frontend never sees 404.
 * We'll hook this up to real Bungie data in the next step.
 */
r.get('/portal/activities', (_req, res) => {
  res.json({ ok: true, activities: [] });
});

export default r;
