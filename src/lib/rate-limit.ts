// ============================================
// KAIRO - Rate Limiting Utility
// Supports both development (in-memory) and production (Redis)
// ============================================

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Rate limit check result
 */
interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Remaining requests in the window */
  remaining: number;
  /** Timestamp when the limit resets */
  resetAt: number;
}

/**
 * In-memory rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ============================================
// In-Memory Rate Limiter (Development)
// ============================================

const memoryStore = new Map<string, RateLimitEntry>();

/**
 * Memory-based rate limiter for development
 * NOTE: Does not work in serverless production (each instance has its own memory)
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  // Clean up expired entries periodically
  if (memoryStore.size > 1000) {
    for (const [k, v] of memoryStore.entries()) {
      if (now > v.resetAt) memoryStore.delete(k);
    }
  }

  // No entry or expired
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// ============================================
// Redis Rate Limiter (Production)
// Uses Upstash Redis when available
// ============================================

let redisClient: unknown = null;

async function getRedisClient() {
  if (redisClient) return redisClient;

  // Only attempt to use Redis in production with proper env vars
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      // Dynamic import to avoid issues when Redis is not configured
      // Note: @upstash/redis needs to be installed for production use
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Redis } = await import('@upstash/redis' as string);
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      console.log('[RateLimit] Using Upstash Redis');
      return redisClient;
    } catch (error) {
      console.warn('[RateLimit] Failed to initialize Redis, falling back to memory:', error);
      return null;
    }
  }

  return null;
}

async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const redis = await getRedisClient();
    if (!redis || typeof redis !== 'object') {
      // Fallback to memory if Redis not available
      return checkRateLimitMemory(key, config);
    }

    const now = Date.now();
    const windowKey = `ratelimit:${key}`;

    // Use Redis INCR with EXPIRE for atomic rate limiting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redisTyped = redis as any;
    const count = await redisTyped.incr(windowKey);

    // Set expiry on first request in window
    if (count === 1) {
      await redisTyped.pexpire(windowKey, config.windowMs);
    }

    // Get TTL for resetAt
    const ttl = await redisTyped.pttl(windowKey);
    const resetAt = now + (ttl > 0 ? ttl : config.windowMs);

    if (count > config.maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetAt,
      };
    }

    return {
      success: true,
      remaining: config.maxRequests - count,
      resetAt,
    };
  } catch (error) {
    console.error('[RateLimit] Redis error, falling back to memory:', error);
    return checkRateLimitMemory(key, config);
  }
}

// ============================================
// Public API
// ============================================

/**
 * Check rate limit for a given key
 * Automatically uses Redis in production, memory in development
 *
 * @param key - Unique identifier (e.g., "project:uuid" or "user:uuid")
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 100, windowMs: 60_000 }
): Promise<RateLimitResult> {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In development, use memory-based rate limiting
    return checkRateLimitMemory(key, config);
  }

  // In production, try Redis first
  return checkRateLimitRedis(key, config);
}

/**
 * Create a rate limiter with specific configuration
 *
 * @param config - Rate limit configuration
 * @returns Rate limiter function
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (key: string) => checkRateLimit(key, config);
}

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
  /** Standard API rate limit: 100 requests per minute */
  standard: createRateLimiter({ maxRequests: 100, windowMs: 60_000 }),

  /** Strict rate limit: 20 requests per minute */
  strict: createRateLimiter({ maxRequests: 20, windowMs: 60_000 }),

  /** Lenient rate limit: 200 requests per minute */
  lenient: createRateLimiter({ maxRequests: 200, windowMs: 60_000 }),

  /** WhatsApp API rate limit: 100 requests per minute per project */
  whatsapp: createRateLimiter({ maxRequests: 100, windowMs: 60_000 }),
};
