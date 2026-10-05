# Working backlog

Not graded content --- PROCESS.md and README.md are the documents that matter
for the crit. This is just a place to park feedback and ideas between
sessions so they don't get lost.

## 2026-10-05 playtest feedback

- [x] watering can was actually the 🪴 potted-plant emoji, not a watering can
      --- fixed, and it now actively waters on click (was already wired to
      `/api/water`, just had the wrong icon)
- [x] plant now scales with its stage (wilting/thirsty/okay/thriving), not
      just leaf colour and tilt
- [ ] option to rename the plant
- [x] "feeling" vs "doing" posts now have their own colour (category-tag
      background), not just a text label
- [ ] layout: a Pinterest-style masonry feed rather than a single column
- [x] reactions on posts, 2026-10-05: a ❄️<->🔥 drag slider per post
      (-100..100, sign + magnitude, only ever shown as the slider/emoji ---
      no raw number for *your own* vote in the UI), vote on release not on
      every drag frame. Sort by "newest" or "extremest" (|avg score| across
      everyone who's voted). Reacting to *photos* specifically (vs. the
      whole post) is still open.
- [x] slider moved to the side of the post (vertical, rotated range input)
      with a small dot-strip plot of everyone's votes sharing its axis, plus
      a median emoji label (title attribute carries the exact number). Went
      with a strip plot over a violin/KDE: with often under ~15 points per
      post, a smoothed density would imply more data than exists -- a strip
      plot shows the real, small sample honestly. Colors are the dataviz
      skill's validated diverging blue/red pair, re-validated against this
      app's own card surfaces. One deliberate deviation from the skill's
      usual per-mark hover tooltip: individual dots don't show their exact
      value on hover, since that would re-expose one person's raw vote,
      against this feature's whole "slider/emoji only" premise -- only the
      *aggregate* median gets a precise number.
- [ ] `<img>` tags for post photos should move to Astro's `<Image>`
      component once images aren't runtime-uploaded user content read from
      `/data` (Astro's image pipeline optimises build-time/local assets;
      runtime-uploaded files would need `astro:assets`' remote/content-layer
      path instead of the default component --- worth a proper look rather
      than a reflexive swap)
