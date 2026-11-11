# Process overview

## Choosing the work

I built a catch-up board for about fifteen undergraduate friends who are moving apart. My first idea was an encrypted messenger based on an existing Matrix project. I dropped it because it repeated a chat app, lacked a web target, and needed infrastructure that didn't fit the course's small Fly machine. Short updates and a shared plant gave me a manageable starting point, with a reason for several people to be present together.

I reused the Astro SSR, SQLite and Drizzle stack I'd already deployed in crit 7 ([`1c161f4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/1c161f4)). Familiarity bought time near the cutoff. One persistent volume suited this group; it wasn't a claim that this architecture suits every app. Likewise, an in-memory event broker works because there's one server process. Scaling to multiple machines would require revisiting it.

## Working with the agent

The productive pattern was to ask for an interaction, try it, then explain what failed. The first join/post/water implementation landed in [`debc1f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/debc1f5). I joined, posted a photo, watered, and restarted the server to check persistence myself. This pass also caught an origin-check configuration problem that would reject local requests while production appeared healthy.

Playtesting exposed a watering can that looked like a pot shaking, leaned backwards and dropped water diagonally. My feedback and the corrections are recorded in [`202fea9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/202fea9) and [`c313687`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/c313687). Understanding the transform order mattered: rotating the translation changed the fall direction. Asking for another attempt without understanding that would have left the same mistake available elsewhere.

From the houses feature onward I ran agents in parallel, each in its own git worktree, merging back myself rather than letting one agent see another's half-finished work. The trade-off was mine, not the agents': conflicts like a renumbered migration or two branches appending the same `PROCESS.md` section became my job, in exchange for independent features landing without one slow agent blocking another. Notifications ([`ffd218f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/ffd218f)) and weekly streaks ([`ca82e26`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/ca82e26)) both merged this way. The history makes those integration points visible; it does not, by itself, prove parallel work saved time over a single agent working sequentially. My current harness requires type checking, a build, tests twice against a scratch database, and browser checks at desktop and mobile sizes, run by me after every merge rather than taken on an agent's word. The fuller account, including how conflicts were actually resolved, is in [`docs/process-history.md`](docs/process-history.md).

## Deciding what should be live

The crit 9 decision was to stream presence and plant changes while leaving posts and reactions for reload ([`ddcecbd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/ddcecbd), [`57ca858`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/57ca858)). Presence needs to be current to mean anything. Reading a friend's update can happen at the reader's pace. The same distinction now separates ambient house activity from the feed.

The alternative was live posts or a new-post badge. That might help friends notice each other, and it fits the brief's emphasis on immediate shared changes. I kept reload-only reading because I wanted to avoid making the board feel like another conversation demanding attention. This remains a design hypothesis, not an established effect. It also has a visible cost: another tab can retain a deleted post until reload, including a broken photo.

## Corrections that changed the checks

The initial identity cookie contained a person's public ID. Author-only deletion looked protected, but copying another person's ID could impersonate them. Real accounts replaced this with password authentication and opaque sessions ([`e7e5190`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/e7e5190)). `spec/auth.test.ts` now tries the exposed ID as both the old cookie and a session token and expects rejection. That turns the discovered weakness into a repeatable check.

Houses introduced another mistaken assumption: I initially treated knowing a house name like possessing an invitation. Names are guessable. [`f5a2836`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/f5a2836) changed name-based joining into knocking, while an invitation still grants entry. `spec/knocks.test.ts` checks that knocking alone gives no access. Membership checks and house-scoped events carry the privacy boundary into the server; hiding links would not be sufficient.

The audit log also needed correction. Author-only deletion, expiry and durable action records landed in [`d32ed73`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/d32ed73). Rehearsing the crit showed that display names alone couldn't distinguish two people with the same name. [`8473696`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/8473696) added an ID prefix. The lesson was specific: a log must answer the question it exists for. A readable line was not enough if it couldn't identify which browser's person acted.

The party-room drag bug was a different lesson ([`a4ec054`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/a4ec054)). A plausible first explanation blamed pointer-capture release throwing an exception. Browser reproduction disproved it. A live update actually replaced the dragged element, leaving its event listeners detached and the floating avatar stranded. Moving gesture listeners to `document` preserved cleanup through replacement. A disposable browser script reproduced the old failure and checked the fix, but wasn't committed. That is a limitation: the investigation is documented, while the regression protection is not durable.

## Revising what good meant

I read most of the design literature after building, so I cannot claim it guided everything from the start. The clearest change is between [`5cb88c4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/5cb88c4) and [`9a1dab2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/9a1dab2). Reading Nielsen made my equal-posting goal look misguided: quiet readers were being treated as a problem. I changed the README to comfortable participation and added the corresponding rule to `CLAUDE.md`. Visits, waterings and hearts now matter to the judgment alongside posts.

