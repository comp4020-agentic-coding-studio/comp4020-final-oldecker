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
- [x] layout: multi-column feed, but CSS `columns` (true masonry: packs
      each card into whichever column is currently shortest) fills
      column-major -- top-to-bottom in column 1, then column 2 -- so with
      newest-first sorting, reading left-to-right across a "row" actually
      reads 1-then-4, 2-then-5, not the newest posts sitting together.
      Switched to CSS Grid (`repeat(auto-fill, minmax(min(380px, 100%), 1fr))`),
      which is row-major, so posts read in chronological order left-to-right
      then down. Trade-off: a shared row height per row (the tallest card in
      a row sets it), not true masonry packing -- reading order won over
      packing efficiency here. The `min(380px, 100%)` (not a bare 380px) is
      load-bearing on mobile: minmax()'s minimum is a hard floor even past a
      narrower container, so a bare 380px forced a column wider than a
      ~358px phone viewport instead of collapsing to one column.
- [x] reactions on posts, 2026-10-05: a ❄️<->🔥 drag slider per post
      (-100..100, sign + magnitude, only ever shown as the slider/emoji ---
      no raw number for _your own_ vote in the UI), vote on release not on
      every drag frame. Sort by "newest" or "extremest" (|avg score| across
      everyone who's voted). Reacting to _photos_ specifically (vs. the
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
      _aggregate_ median gets a precise number.
- [ ] `<img>` tags for post photos should move to Astro's `<Image>`
      component once images aren't runtime-uploaded user content read from
      `/data` (Astro's image pipeline optimises build-time/local assets;
      runtime-uploaded files would need `astro:assets`' remote/content-layer
      path instead of the default component --- worth a proper look rather
      than a reflexive swap)
- [ ] add random prompts that can help as a starter suggestions for new posts about both feeling and about doing posts. They should be grayed out in the background of the typing field and dissapear as soon as you start typing.
