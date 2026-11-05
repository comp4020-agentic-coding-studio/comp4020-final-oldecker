# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the template is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the course website publishes the
[final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/).
What the agent needs to carry from any of it is your call.

dont delete the uploaded posts that are already on there

## What this app is for

`README.md` is the argument; read it before changing behaviour. In one line:
**good means the quieter people in the group can take part comfortably and
still feel it's their room too.** Reading quietly counts as taking part; the
goal is not equal posting. It is a closed space for one group of friends.
Every rule below comes from that.

## Never

- **Never delete people's posts or uploaded photos.** That includes
  migrations, "cleanup" scripts, test runs against production, and
  resetting the volume to fix a deploy. The only code that removes a post is
  the author deleting their own and the existing 60-day expiry sweep. Don't
  add another path, and don't widen those two.
- **Never let anything in a house be seen or changed by someone who isn't a
  member of it.** Every read and every mutation checks membership on the
  server. That includes live events: a broadcast goes to one house's
  channel, never to everyone.
- **Never make knocking a way in.** Typing a house's name knocks. Only an
  invite link or a member letting you in makes you a member.
- **Never add discovery**: no list of all houses, no public profiles, no
  search across houses, nothing that reveals a house exists to a
  non-member.
- **Never reward volume over regularity.** Points, levels and streaks count
  distinct days and weeks of showing up, not how many times something was
  done. Don't add likes, follower counts, or anything that ranks posts
  against each other.
- **Never frame quiet people as a problem.** No "you haven't posted"
  messages, no shaming copy, nothing that marks someone who only reads as
  failing. Missing a week costs only the small streak bonus, and that's the
  whole penalty.
- **Never add daily streaks or daily nudges.** Streaks count weeks. Push
  notifications are for things a person was sent or would want to know
  about (a heart, a knock, a friend's post), never "you haven't been on
  today".

## Every change

- **Live where it's ambient, reload where it's reading.** Presence, the
  plant, the party room, the wall, knocks, hearts and levels update live
  over the house's SSE channel. Posts and reactions wait for a reload; that
  is a decision (PROCESS.md, crit 9 ADR), not a gap to fill.
- **Derive, don't store.** Levels, streaks, plant health and expiries are
  computed from `audit_log` and timestamps at read time. Anything that must
  happen later uses a `setTimeout` *plus* a read-time sweep, because the
  machine scales to zero and loses timers. No cron, no counters that can
  drift.
- **Every mutation calls `logAction` once**, so `flyctl logs` can narrate
  who did what by name.
- **Mutating routes take form-encoded bodies**, never JSON: Astro's origin
  check only covers form posts.
- **Migrations are additive** unless there is no other way. If a migration
  rebuilds or alters a table, take a Fly volume snapshot before deploying
  it.
- **Absence stays gentle.** Someone who's away is asleep in the bedroom, not
  marked inactive. Copy is warm and lowercase, in the app's existing voice.
- **Works at 1920×1080 and 390×844**, in light and dark mode, with no
  horizontal scroll. Check it in a real browser, not just the build.

## Before calling something done

- `pnpm typecheck` with 0 errors and 0 warnings, then `pnpm build`.
- `pnpm test` against the built server on a scratch database
  (`DB_PATH`/`UPLOADS_DIR` in `/tmp`, never `/data`), green twice in a row.
  Test usernames must be unique.
- A claim in `README.md` that can be tested gets a test in `spec/`. A change
  that makes a README claim untrue updates the README in the same commit.
- Add a `##` section to `PROCESS.md` for any decision a marker would want
  reasons for, in the file's voice, using `---` for dashes.
