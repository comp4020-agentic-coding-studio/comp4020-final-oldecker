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

## Crit 9 ADR: what's live, and what waits for a reload

The brief for this week is to make the app real-time and then make a
deliberate call about how it behaves with several people on it at once. The
mechanism is Server-Sent Events over a single shared in-memory `EventEmitter`
(`src/lib/events.ts`) --- a shared-cpu-1x Fly machine is one process, so
there's exactly one broker to keep in sync, which is what makes "no Redis, no
separate pub/sub service" a reasonable choice rather than a corner cut; it
stops being reasonable the moment this app runs on more than one machine, and
that's written down right next to the `EventEmitter` so it isn't forgotten.

The actual decision is narrower than "make it real-time": only two things go
out on that channel --- presence (who's here, via `markPresent`/`markAbsent`
in `src/lib/events.ts`) and the shared plant's state (a watering in
`api/water.ts`, a rename in `api/plant/name.ts`). Posts, their photos, and
reactions are deliberately **not** on it; they only show up on the next
reload.

**Why split it that way, rather than push everything:** the plant and
presence are the two things this app is actually about making *co-present*
--- the whole point of the shared plant is that it visibly responds to
someone else showing up right now, and presence only means anything if it's
live (a presence list that's stale by a page reload is just a guestbook). A
post is different: it's something someone took time to write, consciously
chose to publish, and the people reading it are catching up on their own
time, not mid-conversation with the poster. Pushing every new post onto
everyone's open tab instantly would turn a slow, asynchronous "little
update" into something closer to a chat room's unread-badge pressure to
react right now --- which is exactly the shape of app the brief warns
against building by accident, and exactly what this project's README is
arguing it is *not*. Reactions (the temperature slider) are grouped with
posts for the same reason, plus a second one: the slider's own design
already hides an individual's raw vote from everyone but that person, so
streaming every vote live would mean streaming a stream of anonymous-looking
deltas that still, in a group this small, let someone watching closely infer
roughly who just reacted and how strongly --- a leak the current "catch up
on reload" version doesn't have.

**Alternative considered:** push posts live too, badge-style ("1 new
update"), the way most feeds do it. I ruled this out for the reason above,
not because it's harder to build --- the broadcast plumbing already exists,
so adding a `"posted"` event is a few lines, not a redesign. If a pod argues
the other side of this at crit, that's the argument to make: a closed
15-person group arguably *wants* to know the instant a friend posts, the way
you'd want to know a hangout invite landed, and "no reload needed" is squarely
what the brief is testing for everywhere else in the app.

**Conflict/reconnect behaviour:** there's no write-write conflict to resolve
here --- watering and presence are both pure "someone did a thing, tell
everyone," not an edit to shared state two people could clobber each other on
(the closest thing, two people watering within the same week, is designed to
just both count, per `plantHealth()`'s distinct-waterers read). On
disconnect/reconnect, a client gets a fresh `presence` snapshot the instant
its SSE stream reopens (`send({ type: "presence", data: { here:
presenceSnapshot() } })` in `api/events.ts`), rather than diffing against
whatever it last saw --- simpler, and self-healing against a dropped event,
at the cost of a flicker if someone's tab briefly reconnects. Posts, being
reload-only, have no reconnect behaviour to design at all; that's part of
why keeping them off the live channel is less work, not just a safer design.

**Addendum, after adding post delete:** hard-deleting your own post (below)
is one genuine new consequence of the reload-only decision above, worth
stating rather than leaving implicit. Deleting unlinks the post's photo
files immediately, but another open tab still has that post rendered until
its next reload --- so its `<img>` tags will start 404ing the moment you
delete it, not just show stale text. Posting and deleting share the same
"not urgent enough to push live" reasoning, but only deleting leaves a
visibly broken trace (a missing image) rather than a merely stale one (an
old post still sitting there) in someone else's already-open tab.

## Crit 10: server-checked access control, and a persistent audit log

The brief this week asks for genuine multi-user behaviour with access
decisions checked on the server, and a log of who did what that outlives the
crit. Two real gaps made this an easy decision rather than an invented one:
there was no way to remove a post at all, and nothing durable recorded any
action past a crash-only `console.error`.

**What's checked, and where:** anyone can *read* any post --- that's the
whole point of a shared board --- but only its author can remove it. The
check lives in `src/pages/api/posts/[id]/delete.ts`: load the post, compare
`post.authorId` against the cookie-derived `currentPerson(cookies).id`, 403
if they don't match. This is the only access-control decision this app
actually needs yet (everything else --- watering, renaming the plant,
reacting, painting the canvas --- is deliberately something *anyone* in the
group can do; there's no concept of "your" plant or "your" pixel the way
there's "your" post).

**Posts also hard-expire after 60 days** (`sweepExpiredPosts()` in
`src/lib/posts.ts`, called once per request from `index.astro`'s
frontmatter, same "derive fresh at read time, no cron" shape as
`plantHealth()`). It shares the exact same deletion code as the manual
delete route (`deletePostRecord`) rather than a second copy, so there's only
one place that has to get "unlink files, then delete postImages/postScores/
posts rows" right. The sweep and a manual delete can't corrupt each other if
they ever land on the same post at once: a `DELETE` on an already-gone row
is just a no-op in SQLite, not an error.

**The audit log** (`auditLog` table, `src/lib/audit.ts`) is one row per
mutation --- who (nullable: the 60-day sweep has no person to blame, and
logging it under the original author's name would make an automatic expiry
read, live in `flyctl logs`, as that person deleting their own post, which
isn't what happened), what, and a short free-text detail. `logAction` does
exactly two things, both from the same fields: insert the row, then print
one `console.log` line naming the person so a crit presenter can narrate two
people's actions apart by reading logs alone, the way the format asks for.
It's wired into every mutating route: joining, posting, watering, renaming
the plant, reacting, deleting, expiring, painting a pixel, renaming the
wall, and joining/leaving the party room (below). Like `waterings`, it's
append-only and unpruned --- fine for ~15 people over one semester, worth
naming rather than treating as free, same honesty as this file's "no Redis
until more than one machine" line.

**Correction, caught rehearsing the crit-10 narration:** the console line
originally showed only a person's display name, on the reasoning that a
name is more legible at a glance than an opaque id. That reasoning missed
the actual spec: nothing stops two pod members typing the same name at
`/api/join`, and crit 10's test is specifically "can the logs tell two
browsers apart" --- a log line that can't distinguish a name collision fails
the one job it exists to do. Fixed by appending each person's id prefix (the
first 8 characters of their UUID) in parentheses after their name, so the
line stays name-legible but is never actually ambiguous between two people:
`person=Alice (3f9a21c4)`.

## The shared pixel canvas: last-write-wins, no locking, no history

A small, scaled-down r/place: a shared 32x32 grid (`src/lib/canvas.ts`), a
fixed ~14-colour palette, a 30-second per-person cooldown enforced server-
side (`src/pages/api/canvas/pixel.ts`, checked against the audit log's own
most-recent `pixel_place` row rather than a bespoke cooldown column), and
every placement pushed live over the same SSE channel the plant already
uses. Unlike the plant and presence, this *is* a write-write conflict: two
people can paint the same cell, and the second write simply wins, with no
locking, no versioning, and no per-cell history shown.

That's a deliberate call, not a shortcut, and it holds up specifically
*because* of this app's scale, not despite it. Real r/place's last-write-wins
is forgiving because the canvas is huge and most people are watching a
different corner of it --- an overwritten pixel is usually invisible loss.
Here, with ~15 people, a 32x32 grid, and a 30-second cooldown between any one
person's placements, a collision on the exact same cell is rare, and when it
happens everyone watching sees it happen, live, as an overwrite rather than
a silently vanished vote --- "oh, they changed it back" is a visible moment,
not invisible data loss. Adding versioning or a contested-cell indicator
would be solving a problem this app's scale doesn't actually have, the same
unreasoned-default trap the streaks section above argues against.

## The plant's watering counter now resets on a fixed week, not a rolling one

`plantHealth()` originally counted distinct waterers in the last 7 days from
whenever anyone happened to load the page --- a rolling lookback, so "this
week" never actually reset at a shared instant; it just faded, one watering
at a time, as each individual tap aged past 7 days old. That's a different
thing from what "resets weekly" means to a person, so the cutoff is now a
fixed calendar week: the most recent Monday 00:00, Australia/Canberra
(`mostRecentCanberraMonday()` in `src/lib/week.ts`). The count now visibly
drops to 0 the instant a new week starts for everyone at once, not
gradually as old waterings roll out of a trailing window.

Worth a note specifically because Fly's machine runs UTC (nothing in this
repo sets `TZ`), so the naive version of this --- `new Date().getDay()` ---
would be computing "Monday" in the wrong timezone entirely. Canberra's
AEST/AEDT split is a real ~half-the-year effect, not a rare edge case, so it
gets handled rather than ignored: `Intl.DateTimeFormat` already carries
Node's built-in DST table, so no date library was needed, just reading the
weekday/hour it reports for Canberra specifically. The one corner left
imprecise on purpose: on the two days a year the clock actually changes,
the cutoff can land up to an hour off local midnight (a 23h or 25h-long
local day) --- not worth a bisection search for sub-hour precision on two
days a year, in an app for ~15 people.

## The party room: this week's access-control decision

Crit 10 asks for a decision about who can see and change what, checked on
the server and written down. The real gap it landed on: dragging your own
avatar into a shared party room to say "free to hang out for a couple of
hours" is a genuine mutation on shared state (`party_guests`, one row per
person currently in the room), and the only thing worth checking is that
you can only ever add or remove *your own* avatar, never anyone else's.

**What's checked, and where:** `src/pages/api/party/join.ts` and
`.../leave.ts` both start the same way every mutating route here does ---
`currentPerson(cookies)`, 401 if there's no one --- and then act exclusively
on `person.id`. There's no id in either request to compare against at all,
unlike post delete's `post.authorId !== person.id` check: the row acted on
*is* the caller's own by construction, so there's nothing to spoof and
nothing further to validate. That's a simpler shape than the delete route's,
not a weaker one --- the access control is in what the route is capable of
asking for, not in an extra comparison.

**Re-joining while already in the room is a plain upsert**
(`party_guests.personId` is the real primary key, not a surrogate), which is
what makes "drag yourself in again to refresh your timer" free: the server
doesn't need to distinguish "joining" from "extending" as separate actions,
because they're the same write.

**Where membership lives, and why that matters here specifically:** the
room's guest list is a SQLite table, not an in-memory `Map` the way presence
is (`src/lib/events.ts`'s `present`). Presence can live in memory because
its fact --- "this connection is open" --- is re-derived for free the
instant a tab reconnects; losing it on a restart is correct, not lossy. Party
membership encodes something that outlives any one connection ("joined less
than ~2 hours ago"), and `fly.toml` scales this app's one machine to zero
between visits, which means it restarts specifically during the idle gaps
when nobody's open tab would be there to silently repair an in-memory wipe.
So: persisted, *because of* that scale-to-zero behaviour, not despite it.

**Expiry is sweep-at-read, like the 60-day post expiry, plus one thing posts
don't need:** a live broadcast the moment someone's time actually runs out.
`sweepExpiredPartyGuests()` (`src/lib/party.ts`) is called once per request
from `index.astro`, same "derive fresh, no cron" shape as
`sweepExpiredPosts()` --- a fresh page load is never wrong. But the room is
live in a way posts deliberately aren't (crit 9's own bar for what belongs
on the SSE channel: "a presence list that's stale... is just a guestbook"),
so a pure sweep-at-read would let the room look occupied to everyone already
connected until someone happens to reload. The fix is a `setTimeout`
scheduled per join, firing at `expiresAt`, that re-checks and broadcasts.
If the machine restarts, the in-flight timer is lost along with everything
else in memory, but the next request's sweep and the next SSE connection's
`party_snapshot` catch it up --- the same self-healing-on-reconnect idiom
this app already leans on for presence.

**Logging:** every join, leave, and expiry calls `logAction` under
`party_join`/`party_leave`/`party_expire`, the same audit trail built for
crit 9 --- `party_expire` logs with `person: null`, same reasoning as
`post_expire`: a timer firing isn't a person acting, and attributing it to
whoever's row expired would misread, live in `flyctl logs`, as that person
leaving on purpose.

## The avatar stuck in the air: a live-update race in the drag code

A user reported the party-room drag breaking mid-gesture: the cloned avatar
that's supposed to follow the cursor would sometimes just stop, frozen in
place over the page (in one screenshot, right on top of the panel's own
heading), never reaching the room and never going away.

The first theory, before any of this was reproduced, was that
`finish()`'s unconditional `sourceEl.releasePointerCapture(pointerId)` was
throwing: the Pointer Events spec has the UA release capture itself right
before it fires `pointercancel`, so a `pointercancel`-bound handler calling
`releasePointerCapture` again looked like it'd hit an already-released
pointer and throw, aborting the function before `ghost.remove()` ever ran.
That's a real DOMException in both engines tested (Chromium and WebKit throw
`NotFoundError` for a pointer id that was never active at all) --- but it
didn't hold up under an actual repro. Calling `releasePointerCapture` twice
on a pointer id that *was* genuinely captured a moment ago is a silent
no-op in Chromium, not a throw; nothing in this codebase's own flow ever
calls it with a fabricated id. Worth writing down *because* it was wrong:
a plausible spec-reading hypothesis still needs a real browser to check it
against before it becomes a fix.

**What the repro actually found:** this file's `startDrag()` attached
`pointermove`/`pointerup`/`pointercancel` straight onto `sourceEl` --- the
chip or in-room avatar actually being dragged. That's fine as long as
`sourceEl` stays put for the gesture's duration, which it normally does.
But the party room is live: `live.ts`'s `party_joined`/`party_left`
listeners call `applyPartyJoin`/`applyPartyLeave` (`party-dom.ts`), which
remove and re-insert a guest's element by `data-person-id` every time a
join/leave/refresh broadcast arrives for them --- including a broadcast
triggered from a *second open tab* belonging to the same person, or a
retried `/api/party/join`, while the first tab is mid-drag on that exact
avatar. The moment that happens, `sourceEl` is a detached node, and a
detached node in both engines tested simply never receives another pointer
event again --- not `pointermove`, not `pointerup`, and critically not
`pointercancel` either. `finish()` never runs. The ghost (and the now-
orphaned listeners still attached to the detached node) are never cleaned
up, so the clone sits exactly where it last was told to move to, forever.
That matches the report precisely: frozen mid-page, not following the
cursor, no error in the console because nothing ever threw --- the handler
that was supposed to run just never got the chance to.

**The fix:** move the gesture's `pointermove`/`pointerup`/`pointercancel`
listeners off `sourceEl` and onto `document`, filtering by `pointerId`
instead of relying on being attached to the node the pointer happens to be
captured by. `document` is never going anywhere mid-drag, so a live update
swapping `sourceEl`'s node out from under the gesture can no longer sever
the event stream that cleanup depends on. `setPointerCapture` still targets
`sourceEl` (it has to --- that's what unifies mouse and touch here), but
releasing it is now guarded with `sourceEl.isConnected &&
sourceEl.hasPointerCapture(pointerId)` rather than a bare call, and all of
`finish()`'s teardown (listener removal, the dropzone's hover class, the
ghost) now lives in a `finally` block so no exception anywhere above it ---
expected or not --- can skip cleanup again. Belt-and-braces on top of that:
`startDrag()` now sweeps away any stray `.party-drag-ghost` before starting
a new drag, so even an as-yet-undiscovered path to a leaked ghost can't
compound into two.

**How it was verified:** a disposable Playwright script (not committed ---
this repo carries no Playwright dependency) joined a person, dragged their
in-room avatar out, and while the drag was still in progress fired a second
`/api/party/join` for that same person to trigger the exact live-update
race above. Against the old code the ghost survived with no further
cursor-tracking and no console error, matching the report; against the
fixed code the ghost kept following the cursor through the mid-drag DOM
replacement and was gone on mouseup. The two normal flows --- dropping
inside the zone to join, dropping outside to no-op --- were re-checked the
same way and are unaffected.
