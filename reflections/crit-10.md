# Crit 10 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was catching a bug the spec itself was designed to expose,
before the crit did it for me. The audit log's console line originally
showed only a person's display name, on the reasoning that a name is more
legible at a glance than an opaque id — true, but beside the point. This
week's whole test is "can you tell two browsers apart from the logs alone,"
and nothing stops two pod members typing the same name at `/api/join`. I
caught it by actually rehearsing the crit condition rather than trusting
the design: joined twice as "Sam" from two different sessions and watched
the log go ambiguous exactly where it mattered. The fix (an id prefix next
to the name) was small; the lesson was that "this satisfies the spec" is a
claim to test against the spec's actual adversarial case, not just against
my own mental model of what the feature does.

The second one was a rerun of crit 8's lesson from a different angle. Building
the party room's avatars, I found they were rendering at zero width — and
tracing it back, the exact same bug has been silently live in the presence
strip since crit 9: Astro's scoped CSS only attaches its scoping attribute
to elements it renders server-side, so anything built client-side via
`innerHTML` or `createElement` (which `live.ts` has been doing since the
real-time work started) quietly falls outside every scoped rule that
targets it. `pnpm check` was green the entire time, because nothing in it
ever looks at a live SSE update visually. Same root as crit 8's watering-can
bug — functional checks proving the plumbing works while the actual pixels
on screen were wrong — just hiding in a different layer this time.

## What did this work change about who I want to be as a developer?

It sharpened a habit I only had half-formed after crit 8: when a feature's
whole point is resisting a specific failure mode, go create that failure
mode on purpose before calling it done, rather than reasoning abstractly
about whether the design should handle it. I could have read the party room
and audit log code and convinced myself the name-collision case was fine; I
only actually knew it wasn't by typing "Sam" twice. I want to keep treating
a spec's adversarial framing — "if X can't tell Y apart, that's the
finding" — as a literal instruction to go try to break it that way myself,
not as background colour to design around in my head.
