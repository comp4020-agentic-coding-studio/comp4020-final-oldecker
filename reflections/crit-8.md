# Crit 8 reflection

## What was the breakthrough that moved the work forward?

Two bugs this week taught me the same lesson from different angles. The
CSRF/localhost bug (Astro's origin check silently downgrading the hostname
whenever it doesn't match `allowedDomains`) would have 403'd every join,
post and vote in local dev and in CI's pre-deploy check, while working
fine against the real `fly.dev` domain — so it would have looked fine in
production and been broken everywhere actually cheap to test. The
breakthrough there was reading Astro's own source to find the exact
mechanism rather than patching around the symptom.

The watering-can direction bugs (leaning the wrong way, water falling
diagonally) had a different cause but the same root: only ever verified
functionally — `pnpm check`, HTTP codes, grepped markup — never visually.
Reasoning abstractly about which way a CSS `rotate()` sign points is
exactly the kind of thing that's easy to get wrong twice, and no amount of
passing tests catches that. Only actually looking at it does. The real
breakthrough wasn't fixing the sign; it was noticing my whole
verification loop had a blind spot for anything visual, and that passing
tests prove the plumbing works, not that the thing looks right.

## What did this work change about who I want to be as a developer?

It sharpened that I want to build things that are actually meaningful to
people, not just technically correct. The board only exists because it's
for a specific group of real friends going through a real moment
(scattering after our degree) — and that's made me want to keep steering
toward work with a real person or relationship behind it, not work that's
just an interesting technical exercise with no one in particular on the
other end of it.
