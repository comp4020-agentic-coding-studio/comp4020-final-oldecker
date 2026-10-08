// Chosen once at join, instead of a colour swatch --- doubles as the
// identity shown in the live "who's here" presence strip (see
// src/pages/api/events.ts and src/scripts/live.ts). Six Australian
// cryptids/folklore monsters, drawn as simple flat blobs: big eyes, one or
// two signature features, nothing that needs more than a handful of SVG
// primitives to read clearly at presence-strip size (~28px).
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
      <ellipse cx="24" cy="36" rx="6" ry="7" fill="#fff" />
      <ellipse cx="40" cy="36" rx="6" ry="7" fill="#fff" />
      <circle cx="25" cy="38" r="3" fill="#122" />
      <circle cx="41" cy="38" r="3" fill="#122" />
      <path d="M24 50 Q32 56 40 50" stroke="#123" stroke-width="2.5" fill="none" stroke-linecap="round" />
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
      <ellipse cx="24" cy="38" rx="5.5" ry="6.5" fill="#fff" />
      <ellipse cx="40" cy="38" rx="5.5" ry="6.5" fill="#fff" />
      <circle cx="25" cy="40" r="2.8" fill="#201208" />
      <circle cx="41" cy="40" r="2.8" fill="#201208" />
      <ellipse cx="32" cy="48" rx="5" ry="3.5" fill="#3f291c" />
      <path d="M26 52 L29 56 M38 52 L35 56" stroke="#201208" stroke-width="2" stroke-linecap="round" />
      <path d="M22 50 L18 55 M20 46 L15 49 M42 50 L46 55 M44 46 L49 49" stroke="#efe6da" stroke-width="2" stroke-linecap="round" />
    `,
  },
  {
    id: "yowie",
    name: "Yowie",
    accent: "#6b4423",
    svg: `
      <path d="M32 10 C14 10 10 26 12 40 C13 52 20 58 32 58 C44 58 51 52 52 40 C54 26 50 10 32 10 Z" fill="#6b4423" />
      <path d="M12 40 q-6 2 -6 -4 q4 -2 7 1 Z M52 40 q6 2 6 -4 q-4 -2 -7 1 Z" fill="#6b4423" />
      <ellipse cx="24" cy="36" rx="5.5" ry="6.5" fill="#fff" />
      <ellipse cx="40" cy="36" rx="5.5" ry="6.5" fill="#fff" />
      <circle cx="24" cy="38" r="2.8" fill="#1a0f05" />
      <circle cx="40" cy="38" r="2.8" fill="#1a0f05" />
      <path d="M25 48 Q32 53 39 48" stroke="#1a0f05" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M18 20 q4 -4 8 -2 M46 20 q-4 -4 -8 -2" stroke="#4a2f17" stroke-width="2.5" fill="none" stroke-linecap="round" />
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
      <circle cx="27" cy="29" r="3.2" fill="#3a2a05" />
      <circle cx="37" cy="29" r="3.2" fill="#3a2a05" />
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
      <ellipse cx="15.5" cy="18" rx="2.3" ry="2.8" fill="#fff" />
      <ellipse cx="20.5" cy="18" rx="2.3" ry="2.8" fill="#fff" />
      <circle cx="15.5" cy="19" r="1.2" fill="#0d1f0d" />
      <circle cx="20.5" cy="19" r="1.2" fill="#0d1f0d" />
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
      <ellipse cx="25" cy="32" rx="6" ry="7" fill="#fff" />
      <ellipse cx="39" cy="32" rx="6" ry="7" fill="#fff" />
      <circle cx="26" cy="34" r="3" fill="#2a0a07" />
      <circle cx="40" cy="34" r="3" fill="#2a0a07" />
      <ellipse cx="32" cy="44" rx="6" ry="4" fill="#7a211b" />
    `,
  },
];

export const AVATAR_IDS = AVATARS.map((a) => a.id);

export function avatarById(id: string): Avatar | undefined {
  return AVATARS.find((a) => a.id === id);
}
