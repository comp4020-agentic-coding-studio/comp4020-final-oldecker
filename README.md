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

**Good means the quieter people in the group can take part comfortably,
and still feel like it's their room too.** The failure I'm designing against
is the usual one in group spaces: a few people carry everything, and the rest
gradually feel like guests in somebody else's room. Nielsen calls this
participation inequality (see below). What I'm *not* aiming for is everyone
posting equally. Reading quietly is a real way of staying connected, and
treating quiet friends as a problem to fix would be its own failure. So the
measure is softer: everyone should be able to show up, in some way, every
couple of weeks without it feeling like a performance. Posting is one of
several ways to do that.

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
  wait for a reload, so you decide when new posts reach you. A post popping
  in while you're reading another one would pull attention to whoever is
  posting right now (the full argument is in PROCESS.md, under the crit 9
  decision). This is a design bet, not a settled fact; see below.
- **No daily streaks or daily nudges**, for the reason above.

## What I read, and what it changed

I started from reasoning about my specific friends rather than from reading,
and came to most of these sources part-way through, so some confirmed
decisions I'd already made and some changed them. The argument rests on
Sloan and Shirky. Nielsen states the problem, calm technology shapes how the
house feels, Rao and Strickler explain the wider context, and Eyal and
Duolingo are the alternative I argue against.

- **Robin Sloan, ["An app can be a home-cooked
  meal"](https://www.robinsloan.com/notes/home-cooked-app/) (2020).** Sloan
  built a messaging app for his family of four and nobody else. This answers
  "why build a little website just for us?": its value comes from care,
  familiarity and usefulness to the people it's for, and it needs no growth
  plan to be worth making. It's why shared jokes, the hand-drawn house and
  the *ich hab dich lieb* are features, not decoration.
- **Clay Shirky, ["Situated
  Software"](https://web.archive.org/web/20040411202042/http://www.shirky.com/writings/situated.html)
  (2004).** Shirky describes software built for one social situation, where
  the group's existing relationships do part of the work. That's why the
  board leans on trust instead of moderation tools: an invite link from a
  friend is the whole access model. It's also the limit of everything here:
  what works for this group may not work for any other.
- **Jakob Nielsen, ["Participation Inequality: Encouraging More Users to
  Contribute"](https://www.nngroup.com/articles/participation-inequality/)
  (2006).** In online communities a small minority makes most of the
  contributions (the "90-9-1" rule). The pattern comes from large public
  communities, so I don't treat it as a prediction for fifteen friends. I
  take two things from it: make taking part easier (short updates, a
  temperature drag, a pixel, a heart), and don't count reading as failure.
  This is what moved my definition of good away from "everyone posts as
  often as everyone else".
- **Mark Weiser and John Seely Brown, ["Designing Calm
  Technology"](https://calmtech.com/papers/designing-calm-technology.html)
  (1995).** Calm technology lets information sit at the edge of your
  attention and come to the centre only when you want it. The plant, the
  corridor and the lit-up windows on the street are meant to work that way.
  The paper doesn't show that posts waiting for a reload are calmer; that is
  my hypothesis. Live presence could just as easily create pressure to
  reply, so I treat both as things to check with the group, not settled
  facts.
- **Venkatesh Rao, ["The Extended Internet
  Universe"](https://studio.ribbonfarm.com/p/the-extended-internet-universe)
  (2019), and Yancey Strickler, ["The Dark Forest Theory of the
  Internet"](https://onezero.medium.com/the-dark-forest-theory-of-the-internet-7dc3e68a7cb1)
  (2019).** Rao's "cozyweb" names the private chats and groups where a lot of
  real online life now happens. Strickler explains why people retreat there
  from public spaces. Together they back the boundary of the app: invite-only,
  no discovery, an audience that's always clear. They're interpretive
  essays, though, not evidence that privacy alone makes people closer.
- **Nir Eyal, *Hooked* (2014), and [Duolingo's
  streaks](https://blog.duolingo.com/how-duolingo-streak-builds-habit/).**
  Eyal gives a model of habit formation, and Duolingo uses daily streaks for
  both learning habits and retention. It would be unfair to say they only
  serve platform numbers. The real question for me is which habits serve a
  friendship. A weekly streak asks for less, but it can still make people
  feel guilty or post just to keep it alive. So the design choices that
  matter are that missing a week costs only the small bonus, that the bonus
  is capped well below what genuine activity earns, and that it rewards
  showing up rather than volume.

**What I changed my mind about.** PROCESS.md argues, before anything was
built, that streaks and levels should be visible only to their owner, since
public numbers are how a retention mechanic turns into pressure to perform.
After using it, I reversed that. In a closed group of friends, seeing
someone's level, or the little flame for their weekly streak, is closer to
seeing that they've been around lately than to ranking them, and a private
number did nothing for the group goal above. The Eyal and Duolingo reading
makes this the decision I'm least sure of. The leaderboard sits at the
bottom of the page, under everything else, on purpose, and it's the first
thing I'd remove if the group says it feels like comparison.

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

Other claims can only be judged, and they're claims about my friends, not
the code:

- **Do quieter people take part comfortably?** I'm judging this from who
  turns up in the audit log over the weeks (visits, waterings and hearts,
  not just posts), and by asking them, since a number can't tell comfortable
  from obliged.
- **Does the house feel calm rather than demanding?** Specifically, does the
  plant give a sense of connection without asking for attention, and does
  reload-only actually feel like control over when posts arrive? Judged by
  playtesting with the group. PROCESS.md records the corrections that came
  out of that.
- **Do streaks and public levels feel friendly or like pressure?** This is
  the claim I'm least sure of, and the one I'd change first.
