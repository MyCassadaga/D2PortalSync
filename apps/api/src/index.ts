// apps/api/src/index.ts
import express, { Request, Response } from 'express';
import cors, { CorsOptionsDelegate } from 'cors';
import cookieParser from 'cookie-parser';

// Routes
import profileRoutes from './routes/profile';
import portalRoutes from './routes/portal';
import forecastRoutes from './routes/forecast';
import dbtestRoutes from './routes/dbtest';

// DB helpers
import { storeSession, ensureSchema } from './db';

const app = express();

// ----- CORS -----
const raw = (process.env.ALLOW_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function isAllowed(origin: string) {
  if (raw.length === 0) return true;               // allow all if not configured
  if (raw.includes(origin)) return true;           // exact match
  try {
    const { hostname } = new URL(origin);
    for (const pat of raw) {
      if (pat.startsWith('*.')) {
        const suffix = pat.slice(2);
        if (hostname === suffix || hostname.endsWith('.' + suffix)) return true;
      }
    }
  } catch {
    // ignore bad origins
  }
  return false;
}

const corsDelegate: CorsOptionsDelegate = (req, cb) => {
  const origin = (req.headers?.origin as string) || '';
  if (!origin || isAllowed(origin)) cb(null, { origin: true, credentials: true });
  else cb(new Error('CORS blocked for origin: ' + origin), { origin: false });
};

app.use(cors(corsDelegate));
// Explicit preflight handling
app.options('*', cors(corsDelegate));

app.use(express.json());
app.use(cookieParser());

// Ensure DB schema (best-effort)
ensureSchema().catch(err => console.error('ensureSchema failed:', err?.message || err));

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

// ----- OAuth: Start (preserve `next` via state) -----
app.get('/auth/login', (req: Request, res: Response) => {
  // e.g. /auth/login?next=/dashboard?my=...&team=...&sel=...
  const nextRaw = typeof req.query.next === 'string' ? req.query.next : '/dashboard';
  const nextSafe = nextRaw && nextRaw.startsWith('/') ? nextRaw : '/dashboard';

  const url = new URL('https://www.bungie.net/en/OAuth/Authorize');
  url.searchParams.set('client_id', String(process.env.BUNGIE_CLIENT_ID));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', String(process.env.OAUTH_REDIRECT_URL));
  // carry the destination/params through OAuth
  url.searchParams.set('state', encodeURIComponent(nextSafe));

  res.redirect(url.toString());
});

// ----- OAuth: Callback (restore `next`, append sid) -----
app.get('/auth/callback', async (req: Request, res: Response) => {
  const code = (req.query.code as string) || '';
  const stateParam = typeof req.query.state === 'string' ? req.query.state : '';
  let nextPath = '/dashboard';
  try {
    const decoded = decodeURIComponent(stateParam);
    if (decoded && decoded.startsWith('/')) nextPath = decoded;
  } catch { /* ignore bad state */ }

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

  const tokensJson: any = await tokenRes.json();
  const access_token = String(tokensJson.access_token);
  const refresh_token = tokensJson.refresh_token ? String(tokensJson.refresh_token) : undefined;
  const expires_in = Number(tokensJson.expires_in);
  const membership_id = tokensJson.membership_id ? String(tokensJson.membership_id) : 'pending';

  // Store session (fallback cookie if DB fails)
  let sessionId: string | null = null;
  try {
    sessionId = await storeSession({
      membership_id,
      access_token,
      refresh_token,
      expires_in
    });
  } catch (e: any) {
    console.error('storeSession failed:', e?.message || e);
    res.cookie('session_tmp', JSON.stringify({ access_token, refresh_token, expires_in }), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    });
  }

  if (sessionId) {
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    });
  }

  const frontBase = String(process.env.FRONTEND_URL || 'http://localhost:3000');
  const finalUrl = new URL(frontBase + nextPath);
  if (sessionId) finalUrl.searchParams.set('sid', sessionId);

  res.redirect(finalUrl.toString());
});

// ----- Feature routes -----
app.use(dbtestRoutes);
app.use(profileRoutes);
app.use(portalRoutes);
app.use(forecastRoutes);

// ----- Start server -----
const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log('API listening on :' + port);
});
