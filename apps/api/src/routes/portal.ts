import { Router } from 'express';
import { getSession } from '../db';

const r = Router();

// Basic Bungie fetch (no auth needed for milestones/manifest)
async function bungiePublic(path: string) {
  const url = 'https://www.bungie.net/Platform' + path;
  const res = await fetch(url, {
    headers: { 'X-API-Key': String(process.env.BUNGIE_API_KEY) }
  });
  if (!res.ok) throw new Error('Bungie public error: ' + res.status);
  return await res.json();
}

// Optional auth fetch (not strictly needed here, but ready)
async function bungieAuth(path: string, accessToken: string) {
  const url = 'https://www.bungie.net/Platform' + path;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': String(process.env.BUNGIE_API_KEY),
      'Authorization': 'Bearer ' + accessToken
    }
  });
  if (!res.ok) throw new Error('Bungie auth error: ' + res.status);
  return await res.json();
}

// Helper: get a session access token from cookie/header/query (same fallbacks as /me/profile)
function extractSid(req: any): string | null {
  // Authorization: Bearer sid:<sessionId>
  const authHeader = (req.headers.authorization as string | undefined) ?? '';
  const m = authHeader.match(/^Bearer\s+sid:(.+)$/i);
  const authSid = m ? m[1] : null;
  const cookieSid = req.cookies?.session_id as string | undefined;
  const urlSid = typeof req.query?.sid === 'string' ? (req.query.sid as string) : null;
  return authSid || cookieSid || urlSid || null;
}

/**
 * Returns a few real activities by:
 *  1) Reading current Milestones (public)
 *  2) For the first handful of milestones that expose an activityHash,
 *     fetching the ActivityDefinition to get display name + recommendedLight.
 *
 * This is a minimal “real data” starter; we can refine which milestones map to Portal later.
 */
r.get('/portal/activities', async (req, res) => {
  try {
    // (Optional) try to load session; not required for public endpoints, but we allow ?sid=/cookie/header
    const sid = extractSid(req);
    if (sid) {
      try { await getSession(sid); } catch { /* ignore if missing */ }
    }

    // 1) Current milestones (public)
    const ms: any = await bungiePublic('/Destiny2/Milestones/');
    const entries = Object.values(ms?.Response || {}) as any[];

    // pick some milestones that expose an activity
    const withActivities = entries
      .map((e: any) => {
        const act = e?.activities?.[0];
        return act && act.activityHash ? { milestoneHash: e.milestoneHash, activityHash: act.activityHash } : null;
      })
      .filter(Boolean)
      .slice(0, 4) as { milestoneHash: number; activityHash: number }[];

    // 2) Look up ActivityDefinition for names/light (public)
    const activities = [];
    for (const item of withActivities) {
      try {
        const def: any = await bungiePublic(`/Destiny2/Manifest/DestinyActivityDefinition/${item.activityHash}`);
        const defData = def?.Response;
        const name = defData?.displayProperties?.name || `Activity ${item.activityHash}`;
        const recommendedLight = defData?.activityLightLevel ?? defData?.lightLevel ?? null;

        activities.push({
          hash: item.activityHash,
          name,
          group: 'milestone',
          recommendedLight: typeof recommendedLight === 'number' ? recommendedLight : null
        });
      } catch {
        // skip any that fail to load
      }
    }

    res.json({ ok: true, activities });
  } catch (e: any) {
    console.error('/portal/activities error:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
