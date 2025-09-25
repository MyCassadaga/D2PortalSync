// Start OAuth  (REPLACE this handler)
app.get('/auth/login', (req, res) => {
  // Preserve the page/query the user is on, default to /dashboard
  const nextRaw = typeof req.query.next === 'string' ? req.query.next : '/dashboard';
  const nextSafe = nextRaw && nextRaw.startsWith('/') ? nextRaw : '/dashboard';

  const url = new URL('https://www.bungie.net/en/OAuth/Authorize');
  url.searchParams.set('client_id', String(process.env.BUNGIE_CLIENT_ID));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', String(process.env.OAUTH_REDIRECT_URL));
  // carry "next" via OAuth state (URL-encoded so we can safely round-trip)
  url.searchParams.set('state', encodeURIComponent(nextSafe));

  res.redirect(url.toString());
});

// OAuth callback  (REPLACE this handler)
app.get('/auth/callback', async (req, res) => {
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

  // token parse/schema as before
  const tokensJson: any = await tokenRes.json();
  const tokens = {
    token_type: String(tokensJson.token_type),
    access_token: String(tokensJson.access_token),
    expires_in: Number(tokensJson.expires_in),
    refresh_token: tokensJson.refresh_token ? String(tokensJson.refresh_token) : undefined,
    refresh_expires_in: tokensJson.refresh_expires_in ? Number(tokensJson.refresh_expires_in) : undefined,
    membership_id: tokensJson.membership_id ? String(tokensJson.membership_id) : undefined
  };

  const membershipId = tokens.membership_id ? tokens.membership_id : 'pending';

  // Store server-side session, with fallback cookie if DB fails
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

  const frontBase = String(process.env.FRONTEND_URL || 'http://localhost:3000');
  // Append "sid" to whatever path/query we preserved in state
  const finalUrl = new URL(frontBase + nextPath);
  if (sessionId) finalUrl.searchParams.set('sid', sessionId);

  res.redirect(finalUrl.toString());
});
