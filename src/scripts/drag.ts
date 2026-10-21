// The app's one drag gesture, shared by every place an avatar can be dragged:
// the house page (corridor -> party room to join, room -> corridor to leave,
// either -> the street door to go back out to /houses) and the street page
// (your avatar -> a house to go in). Each caller passes the drop zones it
// cares about; this file only knows about pointers, a ghost, and rectangles.
//
// No drag library: Pointer Events (pointerdown/move/up + setPointerCapture)
// are enough, and this is the only drag gesture in the app, matching its
// existing hand-rolled-everything style. setPointerCapture is what unifies
// mouse and touch.

export interface DropZone {
  el: HTMLElement;
  onDrop: () => void | Promise<void>;
}

export interface DragOptions {
  zones: DropZone[];
  // Dropped somewhere that isn't any zone (but not cancelled) --- the party
  // room's "drag yourself back out" uses this, so a drop anywhere outside
  // the room still counts as leaving, as it always has.
  onMiss?: () => void | Promise<void>;
}

function pointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// Zones are checked in order, first hit wins, so a small zone sitting inside
// or overlapping a bigger one (the street door at the end of the corridor)
// should be listed first.
function zoneAt(zones: DropZone[], x: number, y: number): DropZone | undefined {
  return zones.find((z) => z.el.isConnected && pointInRect(x, y, z.el.getBoundingClientRect()));
}

// startX/startY: where the pointer went down, so the tap-vs-drag check below
// measures real movement rather than distance from the avatar's centre.
function startDrag(
  sourceEl: HTMLElement,
  pointerId: number,
  startX: number,
  startY: number,
  { zones, onMiss }: DragOptions,
): void {
  // Belt-and-braces: if an earlier drag's ghost somehow survived (a bug we
  // don't expect anymore, but also the exact symptom this function used to
  // cause --- see the finish() comment below), don't let it pile up
  // underneath a new one.
  document.querySelectorAll(".party-drag-ghost").forEach((el) => el.remove());

  const ghost = sourceEl.cloneNode(true) as HTMLElement;
  ghost.classList.add("party-drag-ghost");
  ghost.removeAttribute("id");
  ghost.removeAttribute("hidden");
  document.body.appendChild(ghost);

  const originRect = sourceEl.getBoundingClientRect();
  const offsetX = originRect.width / 2;
  const offsetY = originRect.height / 2;

  const moveGhost = (x: number, y: number) => {
    ghost.style.left = `${x - offsetX}px`;
    ghost.style.top = `${y - offsetY}px`;
  };
  moveGhost(originRect.left + offsetX, originRect.top + offsetY);

  let hovered: DropZone | undefined;
  const setHovered = (zone: DropZone | undefined) => {
    if (zone === hovered) return;
    hovered?.el.classList.remove("drag-over");
    zone?.el.classList.add("drag-over");
    hovered = zone;
  };

  // Cleanup (ghost + listeners) must run no matter what: a live update
  // arriving mid-drag (someone re-joining the party room from another tab, a
  // timer expiring your own slot --- see party-dom.ts) can replace sourceEl's
  // node in the DOM out from under this gesture. This used to listen on
  // sourceEl itself, and a detached element never receives another pointer
  // event again --- not even pointercancel --- so finish() never ran and the
  // ghost leaked forever, frozen wherever the pointer last was: the "avatar
  // stuck in the air" bug (PROCESS.md). Listening on `document`, filtered by
  // pointerId, tracks the gesture regardless of what happens to sourceEl,
  // and try/finally means even an unexpected exception can't skip teardown.
  const finish = async (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    try {
      if (sourceEl.isConnected && sourceEl.hasPointerCapture(pointerId)) {
        sourceEl.releasePointerCapture(pointerId);
      }
    } finally {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      setHovered(undefined);
      ghost.remove();
    }

    // pointercancel carries no meaningful position --- always a non-drop.
    if (e.type === "pointercancel") return;
    // A press-and-release that barely moved is a tap, not a drop: it must
    // not count as "dropped outside the room" and kick you out of it.
    if (Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;

    const zone = zoneAt(zones, e.clientX, e.clientY);
    try {
      if (zone) await zone.onDrop();
      else await onMiss?.();
    } catch {
      // Nothing was moved optimistically before a request settled, so a
      // failure just needs the ghost gone (already done) --- the real avatar
      // is exactly where it started.
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    moveGhost(e.clientX, e.clientY);
    setHovered(zoneAt(zones, e.clientX, e.clientY));
  };

  sourceEl.setPointerCapture(pointerId);
  // Bound to `document`, not sourceEl --- see finish() for why.
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
}

// The entry point callers use from a pointerdown handler.
export function dragFrom(sourceEl: HTMLElement, e: PointerEvent, options: DragOptions): void {
  // A drag only ever starts on the primary button / a single touch.
  if (e.button !== 0) return;
  e.preventDefault();
  startDrag(sourceEl, e.pointerId, e.clientX, e.clientY, options);
}