Sloan and Shirky helped explain choices already made: software for this particular group can be worthwhile without discovery or growth. Weiser and Brown gave a language for ambient presence, but didn't validate my reload-only decision. Eyal and Duolingo complicated my assumption that weekly streaks automatically serve friends better than daily ones.

I also reversed my preference for private activity levels, making them public in [`69467f7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/69467f7). Seeing that friends had been around felt useful, but the leaderboard could still create comparison. Weekly streaks ([`096569d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-oldecker/commit/096569d)) need only one active day and add a capped bonus. That limits the penalty for absence; it doesn't prove the feature feels gentle.

## Adding an eye-colour key without resetting anyone's face

Extending the avatar builder (more hairstyles, more hair colours, eye colour, a nose ring) touched `src/lib/face.ts`, the one place that both renders faces and gatekeeps what's accepted into `people.avatar`. The nose ring was free --- it's just one more entry in the existing `extras` list. Eye colour wasn't: it needed a new key (`ec`) in a config shape that `parseAvatar()` previously rejected unless the object had *exactly* `FACE_KEYS.length` keys. Every face already stored in the database was serialized under the old key set. Add `ec` to `FACE_KEYS` and ship the old strict check unchanged, and every existing person's stored JSON would suddenly have the "wrong" key count and fail to parse --- `renderAvatarSvg()` falls back to `DEFAULT_FACE` for anything `parseAvatar()` rejects, so this would have silently reset every face in the house to the same neutral default on deploy. That's exactly the kind of destructive, unannounced rewrite the never-delete rule above is there to rule out, even though no row and no post would actually be deleted --- it's still erasing something someone chose.

The fix is a `BACKWARD_COMPATIBLE_KEYS` set (currently just `{"ec"}`) inside `face.ts`. `parseAvatar()` now does three separate checks instead of one key-count comparison: every key present in the parsed object must be one `FACE_KEYS` recognises (rejects typos and future/unknown keys, same as before); every key that IS present must still be a validated in-range integer, with no loosening there; and every key that's ABSENT is only tolerated if it's in `BACKWARD_COMPATIBLE_KEYS` --- anything else absent (an old, always-required key like `sk` or `hs`) still fails the whole parse, same as it always has. An absent backward-compatible key defaults to `0`, which is why `DEFAULT_FACE.ec = 0` and the first `EYE_COLOURS` entry is literally the old hardcoded ink colour (`#1c1410`) rather than a new hue --- "missing `ec`" and "explicitly chose the first eye colour" render as the identical, previously-existing face. I deliberately didn't collapse this into "fewer keys than FACE_KEYS.length is fine": that weaker version would also accept a config missing `sk` or any other old field, silently defaulting someone's skin tone instead of rejecting a truncated or corrupted value, which is a correctness regression the stricter per-key accounting avoids. Any key added after `ec` goes into the same set and gets the same treatment; nothing in this mechanism is specific to eye colour, so this scales to the next addition without more design work.

`spec/face.test.ts` pins this down directly: it feeds `parseAvatar()` the exact 11-key JSON shape documented in `face.ts`'s own header comment (no `ec`), asserts the parse succeeds with `ec: 0`, and asserts the result re-serializes and re-parses to the same config. It also checks the inverse failure modes still hold --- an unknown extra key, a missing *old* key (`sk` deleted), and an out-of-range or non-integer value for a key that IS present are all still rejected, so the loosening is scoped to exactly the one case intended. Beyond the unit test, I booted the built server on a scratch database, signed up a new account by POSTing the old 11-key JSON directly as the `avatar` form field (bypassing the editor UI, which only ever emits the new 12-key shape), and confirmed in both the stored row and the rendered `<svg>` markup that the face came back with every original feature intact and eyes drawn in the original ink colour, not reset to `DEFAULT_FACE` or any other placeholder.

Eye colour itself had to respect the file's existing anti-caricature rule rather than work around it: the header is explicit that every eye style is dark ink marks, never a white sclera shape, because a lighter eye-shape under a dark pupil on a dark face is a specific, named caricature. "Eye colour" therefore means tinting the ink marks `eyes()` already draws --- the iris/pupil dots, arcs and the tall ellipse style all now take an `ink` parameter (`EYE_COLOURS[face.ec]`, defaulting to `INK`) in place of the hardcoded constant, while eyebrows keep drawing with their own separate `hair.dark` colour as before, so changing eye colour can't accidentally change brow colour or vice versa. The six added hues (brown, hazel, green, blue, grey, amber, alongside the original near-black default) are deliberately muted and darkened rather than saturated or bright, chosen so each one still reads as ink on skin at the avatar's small size rather than as a coloured sticker. I checked this by rendering all seven through the real editor at both viewport sizes in light and dark mode: every one stays legible as an eye, none looks like a lighter eye-shape or a highlight that could read as the caricature the header warns about.

## What the evidence can support

