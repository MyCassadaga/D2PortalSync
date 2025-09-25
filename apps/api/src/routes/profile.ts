import { z } from "zod";
import { updateSessionTokens } from "../db";

const RefreshSchema = z.object({
  token_type: z.string(),
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  refresh_expires_in: z.number().optional(),
});
export type RefreshTokens = z.infer<typeof RefreshSchema>;

/**
 * Exchange a Bungie refresh_token for a new access_token.
 */
export async function refreshWithBungie(refreshToken: string): Promise<RefreshTokens> {
  const cid = String(process.env.BUNGIE_CLIENT_ID || "");
  const csec = String(process.env.BUNGIE_CLIENT_SECRET || "");
  const authBasic = "Basic " + Buffer.from(cid + ":" + csec).toString("base64");

  const res = await fetch("https://www.bungie.net/Platform/App/OAuth/Token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": String(process.env.BUNGIE_API_KEY),
      "Authorization": authBasic
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }).toString()
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`refresh failed ${res.status}: ${txt}`);
  }
  const j = await res.json();
  return RefreshSchema.parse(j);
}

/**
 * If a session’s access token is expiring in <60s, refresh it and
 * persist new tokens. Returns the up-to-date session row shape.
 *
 * `sessionRow` should contain at least: access_token, refresh_token, expires_at.
 */
export async function refreshIfExpired(sessionId: string, sessionRow: any): Promise<any> {
  try {
    const expiresAtMs = new Date(sessionRow.expires_at).getTime();
    const now = Date.now();
    const soon = 60_000; // 60s threshold

    if (expiresAtMs - now > soon) return sessionRow;

    if (!sessionRow.refresh_token) throw new Error("no refresh_token on session");

    const tokens = await refreshWithBungie(sessionRow.refresh_token);
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await updateSessionTokens(sessionId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? sessionRow.refresh_token,
      expires_at: newExpiresAt
    });

    return {
      ...sessionRow,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? sessionRow.refresh_token,
      expires_at: newExpiresAt
    };
  } catch (e) {
    // Don’t throw—callers can continue with current token if they want.
    // They can decide to re-login on 401s.
    return sessionRow;
  }
}
