import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  try { return await redis.get<T>(key); } catch { return null; }
}
export async function cacheSet(key: string, value: any, ttlSeconds: number) {
  try { await redis.set(key, value, { ex: ttlSeconds }); } catch {}
}
