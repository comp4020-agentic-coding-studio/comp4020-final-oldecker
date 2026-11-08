# the board

The board is a closed catch-up space for about fifteen friends from my undergrad. As we scatter into different cities, I want to keep the small, everyday connection we used to get from seeing each other at uni. We already have a group chat; this is somewhere to show up without needing something to announce.

## Getting in

Sign up at `/signup` with a unique name and password, then **build a new house** from the street. To bring someone else in, copy the house's **invite link** into a second browser profile or incognito window and sign up there. Typing a house's name instead **knocks**: a member must approve you before you see inside.

With both browsers inside, water the plant, paint a pixel, or drag yourself into the party room. These changes appear in the other window within about a second. Posts and temperature reactions appear on reload.

## What good means here

**Good means quieter friends can take part comfortably and still feel like it's their room too.** Reading quietly counts. A visit, a watering, a pixel or a double-clicked heart lets someone be present without composing a post. Away friends sleep in bunk beds; they aren't labelled inactive. Posts expire after 60 days, lowering the stakes of sharing.

Rewards count different activities on different days, not repeated clicks. Weekly streaks survive with one active day, including just visiting. There are no daily nudges, public discovery, follower counts, likes or feed algorithm. The house stays small because its value depends on people knowing each other.

## What I read, and reconsidered

Most reading came after building. [Sloan's “An app can be a home-cooked meal” (2020)](https://www.robinsloan.com/notes/home-cooked-app/) gave me words for making something worthwhile for a few people without a growth plan. [Shirky's “Situated Software” (2004)](https://web.archive.org/web/20040411202042/http://www.shirky.com/writings/situated.html) explains how existing relationships support software made for one group; that also limits what I can claim beyond my friends.

[Nielsen's participation inequality (2006)](https://www.nngroup.com/articles/participation-inequality/) changed my goal from equal posting to comfortable participation. His large-community pattern isn't a prediction for fifteen friends, but it made treating quiet readers as a problem seem wrong.

[Weiser and Brown's calm technology (1995)](https://calmtech.com/papers/designing-calm-technology.html) informs the ambient plant and corridor. It doesn't prove reload-only posts feel calmer; that's my hypothesis, and live presence might itself create pressure.

Eyal's *Hooked* (2014) and [Duolingo's account of streaks](https://blog.duolingo.com/how-duolingo-streak-builds-habit/) challenge my rewards. Habits can serve users, but even weekly streaks might create guilt. I originally wanted private levels, then made them public because seeing friends had been around felt useful. This remains my least certain decision. Missing a week loses only a capped bonus; I'd remove the leaderboard if friends experience it as comparison.

## What's enforced and what's judged

`CLAUDE.md` carries these boundaries into agent instructions. Tests in `spec/` check account forgery, house membership, isolation of live events, knocking without entry, activity limits, weekly streaks, private hearts, wall votes and persistence. These checks protect concrete promises; they cannot establish comfort.

I judge comfort through playtesting and conversations with the group, alongside visits, waterings and hearts in the audit log. Activity alone cannot distinguish feeling welcome from feeling obliged. Whether quieter friends feel at home, and whether public levels undermine that, remains the test that matters.
