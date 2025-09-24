// apps/api/src/index.ts
import express from 'express';
import cors from 'cors';
import type { CorsOptions, CorsOptionsDelegate } from 'cors';
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

const corsOptionsDelegate: CorsOptionsDelegate = (req, callback) => {
  const originHeader = (req.headers?.origin as string | undefined) || '';
  let options: CorsOptions;
  if (!originHeader || isAllowed(originHeader)) {
    options = { origin: true, credentials: true };
  } else {
    options = { origin: false };
  }
  callback(null, options);
};

// Use CORS for all routes + explicitly handle preflight
app.use(cors(corsOptionsDelegate));
app.options('*', cors(corsOptionsDelegate));

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
    res.status(400).send('Missing code');
    return;
  }

  const cid = String(process.env.BUNGIE_CLIENT_ID || '');
  const csec = String(process.env.BUNGIE_CLIENT_SECRET || '');
  const authBasic = 'Basic ' + Buffer.from(cid + ':' + csec).toString('base64');

  const tokenRes = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': String(process.env.BUNGIE_API_KEY),
      'Authorization': authBasic
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: String(process.env.OAUTH_REDIRECT_URL)
    }).toString()
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    res.status(502).send('Bungie token exchange failed (' + tokenRes.status + '): ' + errText);
    return;
  }

  const tokensJson: unknown = await tokenRes.json();
  const tokens: BungieToken = BungieTokenSchema.parse(tokensJson);

  const membershipId = tokens.membership_id ? tokens.membership_id : 'pending';

  // Store server-side session, don’t crash if DB is down
  let sessionId: string | null = null;
  try {
    sessionId = await storeSession({
      membership_id: membershipId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in
    });
  } catch (e: any) {
    console.error('storeSession failed:', e?.message || e);
    res.cookie('session_tmp', JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in
    }), { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
  }

  if (sessionId) {
    res.cookie('session_id', sessionId, {
      httpOnly: true, secure: true, sameSite: 'none', path: '/'
    });
  }

    const front = String(process.env.FRONTEND_URL || 'http://localhost:3000');
  // add ?sid=... so the frontend can store it and use Authorization header
  let redirectUrl = front + '/dashboard';
  if (sessionId) redirectUrl += '?sid=' + encodeURIComponent(sessionId);
  res.redirect(redirectUrl);

});

// ----- Feature routes (REGISTER AFTER app IS DECLARED) -----
app.use(dbtestRoutes);
app.use(profileRoutes);
app.use(portalRoutes);
app.use(forecastRoutes);

// Optional: logout helper for testing
app.post('/auth/logout', (_req, res) => {
  res.clearCookie('session_id', { path: '/' });
  res.clearCookie('session_tmp', { path: '/' });
  res.json({ ok: true });
});

// ----- Start server -----
const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log('API listening on :' + port);
});
