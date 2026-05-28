// Simple in-memory rate limiter
// For production scale, swap the Map for Redis (Upstash)
const store = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, max: number, windowMs: number) {
  const now      = Date.now()
  const existing = store.get(key)

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1 }
  }
  if (existing.count >= max) {
    return { allowed: false, remaining: 0 }
  }
  existing.count++
  return { allowed: true, remaining: max - existing.count }
}
