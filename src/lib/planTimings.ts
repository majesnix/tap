/** Default pause after a no-wait step. */
export const STEP_DELAY_DEFAULT_MS = 200;
/** Longest pause a no-wait step may insert (one minute); mirrors MAX_STEP_DELAY_MS in Rust. */
export const STEP_DELAY_MAX_MS = 60_000;
/** Default reply wait. */
export const REPLY_TIMEOUT_DEFAULT_MS = 10_000;
/** Longest reply wait (five minutes); mirrors MAX_REPLY_TIMEOUT_MS in Rust. */
export const REPLY_TIMEOUT_MAX_MS = 300_000;

/** Parse a delay field into a bounded number of milliseconds. */
export function clampStepDelay(raw: string): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return STEP_DELAY_DEFAULT_MS;
  return Math.min(Math.max(n, 0), STEP_DELAY_MAX_MS);
}

/** Parse a timeout field into a bounded, non-zero number of milliseconds. */
export function clampReplyTimeout(raw: string): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return REPLY_TIMEOUT_DEFAULT_MS;
  return Math.min(Math.max(n, 1), REPLY_TIMEOUT_MAX_MS);
}
