import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
app.use(cors({ origin: process.env.ALLOW_ORIGIN?.split(",") || true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// OAuth start
app.get("/auth/login", (_req, res) => {
  const url = new URL("https://www.bungie.net/en/OAuth/Authorize");
  url.searchParams.set("client_id", process.env.BUNGIE_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", process.env.OAUTH_REDIRECT_URL!);
  res.redirect(url.toString());
});

// OAuth callback (tokens stored server-side in a future step)
import fetch from "node-fetch";
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Missing code");
  const tokenRes = await fetch("https://www.bungie.net/Platform/App/OAuth/Token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": process.env.BUNGIE_API_KEY!,
      "Authorization": "Basic " + Buffer.from(`${process.env.BUNGIE_CLIENT_ID}:${process.env.BUNGIE_CLIENT_SECRET}`).toString("base64")
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.OAUTH_REDIRECT_URL!
    }).toString()
  });
  const tokens = await tokenRes.json();
  if (!("access_token" in tokens)) return res.status(500).json(tokens);
  // TODO: store tokens (DB). For now: session cookie is fine for testing.
  res.cookie("session", JSON.stringify(tokens), { httpOnly: true, sameSite: "lax", secure: true });
  res.redirect((process.env.FRONTEND_URL || "http://localhost:3000") + "/dashboard");
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API on :${port}`));
