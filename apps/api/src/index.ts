import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { z } from "zod";


const app = express();
app.use(cors({ origin: process.env.ALLOW_ORIGIN?.split(",") || true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// ---- Zod schema for Bungie token response ----
const BungieTokenSchema = z.object({
  token_type: z.string(),
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  refresh_expires_in: z.number().optional(),
  membership_id: z.string().optional()
});
type BungieToken = z.infer<typeof BungieTokenSchema>;

// OAuth start
app.get("/auth/login", (_req, res) => {
  const url = new URL("https://www.bungie.net/en/OAuth/Authorize");
  url.searchParams.set("client_id", process.env.BUNGIE_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", process.env.OAUTH_REDIRECT_URL!);
  res.redirect(url.toString());
});

// OAuth callback
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send("Missing code");

  const tokenRes = await fetch("https://www.bungie.net/Platform/App/OAuth/Token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": process.env.BUNGIE_API_KEY!,
      "Authorization": "Basic " + Buffer.from(
        `${process.env.BUNGIE_CLIENT_ID}:${process.env.BUNGIE_CLIENT_SECRET}`
      ).toString("base64")
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.OAUTH_REDIRECT_URL!
    }).toString()
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    return res.status(502).send(`Bungie token exchange failed (${tokenRes.status}): ${errText}`);
  }

  // 👇 This line fixes the "unknown" issue by validating + typing
  const tokens: BungieToken = BungieTokenSchema.parse(await tokenRes.json());

  // For MVP: cookie. (Later: store in DB)
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  res.cookie("session", JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt
  }), {
    httpOnly: true,
    secure: true,          // OK on Render (HTTPS). For local dev you may set false.
    sameSite: "lax",
    path: "/"
  });

  res.redirect((process.env.FRONTEND_URL || "http://localhost:3000") + "/dashboard");
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API on :${port}`));
