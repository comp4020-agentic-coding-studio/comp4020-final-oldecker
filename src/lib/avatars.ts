// Chosen once at join, instead of a colour swatch --- doubles as the
// identity shown in the live "who's here" presence strip (see
// src/pages/api/events.ts and src/scripts/live.ts). Six Australian
// cryptids/folklore monsters, drawn as simple flat blobs.
//
// Eye convention, deliberately: a solid dark pupil circle plus a small
// white highlight dot, nothing else. An earlier version used a white
// oval "sclera" shape under a dark pupil, on a solid dark fill --- that
// specific combination is blackface caricature's visual grammar, and one
// avatar (Yowie) read that way by accident. Every avatar uses the plain
// pupil+highlight style now, on purpose, so none of them can read as a
// human face regardless of body colour.
export interface Avatar {
  id: string;
  name: string;
  accent: string; // also used for the small identity dot next to posts
  svg: string; // viewBox "0 0 64 64"
}

export const AVATARS: Avatar[] = [
  {
    id: "bunyip",
    name: "Bunyip",
    accent: "#2a6f6f",
    svg: `
      <ellipse cx="32" cy="38" rx="22" ry="18" fill="#2a6f6f" />
      <path d="M14 30 Q8 24 4 26 Q10 34 16 34 Z" fill="#2a6f6f" />
      <path d="M50 30 Q56 24 60 26 Q54 34 48 34 Z" fill="#2a6f6f" />
      <circle cx="25" cy="37" r="3.6" fill="#0c1716" />
      <circle cx="41" cy="37" r="3.6" fill="#0c1716" />
      <circle cx="23.7" cy="35.7" r="1.1" fill="#fff" />
      <circle cx="39.7" cy="35.7" r="1.1" fill="#fff" />
      <path d="M24 50 Q32 56 40 50" stroke="#0c1716" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M20 48 L16 56 M44 48 L48 56" stroke="#e8d9a0" stroke-width="3" stroke-linecap="round" />
    `,
  },
  {
    id: "drop-bear",
    name: "Drop Bear",
    accent: "#8a5a3c",
    svg: `
      <circle cx="32" cy="40" r="20" fill="#8a5a3c" />
      <circle cx="14" cy="26" r="9" fill="#8a5a3c" />
      <circle cx="50" cy="26" r="9" fill="#8a5a3c" />
      <circle cx="14" cy="26" r="4" fill="#3f291c" />
      <circle cx="50" cy="26" r="4" fill="#3f291c" />
      <circle cx="25" cy="39" r="3.6" fill="#1a0f08" />
      <circle cx="41" cy="39" r="3.6" fill="#1a0f08" />
      <circle cx="23.7" cy="37.7" r="1.1" fill="#fff" />
      <circle cx="39.7" cy="37.7" r="1.1" fill="#fff" />
      <ellipse cx="32" cy="48" rx="5" ry="3.5" fill="#3f291c" />
      <path d="M26 52 L29 56 M38 52 L35 56" stroke="#201208" stroke-width="2" stroke-linecap="round" />
      <path d="M22 50 L18 55 M20 46 L15 49 M42 50 L46 55 M44 46 L49 49" stroke="#efe6da" stroke-width="2" stroke-linecap="round" />
    `,
  },
  {
    id: "yowie",
    name: "Yowie",
    accent: "#5c6b4a",
    svg: `
      <!-- a rounder, visibly-furry silhouette (jagged tufts, not a smooth
           face outline) in a grey-green, away from any skin-tone reading -->
      <path d="M32 12 C16 12 10 24 11 36 C8 38 8 44 12 45 C13 53 21 58 32 58 C43 58 51 53 52 45 C56 44 56 38 53 36 C54 24 48 12 32 12 Z" fill="#5c6b4a" />
      <path d="M18 18 l-3 -4 M24 14 l-2 -5 M40 14 l2 -5 M46 18 l3 -4" stroke="#44512f" stroke-width="2.5" stroke-linecap="round" />
      <circle cx="24" cy="36" r="3.6" fill="#13170c" />
      <circle cx="40" cy="36" r="3.6" fill="#13170c" />
      <circle cx="22.7" cy="34.7" r="1.1" fill="#fff" />
      <circle cx="38.7" cy="34.7" r="1.1" fill="#fff" />
      <path d="M24 47 Q32 52 40 47" stroke="#13170c" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M27 47 l1.5 4 M37 47 l-1.5 4" stroke="#fff" stroke-width="2" stroke-linecap="round" />
    `,
  },
  {
    id: "min-min-light",
    name: "Min Min Light",
    accent: "#e3b23c",
    svg: `
      <circle cx="32" cy="32" r="14" fill="#fff6d8" />
      <circle cx="32" cy="32" r="20" fill="#e3b23c" opacity="0.35" />
      <circle cx="32" cy="32" r="26" fill="#e3b23c" opacity="0.15" />
      <circle cx="27" cy="29" r="3" fill="#3a2a05" />
      <circle cx="37" cy="29" r="3" fill="#3a2a05" />
      <circle cx="25.9" cy="27.9" r="1" fill="#fff6d8" />
      <circle cx="35.9" cy="27.9" r="1" fill="#fff6d8" />
      <path d="M26 38 Q32 43 38 38" stroke="#3a2a05" stroke-width="2.2" fill="none" stroke-linecap="round" />
      <path d="M10 14 L14 20 M54 14 L50 20 M10 50 L14 44 M54 50 L50 44" stroke="#e3b23c" stroke-width="2" stroke-linecap="round" />
    `,
  },
  {
    id: "hoop-snake",
    name: "Hoop Snake",
    accent: "#3f7d3f",
    svg: `
      <circle cx="32" cy="32" r="20" fill="none" stroke="#3f7d3f" stroke-width="9" />
      <circle cx="18" cy="20" r="8" fill="#3f7d3f" />
      <circle cx="16" cy="19" r="2.1" fill="#0d1f0d" />
      <circle cx="21" cy="19" r="2.1" fill="#0d1f0d" />
      <circle cx="15.3" cy="18.3" r="0.7" fill="#fff" />
      <circle cx="20.3" cy="18.3" r="0.7" fill="#fff" />
      <path d="M16 24 Q18 27 20 24" stroke="#0d1f0d" stroke-width="1.6" fill="none" stroke-linecap="round" />
      <path d="M12 14 L8 10" stroke="#d6453f" stroke-width="2" stroke-linecap="round" />
    `,
  },
  {
    id: "yara-ma",
    name: "Yara-ma-yha-who",
    accent: "#c1443b",
    svg: `
      <circle cx="32" cy="34" r="18" fill="#c1443b" />
      <circle cx="18" cy="46" r="5" fill="#c1443b" />
      <circle cx="46" cy="46" r="5" fill="#c1443b" />
      <circle cx="18" cy="46" r="2.3" fill="#7a211b" />
      <circle cx="46" cy="46" r="2.3" fill="#7a211b" />
      <circle cx="26" cy="32" r="3.6" fill="#2a0a07" />
      <circle cx="40" cy="32" r="3.6" fill="#2a0a07" />
      <circle cx="24.7" cy="30.7" r="1.1" fill="#fff" />
      <circle cx="38.7" cy="30.7" r="1.1" fill="#fff" />
      <ellipse cx="32" cy="44" rx="6" ry="4" fill="#7a211b" />
    `,
  },
];

export const AVATAR_IDS = AVATARS.map((a) => a.id);

export function avatarById(id: string): Avatar | undefined {
  return AVATARS.find((a) => a.id === id);
}
