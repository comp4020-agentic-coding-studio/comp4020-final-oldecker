# Working backlog

Not graded content --- PROCESS.md and README.md are the documents that matter
for the crit. This is just a place to park feedback and ideas between
sessions so they don't get lost.

## 2026-10-05 playtest feedback

- [x] watering can was actually the 🪴 potted-plant emoji, not a watering can
      --- fixed, and it now actively waters on click (was already wired to
      `/api/water`, just had the wrong icon)
- [ ] plant should visibly grow / get more detailed across its stages, not
      just change leaf colour and tilt
- [ ] option to rename the plant
- [ ] "feeling" vs "doing" posts should read as visually distinct (colour),
      not just a small text tag
- [ ] layout: a Pinterest-style masonry feed rather than a single column
- [ ] reactions on posts/photos --- currently no way to react to someone
      else's post at all
- [ ] `<img>` tags for post photos should move to Astro's `<Image>`
      component once images aren't runtime-uploaded user content read from
      `/data` (Astro's image pipeline optimises build-time/local assets;
      runtime-uploaded files would need `astro:assets`' remote/content-layer
      path instead of the default component --- worth a proper look rather
      than a reflexive swap)
