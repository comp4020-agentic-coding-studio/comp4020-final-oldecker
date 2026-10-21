// Brute-force protection for /login: count FAILED attempts in a sliding
// window, per name and per IP, and refuse further attempts while either
// counter is full. In memory, which is right for exactly one Fly machine
// (fly.toml): a restart forgets the counts, which only ever helps an
// attacker by one window's worth of guesses, and there is no second machine
// whose counts would disagree. If the app ever runs more than one machine,
// this has to move into the database.
//
// Trade-off, chosen on purpose: the per-name limit means someone who knows a
// friend's name can lock that friend out of logging in for a few minutes by
// failing on purpose. For a closed group that's the lesser evil next to
// letting anyone guess at one account all day; the lockout ends by itself.
export const WINDOW_MS = 10 * 60 * 1000;
export const MAX_FAILS_PER_NAME = 5;
export const MAX_FAILS_PER_IP = 20;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const kept = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (kept.length) failures.set(key, kept);
  else failures.delete(key);
  return kept;
}

export interface LoginGate {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkLogin(nameKey: string, ip: string, now = Date.now()): LoginGate {
  const byName = recent(`name:${nameKey}`, now);
  const byIp = recent(`ip:${ip}`, now);
  let until = 0;
  if (byName.length >= MAX_FAILS_PER_NAME) until = Math.max(until, byName[0] + WINDOW_MS);
  if (byIp.length >= MAX_FAILS_PER_IP) until = Math.max(until, byIp[0] + WINDOW_MS);
  return until === 0
    ? { allowed: true, retryAfterSeconds: 0 }
    : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)) };
}

export function recordFailedLogin(nameKey: string, ip: string, now = Date.now()): void {
  for (const key of [`name:${nameKey}`, `ip:${ip}`]) {
    failures.set(key, [...recent(key, now), now]);
  }
}

// A correct password forgives that name's earlier typos. The IP counter is
// deliberately left alone: one success mustn't reset a scripted guesser who
// owns one real account.
export function recordSuccessfulLogin(nameKey: string): void {
  failures.delete(`name:${nameKey}`);
}
