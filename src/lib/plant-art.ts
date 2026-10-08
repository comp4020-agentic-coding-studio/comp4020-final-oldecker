// One distinct illustration per growth stage, not one shape recoloured four
// ways --- a wilting plant should read as a different *plant*, not just a
// browner version of the thriving one. Shared between the server render
// (src/pages/index.astro) and the live client update (src/scripts/live.ts,
// src/scripts/water-plant.ts via plant-dom.ts), so both ever show the same
// four pictures.
//
// This duplicates the stage union from src/lib/plant.ts rather than
// importing it: plant.ts pulls in db.ts (better-sqlite3), and this module
// is imported by client-side scripts. A type-only import gets erased at
// compile time either way, but keeping this module's import graph free of
// any server-only edge, even a type-only one, is one less thing to get
// wrong if that ever changes.
export type PlantStage = "wilting" | "thirsty" | "okay" | "thriving";

// Every stage shares the same pot footprint/position so swapping markup
// in place (on a live update) never jumps the layout, just varies colour
// and decoration on top of it.
function pot(fill: string, decorated: boolean): string {
  const base = `<rect x="20" y="54" width="24" height="8" rx="2" fill="${fill}" stroke="#00000022" stroke-width="1.5" />`;
  const decoration = decorated
    ? `<path d="M24 58 h16 M24 60 h16" stroke="#ffffff55" stroke-width="1.2" stroke-linecap="round" />`
    : "";
  return base + decoration;
}

export function plantSvgForStage(stage: PlantStage): string {
  switch (stage) {
    case "wilting":
      return `
        ${pot("#8a6a3f", false)}
        <path d="M18 56 l1 -3 M46 56 l-1 -3" stroke="#8a6a3f" stroke-width="1.5" />
        <path d="M32 54 C32 44 36 40 34 32" fill="none" stroke="#7a6a3a" stroke-width="3.5" stroke-linecap="round" />
        <path d="M34 32 C28 34 20 32 18 24 C26 24 33 28 34 32 Z" fill="#b8a85c" stroke="#7a6a3a" stroke-width="1.5" />
        <path d="M34 32 C40 30 44 24 42 18 C36 22 33 28 34 32 Z" fill="#c9bb70" stroke="#7a6a3a" stroke-width="1.5" />
      `;
    case "thirsty":
      return `
        ${pot("#8a6a3f", false)}
        <path d="M32 54 L32 38" fill="none" stroke="#5c7a3f" stroke-width="3.5" stroke-linecap="round" />
        <path d="M32 44 C24 42 18 34 20 28 C28 30 33 38 32 44 Z" fill="#c3cf97" stroke="#5c7a3f" stroke-width="1.5" />
        <path d="M32 40 C40 38 46 32 45 26 C38 28 32 34 32 40 Z" fill="#c3cf97" stroke="#5c7a3f" stroke-width="1.5" />
      `;
    case "okay":
      return `
        ${pot("#8a6a3f", false)}
        <path d="M32 54 L32 30" fill="none" stroke="#3f6b32" stroke-width="4" stroke-linecap="round" />
        <path d="M32 40 C22 38 16 28 18 20 C28 22 34 32 32 40 Z" fill="#9ccb7e" stroke="#3f6b32" stroke-width="1.5" />
        <path d="M32 36 C42 34 48 26 46 18 C38 20 31 28 32 36 Z" fill="#9ccb7e" stroke="#3f6b32" stroke-width="1.5" />
        <path d="M32 30 C30 24 32 18 32 14 C34 18 36 24 32 30 Z" fill="#9ccb7e" stroke="#3f6b32" stroke-width="1.5" />
      `;
    case "thriving":
      return `
        ${pot("#8a6a3f", true)}
        <path d="M32 54 L32 24" fill="none" stroke="#2f5a26" stroke-width="4.5" stroke-linecap="round" />
        <path d="M32 42 C20 40 12 28 15 18 C27 21 34 32 32 42 Z" fill="#7fc45c" stroke="#2f5a26" stroke-width="1.5" />
        <path d="M32 38 C44 36 52 26 49 16 C39 19 30 30 32 38 Z" fill="#7fc45c" stroke="#2f5a26" stroke-width="1.5" />
        <path d="M32 30 C25 26 23 18 26 12 C31 16 34 24 32 30 Z" fill="#8fd470" stroke="#2f5a26" stroke-width="1.5" />
        <path d="M32 30 C39 26 41 18 38 12 C33 16 30 24 32 30 Z" fill="#8fd470" stroke="#2f5a26" stroke-width="1.5" />
        <circle cx="32" cy="12" r="7" fill="#f2a6c4" stroke="#c76f93" stroke-width="1.2" />
        <circle cx="32" cy="12" r="3" fill="#f6d94a" />
        <path d="M14 30 l-3 -2 M50 30 l3 -2 M22 10 l-2 -3 M42 10 l2 -3" stroke="#f6d94a" stroke-width="1.6" stroke-linecap="round" />
      `;
  }
}
