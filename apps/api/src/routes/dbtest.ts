import { Router } from 'express';
import { pool } from '../db';
const r = Router();
r.get('/admin/db-test', async (_req, res) => {
  try { const { rows } = await pool.query('select now() as now'); res.json({ ok: true, now: rows[0].now }); }
  catch (e: any) { res.status(500).json({ ok: false, error: e?.message || String(e) }); }
});
export default r;