The strongest parts of this process connect a mistake to a changed rule, implementation or test. The weaker parts rely on temporary browser scripts or judgments that need longer use. Tests can establish membership boundaries and persistence; they cannot tell whether friends feel welcome. I will judge that through conversations and playtesting, using the audit log as context rather than a measure of friendship. The [archived process record](docs/process-history.md) retains the detailed investigations and earlier decisions; the [earlier README](docs/readme-history.md) preserves the fuller reading discussion.

## Hiding the standing explanations

Feedback was blunt: too many explanations sat in plain sight on the house page, all the time, for everyone, whether they needed them or not --- the corridor and party-room hints, the bedroom hint, the level note under the progress bar, and the leaderboard hint. I moved all five behind a shared `InfoButton` component, one round low-contrast `(i)` button next to each heading. Clicking or tapping it opens a popover with the same words the `<p>` used to show permanently; the widgets themselves (the drag targets, the canvas, the avatars) don't move or change.

One shared component meant one place to get keyboard and touch behaviour right instead of five. `src/components/InfoButton.astro` renders the button and popover; `src/scripts/info-button.ts` wires every instance on the page by delegation (one click listener, one keydown listener, no matter how many buttons render), so a sixth usage later needs no new script. Each popover is a real `<button>` with `aria-expanded` and `aria-describedby`, closes on Esc or an outside click, and opens on both click and keyboard activation (Enter/Space), since a hover-only tooltip is useless on a phone.

The one bug worth recording: my first pass positioned the popover at `left: 0` relative to its own wrapper. That's fine when the button sits near the left edge of a 390px screen, and wrong when it sits near the right edge of a heading --- the leaderboard and level-progress buttons both spilled their popover off the right side of the viewport. A throwaway Playwright script at 390×844 caught it with a screenshot before I'd have noticed by eye. The fix clamps the popover's horizontal position in `info-button.ts` once it's shown, measuring the actual viewport width rather than assuming a fixed layout.

Verified: `pnpm typecheck` (0 errors, 0 warnings), `pnpm build`, and `pnpm test` green twice in a row (83/83) against a scratch database in `/tmp`. A throwaway Playwright install (outside the repo, removed afterward) opened and closed all five popovers by click and by keyboard at 1920×1080 and 390×844, in light and dark mode --- 24 checks, all passing, plus a screenshot confirming the clamped popover stays on screen at 390px. Not verified: a screen reader reading the popover content aloud, and whether the wording inside each popover reads as warm rather than clinical once it's one click away instead of always visible --- that's a judgement for playtesting, not a test.

## A countdown ring, not a countdown rewrite

The wall's "wait 7m 32s" text became a small SVG ring --- a background track plus a foreground arc whose `stroke-dashoffset` drains as the wait runs out --- next to the unchanged level line. The split follows a rule the rest of the app already uses for the plant and the levels bar: the server computes the true starting state (a `stroke-dashoffset` from the same fraction-remaining math the text uses) so a reload mid-cooldown shows the right angle immediately, and the client only animates from there, on `requestAnimationFrame` rather than a once-a-second rebuild, so the arc itself can move more smoothly than the text does without either rebuilding the SVG or drifting from the number beside it. `src/lib/canvas.ts` got one new, pure export (`cooldownRingOffset`) so the server and the client read the same circumference off the same radius, the same way `cooldownRemaining` already keeps the API route and the page in step.

The ring is `aria-hidden`: the text it sits next to is the only thing that ever carried the cooldown's meaning, and it still does, just shorter ("8m 22s" instead of "wait 8m 22s to place again") so it reads as a label next to a dial rather than a full sentence floating beside a circle. Not everyone reads an analogue face at a glance, which is the whole reason the text stayed.

## The info popover was drawing behind the bedroom and corridor

Feedback: the bedroom's info button opened a popover that got covered by the
beds instead of sitting on top of them. The corridor had the same bug, waiting
to be noticed.

Both sections wrap their heading in its own positioned box --- `.corridor-head`
and `.bedroom-head` --- sitting next to a sibling that's also positioned at the
same `z-index: 1`: `.corridor-floor-row` and `.bedroom-beds`. Equal `z-index`
is broken by DOM order, and both siblings come *after* the head in the markup,
so they painted on top of it, popover and all, even though the popover's own
`z-index: 5` was higher --- that number only wins within its own stacking
context, and the head's context as a whole was still losing to its neighbour.
The fix raises each head to `z-index: 2`, so its whole stacking context,
popover included, comes out on top; the beds and the corridor floor keep their
own `z-index: 1`, so nothing else about their layering changes.

I checked every other `InfoButton` placement (the party room, the level
progress bar, the leaderboard) for the same shape and found none: their
heading wrappers aren't positioned at all, so they paint in plain document
order with nothing to lose a tie against.

Verified: `pnpm typecheck` (0/0), `pnpm build`, `pnpm test` twice (90/90)
against a scratch database. A throwaway Playwright check opened both
popovers in a real Chromium and read back `document.elementFromPoint()` at
each popover's own centre --- confirming the popover itself, not a bed or a
corridor avatar, is the topmost element there --- then screenshotted both to
confirm the same thing by eye.
