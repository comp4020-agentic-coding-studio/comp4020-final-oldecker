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

## Names under the who's-online avatars

The presence strip at the top of the board showed bare avatar circles, so
you had to hover to learn who anyone was --- and on a phone there is no
hover. The party room already solved this: a small, muted, ellipsis-truncated
name under each avatar. The presence strip now uses the same shape (a
`.presence-guest` column holding the existing `.presence-avatar` circle and a
new `.presence-name` label), with the full name still in the `title` tooltip.

Three things kept this from being a one-line change. The strip is built twice
--- SSR markup in `index.astro` and `renderPresence()` in `live.ts` on every
presence event --- so both had to change together, and the new classes are
`:global()` for the usual reason (scoped CSS never reaches `innerHTML`
elements). The old code only escaped `"` in names, which is fine for an
attribute but not now that the name is also inserted as element text, so
`renderPresence()` reuses `escapeHtml` from `party-dom.ts` (now exported)
rather than growing a second copy. And since every entry is now 3rem wide
rather than 1.8rem, the strip got `flex-wrap` so a busy board wraps instead of
pushing the page sideways on mobile; the label has `max-width: 100%` and
truncates rather than widening its column.

**How it was verified:** a throwaway Playwright script joined two people in
separate contexts (one with `<b>&"x"` in their name, one with a very long
name) and checked that each saw the other's name under their avatar both on
initial load and after a live presence update, that the markup was escaped
(the name appears as text, not a `<b>` element), and that the page had no
horizontal overflow at 390x844 and 1920x1080.

---

## Activity level: a private reward, derived not stored

The wall's pixel cooldown used to be a flat 30 seconds for everyone. It now
shrinks with how much you've taken part in the board lately, down to 10
seconds. The level is shown only to the person themselves, next to the
cooldown label ("level 3 · you can place every 18s"); no one else's page
carries it and there is no ranking, for the same reason as the streaks
decision above: a public number to compete over is the harm to avoid, and
here it would also tell everyone who's been quiet.

**The formula** (`src/lib/activity.ts`): over the last 7 days of `audit_log`,
each *distinct action type on each distinct UTC day* earns that action's
weight once: posting 4, watering the plant 3, rating a post 2, joining the
party room 2, placing a pixel 1. Points map to levels at 0/4/10/18/28, which
give cooldowns of 30/24/18/14/10 seconds. It is computed at read time on
every page render and every placement, like `plantHealth()`: no counter, no
cron, no schema change, and it decays by itself as days fall out of the window.

**Anti-farming:** counting distinct days rather than raw rows means twenty
ratings in a minute are worth exactly one rating, so nothing can be spammed
up the ladder; the most any one action can give is 7 times its weight. The
only way to the top (28 points) is to do several different things across
several days, which is the "show up regularly" behaviour the streaks section
wanted. Pixels are weighted 1 so painting alone caps at 7 points (level 2):
the wall can't be levelled up by painting the wall.

**Server is the authority:** `/api/canvas/pixel` derives the level itself and
returns `cooldownSeconds` and `level` in both its success and 429 responses;
the client only displays and counts down what it is told. Because a
placement is itself activity, the success response is computed after the
row is written, so the placement that tips you into a new level starts its
countdown at the new, shorter cooldown.

*(Superseded in part: the level is now public, and the cooldowns are much
longer. See "Activity levels go public" below. The formula and the
anti-farming reasoning here still hold.)*

## Activity levels go public, and the wall slows down

The user changed their mind about the privacy call above. Levels are now
visible to everyone in a house: a small numbered badge on each person's
avatar in the corridor and the party room, a ring around the avatar that
goes plain, bronze, silver, gold and then a slowly turning magenta-violet
ring at level 5, and a short "who's been around" leaderboard under the feed.
I argued for privacy before, so this is the reasoning for undoing it rather
than a silent reversal.

**Why it's fine now.** The worry was a public number that points at whoever
has been quiet. Two things are different. First, the group asked for it: it
is fifteen friends who want to see each other turning up, and a badge is
closer to "Ada's been around a lot this week" than to a score. Second, the
formula was already built so the number can't really be competed over. Each
kind of action counts once per UTC day, over a rolling 7 days, so you can't
grind it in an evening, and it decays without anyone doing anything. Being
at level 1 just means "not much this week", which tells your friends nothing
the empty corridor didn't already. What I kept from the old reasoning: no
history, no all-time totals, no "you dropped a level" message. The
leaderboard sits at the very bottom of the page and only lists *this*
house's members, and ties share a rank, so a quiet week puts you at the
bottom of a short list rather than in a public ranking.

**The new curve: 10 min, 5 min, 2 min, 1 min, 30 s.** The old 30s-to-10s
range made the cooldown barely noticeable, so the level didn't matter much.
Stretching the base to ten minutes makes each pixel a small decision, and a
twenty-fold spread between level 1 and level 5 gives the badge a real perk
behind it. The point thresholds (0/4/10/18/28) and the weights are
unchanged, and pixels still cap at level 2 on their own (5 minutes), so the
wall still can't be levelled up by painting the wall. With waits that are
minutes long, the countdown now reads "4m 32s" rather than "272s".

**How it's computed for a whole house.** `levelsFor(ids)` in
`src/lib/activity.ts` is one grouped query over `audit_log` (by person and
action, counting distinct days) for any number of people, covered by the
existing `(person_id, action, created_at)` index. The house page calls it
once, through `houseLeaderboard()`, for every member, and the presence and
party snapshots call it once for everyone they list, so ~15 badges cost
one query, not fifteen. Still no schema change: the level is still derived
at read time and stored nowhere. The curve, the weights and the wording
moved into `src/lib/levels.ts`, which has no server imports, so the browser
formats the countdown and draws badges with the same numbers the server
enforces.

**Live updates.** A level can only change when an `audit_log` row is
written, and every row goes through `logAction()`. So that is where it is
detected: for the five weighted actions it reads your points before and
after the insert, and if they changed it broadcasts a small `level` event
(`personId`, `level`, `points`) to every house you belong to, since your
badge is on all of them. Most actions don't change anything (it's the
second watering of the day, say), and then nothing is sent. Presence and
party payloads also carry each person's level, so a chip rebuilt for any
other reason is never stale. On the page, `src/scripts/level-dom.ts` updates
every `.lvl-flair` inside any element with that person's `data-person-id`,
re-sorts the leaderboard, and gives the badge a little pop when it goes up.

