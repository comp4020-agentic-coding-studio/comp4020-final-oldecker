# Crit 9 reflection

## What was the breakthrough that moved the work forward?

The breakthrough wasn't getting Server-Sent Events working --- that part was
mechanical. It was realising, while writing up the ADR in PROCESS.md, that
"make it real-time" isn't one decision, it's at least two: a transport
decision (SSE, one shared `EventEmitter`, because this is one process on one
machine) and a much more interesting *scope* decision about which state
actually deserves to be live. I'd built presence and the plant's watering as
the live things and left posts and reactions as reload-only without fully
articulating why until I had to write it down for the crit. Once I did, it
turned out not to be an accident of what was easiest to wire up first, but
the right call for what this app is: posts are something someone takes time
over and other people catch up on at their own pace, not a stream anyone
should feel pressure to react to the instant it lands. Writing the ADR
*after* the code already existed was the wrong order to do it in, even
though the decision itself held up --- next time that reasoning needs to come
before the commit, not be reconstructed from it.

## What did this work change about who I want to be as a developer?

It made me more suspicious of treating "real-time" as a single feature with a
single switch. The brief's own framing --- decide how it behaves when several
people use it at once, then defend that choice against the opposite one ---
pushed me to actually defend a boundary (presence and the plant are live,
posts and reactions aren't) rather than just making everything live because
the plumbing was already there and more live state looks more impressive in
a demo. I want to keep asking "does this *need* to be instant, or does
instant just look good" rather than defaulting to the maximum amount of
real-time a stack makes easy.
