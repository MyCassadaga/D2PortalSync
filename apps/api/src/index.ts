// apps/api/src/index.ts
import express from 'express';
import cors from 'cors';
import type { CorsOptionsDelegate } from 'cors';
import cookieParser from 'cookie-parser';
import { z } from 'zod';

import profileRoutes from './routes/profile';
import portalRoutes from './routes/portal';
import forecastRoutes from './routes/forecast';
import dbtestRoutes from './routes/dbtest';
import { storeSession, ensureSchema } from './db';

// ----- App setup (DECLARE APP FIRST) -----
const app = express();

// Build allowlist from env (comma-separated), supports wildcards like "*.vercel.app"
const raw = (process.env.ALLOW_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const isAllowed = (origin: string) => {
  if (raw.length === 0) return true;           // allow all if unset (dev)
  if (raw.includes(origin)) return true;       // exact match
  try {
    const { hostname } = new URL(origin);
    for (const pat of raw) {
      if (pat.startsWith('*.')) {
        const suffix = pat.slice(2);
        if (hostname === suffix || hostname.endsWith('.' + suffix)) return true;
      }
    }
  } catch { /* ignore bad origins */ }
  return false;
};

const corsDelegate: CorsOptionsDelegate = (req, cb) => {
  const origin = req.header('Origin') || '';
  if (!origin || isAllowed(origin)) cb(null, { origin: true, credentials: true });
  else cb(new Error('CORS blocked for origin: ' + origin), { origin: false });
};

app.use(cors(corsDelegate));
app.use(express.json());
app.use(cookieParser());

// Ensure schema on boot (does not crash the app if it fails)
ensureSchema().catch(err => console.error('ensureSchema failed:', err?.message || err));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// ----- OAuth token schema -----
const BungieTokenSchema = z.object({
  token_type: z.string(),
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  refresh_expires_in: z.number().optional(),
  membership_id: z.string().optional()
});
type BungieToken = z.infer<typeof BungieTokenSchema>;

// Start OAuth
app.get('/auth/login', (_req, res) => {
  const url = new URL('https://www.bungie.net/en/OAuth/Authorize');
  url.searchParams.set('client_id', String(process.env.BUNGIE_CLIENT_ID));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', String(process.env.OAUTH_REDIRECT_URL));
  res.redirect(url.toString());
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  const code = (req.query.code as string) || '';
  if (!code) {
    res.status
