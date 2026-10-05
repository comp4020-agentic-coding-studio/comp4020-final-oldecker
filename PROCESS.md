# Process overview

How you got from the brief to the harness, agentic workflow and stack behind
this app, told however suits the work. The
[final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/#what-you-submit)
says what it covers and how long it runs.

Markers follow the links you give them; they don't trawl the repo for evidence
you didn't point at. A link to the record is one whose text is the commit
hash, linked to that commit (or a `sha...sha` range) on GitHub.

`pnpm check:evidence` checks that this comment is gone and that every commit you
link exists in this repo. Whether the account is any good is the marker's call.

## What I'm building

A small catch-up board for a closed group of about 15 friends: short posts
("feeling" or "doing" updates), up to three photos each, and a shared plant
that the whole group waters just by showing up. I ruled out my first instinct
early --- an encrypted Snapchat-style messenger, reusing an existing side
project of mine built on Matrix. It didn't survive contact with the brief:
it's a messenger, and "a chat room with the nouns swapped" is the brief's own
cited example of a weak response; it's also a mobile client with no web
target, which doesn't fit "a multi-user, real-time website"; and its
Synapse+Postgres infrastructure doesn't fit the course's one-machine,
256MB Fly shape at all. The board is a better fit for the brief's own
permission to build small ("an app for twelve people, one street... is
on-brief") and for the design-for-co-presence note, once the plant and
reactions are in: it should be a little more alive because other people are
there, not just a feed you catch up on whenever.

## Stack

Reused crit 7's recipe rather than exploring something new this week: Astro
(SSR via `@astrojs/node`, standalone adapter) with `better-sqlite3` and
Drizzle on the `/data` volume
([`1c161f4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/1c161f4)).
That was a deliberate trade, not a default: with the whole repo still to set
up and the crit 8 cutoff close, a stack I'd already proven working end to end
on Fly bought back a day I didn't have. Worth a real decision, not a reflex,
next time the app's needs actually outgrow it.

One thing the agent got right that I wouldn't have caught myself: the course's
automated stack-conversion script is built for the GitHub Pages half, and
would have written a `base` path into `astro.config.ts` that 404s the root
route this app's spec actually checks. It built the SSR config by hand
instead, against crit 7's already-deployed shape.

## Building the core interaction

The agent built the join/post/water flow and the plant's health query (read
at request time from distinct waterers in the last 7 days --- no counter, no
cron) in
[`debc1f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/debc1f5),
and I verified it myself rather than taking a green check on faith: joined,
posted with a photo, watered the plant, then killed and restarted the whole
server to prove a post survives what a redeploy would do to it.

That same pass caught a real bug before it shipped: Astro's CSRF origin check
silently downgrades the request's hostname to a bare `localhost` (port
dropped) whenever the Host header doesn't match `allowedDomains`, which would
have 403'd every join/post/water action in local dev and in CI's pre-deploy
Docker check specifically, while working fine against the real `fly.dev`
domain behind Fly's proxy. It would have looked fine in production and been
broken everywhere I could cheaply test it. Fixed by adding a second
`allowedDomains` entry for plain local HTTP, without loosening the production
check.

## A correction, not a retry

After playtesting the first version I reported back three issues as plain
feedback rather than re-prompting line by line: the watering can was
rendering as the 🪴 potted-plant emoji (so the "pour" animation just looked
like the pot shaking), it leaned the wrong way, and the water fell in the
wrong direction
([`202fea9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/202fea9)
and the commit after it). The direction bugs were worth understanding, not
just flipping a sign until it looked right: the lean was backwards because the
rotation's sign was wrong relative to the pivot point, and the water fell
diagonally because `rotate(45deg) translateY(16px)` rotates the translation
itself when `rotate()` is listed outer-most in the transform --- the shape
rotation (circle into teardrop) needed to be inner, with the straight-down
fall as the outer, screen-space displacement.

## Streaks: a deliberate choice, not a default

I want to argue for including some form of streak mechanic, and I want to be
explicit about why, since a feature this familiar is exactly the kind of
thing that's easy to add as an unreasoned default. The actual goal for this
app is narrow: with ~15 people in the group, it should be genuinely
encouraged that *everyone* posts, not just the two or three people who'd post
anywhere. A streak is a cheap, legible signal that rewards showing up
regularly rather than rewarding the loudest or most eloquent post --- which
fits a "little update" app better than a like count would, since the point
isn't to rank posts against each other. The risk with streaks generally is
that they're built for a platform's retention, not the people using it; here
the audience is a closed group of friends I already have a relationship with,
so the harm that design pattern usually causes (pressure to perform for
strangers, anxiety about losing a public number) is much smaller, and I'd
rather have it visible only to the person themselves, not as a leaderboard.
Not built yet --- this is the reasoning I want on record before I build it,
not an after-the-fact justification.
