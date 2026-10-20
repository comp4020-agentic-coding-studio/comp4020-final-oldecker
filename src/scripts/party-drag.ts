// Your own drag in and out of the party room. Someone ELSE joining/leaving
// arrives through live.ts instead (same split as the plant and the canvas).
//
// No drag library: Pointer Events (pointerdown/move/up + setPointerCapture)
// are enough, and this is the only drag gesture in the app, matching its
// existing hand-rolled-everything style. setPointerCapture is what unifies
// mouse and touch --- move/up keep firing on the source element even once
// the pointer travels outside its bounds, so one listener set covers both
// input types without extra branching.
import { applyPartyJoin, applyPartyLeave } from "./party-dom";

const dropzoneEl = document.querySelector<HTMLElement>("#party-room-dropzone");
const roomGuestsEl = document.querySelector<HTMLElement>("#party-room-guests");
const youChip = document.querySelector<HTMLElement>("#party-you");
const ownPersonId = youChip?.dataset.personId ?? "";
const ownName = youChip?.dataset.name ?? "";
const ownAvatar = youChip?.dataset.avatar ?? "";

function pointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// direction: "in" drags FROM the strip's own chip TO the room (drop INSIDE
// the zone counts); "out" drags FROM your in-room avatar back out (drop
// OUTSIDE the zone counts) --- same gesture, opposite hit test and
// opposite API route.
function startDrag(sourceEl: HTMLElement, pointerId: number, direction: "in" | "out"): void {
  const ghost = sourceEl.cloneNode(true) as HTMLElement;
  ghost.classList.add("party-drag-ghost");
  ghost.removeAttribute("id");
  document.body.appendChild(ghost);

  const originRect = sourceEl.getBoundingClientRect();
  const offsetX = originRect.width / 2;
  const offsetY = originRect.height / 2;

  const moveGhost = (x: number, y: number) => {
    ghost.style.left = `${x - offsetX}px`;
    ghost.style.top = `${y - offsetY}px`;
  };
  moveGhost(originRect.left + offsetX, originRect.top + offsetY);

  const isOverZone = (x: number, y: number): boolean => {
    const zone = dropzoneEl?.getBoundingClientRect();
    return !!zone && pointInRect(x, y, zone);
  };

  const finish = async (e: PointerEvent) => {
    sourceEl.releasePointerCapture(pointerId);
    sourceEl.removeEventListener("pointermove", onMove);
    sourceEl.removeEventListener("pointerup", finish);
    sourceEl.removeEventListener("pointercancel", finish);
    dropzoneEl?.classList.remove("drag-over");

    const over = isOverZone(e.clientX, e.clientY);
    const dropped = direction === "in" ? over : !over;
    ghost.remove();
    if (!dropped) return;

    try {
      if (direction === "in") {
        const res = await fetch("/api/party/join", { method: "POST" });
        if (!res.ok) throw new Error("join failed");
        const { expiresAt } = (await res.json()) as { expiresAt: number };
        applyPartyJoin({ personId: ownPersonId, name: ownName, avatar: ownAvatar, expiresAt }, ownPersonId);
      } else {
        const res = await fetch("/api/party/leave", { method: "POST" });
        if (!res.ok) throw new Error("leave failed");
        applyPartyLeave(ownPersonId, ownPersonId);
      }
    } catch {
      // Nothing was removed from the DOM optimistically before the request
      // settled, so a failure just needs the ghost gone (already done) ---
      // the real avatar is exactly where it started.
    }
  };

  const onMove = (e: PointerEvent) => {
    moveGhost(e.clientX, e.clientY);
    const over = isOverZone(e.clientX, e.clientY);
    dropzoneEl?.classList.toggle("drag-over", direction === "in" && over);
  };

  sourceEl.setPointerCapture(pointerId);
  sourceEl.addEventListener("pointermove", onMove);
  sourceEl.addEventListener("pointerup", finish);
  sourceEl.addEventListener("pointercancel", finish);
}

youChip?.addEventListener("pointerdown", (e) => startDrag(youChip, e.pointerId, "in"));

// Event-delegated on the room container, not one listener per avatar: the
// guest list's elements come and go as people join/leave, and delegation
// means a newly-added avatar is draggable without any extra wiring.
roomGuestsEl?.addEventListener("pointerdown", (e) => {
  const avatarEl = (e.target as HTMLElement).closest<HTMLElement>(".party-room-avatar[data-own]");
  if (!avatarEl) return;
  startDrag(avatarEl, (e as PointerEvent).pointerId, "out");
});
