// Tap a post photo to see it full-screen. One click listener on document
// (same shape as delete-post.ts), so thumbnails in a post that arrives or
// re-renders after load work without re-binding anything. The set of photos
// you can step through is read from the clicked thumbnail's own post at open
// time --- never across posts. Display-only: nothing here writes.

const box = document.getElementById("lightbox");

if (box) {
  const img = box.querySelector<HTMLImageElement>(".lb-img")!;
  const count = box.querySelector<HTMLElement>(".lb-count")!;
  const closeBtn = box.querySelector<HTMLButtonElement>(".lb-close")!;
  const prevBtn = box.querySelector<HTMLButtonElement>(".lb-prev")!;
  const nextBtn = box.querySelector<HTMLButtonElement>(".lb-next")!;

  let photos: HTMLButtonElement[] = [];
  let index = 0;
  let opener: HTMLElement | null = null;
  let savedOverflow = "";

  const show = (i: number) => {
    index = (i + photos.length) % photos.length;
    const thumb = photos[index];
    const thumbImg = thumb.querySelector("img");
    img.src = thumb.dataset.full ?? thumbImg?.src ?? "";
    // keep the thumbnail's own alt; fall back to its position so a screen
    // reader still hears something when the upload has no description
    img.alt = thumbImg?.alt || `photo ${index + 1} of ${photos.length}`;
    const many = photos.length > 1;
    count.textContent = many ? `${index + 1} / ${photos.length}` : "";
    prevBtn.hidden = !many;
    nextBtn.hidden = !many;
  };

  const open = (thumb: HTMLButtonElement) => {
    const group = thumb.closest(".post-images");
    photos = group ? [...group.querySelectorAll<HTMLButtonElement>(".post-photo")] : [thumb];
    opener = thumb;
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.hidden = false;
    show(Math.max(0, photos.indexOf(thumb)));
    closeBtn.focus();
  };

  const close = () => {
    if (box.hidden) return;
    box.hidden = true;
    img.removeAttribute("src");
    document.body.style.overflow = savedOverflow;
    // the opener may have been re-rendered away while we were open
    if (opener?.isConnected) opener.focus();
    opener = null;
  };

  document.addEventListener("click", (event) => {
    const thumb = (event.target as HTMLElement).closest<HTMLButtonElement>(".post-photo");
    if (thumb) {
      event.preventDefault();
      open(thumb);
    }
  });

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => show(index - 1));
  nextBtn.addEventListener("click", () => show(index + 1));
  // backdrop = anywhere that isn't the photo or a control
  box.addEventListener("click", (event) => {
    if (event.target === box || (event.target as HTMLElement).classList.contains("lb-stage")) close();
  });

  document.addEventListener("keydown", (event) => {
    if (box.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowLeft" && photos.length > 1) {
      show(index - 1);
    } else if (event.key === "ArrowRight" && photos.length > 1) {
      show(index + 1);
    } else if (event.key === "Tab") {
      // trap focus on whichever controls are visible
      const controls = [closeBtn, prevBtn, nextBtn].filter((b) => !b.hidden);
      const at = controls.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      const step = event.shiftKey ? -1 : 1;
      controls[(at + step + controls.length) % controls.length].focus();
    }
  });

  // swipe: mostly-horizontal moves between photos, mostly-downward closes
  let startX = 0;
  let startY = 0;
  let tracking = false;
  box.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    tracking = true;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });
  box.addEventListener("touchend", (event) => {
    if (!tracking) return;
    tracking = false;
    const dx = event.changedTouches[0].clientX - startX;
    const dy = event.changedTouches[0].clientY - startY;
    const SWIPE = 50;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE && photos.length > 1) {
      show(dx < 0 ? index + 1 : index - 1);
    } else if (dy > SWIPE && dy > Math.abs(dx)) {
      close();
    }
  });
}
