// Shared between pixel-canvas.ts (your own rename) and live.ts (someone
// else's, arriving over SSE) --- same split, same "don't clobber a mid-edit"
// guard, as plant-dom.ts's applyPlantName.
const nameHeading = document.querySelector<HTMLElement>("#canvas-name");
if (nameHeading) nameHeading.dataset.previous = nameHeading.textContent ?? "";

export function applyCanvasName(name: string): void {
  const heading = document.querySelector<HTMLElement>("#canvas-name");
  const input = document.querySelector<HTMLInputElement>('#rename-canvas-form input[name="name"]');
  if (heading) heading.textContent = name;
  if (input && input.value === heading?.dataset.previous) input.value = name;
  if (heading) heading.dataset.previous = name;
}
