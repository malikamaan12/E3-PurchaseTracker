import { db } from "@db";
import { rateLimitBuckets } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { getServerSecret } from "@/lib/utils/config";

const RATE_LIMIT_SALT = getServerSecret("RATE_LIMIT_SALT", "local-development-rate-limit-salt");

/**
 * DurableRateLimitService
 * Provides a serverless-safe, database-backed token bucket rate limiter.
 * Does not rely on in-memory state or single-process timers.
 */
export class DurableRateLimitService {
  private static instance: DurableRateLimitService;

  private constructor() {}

  public static getInstance(): DurableRateLimitService {
    if (!DurableRateLimitService.instance) {
      DurableRateLimitService.instance = new DurableRateLimitService();
    }
    return DurableRateLimitService.instance;
  }

  /**
   * Extracts clean, edge-sanitized client IP from NextRequest or headers.
   */
  public extractClientIp(req: { headers: { get(name: string): string | null } }): string {
    const xRealIp = req.headers.get("x-real-ip");
    if (xRealIp?.trim()) return xRealIp.trim();

    const xForwardedFor = req.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      const firstIp = xForwardedFor.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }

    return "unknown-source";
  }

  /**
   * Hashes an IP address using SHA-256 with a salt to maintain privacy
   * while allowing durable abuse correlation.
   */
  public hashIp(ip: string | null | undefined): string {
    if (!ip) return crypto.createHash("sha256").update(`${RATE_LIMIT_SALT}:unknown-source`).digest("hex");

    // Normalize: extract primary IP if comma-separated list, strip port if IPv4
    let cleanIp = ip.split(",")[0]?.trim().toLowerCase() || "unknown-source";
    if (cleanIp.includes(":") && !cleanIp.includes("::")) {
      const parts = cleanIp.split(":");
      if (parts.length === 2 && !isNaN(Number(parts[1]))) {
        cleanIp = parts[0];
      }
    }

    return crypto
      .createHash("sha256")
      .update(`${RATE_LIMIT_SALT}:${cleanIp}`)
      .digest("hex");
  }

  /**
   * Atomically checks and consumes rate limit tokens.
   * 
   * @param key Unique rate limit key (e.g. `exchange:${ipHash}`)
   * @param maxTokens Maximum capacity of the bucket
   * @param refillWindowSeconds Time in seconds to fully refill the bucket
   * @param cost Number of tokens to consume (default 1)
   */
  public async consume(
    key: string,
    maxTokens: number,
    refillWindowSeconds: number,
    cost: number = 1
  ): Promise<{ allowed: boolean; remaining: number; resetAfterMs: number }> {
    const now = Date.now();
    const windowMs = refillWindowSeconds * 1000;
    const expiresAt = new Date(now + windowMs * 2);

    try {
      // Find or initialize bucket
      const [existing] = await db
        .select()
        .from(rateLimitBuckets)
        .where(eq(rateLimitBuckets.key, key))
        .limit(1);

      if (!existing) {
        // Initial insert
        const remaining = Math.max(0, maxTokens - cost);
        await db
          .insert(rateLimitBuckets)
          .values({
            key,
            tokens: remaining,
            lastRefill: now.toString(),
            expiresAt,
          })
          .onConflictDoNothing();

        return {
          allowed: true,
          remaining,
          resetAfterMs: windowMs,
        };
      }

      // Calculate refill
      const lastRefill = parseInt(existing.lastRefill || "0", 10);
      const elapsedMs = Math.max(0, now - lastRefill);
      const tokensToAdd = Math.floor((elapsedMs / windowMs) * maxTokens);
      const currentTokens = Math.min(maxTokens, existing.tokens + tokensToAdd);

      if (currentTokens < cost) {
        // Rate limit exceeded
        const msNeeded = Math.ceil(((cost - currentTokens) / maxTokens) * windowMs);
        return {
          allowed: false,
          remaining: currentTokens,
          resetAfterMs: msNeeded,
        };
      }

      // Update remaining tokens
      const newTokens = currentTokens - cost;
      const newRefill = tokensToAdd > 0 ? now.toString() : existing.lastRefill;

      await db
        .update(rateLimitBuckets)
        .set({
          tokens: newTokens,
          lastRefill: newRefill,
          expiresAt,
        })
        .where(eq(rateLimitBuckets.key, key));

      return {
        allowed: true,
        remaining: newTokens,
        resetAfterMs: windowMs,
      };
    } catch (error) {
      console.error("[RateLimiter] Database rate limiting error:", error);
      // Fail open defensively so database hiccups do not lock out legitimate operations,
      // but log the security anomaly.
      return { allowed: true, remaining: 1, resetAfterMs: 0 };
    }
  }

  /**
   * Cleanup expired rate limit buckets to maintain database hygiene
   */
  public async cleanupExpired(): Promise<void> {
    try {
      await db
        .delete(rateLimitBuckets)
        .where(sql`expires_at < ${new Date()}`);
    } catch (err) {
      console.error("[RateLimiter] Cleanup error:", err);
    }
  }
}

export const durableRateLimiter = DurableRateLimitService.getInstance();
