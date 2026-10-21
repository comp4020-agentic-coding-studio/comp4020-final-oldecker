// Client side of src/components/AvatarEditor.astro: the server renders the
// first state, this keeps the hidden input, the big preview and every option
// thumbnail in step with whatever's picked. All drawing goes through
// src/lib/face.ts, the same renderer the whole app uses, so the preview is
// exactly what will show up in posts and the presence strip.
import { FACE_GROUPS, FACE_KEYS, parseAvatar, randomFace, renderFaceSvg, serializeFace, type FaceConfig } from "../lib/face";

function setup(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>("[data-avatar-input]");
  const preview = root.querySelector<SVGElement>("[data-avatar-preview]");
  if (!input || !preview) return;
  let face = parseAvatar(input.value);
  if (!face) return;

  const viewByKey = new Map(FACE_GROUPS.map((g) => [g.key, g.view]));

  function paint(next: FaceConfig): void {
    face = next;
    input!.value = serializeFace(next);
    preview!.innerHTML = renderFaceSvg(next);
    for (const btn of root.querySelectorAll<HTMLButtonElement>(".ae-opt")) {
      const key = btn.dataset.key as keyof FaceConfig;
      const index = Number(btn.dataset.index);
      btn.setAttribute("aria-pressed", String(next[key] === index));
      // style thumbnails show the *current* face with only that option swapped in
      if (viewByKey.get(key) && btn.classList.contains("ae-style")) {
        const svg = btn.querySelector("svg");
        if (svg) svg.innerHTML = renderFaceSvg({ ...next, [key]: index });
      }
    }
  }

  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const opt = target.closest<HTMLButtonElement>(".ae-opt");
    if (opt && face && FACE_KEYS.includes(opt.dataset.key as keyof FaceConfig)) {
      paint({ ...face, [opt.dataset.key as keyof FaceConfig]: Number(opt.dataset.index) });
      return;
    }
    if (target.closest("[data-avatar-shuffle]")) paint(randomFace());
  });
}

for (const root of document.querySelectorAll<HTMLElement>("[data-avatar-editor]")) setup(root);
