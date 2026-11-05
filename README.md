# the board

The board is a small, closed catch-up space for about fifteen of my closest
friends from my undergrad. You post short "feeling" or "doing" updates with a
couple of photos, water a shared plant with one tap, and react to each
other's posts by dragging from freezing to on fire. Around that sit a few
things that only make sense because the others are there too: a corridor
showing who's in right now, a party room you drag yourself into, a shared
pixel wall, and a bedroom with bunk beds for everyone who's away.

## Getting in (for markers and other newcomers)

Everything is behind an account, on purpose: the board is for one group of
friends, not for whoever finds the URL.

1. **Sign up** at `/signup` with a name and a password. Names are unique, so
   if yours is taken, pick another.
2. You land on **the street**, which is empty until you belong to a house.
   Use **build a new house** and give it any name. You're now its first
   member.
3. To get a **second person** in (a second Chrome profile or an incognito
   window), copy the **invite link** from inside your house and open it in
   the second browser. It walks them through signup and straight into the
   same house. An invite link is the only way to walk straight in.
4. Typing a house's name on the street's signpost instead **knocks on its
   door**. Somebody already inside has to let you in, and until then you see
   nothing of the house. This is deliberate, not a bug (see below). For
   testing, use the invite link.

With both browsers in the same house, everything below the posts is live:
watering the plant, people arriving, dragging yourself into the party room,
painting a pixel, voting on the wall, and double-clicking someone's avatar to
send them an *ich hab dich lieb*. These show up in the other window within
about a second, with no reload. Posts and reactions are the exception: they
appear on the next load (see "What's enforced and what's judged").

## Who this is for

This is for the specific group of friends I did my bachelor's degree with.
We're starting to scatter into different cities, different jobs and
different daily rhythms. The thing that used to keep us in each other's
lives without any effort was seeing each other at uni several times a week,
and that's gone. I want a place that pulls us back together and keeps us
actually connected, not another group chat everyone mutes.

## What breaks without it

Without something like this, I think we'd stay loosely in touch: the odd
message, a group chat for logistics and memes. What we'd lose is the
smaller, ongoing stuff, how someone's actually doing between the big news
rather than just at it. That's the gap this is meant to close.

## What "good" means here

**Good means the quiet people show up about as often as the loud ones.** The
failure I'm designing against is the normal one for group spaces, where two
or three people carry everything and the rest lurk until it feels like
somebody else's room. Concretely, the floor I'm aiming for is everyone
posting something, or at least turning up, every couple of weeks. More than
that is a bonus, not the bar.

That one idea decides most of the app:

- **Showing up is worth something on its own.** Opening the house puts you
  in the corridor and takes you out of the bedroom, and one tap on the
  watering can counts you towards the plant's week. A person who has nothing
  to post still visibly *was here*, which is what a quiet person can always
  manage.
- **Low-effort ways to be present.** A two-line post, a drag on someone
  else's post, one pixel on the wall, or a heart sent with a double-click.
  None of these needs anything clever to say.
- **Rewards favour regularity, not volume.** Your activity level counts the
  *kinds* of things you did each day, not how many: the same action twice in
  a day is worth it once. So posting ten times doesn't outrun someone who
  dropped in on three different days. Long-term streaks count weeks, not
  days: doing anything at all on one day of the week, even just opening the
  house, keeps it alive, and each week of a streak adds a small, capped
  bonus to your level. A daily streak would reward exactly the people who
  were already going to post the most.
- **Absence is gentle.** People who are away aren't greyed out or listed as
  inactive. They're asleep in a bunk bed, and an *ich hab dich lieb* sent to
  them waits until they're back.
- **Things fade, which lowers the stakes of posting.** Posts expire after 60
  days, so nothing you put up has to be good enough to stay forever.

## What I deliberately didn't build

- **No public visibility, no discovery.** You can't browse other houses or
  learn that one exists. If more people want this, the answer isn't opening
  it up. They build their own house and invite their own friends.
- **No feed algorithm, no follower counts, no likes.** Reactions are a
  temperature, not a tally you can compare across people.
- **No chat.** The brief's own warning about "a chat room with the nouns
  swapped" is right, and the group already has a chat for logistics. This
  is for the slower kind of keeping up.
- **No live-updating posts.** The house's ambient state is live, but posts
  wait for a reload. A post that pops in while you're reading another one
  pulls attention to whoever's posting right now. That's the opposite of
  what I want for the quiet ones (the full argument is in PROCESS.md, under
  the crit 9 decision).
- **No daily streaks or daily nudges**, for the reason above.

## What I read, and what I changed my mind about

I didn't start from reading. The early decisions came from reasoning about
what my specific friends need, and from reacting against the brief's
"median answer" warning. The one place I changed course on the record is
**public levels**. PROCESS.md argues, before anything was built, that streaks
and levels should be visible only to their owner, since public numbers are
how a retention mechanic turns into pressure to perform. After using it, I
reversed that. In a closed group of friends, seeing someone's level, or the
little flame for their weekly streak, is closer to seeing that they've been
around lately than to ranking them, and a private number did nothing for
the group-level goal above. The leaderboard
sits at the bottom of the page, under everything else, on purpose.

## What's enforced and what's judged

Some of "good" can be tested, and these claims are checked by `spec/`
against the running app:

- **Only members see a house.** Non-members can't read or change it, live
  events never leak across houses, and knocking by name grants nothing
  until a member lets you in (`houses.test.ts`, `knocks.test.ts`).
- **Accounts are real.** Passwords are required, sessions are opaque, and a
  forged cookie doesn't authenticate (`auth.test.ts`).
- **Shared state is live** within about a second for the ambient things:
  watering, presence, knocks, levels, wall votes and hearts
  (`realtime.test.ts` and the others).
- **Regularity beats volume.** Repeating an action in a day earns nothing
  more, and the wall cooldown follows the level curve
  (`activity-cooldown.test.ts`). A week counts the same whether you were
  there one day or seven, a gap week ends a streak, and Canberra's
  daylight-saving weeks don't break the week maths (`streak.test.ts`).
- **Notifications only for things meant for you.** Subscribing needs an
  account, and the app only pushes for a heart, a knock or a friend's post,
  never on a timer (`push.test.ts` covers the subscription routes).
- **Hearts are rare enough to mean something.** One per person per day, an
  offline recipient gets it on their next visit, and only the recipient sees
  it (`lieb.test.ts`).
- **Wiping the wall is a group decision**, and it never touches posts
  (`wallvote.test.ts`).
- **What you do persists** across sessions and restarts (`alive.test.ts`).

Other claims can only be judged. Whether the quiet people actually show up
more is a claim about my friends, not the code, and I'm judging it by
watching who posts and who turns up in the audit log over the weeks it's
been running. Whether the house *feels* like a place rather than a feed is
judged by playtesting, and PROCESS.md records the corrections that came out
of that.
