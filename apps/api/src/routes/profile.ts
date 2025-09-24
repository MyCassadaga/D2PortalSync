import { Router } from "express";
import { getSession, pool } from "../db";
import { bungieFetch } from "../services/bungie";
import { cacheGet, cacheSet } from "../cache";

const r = Router();

r.get("/me/profile", async (req, res) => {
  const sid = req.cookies.session_id;
  if (!sid) return res.status(401).json({ error: "no session" });
  const session = await getSession(sid);
  if (!session) return res.status(401).json({ error: "session expired" });

  // Try cache
  const cacheKey = `profile:${sid}`;
  const cached = await cacheGet<any>(cacheKey);
  if (cached) return res.json(cached);

  // 1) memberships
  const memberships = await bungieFetch<any>({
    path: "/User/GetMembershipsForCurrentUser/",
    accessToken: session.access_token
  });
  const m = memberships?.Response?.destinyMemberships?.[0];
  if (!m) return res.status(400).json({ error: "no destiny memberships" });

  // Update membership_id if pending
  if (session.membership_id === "pending") {
    await pool.query("update sessions set membership_id = $1 where id = $2", [m.membershipId, sid]);
  }

  // 2) profile
  const prof = await bungieFetch<any>({
    path: `/Destiny2/${m.membershipType}/Profile/${m.membershipId}/?components=100,200`,
    accessToken: session.access_token
  });

  // summarize: name, characterIds, highest power
  const chars = Object.values(prof.Response.characters.data || {}) as any[];
  const powerList = chars.map(c => c.light as number);
  const highestPower = Math.max(...powerList, 0);

  const out = {
    membershipId: m.membershipId,
    membershipType: m.membershipType,
    characterIds: prof.Response.profile.data.characterIds,
    highestPower
  };

  await cacheSet(cacheKey, out, 90); // 90s TTL
  res.json(out);
});

export default r;
