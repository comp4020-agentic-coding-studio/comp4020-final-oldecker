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
      no raw number in the UI), vote on release not on every drag frame.
      Sort by "newest" or "extremest" (|avg score| across everyone who's
      voted). Reacting to *photos* specifically (vs. the whole post) is
      still open.
- [ ] `<img>` tags for post photos should move to Astro's `<Image>`
      component once images aren't runtime-uploaded user content read from
      `/data` (Astro's image pipeline optimises build-time/local assets;
      runtime-uploaded files would need `astro:assets`' remote/content-layer
      path instead of the default component --- worth a proper look rather
      than a reflexive swap)
