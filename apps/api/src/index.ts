// apps/api/src/index.ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { z } from 'zod';

import profileRoutes from './routes/profile';
import portalRoutes from './routes/portal';
import forecastRoutes from './routes/forecast';
import { storeSession } from './db';

// ----- App setup -----
const app = express();

const allowed =
  (process.env.ALLOW_ORIGIN?.split(',') || []).map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: allowed.length ? allowed : true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// ----- OAuth -----
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
  url.searchParams.set('client_id', process.env.BUNGIE_CLIENT_ID!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', process.env.OAUTH_REDIRECT_URL!);
  res.redirect(url.toString());
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send('Missing code');
    return;
  }

  const tokenRes = await fetch('https://www.bungie.net/Platform/App/OAuth/Token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': process.env.BUNGIE_API_KEY!,
      'Authorization':
        'Basic ' + Buffer.from(
          `${process.env.BUNGIE_CLIENT_ID}:${process.env.BUNGIE_CLIENT_SECRET}`
        ).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.OAUTH_REDIRECT_URL!
    }).toString()
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    res.status(502).send(`Bungie token exchange failed (${tokenRes.status}): ${errText}`);
    return;
  }

  const tokensJson = await tokenRes.json();
  const tokens: BungieToken = BungieTokenSchema.parse(tokensJson);

  const membershipId = tokens.membership_id ?? 'pending';

  const sessionId = await storeSession({
    membership_id: membershipId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in
  });

  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  });

  const front = process.env.FRONTEND_URL || 'http://localhost:3000_
