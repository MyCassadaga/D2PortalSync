import { Router } from 'express';
import { getSession, pool } from '../db';

const r = Router();

async function bungieFetch(path: string, accessToken: string) {
  const url = 'https://www.bungie.net/Platform' + path;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': String(process.env.BUNGIE_API_KEY),
      'Authorization': 'Bearer ' + accessToken
    }
  });
  if (!res.ok) throw new Error('Bungie error: ' + res.status);
  return await res.json();
}

r.get('/me/profile', async (req, res) => {
  const sid = req.cookies.session_id as string | undefined;
  if (!sid) { res.status(401).json({ error: 'no session' }); return; }
  const session = await getSession(sid);
  if (!session) { res.status(401).json({ error: 'session expired' }); return; }

  // 1) memberships
  const me = await bungieFetch('/User/GetMembershipsForCurrentUser/', session.access_token);
  const m = me?.Response?.destinyMemberships?.[0];
  if (!m) { res.status(400).json({ error: 'no destiny memberships' }); return; }

  // If we stored 'pending', update membership_id now
  if (session.membership_id === 'pending') {
    await pool.query('update sessions set membership_id = $1 where id = $2', [m.membershipId, sid]);
  }

  // 2) profile
  const prof = await bungieFetch(
    `/Destiny2/${m.membershipType}/Profile/${m.membershipId}/?components=100,200`, session.access_token
  );

  const chars = Object.values(prof.Response.characters.data || {}) as any[];
  const highestPower = Math.max(...chars.map(c => c.light as number), 0);

  res.json({
    membershipId: m.membershipId,
    membershipType: m.membershipType,
    characterIds: prof.Response.profile.data.characterIds,
    highestPower
  });
});

export default r;
