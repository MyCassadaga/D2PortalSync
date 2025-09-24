import { Router } from 'express';

const r = Router();

/**
 * For now, keep a tiny inline seed. Replace with real hashes later.
 * (This avoids JSON imports and extra TS config.)
 */
const portalActivityHashes: Record<string, number[]> = {
  soloOps: [],
  fireteamOps: [],
  pinnacleOps: [],
  crucibleOps: []
};

// Minimal “definition” fetch using Bungie’s entity definition endpoint.
async function getActivityDef(hash: number) {
  const res = await fetch(
    'https://www.bungie.net/Platform/Destiny2/Manifest/DestinyActivityDefinition/' + hash + '/',
    { headers: { 'X-API-Key': String(process.env.BUNGIE_API_KEY) } }
  );
  if (!res.ok) throw new Error('activity def failed: ' + res.status);
  const j = await res.json();
  return j.Response;
}

r.get('/portal/activities', async (_req, res) => {
  const groups = Object.entries(portalActivityHashes) as [string, number[]][];
  const results: any[] = [];

  for (const [group, hashes] of groups) {
    for (const h of hashes) {
      try {
        const def = await getActivityDef(h);
        results.push({
          group,
          hash: def.hash,
          name: def.displayProperties?.name,
          recommendedLight: def.activityLightLevel,
          rewards: def.rewards ?? [],
          modifiers: def.modifiers ?? []
        });
      } catch (e: any) {
        // swallow errors per activity in MVP
      }
    }
  }

  res.json({ activities: results });
});

export default r;
