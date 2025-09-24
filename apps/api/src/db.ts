import { Pool } from "pg";

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL is NOT set. pg will try localhost:5432 and fail.");
}

export const pool = new Pool({
  connectionString: conn,
  ssl: { rejectUnauthorized: false } // Neon uses SSL
});

export async function getSession(sessionId: string) {
  const { rows } = await pool.query(
    "select * from sessions where id = $1 and expires_at > now()", [sessionId]
  );
  return rows[0] || null;
}

export async function storeSession(opts: {
  membership_id: string, access_token: string, refresh_token?: string, expires_in: number
}) {
  const expiresAt = new Date(Date.now() + opts.expires_in * 1000);
  const { rows } = await pool.query(
    `insert into sessions (membership_id, access_token, refresh_token, expires_at)
     values ($1,$2,$3,$4) returning id`,
    [opts.membership_id, opts.access_token, opts.refresh_token || null, expiresAt]
  );
  return rows[0].id as string;
}

export async function ensureSchema() {
  await pool.query(`create extension if not exists pgcrypto;`);
  await pool.query(`
    create table if not exists sessions (
      id uuid primary key default gen_random_uuid(),
      membership_id text not null,
      access_token text not null,
      refresh_token text,
      expires_at timestamptz not null,
      created_at timestamptz default now()
    );
  `);
}
