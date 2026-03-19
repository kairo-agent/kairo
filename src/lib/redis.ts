/**
 * KAIRO - Redis Client (Upstash)
 *
 * Shared Redis client for debounce, caching, and other operations.
 * Returns null if Redis is not configured (development fallback).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRedis(): Promise<any | null> {
  if (redisClient) return redisClient;

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      // Dynamic import to avoid issues when Redis is not configured
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Redis } = await import('@upstash/redis' as string);
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      return redisClient;
    } catch {
      return null;
    }
  }

  return null;
}
