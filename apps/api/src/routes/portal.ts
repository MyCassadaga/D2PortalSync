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
  const tmpRaw = req.cookies.session_tmp as string | undefined;

  // 1) Try DB-backed session
  let accessToken: string | null = null;
  let membershipId: string | null = null;

  if (sid) {
    try {
      const s = await getSession(sid);
      if (s) {
        accessToken = s.access_token;
        membershipId = s.membership_id;
      }
    } catch (e: any) {
      console.error('getSession error:', e?.message || e);
    }
  }

  // 2) Fallback to temporary cookie if DB session missing
  if (!accessToken && tmpRaw) {
    try {
      const tmp = JSON.parse(tmpRaw);
      accessToken = tmp.access_token || null;
    } catch {}
  }

  if (!accessToken) {
    return res.status(401).json({
      error: 'no session',
      haveSessionId: !!sid,
      haveSessionTmp: !!tmpRaw
    });
  }

  // 3) Bungie: get memberships
  const me = await bungieFetch('/User/GetMembershipsForCurrentUser/', accessToken);
  const m = me?.Response?.destinyMemberships?.[0];
  if (!m) {
    return res.status(400).json({ error: 'no destiny memberships' });
  }

  // Backfill membership_id if it was 'pending'
  if (membershipId === 'pending' && sid) {
    try {
      await pool.query('update sessions set membership_id = $1 where id = $2', [m.membershipId, sid]);
    } catch (e: any) {
      console.error('update membership_id failed:', e?.message || e);
    }
  }

  // 4) Bungie: get profile + compute highest power
  const prof = await bungieFetch(
    `/Destiny2/${m.membershipType}/Profile/${m.membershipId}/?components=100,200`,
    accessToken
  );

  const chars = Object.values(prof.Response.characters.data || {}) as any[];
  const highestPower = Math.max(...chars.map((c: any) => Number(c.light) || 0), 0);

  res.json({
    membershipId: m.membershipId,
    membershipType: m.membershipType,
    characterIds: prof.Response.profile.data.characterIds,
    highestPower
  });
});

export default r;
