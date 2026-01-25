import { createHash, randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export interface ApiKeyValidationResult {
  valid: boolean;
  userId?: string;
  keyId?: string;
  error?: string;
}

/**
 * Generate a new API key
 * Returns the full key (only shown once) and the hash for storage
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  // Generate 32 random bytes and encode as base64
  const randomPart = randomBytes(32).toString("base64url");
  const key = `ds_${randomPart}`;
  const hash = hashApiKey(key);
  const prefix = key.substring(0, 11); // "ds_" + first 8 chars

  return { key, hash, prefix };
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate an API key from the Authorization header
 * Returns the user ID if valid, null otherwise
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<ApiKeyValidationResult> {
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  // Extract the key from "Bearer ds_xxx" format
  const match = authHeader.match(/^Bearer\s+(ds_[A-Za-z0-9_-]+)$/);
  if (!match) {
    return { valid: false, error: "Invalid Authorization format. Use: Bearer ds_xxx" };
  }

  const apiKey = match[1];
  const keyHash = hashApiKey(apiKey);

  const supabase = createServiceClient();

  // Look up the API key by its hash
  const { data: apiKeyRecord, error } = await supabase
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !apiKeyRecord) {
    return { valid: false, error: "Invalid API key" };
  }

  if (apiKeyRecord.revoked_at) {
    return { valid: false, error: "API key has been revoked" };
  }

  // Update last_used_at timestamp (fire and forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKeyRecord.id)
    .then(() => {});

  return {
    valid: true,
    userId: apiKeyRecord.user_id,
    keyId: apiKeyRecord.id,
  };
}

/**
 * Simple in-memory rate limiter
 * In production, use Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  keyId: string,
  limit: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(keyId);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || record.resetAt < now) {
    // Start a new window
    const resetAt = now + windowMs;
    rateLimitStore.set(keyId, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}
