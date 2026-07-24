/**
 * Small, dependency-free helpers shared across the main process.
 */
import { randomUUID } from 'node:crypto'

/** Short, collision-resistant id for tabs, runs, records, etc. */
export function id(prefix = ''): string {
  return prefix + randomUUID().replace(/-/g, '').slice(0, 16)
}

/** Extract a bare origin ("https://example.com") from any URL, or '' on failure. */
export function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/** A promise that resolves after `ms` — used to pace agent actions. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