**Your own level** gets a progress bar under the wall: points, how many more
to the next level, and chips for what earns points ("post +4", "water the
plant +3", ...). A chip greys out with "✓ today" once that action has
already scored today, because the once-per-day rule would otherwise make the
hints a lie: a second post is worth nothing. (`GET /api/level` refreshes
them after you earn something.) When your level goes up you get a toast with
a bit of confetti, whether it happens live (a `level` event about you, or a
pixel's response) or while you were away. The last level you saw is kept in
`localStorage`, wrapped in try/catch, so a level-up that happened on your
phone is celebrated on the laptop next time. A private window just skips the
"while you were away" part. A level-up mid-wait also shortens the countdown
you're already in, because the server measures the new cooldown from your
last placement.

**The badge is reusable.** `LevelFlair.astro` (server) and `flairHtml()`
(browser) produce the same markup, a `.lvl-flair` wrapper around any round
avatar element plus a `.lvl-badge`, styled by the global
`src/styles/levels.css`. The ring overrides the wrapped avatar's border
colour with `!important` on purpose: the ring *is* the information, so it
has to win over whatever border the chip already has without this file
knowing that chip's selectors. The colours are new tokens in both modes, and
each clears 3:1 against the card and against the corridor and party walls.
The badge numeral clears 4.6:1 on its own colour.

**How it was verified:** `pnpm typecheck` clean; the spec, with
`activity-cooldown.test.ts` rewritten for the new curve (10 min, then 5 min
and 2 min as points come in; repeats in a day earning nothing; another
member's page showing someone's level and leaderboard rank; no other
house's people on the list; a `level` event reaching another member's
stream), green twice in a row. None of it waits out a cooldown: the curve is
read off the server's answers. Then a throwaway Playwright script put three
people in one house, with backdated `audit_log` rows inserted into the
scratch database to put them at levels 4, 3 and 2. At 1920x1080 and
390x844, in light and dark, it checked that the second person saw the
others' badges and rings and the leaderboard in the right order (a
`<b>&"x"` name rendering as text), that the top person reached level 5 in
the browser (water, party, pixel), got the toast, and that the other
person's badge and leaderboard changed live, that the countdown read in
minutes, that a reload didn't repeat the toast, and that a stored lower
level produced the "while you were away" toast. No horizontal overflow and
no page errors.

## Making the party room look like a room

The party room's dropzone was a dashed amber rounded rectangle, which read as
"a form control" rather than "a place". The ask was to make it look like an
actual little room, so the dropzone is now one: wallpaper stripes for the back
wall, a wood-plank floor with a dark skirting board, a rug, a window with
curtains, a sofa, a standing lamp with a soft glow, balloons, and a string of
bunting across the top --- all hand-drawn inline SVG/CSS in the app's flat
style, in one `pointer-events: none` layer behind the guests. Guests stand on
the floor in a bottom-aligned row with a little shadow under each avatar, and
their names sit in a small card-coloured pill so the text never has to be read
off the rug.

Two design calls worth recording. First, the room's paint is all new colour
tokens in both the light and dark blocks (the dark room is the same room at
night: indigo wall, the lamp and bunting as the warm lights), but the things
that carry meaning keep tokens that were already contrast-checked: the room's
outline is still `--party-accent` (>= 3:1), and name tags are `--ink` on
`--card`. Decorative paint has no contrast floor to meet. Second, the drag code
is untouched: the hit test is still the dropzone's bounding rect, so the whole
room is the target and the decorations can't block it. Guest markup is
unchanged too, so `party-dom.ts` needed no edits; the only client-built
elements are styled via `:global()` as before.

At phone width (~250px of room) the sofa and balloons are dropped rather than
squeezed in, and in-room chips shrink slightly so about five guests stand on
one floor row. My first mobile screenshot showed a second row of guests
standing on the *wall*, which is what prompted that.

**How it was verified:** `pnpm typecheck`, `pnpm build` and the test suite
against a scratch DB; then a throwaway Playwright script (outside the repo)
took screenshots of the empty room and with 1 and 5 guests, light and dark,
at 1920x1080 and 390x844 (no horizontal overflow in any), and did a real mouse
drag of `#party-you` into the room (guest appears, chip hides) and back out
(guest gone, chip returns).

## Build-your-own face avatars replace the six creatures

The fixed set of six Australian folklore creatures was a choice made once at
join and never revisitable, and it stopped fitting an app where the avatar is
the main thing that says who you are in a strip, a party room and a post
header. The user decided: a face builder only, the creatures go away as a
choice. Flat and Bitmoji-ish rather than realistic --- skin, hair colour,
hairstyle, eyebrows, eyes, mouth, facial hair, glasses, extras (beanie, cap,
headband, earrings, flower, headphones, party hat), outfit and backdrop colour.

**Hair gap and balding stages.** A user spotted skin showing above the hair. The front-hair
shapes drew their own outer curve, which peaked lower than the head ellipse (top y=14), so
buzz, short, long, curly, bun and mullet all let a sliver through. They now start their outline
with an arc padded 0.7 outside the head (`headCap`), and I checked it numerically by sampling the
head outline against the hair fills. Four balding stages were appended as hairstyles 9-12
(receding, thinning, horseshoe, shaved). Appended, never inserted, because faces are stored as indices.

**Storage, and why there is no migration.** A face is eleven small integers,
each an index into an option list in `src/lib/face.ts`, stored as compact JSON
in the existing `people.avatar` text column. Another change this round owns
the only migration, and a column of text that already held "a key into a
table" is happy to hold "a key into eleven tables" instead. The side benefit
is that the SVG is built only from constants in that file: no user-controlled
string is ever interpolated into markup, so `set:html` and `innerHTML` stay
safe. `parseAvatar()` is the one gatekeeper --- exact key set, in-range
integers, 200-character cap --- and the API re-serialises to canonical form
before saving, so the column only ever holds the known shape.

**One renderer, three kinds of caller.** `renderAvatarSvg()` is imported by
the server page, `live.ts`, `party-dom.ts` and the editor itself, so the
preview is exactly what appears everywhere. Saving at `POST /api/avatar` is
form-encoded (the CSRF note in `score.ts` applies), updates only the cookie
owner's row, writes an `avatar_update` audit line, and re-broadcasts the
presence list and, if you are in it, your party-room entry, so other open tabs
change live rather than on their next reload.

**Legacy rows.** Old rows hold ids like `bunyip`. I kept `avatars.ts` purely as
a fallback: those ids still draw the old creature, so no old post changes
under anyone, and nothing was deleted. Anything unrecognisable draws a neutral
default face instead of a blank circle. `/api/join` still accepts the six
legacy ids so the spec tests (which join as `bunyip`) pass unchanged.

**The eye lesson carried over.** `avatars.ts` documents a past caricature
mistake (white sclera under a dark pupil on a dark fill). Every eye style here
is ink marks with at most a tiny highlight, mouths are ink or a dark open
shape, and features are drawn identically on every skin tone, which only
changes the skin fills. I checked it by rendering 24 random faces at 150, 32
and 28px and looking at them, across the full tone range.

**Reusable for the signup merge.** The editor is `AvatarEditor.astro` plus
`avatar-editor.ts`: it drops into any form and submits one hidden `avatar`
field. The join form uses it, seeded with `randomFace()`.

**How it was verified:** a disposable Playwright script (not committed) joined
through the editor, edited at `/avatar`, and checked that a second browser
context saw the change in the presence strip and a joining guest appear in the
party room over SSE, at 1920x1080 and 390x844, light and dark, with no
horizontal overflow and no console errors. A legacy `bunyip` row still renders
as its creature. `POST /api/avatar` returns 401 with no cookie and 400 for
garbage, wrong-shape, out-of-range, 50KB and JSON-bodied requests.

## Real accounts: who you are is now something the server checks

Until now "identity" was a name and an avatar picked once, and the cookie
was the raw `people.id`. That was fine for a trusted link, and it had one
real hole: the party room's avatars carry `data-person-id` in the page HTML,
so every id on the board was public to everyone on the board. Copy a
friend's id into your own `person_id` cookie and `currentPerson()` would
cheerfully hand you *their* identity --- post as them, delete their posts,
water as them --- with nothing in the audit log to say it wasn't them. The
party room's "you can only touch your own row" check was sound, but it was
only ever as strong as the cookie underneath it, and that cookie was
forgeable by design.

**What's checked, and where:** `currentPerson(cookies)` in
`src/lib/identity.ts` still sits at the top of every route, unchanged for
callers, but it now resolves differently. The `session` cookie holds 32
random bytes (not an id), the `sessions` table stores only the SHA-256 of
that token, and the lookup joins `sessions` to `people` and rejects an
expired row. Nothing about a person is guessable from, or derivable from,
anything that appears in the HTML. The old `person_id` cookie is simply never
read any more, so every cookie issued before this change stopped working the
moment it shipped --- which is also the intended "fresh start": people sign
up again, with a password. `spec/auth.test.ts` checks the forgery directly:
it signs up a victim, scrapes their id out of the board HTML, and tries it as
both `person_id` and `session`; both come back 401.

**Passwords:** hashed with Node's built-in `crypto.scrypt`, a random 16-byte
salt per password, compared with `timingSafeEqual`. The cost parameters are
stored inside each hash string, so raising them later doesn't lock anyone
out. Logging in as a name that doesn't exist still runs a full scrypt
against a throwaway hash, so "no such person" and "wrong password" are the
same answer *and* the same speed. Names are unique ignoring case through a
`name_key` column (lower-cased, whitespace-collapsed) with a unique index.
SQLite can't add a UNIQUE constraint with `ALTER TABLE`, and an index over a
nullable column treats NULLs as distinct, which is exactly what let the
migration run on top of production: old rows, including any duplicate names,
have `name_key` and `password_hash` NULL, so they're untouched, still render
as post authors, and can never be logged into.

**Brute-force limit:** five failed logins per name, or twenty per IP, in any
ten minutes, then a "wait a few minutes" message --- even for the right
password, until the window clears. In memory (`src/lib/ratelimit.ts`),
because there's exactly one machine; a restart forgets the counts, which
costs an attacker at most one window of guesses. The cost is that someone
who knows a friend's name can lock them out for ten minutes by failing on
purpose. For fifteen people I'd rather that than unlimited guessing at one
account, and it heals itself. The IP comes from Fly's `Fly-Client-IP` header
(Fly overwrites any client-supplied copy); the socket address is only the
proxy there.

**Deliberately not built:** password reset by email (no email is collected
yet; the login page says to ask the group admin), and rooms (accounts hang
off `people`, sessions off people, so a room table can reference `people`
later without touching any of this). Logout is `POST` only, so no stray
image tag can log you out, and it ends just that browser's session.

**How it was verified:** against a scratch database built from the five
previous migrations with two legacy people sharing a name and two legacy
posts, then the new build started on top. The migration applied cleanly,
both old posts still rendered, a `person_id` cookie for a legacy id got the
signed-out landing page, and the full spec passed. A throwaway Playwright
script then did the real path in fresh contexts at 1920x1080 and 390x844, in
light and dark: root to signup, a mismatched-password error shown inline,
sign up, post, log out, a second context getting the wrong-password error
and then logging in and seeing the same post.

## Houses: many boards, one account

The board was one shared space: one feed, one plant, one wall, one party
room. Now there are **houses**, and each is an independent copy of all of
those. Accounts and avatars stay global --- you are the same person in every
house you belong to --- and so does the private activity level, which is a
property of you rather than of any one wall (so is the pixel cooldown it
sets: opening a second house doesn't double anyone's painting speed). A
person can belong to as many houses as they like.

**The model:** a `houses` table (`slug`, `name`, `invite_code`) and a
`house_members` table keyed on (house, person). Every piece of shared state
gained a `house_id`: `posts` (and through them their photos and scores),
`waterings`, `pixels` (whose key is now house, x, y), `party_guests` (house,
person), and the two single-row name tables, `plant` and `canvas_meta`, which
became one-row-per-house with a unique `house_id`. The slug is the URL
(`/h/<slug>`) *and* the name you type to visit: it's the name lower-cased
with punctuation squashed to dashes, so "The Board" and "the board!" can't
both exist, and typing either one finds it. The invite code is a separate
72-bit random token, so a link can be shared without anyone spelling a name.
Anyone logged in can build a house; you get into one by its link
(`/join/<code>`) or its name (the street page's signpost). People's last-used
house is a column on `people`, and `/` sends a returning person straight
there --- or to the street page, if they don't have one yet.

**The migration was the risky part,** because it runs on the production
volume and the one rule I won't bend is that nobody's posts or photos go
missing. SQLite can't change a primary key, and can't `ADD` a `NOT NULL
REFERENCES` column to a table that has rows, so drizzle-kit's generated SQL
would simply have failed on any real database. `drizzle/0006_houses.sql` is
hand-written instead: it creates the first house ("the board", slug
`the-board`, an invite code made by `randomblob()` *at migration time*, so no
working code is ever committed to this public repo), makes every account with
a password a member of it, then rebuilds each affected table the way SQLite's
docs say to --- create `__new_x`, copy every row across with `house_id = 1`,
drop the old one, rename. Legacy no-password rows get no membership (they
can't log in), but their posts still render, because a post belongs to its
house, not to its author. One trap found while writing it: Drizzle's migrator
wraps each migration in `BEGIN`/`COMMIT`, and SQLite silently ignores `PRAGMA
foreign_keys` inside a transaction --- and better-sqlite3 turns foreign keys
*on* by default, so `DROP TABLE posts` would trip `post_images`' reference to
it. So `src/lib/db.ts` now switches foreign keys off around `migrate()`, runs
`PRAGMA foreign_key_check`, and switches them back on. A dangling reference
is logged loudly rather than thrown, on purpose: a throw at boot would put
the one machine into a restart loop over what might be a single stale row.

**How the migration was tested on real data:** I built and ran the
pre-houses `main` on a scratch database and seeded it through its own HTTP
API --- three accounts, three posts with three photos between them, two
votes, waterings, a renamed plant and wall, two painted pixels, two people in
the party room --- plus a legacy no-password person with a post and a
watering inserted directly, like production has. Then I started this build
on a copy of that database, so the migration ran on the real boot path.
Every table had identical row counts before and after, `foreign_key_check`
was clean, all three accounts still logged in and were sent to
`/h/the-board`, and the page showed all four posts (including the legacy
one), all three photos, both pixels in their colours, both custom names, the
two party guests, the old votes and the old waterings.

**Access control, this time per house.** Crit 10's decision was "anyone can
read any post, only its author can delete it". That's still true, but
"anyone" now means *anyone in this house*, and it's checked on the server
every time. `houseAccess()` in `src/lib/houses.ts` is the one gate every
house API route goes through: who's asking (401 if nobody), which house they
named (400 if none), whether it exists (404), whether they're a member
(403) --- and only then does the route touch anything. The house page does
the same check before running a single query, and a non-member gets a 403
"door" page with nothing from inside on it. The house is always *named in
the request* --- `?house=<slug>` in the URL, so bodyless POSTs stay bodyless
and inside Astro's unconditional same-origin check --- rather than inferred
from "the last house you opened". I chose that because inferring it would
make the server's idea of which house you're in a piece of hidden state that
another tab can change: a phone left open on one house would quietly start
posting into whichever house you'd last opened on your laptop. Two less
obvious holes this closes: scoring or deleting a post checks that the post is
*in* the house you named, so being a member of one house doesn't reach into
another by naming your own (that's a 404); and `/uploads/*` now only serves a
photo to a member of the house its post is in, so a copied image URL doesn't
carry a house's photos outside it. `/api/events` checks membership before
the stream opens, so nobody can watch a house's corridor or plant by holding
a connection. Joining by name is the one deliberately open door: a name is
something you're told, like a link, and for a closed group of friends I'd
rather "type the name your friend said" just work than add a knock-and-wait
approval step nobody will be around to answer. (I changed my mind on this
one --- see "Knocking" below.) Joining is a POST, never a GET
(an invite link shows a "come in" button rather than joining on load), for
the same reason logout is: a link preview or an `<img>` mustn't be able to
change what you belong to. `spec/houses.test.ts` checks all of it as an
outsider: a 403 from every page and mutating route, and nothing they tried
landing.

**Live updates, per house.** `src/lib/events.ts` keeps one emitter channel
and one presence map *per house*. A broadcast into house 3 only reaches
streams subscribed to house 3, and someone with two houses open in two tabs
stands in both corridors (and leaves each one independently). The spec opens
a stream in one house while someone else waters, paints, renames and parties
in another, and checks none of it arrives.

**The corridor, the party room and the street.** Inside a house your avatar
stands in a **corridor** --- a sage-green hallway that replaces the old
"who's online" strip, showing everyone with the house open right now. From
there you drag yourself into the **party room** (unchanged in spirit: still
"free to hang out for a couple of hours", still live), or onto the open front
door at the corridor's end, the **street**, which takes you out to `/houses`.
The street is a door, not a place: nobody sees you there, and leaving closes
your connection, which is what takes you out of the corridor for everyone
else. Your party-room slot deliberately survives the walk out, because it
means "free for a couple of hours", not "has this tab open". `/houses` is
drawn as an actual street --- your houses in a row (windows lit when someone's
home), an empty fenced plot to build a new one, a signpost to visit one by
name, and you standing on the pavement, draggable onto any of them. On a
phone the row wraps into a two-by-two neighbourhood instead of scrolling
sideways, so someone with no houses yet never has to discover a hidden
scroll to find "build". All three drop targets --- party room, street door,
each house on the street --- share one drag implementation (`src/scripts/
drag.ts`), generalised from the party room's: listeners on `document`,
filtered by pointer id, torn down in a `finally`, so the "avatar stuck in the
air" bug fixed earlier can't come back through a second, separately-written
drag. One small new rule rode along: a press that barely moves is a tap, not
a drop, so tapping your own avatar in the party room no longer counts as
"dragged it outside the room" and leaves.

**Verified:** `pnpm typecheck` clean; the migration check above; the spec,
updated for houses plus the new contract file, green twice in a row against
a fresh build; and a throwaway Playwright script, at 1920x1080 and 390x844 in
light and dark: sign up and land on an empty street, build a house, copy its
invite link, a second browser follows the link through signup and back to
"come in", both see each other in the corridor, one drags into the party room
and the other sees it live, one drags onto the street door and lands on the
street page, a second house appears on the street, dragging your avatar onto
a house goes into it, and a third person gets the 403 door.

## Knocking: typing a name now asks, an invite link still opens

When houses shipped, typing a house's name on the street made you a member
on the spot, and I defended that above as "a name is something you're told,
like a link". It isn't, quite. A link is a 72-bit random code that only
exists because someone inside copied it and handed it over; a name is
something you can *guess*, and house names are the kind of thing people
guess ("the board", "flat 4", someone's surname). So the two ways in now
differ on purpose. **An invite link walks you straight in**, unchanged ---
someone who lives there chose to give it to you, and that choice *is* the
permission. **Typing a name knocks.** You are stood at the front door, not
made a member, and you see nothing inside until someone who lives there
answers. Any member can let you in or turn you away; I didn't add an
owner or an admin, because nobody in a group of friends wants to be the
bouncer and the house was always everyone's equally. My earlier worry ---
"nobody will be around to answer" --- is why **a knock never expires**: it
waits on the doormat until somebody opens the house, however long that is,
and the knocker can walk away any time ("stop waiting"). If you're turned
away you're told once, on your street page, and you can knock again later;
nothing remembers it against you.

**The model:** a `house_knocks` table (house, person, created, answered,
who answered, outcome `pending` / `let_in` / `turned_away` / `cancelled`).
Rows are never deleted, so it's also the history of who knocked where. "At
most one pending knock per person per house" is a *partial* unique index
(`WHERE outcome = 'pending'`), so knocking twice while you wait is the same
knock, but once it's answered you're free to knock again. A `seen_at`
column is what makes "you were turned away" a thing you're told once rather
than every visit. The migration is a plain `CREATE TABLE` --- nothing
existing is touched, so no post or photo is anywhere near it.

**Server-side checks** (`src/lib/knock-routes.ts`, `src/lib/knocks.ts`),
all on form-encoded POSTs so they stay inside Astro's same-origin check:
letting in and turning away go through the same `houseAccess()` gate as
every other house route, so only a current member of *that* house can
answer, and a knock that isn't at that house's door is a 404 --- being a
member of one house doesn't reach the doormat of another. Only the knocker
can cancel their own knock (a member gets a 403: they answer, they don't
cancel). Answering is an `UPDATE ... WHERE outcome = 'pending'`, so a knock
that's already been answered is a no-op: if two people press "let in" and
"turn away" at the same moment, exactly one wins, and the loser's request
logs nothing, broadcasts nothing and creates no membership. Letting in adds
the membership in the same transaction as closing the knock, so there's
never a "let in" without a member row. Following an invite link while
you're knocking closes the knock too, so nobody is left on a doormat for a
house they're already in. Every step is in the audit log: `house_knock`,
`house_let_in`, `house_turn_away`, `house_knock_cancel`, each with the
house's slug and the knocker's name.

**Live, both sides.** Members see knocks on a little porch at the top of
the house page --- the front door from inside, a doormat, the knocker's face
and "let in" / "turn away". A knock arriving, or being answered by anyone,
goes over the house's own SSE channel, so every member's open page updates
without a reload (and a reconnect gets a fresh snapshot, so a knock
answered while your laptop slept doesn't linger). The knocker can't be on
that channel --- they aren't a member, which is the whole point --- so they
get a channel of their own, `/api/street-events`, keyed on their session
and carrying only news about their own knocks. On their street the house
they knocked on stands with their avatar on its doorstep; when they're let
in it turns into one of their houses in place, windows and all, ready to
tap or drag into, and when they're turned away it goes and they're told.

**Verified:** `pnpm typecheck` clean; a new `spec/knocks.test.ts` (a knock
grants nothing --- page, APIs and event stream all still 403; a member lets
in and access works; a member turns away and it doesn't, the knocker is told
once and can knock again; a non-member, a member of another house, the
knocker themselves and a logged-out request can't answer; only the knocker
can cancel; late answers change nothing; knock events reach that house's
members and no one else; the knocker's own channel hears the answer; an
invite link still walks straight in) plus the old name-join test rewritten
for knocking, all green twice in a row against a fresh build on a scratch
database. Then a throwaway Playwright script at 1920x1080 and 390x844, light
and dark, with three people: A builds a house and stays in it; B knocks by
name and sees "waiting at the door"; A sees B on the doormat live and lets
them in; B's street turns the waiting lot into a house live and B walks in;
C knocks, both A and B see it, A turns C away, B's doormat clears live and
C's street tells them; C knocks again and then stops waiting, and A's page
says so. No page scrolls sideways at either width. The screenshots caught
one thing worth fixing: the door's little "knock knock" labels spilled over
the text beside them, so they now sit on the door's edge.

## The bedroom, and ich hab dich lieb

**The "← street" link is gone.** The house bar is now just the house's name,
invite and log out. The only way out is the open door at the end of the
corridor, which is a link as well as a drop target, so tapping still works.
With nothing on the left anymore, the bar is a three-column grid on a wide
screen (an empty column as wide as the buttons, so the name sits dead
centre). On a phone it's two columns, name left and buttons right, so the
name isn't squeezed down to an ellipsis to keep things symmetrical.

**The bedroom** is a third room in the house map, full width under the
corridor and the party room: a lavender room with a night window and a row
of bunk beds, and a bunk for **every member of the house, online or not**.
The corridor answers "who's here right now"; the bedroom answers "who lives
here", which until now the page never showed anywhere. Two people to a bed,
bottom bunk first, in the order they moved in, so nobody swaps beds when
someone else comes online. Whoever has the house open is awake: sitting up a
little, a warm ring round their face, their name in bold. Everyone else is
asleep: dimmed, tilted into the pillow, a small "zz" rising. One member gets
one bed with the top bunk made but empty; fifteen get eight beds that wrap
into rows (three across at 390px, five on a laptop). The whole bed is drawn
in one unit (`--u`), so the phone layout is one variable, not a dozen
overrides. It gets no channel of its own. It reads the same per-house
`presence` events the corridor already does (present means awake), plus one
new house-wide event, `member_joined`, which `addMember()` broadcasts so a
new bunk appears without a reload. The beds are built by one function,
`bedroomHtml()` in `src/lib/bedroom.ts`, for both the server's first render
and every live rebuild, so the two can't drift. They're styled from a global
stylesheet (`src/styles/bedroom.css`), because the browser rebuilds them and
Astro's scoped CSS never reaches client-built elements --- the bug that's
already bitten this page twice.

**Ich hab dich lieb.** Double-click (or double-tap) anyone else's avatar ---
in the corridor, the party room or a bunk --- and they get a heart. If they
have the house open it arrives live: hearts float up off their own face and
a toast says "Anna hat dich lieb ❤". If they don't, it's stored, and the
next time they open that house it greets them the same way, with "· 2h ago"
on the toast. Then it's marked seen, so it never comes round twice. Storage is a new
table, `lieb_messages` (house, from, to, day, created, seen); the migration
only adds that table and two indexes, nothing on any existing table.

Three decisions, settled with Ole before building:

- **Private, so delivery is targeted.** A heart is between two people. The
  easy build was a house-wide broadcast with a "this one's for Ben" field the
  page filters on, but that puts every heart on every member's wire, readable
  in anyone's devtools. Instead `src/lib/events.ts` grew a second channel per
  (house, person), and `/api/events` subscribes each stream to the house's
  channel *and* its own person's. `sendToPerson()` emits on that one channel
  only. The spec opens three members' streams, sends from A to B, and checks
  that neither C's stream nor A's own ever sees it. A heart belongs to the
  house it was sent in and waits there, not in whichever house you open next.
- **Once per sender to recipient, per day.** The limit is what keeps it worth
  something: a heart you can send fifty times an hour is a spam button, and
  one a day is a small, deliberate thing. A second try that day gets "you
  already told Ben today ❤", not an error. The limit is a unique index on
  (from, to, Canberra date), and the insert is the check. A
  check-then-insert would let two quick double-clicks (or two tabs) both see
  "not yet today" before either wrote; the spec fires six at once and
  exactly one lands. It's per pair, not per house, so sharing two houses
  with someone doesn't mean two a day.
- **Members only, and never yourself,** checked on the server: the sender
  through `houseAccess()` like every route, the recipient with `isMember()`.
  An unknown id and a real person who doesn't live here get the same 404, so
  the route can't be used to ask whether someone exists.

"Seen" needed one more step than expected. A heart delivered live to a tab in
the background hasn't been *seen*, and a laptop with the house open in a tab
all weekend would otherwise silently swallow every heart sent to it. So a
live heart isn't marked seen when it's sent. The recipient's page shows it
when the tab is actually visible, then confirms with `POST /api/lieb/seen`.
A tab closed unread leaves it waiting for the next visit.

The gesture is hand-rolled on `pointerdown`, not `dblclick`, because mobile
browsers don't reliably turn a double-tap into a `dblclick`. Two presses on
the same avatar within 380ms and 24px count as one double-tap. It can't
fight the drag gesture because the two never share an avatar: only your own
is draggable, and only other people's take a heart. A double-click on your
own corridor chip is two taps to `drag.ts`, and taps were already not drops.
Other people's avatars got `touch-action: manipulation`, so a double-tap
doesn't also zoom the page.

**Verified:** `pnpm typecheck` clean, and the spec (with the new
`spec/lieb.test.ts`: once a day per pair, six at once land once, not to
yourself, not to or from a non-member, waits in the right house, live to the
recipient's stream only, an offline recipient sees it on their next load and
not after, an unconfirmed live one still waits, the bedroom lists everyone
with the right awake/asleep state, and a new member is announced) green
twice in a row against a fresh build. Then a throwaway Playwright script at
1920x1080 and 390x844 in light and dark: A double-clicks B in the corridor
and B gets the hearts and toast live while a fourth member gets nothing; a
second try gets the gentle refusal; a double-click in the party room and on
an offline member's bunk both send; that member logs in later on a phone,
gets "· just now", and on reload nothing repeats; a touch double-tap on a
bunk sends; B closes the tab and falls asleep in A's bedroom; a new member
gets a bunk live; and mouse drags into the party room and onto the street
door, plus a touch drag on the phone, still work, while a double-click on
your own avatar triggers neither a drop nor a heart. A one-member house and
a fifteen-member house rendered without horizontal scroll at both widths.

## Hot and cold posts glow, and the invite copy button stops lying

Two small things from the same round of feedback.

**The invite link.** The report was that "copy" puts a generic link on the
clipboard. I couldn't make the handler copy the wrong string: in a real
Chromium (desktop and a 390px touch context, clipboard permissions granted) it
copied exactly the absolute `/join/<code>` URL shown in the box. What I could
reproduce was the failure path. `navigator.clipboard` only exists in a secure
context, so over plain http (a phone hitting a LAN address) or in an in-app
browser the old code fell into its `catch`, selected the text, and changed the
button to "selected" --- without copying anything. The clipboard kept whatever
was there before, usually some other link, which is exactly "it copied a
generic link". The first paint also showed only the relative path until the
script ran. The fix: the server renders the absolute URL, the script rebuilds
it from `location.origin` and the house's `data-path`, and that one string is
both shown and copied. Copying now tries the async API, then
`execCommand("copy")` on the selected input, and only then falls back to
leaving the text selected with a "press and hold" hint. A "copied!" label and
a live-region message confirm it.

**The glow.** A post the group rates strongly now glows: red/orange for hot,
icy blue for cold, using the existing `--temp-hot` / `--temp-cold` tokens plus
`--glow-alpha` (light and dark). Strength is one number from 0 to 1, in
`glowFor()` in `src/lib/temperature.ts`:

    extremity  = clamp((|median| - 20) / 60, 0, 1)
    confidence = min(1, votes / 6)
    strength   = extremity * confidence      (under 0.06 shows nothing)

The median sets the colour, so one outlier can't flip it. One person dragging
to 100 gives 0.17, a whisper; six or more around 80 gives 1. The halo is a
`box-shadow` and a tint on the top, right and bottom borders only, so the left
border stays the feeling/doing colour. The server sets `--glow` on first paint
and `temperature-slider.ts` calls the same function on the scores the vote
response already returns, so a vote and a reload agree.

**Verified:** `pnpm typecheck` clean and the spec green against a fresh build.
A throwaway Playwright script read the real clipboard on desktop and a phone
viewport, and again with `navigator.clipboard` removed (it now still copies,
via `execCommand`). Eight members rated six posts (eight hot, eight cold, one
hot vote only, neutral, three cold, four medium hot): glow came out 1, 1,
0.17, none, 0.5 and 0.33, in light and dark at 1920 and 390 wide with no
horizontal scroll, and a vote that tipped a post redrew its glow to match a
reload.

## The bedroom now only shows who's actually asleep

When the bedroom shipped, every member got a bunk, online or not --- awake
members sat up with a warm ring, asleep ones were dimmed with a little "zz".
The end user's feedback was direct: that's redundant. Anyone awake is already
standing in the corridor a few inches above the bedroom on the same page, so
drawing them a second time in a bed just repeats information the corridor
already gave, and makes you scan two rooms to answer one question ("who's
actually here"). The bedroom's only reason to exist is to answer the question
the corridor *can't*: who lives here that you can't currently see anywhere
else. So awake members are now left out of the bedroom entirely, not styled
differently --- they simply don't get a bunk.

**What changed, and where.** `bedroomHtml()` and `bedroomCount()` in
`src/lib/bedroom.ts` now filter `members` down to `sleeping = members.filter(m
=> !awake.has(m.personId))` before laying out a single bed, where `awake` is
the same per-house presence set (`presenceSnapshot()`/`awakeIds`) the corridor
already reads, plus your own id (you're always awake, since you're the one
looking at the page). Two sleepers per bed, bottom bunk first, in move-in
order, exactly as before --- that part of the bedroom's contract didn't
change, it just now runs over a shorter list. Every bunk this file draws is
therefore always `data-state="asleep"`: there's no "awake" bunk left to
render, so the whole `[data-state="awake"]` block and the `[data-own]`
ring override in `src/styles/bedroom.css` came out as dead code, along with
the `--bed-awake`/`--bed-awake-glow` tokens in `src/styles/tokens.css` that
only that block used. If every member is online, there's nothing left to put
in a bed at all --- an empty row of bedding, or a blank space where the room
used to be, would read as broken, not as good news --- so `bedroomHtml()`
returns a small `everyone's awake! no one to see here right now.` message
instead, and `bedroomCount()` says `everyone's awake` rather than `0 of 4
asleep`. The house page's hint text under the heading changed to match:
"everyone who lives here but isn't around right now," not "awake or asleep."

**Live, both directions, off the event the bedroom already listened to.** No
new event was needed. The bedroom already redrew itself on every per-house
`presence` broadcast (`src/scripts/bedroom-dom.ts`'s `applyBedroomPresence()`,
wired in `live.ts`) --- it just used to redraw *styling* on that event, and
now it redraws *membership*. Someone closing their last tab fires
`markAbsent()` → a fresh `presence` snapshot → every open tab's
`applyBedroomPresence()` rebuilds the bunks with `bedroomHtml()`, and that
person is no longer in `awake`, so they now get a bed they didn't have a
second ago. Someone opening the house fires the mirror image: `markPresent()`
→ `presence` → they drop out of the filtered list and their bed disappears,
with the room falling back to the empty state if they were the last one
sleeping. The same snapshot-on-reconnect behaviour crit 9 built in
(`send({ type: "presence", ... })` the instant a stream opens, rather than
diffing) means a dropped connection that reconnects always ends up correct,
not just eventually consistent.

**How it was verified.** `pnpm typecheck` (0 errors, 0 warnings) and `pnpm
build` clean. `spec/lieb.test.ts`'s bedroom test was rewritten
(`"the bedroom shows only members who are offline, not the ones already in
the corridor"`) to open a 4-person house, put one member's SSE stream up
alongside the viewer's, and check that both online members are absent from
the bedroom HTML entirely (no name, no `data-own="true"`) while the two
offline members get one shared bed between them, both asleep, with the
heading reading "2 of 4 asleep"; a second new test
(`"the bedroom shows a friendly empty state when everyone is awake"`) checks
a 2-person house with both streams open renders no `.bunk-bed` at all and the
`everyone's awake` text instead. The full suite passed twice in a row against
the built server on a scratch SQLite database on a throwaway port. Then, since
the real risk here is the live half (not just what a fresh render looks like),
a disposable Playwright script (not committed) opened two browser contexts ---
different cookie jars, A and B, both members of a fresh house --- and drove
the actual sequence end to end: with both contexts' pages open, A's bedroom
showed the empty-state message and no trace of B; B's browser tab (and its
SSE connection) was then closed outright, and *without reloading A's page* A's
bedroom grew a bed for B, asleep, within the wait window; B then reopened the
house in a new context, and again *without reloading A's page* B's bed
vanished and A's bedroom fell back to the empty state. All three transitions
matched what the HTML-only checks above predicted, confirming the DOM
re-render (not just the SSE payload) behaves correctly in a real browser.

## Vote to wipe the wall, and a past-walls gallery

A new request, settled with Ole before building rather than guessed at: any
house member can start or join a vote to clear their house's pixel wall, and
the old wall is never actually thrown away.

**Why two different pass thresholds, not one.** Strictly more than half the
house voting yes passes it immediately --- if a clear majority of the people
who live here right now want a fresh wall, there's nothing left to wait for.
Otherwise it stays open for 3 days, and on that deadline it passes only if
yes beats no *and* at least 2 people voted yes. That second bar is the real
reason it isn't just "yes > no": without it, one person voting yes and
nobody else answering would pass a vote by nobody actually deciding anything
--- a wall wiped by default isn't a wall wiped by the house. Two still isn't
a lot for a group of ~15, but it's the smallest number that distinguishes
"somebody decided this" from "exactly one person clicked a button and
everyone else was asleep." Both thresholds are checked against the house's
*current* member count every time a ballot lands, not a count frozen when
the vote opened --- someone joining mid-vote genuinely changes what "more
than half" means, the same way `logAction`'s level recompute always reads
live state rather than a cached one.

**Why a snapshot gallery, not a hard delete.** This app's one rule that never
bends is that a person's own posts and photos don't disappear without them
asking (`deletePostRecord` is the only thing that ever removes a post, and
only the author or the 60-day sweep call it). A wiped wall is different in
kind --- it's communal pixel art, not anyone's post --- but "the house voted
to clear it" and "it's gone forever, no take-backs" don't have to be the same
decision, and there's no reason to make them one when keeping the old state
costs one row in a new table. `wipeWall()` in `src/lib/wallvote.ts` reads
every painted cell, writes them as one JSON blob into `wall_gallery` together
with the wall's name at the time, and only then clears `pixels` --- both in
one transaction, so a crash mid-wipe can't leave the snapshot taken but the
live wall un-cleared, or the reverse. `wallvote.ts` never imports `posts`,
`postImages`, or anything from `src/lib/uploads.ts`; the only tables it
touches are `wall_votes`, `wall_vote_ballots`, `pixels`, and `wall_gallery`.
A "past walls" page per house (`/h/<slug>/walls`, behind the same membership
check as the house page itself) shows every snapshot, most recent first,
labelled with when it was wiped. Gallery rows are swept at read time after
about 6 months, the same `sweepExpiredPosts()`-shaped idiom this app already
uses for posts: no calendar precision needed at this scale, just a `lt()`
comparison against a fixed number of seconds, called once per house-page
load and once from the gallery page itself.

**No cron, the same way the party room avoids one.** A vote's 3-day
resolution is architecturally identical to the party room's 2-hour expiry
(`src/lib/party.ts`): a `setTimeout` armed at creation time for the common
case, plus a read-time sweep (`sweepWallVotes()`, called from the house page
next to `sweepExpiredPosts()`/`sweepExpiredPartyGuests()`) as the restart-safe
fallback, since `fly.toml` scales this app's one machine to zero between
visits and a scale-to-zero restart forgets every in-memory timer. The
difference worth naming: the party room's timer usually *is* how an expiry
actually fires, because two hours is well within how long someone might leave
a tab open. Three days is not --- on a 15-person group's realistic usage, the
sweep is what resolves most votes in practice, and the timer is closer to a
nicety for the case where the app genuinely stays warm that long. Both paths
end up calling the exact one `resolveVote()` function, which closes the vote
with a `WHERE status = 'open'` guard, so whichever path gets there first wins
and the other is a silent no-op --- no double wipe, no double audit line, no
double broadcast, the same shape `party.ts`'s `expireIfDue()` uses to survive
racing its own sweep.

**Only one vote per house at a time** is enforced the same way "only one
pending knock per person per house" is in `house_knocks`: a partial unique
index, `wall_votes_one_open` on `(house_id) WHERE status = 'open'`, not an
application-level check that a second request could race past. Starting a
vote while one's already open is `INSERT ... ON CONFLICT DO NOTHING` followed
by a lookup of the existing row on conflict --- the same insert-and-fall-back
shape `knock()` in `src/lib/knocks.ts` uses for its own partial index, chosen
for the same reason: two people clicking "yes" within the same millisecond
can't both insert a second open vote, because SQLite itself refuses the
second row. Casting a ballot is a plain upsert on `(vote_id, person_id)`, so
changing your mind while a vote is open is the same write as voting for the
first time, no special "already voted" branch to get wrong.

**UI.** A small always-visible panel sits under the wall's own controls on
the house page: the tally, time remaining, and yes/no buttons. There's no
separate "start a vote" button --- voting yes or no *is* how a vote starts if
none is open, so the panel never asks you to take an extra step before you
can actually say what you think. It's dashed and muted when nothing's open,
switching to the app's existing `--danger`/`--danger-bg` tokens once a vote
is live, so a wall genuinely at risk of being cleared reads as more
consequential than an idle invitation. Every update --- a ballot landing from
any tab, the vote resolving, the wall actually clearing --- goes out over the
house's existing SSE channel (three new event types in `src/lib/events.ts`:
`wall_vote_update`, `wall_vote_snapshot`, `wall_wiped`), the same channel the
plant and the pixels themselves already use, with a snapshot sent on
`/api/events` connect so a tab that reconnects after a vote resolved doesn't
keep showing it as open.

**Logging.** Passing, failing, and a gallery sweep all go through the
existing `logAction` call, same as every other mutation in this app, so
`flyctl logs` shows `wall_vote_cast` (with who, and which way), then whichever
of `wall_vote_pass`/`wall_vote_fail` actually closed it (person `null`,
since resolving a vote --- whether by the quick-pass path or the 3-day
sweep --- is the vote resolving, not any one person acting), and eventually
`wall_gallery_sweep` when an old snapshot ages out.

**How it was verified:** `pnpm typecheck` clean (0 errors, 0 warnings,
matching the pre-existing baseline hint); `pnpm build`; the built server
against a scratch SQLite database on an unused port, with the full spec
(including a new `spec/wallvote.test.ts`: quick pass on a strict majority
including the single-member case, exactly-half not quick-passing, changing a
ballot replacing rather than adding one, a bad choice value and a non-member
both rejected, a passing vote wiping the live wall while leaving an unrelated
post untouched and saving the old pixels into the gallery, only one vote ever
open per house, a vote in one house never touching another's panel or tally,
the open-vote and wipe events reaching the house's members live and nobody
else's, a reconnecting stream getting the open vote's snapshot rather than a
stale "none," and the gallery listing wipes most-recent-first) green twice in
a row. Outside the spec, a disposable Node script exercised the parts that
depend on real clock drift rather than a fresh request: backdating a vote's
`resolves_at` directly in the scratch database and reloading the house page
(which runs `sweepWallVotes()`) confirmed a lone yes vote fails on the
turnout guard once its window has passed, while yes-beats-no with 2+ yes
votes passes the same way; a live SSE stream across two ballots and a quick
pass showed `wall_vote_update` firing after each ballot and `wall_wiped`
firing exactly once, immediately before the vote's own `passed` update.
