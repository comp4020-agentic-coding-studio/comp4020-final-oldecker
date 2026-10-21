// The build-your-own face avatar: a flat, Bitmoji-ish head-and-shoulders
// drawn from layers on a 64x64 viewBox. One central renderer used by the
// server (index.astro) AND client scripts (live.ts, party-dom.ts, the
// editor) --- so no node/server imports here, ever.
//
// STORAGE. A face is a handful of small integers (an index into each option
// list below), stored as a compact JSON string in the existing
// people.avatar text column --- no schema change, no migration:
//   {"bg":2,"sk":3,"hc":1,"hs":4,"br":2,"ey":0,"mo":1,"bd":0,"gl":0,"ex":0,"of":5}
// Because only indices are stored, the SVG is built purely from constants in
// this file: nothing user-controlled is ever interpolated into markup, so
// there is no injection surface even though renderAvatarSvg() output goes
// through set:html / innerHTML. parseAvatar() is the one gatekeeper: it
// rejects anything that isn't exactly this shape (wrong keys, non-integers,
// out-of-range indices, > MAX_AVATAR_LENGTH chars).
//
// LEGACY VALUES. Rows created before this feature hold a creature id like
// "bunyip". renderAvatarSvg() still draws those with the old creature art
// from avatars.ts (kept for that purpose only --- nobody can *choose* a
// creature any more), so old posts and presence look exactly as they did.
// Anything else unrecognised (corrupt/empty value) renders a neutral default
// face rather than nothing.
//
// EYE STYLING, deliberately. avatars.ts's header documents a past mistake: a
// white oval "sclera" under a dark pupil on a dark fill reads as blackface
// caricature. Every eye style here is dark ink marks (dots, ovals, arcs) with
// at most a tiny highlight --- never a white eye-shape --- and mouths are a
// plain ink line or dark open shape, never a contrasting ring of lip colour.
// The same features are drawn identically on every skin tone; skin tone only
// changes the skin fills (and a slightly deeper shade for neck/ears), so no
// combination can turn into a caricature.
import { avatarById } from "./avatars";

export interface FaceConfig {
  bg: number; // backdrop colour
  sk: number; // skin
  hc: number; // hair colour
  hs: number; // hairstyle
  br: number; // eyebrows
  ey: number; // eyes
  mo: number; // mouth
  bd: number; // facial hair
  gl: number; // glasses
  ex: number; // extras: hats, earrings, etc.
  of: number; // outfit colour (shirt, and hat/headband colour)
}

export type FaceKey = keyof FaceConfig;
export const FACE_KEYS: FaceKey[] = ["bg", "sk", "hc", "hs", "br", "ey", "mo", "bd", "gl", "ex", "of"];
export const MAX_AVATAR_LENGTH = 200;

// --- option data -----------------------------------------------------------

const BACKDROPS = ["#cfe8f7", "#fbe3b5", "#d7efd0", "#f6cfd8", "#dcd2f2", "#f9d7c1", "#c7ece6", "#e4e6ea"];
const BACKDROP_NAMES = ["sky", "sand", "mint", "rose", "lavender", "peach", "teal", "grey"];

// base, shade (neck/ears/nose), ink (mouth). A realistic spread, light to deep.
const SKINS: Array<{ base: string; shade: string; ink: string }> = [
  { base: "#f9dfcb", shade: "#e9bda2", ink: "#8a3b36" },
  { base: "#f2cba8", shade: "#dca983", ink: "#82362f" },
  { base: "#e3b085", shade: "#c98f64", ink: "#7a2f28" },
  { base: "#cf9566", shade: "#b0774c", ink: "#6e2823" },
  { base: "#b3794b", shade: "#935f37", ink: "#4d1a14" },
  { base: "#94603a", shade: "#764a2a", ink: "#3a110d" },
  { base: "#764628", shade: "#5b351d", ink: "#2a0b08" },
  { base: "#5c351f", shade: "#452613", ink: "#1f0805" },
];
const SKIN_NAMES = ["porcelain", "fair", "light tan", "tan", "caramel", "brown", "deep brown", "espresso"];

// base, dark (eyebrows/stubble/shading). Includes a few playful dyed colours.
const HAIRS: Array<{ base: string; dark: string }> = [
  { base: "#1f1a17", dark: "#0f0c0a" },
  { base: "#43291a", dark: "#2a180e" },
  { base: "#7a4c2b", dark: "#553219" },
  { base: "#9b3e22", dark: "#6e2814" },
  { base: "#c4642c", dark: "#8d4318" },
  { base: "#dcb25f", dark: "#a67f33" },
  { base: "#b9bcc4", dark: "#7e828d" },
  { base: "#e0679c", dark: "#a8416f" },
  { base: "#3f6fd1", dark: "#274a99" },
  { base: "#7d52c9", dark: "#553391" },
];
const HAIR_COLOUR_NAMES = ["black", "dark brown", "brown", "auburn", "ginger", "blonde", "silver", "pink", "blue", "purple"];

const OUTFITS = ["#2f6f9f", "#c1443b", "#3f7d3f", "#e3b23c", "#7a4bc2", "#2b2b33", "#ece6dc", "#d9619b"];
const OUTFIT_NAMES = ["blue", "red", "green", "mustard", "purple", "black", "cream", "pink"];

const HAIRSTYLE_NAMES = ["bald", "buzz", "short", "quiff", "long", "curly", "afro", "bun", "mullet", "receding", "thinning", "horseshoe", "shaved"];
const BROW_NAMES = ["none", "straight", "arched", "thick", "raised"];
const EYE_NAMES = ["dots", "big", "happy", "sleepy", "wink", "tall"];
const MOUTH_NAMES = ["smile", "grin", "neutral", "open", "smirk", "tongue", "sad"];
const BEARD_NAMES = ["clean", "stubble", "moustache", "beard"];
const GLASSES_NAMES = ["none", "round", "square", "shades", "tinted"];
const EXTRA_NAMES = ["none", "beanie", "cap", "headband", "earrings", "flower", "headphones", "party hat"];

const INK = "#1c1410"; // eyes/brows ink, same on every skin (see header comment)

export interface FaceGroup {
  key: FaceKey;
  label: string;
  kind: "swatch" | "style";
  names: string[]; // one per option, for tooltips/aria
  colors?: string[]; // swatch groups only
  view?: string; // style groups: viewBox zoomed on the relevant feature
}

// Drives the editor UI (order = display order), so adding an option here
// shows up there with no extra wiring.
export const FACE_GROUPS: FaceGroup[] = [
  { key: "sk", label: "skin", kind: "swatch", names: SKIN_NAMES, colors: SKINS.map((s) => s.base) },
  { key: "hs", label: "hairstyle", kind: "style", names: HAIRSTYLE_NAMES, view: "0 0 64 64" },
  { key: "hc", label: "hair colour", kind: "swatch", names: HAIR_COLOUR_NAMES, colors: HAIRS.map((h) => h.base) },
  { key: "ey", label: "eyes", kind: "style", names: EYE_NAMES, view: "12 18 40 26" },
  { key: "br", label: "eyebrows", kind: "style", names: BROW_NAMES, view: "12 18 40 26" },
  { key: "mo", label: "mouth", kind: "style", names: MOUTH_NAMES, view: "14 28 36 26" },
  { key: "bd", label: "facial hair", kind: "style", names: BEARD_NAMES, view: "10 22 44 34" },
  { key: "gl", label: "glasses", kind: "style", names: GLASSES_NAMES, view: "12 18 40 26" },
  { key: "ex", label: "extras", kind: "style", names: EXTRA_NAMES, view: "0 0 64 64" },
  { key: "of", label: "outfit", kind: "swatch", names: OUTFIT_NAMES, colors: OUTFITS },
  { key: "bg", label: "backdrop", kind: "swatch", names: BACKDROP_NAMES, colors: BACKDROPS },
];

const COUNTS: Record<FaceKey, number> = {
  bg: BACKDROPS.length,
  sk: SKINS.length,
  hc: HAIRS.length,
  hs: HAIRSTYLE_NAMES.length,
  br: BROW_NAMES.length,
  ey: EYE_NAMES.length,
  mo: MOUTH_NAMES.length,
  bd: BEARD_NAMES.length,
  gl: GLASSES_NAMES.length,
  ex: EXTRA_NAMES.length,
  of: OUTFITS.length,
};

export const DEFAULT_FACE: FaceConfig = { bg: 0, sk: 2, hc: 1, hs: 2, br: 1, ey: 0, mo: 0, bd: 0, gl: 0, ex: 0, of: 0 };

// --- validation / (de)serialising -------------------------------------------

// Strict on purpose: the exact key set, every value an in-range integer, a
// hard length cap. Returns the normalised config, or null for anything else
// (including legacy creature ids --- those go through isLegacyAvatarId).
export function parseAvatar(value: unknown): FaceConfig | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_AVATAR_LENGTH) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (Object.keys(obj).length !== FACE_KEYS.length) return null;
  const out = {} as FaceConfig;
  for (const key of FACE_KEYS) {
    const n = obj[key];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n >= COUNTS[key]) return null;
    out[key] = n;
  }
  return out;
}

// Canonical form (fixed key order), so equal faces store as equal strings.
export function serializeFace(face: FaceConfig): string {
  const out: Record<string, number> = {};
  for (const key of FACE_KEYS) out[key] = face[key];
  return JSON.stringify(out);
}

export function randomFace(rng: () => number = Math.random): FaceConfig {
  const pick = (n: number) => Math.floor(rng() * n);
  const face = {} as FaceConfig;
  for (const key of FACE_KEYS) face[key] = pick(COUNTS[key]);
  // keep random faces mostly "natural": dyed hair, hats and party hats stay
  // possible but rarer, and a hat doesn't need a hairstyle fight.
  if (face.hc >= 7 && rng() < 0.6) face.hc = pick(7);
  if (face.ex !== 4 && rng() < 0.45) face.ex = 0;
  if (face.hs >= 9 && rng() < 0.6) face.hs = pick(9); // balding stages: possible but rarer
  if (face.gl > 0 && rng() < 0.4) face.gl = 0;
  if (face.bd > 0 && rng() < 0.5) face.bd = 0;
  return face;
}

// --- renderer ---------------------------------------------------------------

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * factor);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

// Head: ellipse centred (32,31), rx 15, ry 17 (top y=14, chin y=48).
// Eyes sit at y~31 (x 25.5 / 38.5), brows ~26, mouth ~42.
function hairBack(style: number, c: string): string {
  switch (style) {
    case 4: // long
      return `<path d="M14.5 34 C11 6 53 6 49.5 34 L53 60 Q32 66 11 60 Z" fill="${c}"/>`;
    case 5: // curly
      return [
        [19, 24, 6.5], [25, 17, 6.5], [32, 14.5, 6.5], [39, 17, 6.5], [45, 24, 6.5],
        [16, 33, 5], [48, 33, 5], [15, 41, 4], [49, 41, 4],
      ]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`)
        .join("");
    case 6: // afro
      return `<circle cx="32" cy="26" r="21.5" fill="${c}"/>`;
    case 8: // modern mullet: the tail. Textured pieces flick out past the ears and jaw and drop to the nape (behind the head and neck layers, above the shoulders)
      return `<path d="M20 26 L15 29.5 L12.4 34.5 L10.6 40.6 L13.6 39.6 L12.6 45.4 L15.8 43.4 L16.4 49.4 L19.6 45.4 L22 50.6 L25 46.6 L27.6 50.4 L32 47 L36.4 50.4 L39 46.6 L42 50.6 L44.4 45.4 L47.6 49.4 L48.2 43.4 L51.4 45.4 L50.4 39.6 L53.4 40.6 L51.6 34.5 L49 29.5 L44 26Z" fill="${c}"/>`;
    case 11: // horseshoe: the hair that is left, wrapping round behind the ears
      return `<path d="M18.2 22.5 C12.6 26 12.4 36.5 16.8 40.6 Q18.2 41.4 19.2 39.6 L19.2 22.5Z M45.8 22.5 C51.4 26 51.6 36.5 47.2 40.6 Q45.8 41.4 44.8 39.6 L44.8 22.5Z" fill="${c}"/>`;
    case 7: // bun
      return `<circle cx="32" cy="9.5" r="6.5" fill="${c}"/>`;
    default:
      return "";
  }
}

// Outer edge for a front-hair shape: an arc that follows the head ellipse
// (centre 32,31, rx 15, ry 17) padded by 0.7, starting/ending at height y0.
// Hair shapes used to draw their own outer curve, which cut inside the head
// outline at the top, so a sliver of skin showed above the hair. Using the
// head's own curve (padded) means the hair always covers the whole crown.
function headCap(y0: number): string {
  const rx = 15.7;
  const ry = 17.7;
  const t = (y0 - 31) / ry;
  const dx = rx * Math.sqrt(1 - t * t);
  return `M${(32 - dx).toFixed(2)} ${y0} A${rx} ${ry} 0 ${y0 > 31 ? 1 : 0} 1 ${(32 + dx).toFixed(2)} ${y0}`;
}

// The faded sides of the modern mullet: hair colour at falling opacity, so the
// skin shows through more and more towards the ear. Kept inside the head
// outline so the ears stay fully visible. Also drawn under a beanie/cap (which
// stop above the ears), via renderFaceSvg.
function mulletSides(c: string): string {
  // a strip hugging the head edge from y0 down to y1, `w` wide, on both sides
  const strip = (y0: number, y1: number, w: number, op: number) => {
    const edge = (y: number) => 15 * Math.sqrt(1 - ((y - 31) / 17) ** 2);
    const ys = [0, 0.25, 0.5, 0.75, 1].map((k) => y0 + (y1 - y0) * k);
    return [-1, 1]
      .map((sd) => {
        const out = ys.map((y) => `${(32 + sd * edge(y)).toFixed(2)} ${y.toFixed(2)}`);
        const inn = ys.map((y) => `${(32 + sd * (edge(y) - w * (1 - 0.35 * ((y - y0) / (y1 - y0))))).toFixed(2)} ${y.toFixed(2)}`).reverse();
        return `<path d="M${out.join(" L")} L${inn.join(" L")}Z" fill="${c}" opacity="${op}"/>`;
      })
      .join("");
  };
  return strip(22, 29, 4.6, 0.85) + strip(22, 33, 3.4, 0.45) + strip(22, 37.5, 2.4, 0.3);
}

function hairFront(style: number, c: string): string {
  switch (style) {
    case 1: // buzz
      return `<path d="${headCap(30)} C45.5 23 40 19.5 32 19.5 C24 19.5 18.5 23 17 30Z" fill="${c}"/>`;
    case 2: // short, side-swept fringe
      return `<path d="${headCap(32)} C46.5 27 44.5 24 41 22.5 C36 25 28.5 24.5 22 21 C19.5 24 17.5 28 16.5 32Z" fill="${c}"/>`;
    case 3: // quiff
      return `<path d="M16.5 31 C12 8 39 0 48.5 13 C50 19 48.5 25 47.5 31 C46 25 44 22 40 20.5 C34 22.5 26 22.5 22 19 C19 22 17.5 26 16.5 31Z" fill="${c}"/>`;
    case 4: // long: centre part
      return `<path d="${headCap(34)} C46.5 26 40.5 20 32 17.5 C23.5 20 17.5 26 15.5 34Z" fill="${c}"/>`;
    case 5: // curly fringe
      // small curls sitting on the head outline so skin never shows between the cloud and the fringe
      return [[18.5, 26, 3.6], [20.5, 20.5, 4.4], [25.5, 16.5, 4.6], [32, 14.8, 4.8], [38.5, 16.5, 4.6], [43.5, 20.5, 4.4], [45.5, 26, 3.6], [24, 21.5, 5], [32, 19.5, 5.5], [40, 21.5, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join("");
    case 6: // afro hairline
      return `<path d="${headCap(29)} C45 23.5 40 21 32 21 C24 21 19 23.5 16.5 29Z" fill="${c}"/>`;
    case 7: // bun: centre-parted cap
      return `<path d="${headCap(32)} C46 25 40.5 20.5 32 18.5 C23.5 20.5 18 25 16.5 32Z" fill="${c}"/>`;
    case 8: // modern mullet: a low, rounded textured crop pushed forward, jagged fringe tips on the forehead, faded sides (see mulletSides)
      return (
        // the crown cap keeps skin from showing above the hair, whatever the clumps do
        `<path d="${headCap(27)} C45.5 22.5 40 19.5 32 19.5 C24 19.5 18.5 22.5 16.9 27Z" fill="${c}"/>` +
        `<path d="M16.2 29 C14.4 22.5 14.8 16.5 18.6 13.4 Q19.6 10.6 23.4 11 Q26 8.8 29.6 10.2 Q33.2 8.4 36.2 10.2 Q39.8 9.2 41.8 11.8 Q45.6 11.8 46.6 15.8 C49.2 19.4 49.6 24.4 47.8 29 L45.8 25.2 L43.4 26 L42.2 22.6 L39.4 25.6 L36.8 22.8 L34.2 26 L31.4 23.2 L28.4 26 L25.8 23 L23.4 25.6 L20.8 23.2 L19 26.4 L17.6 24.6Z" fill="${c}"/>` +
        // texture: short curved strands through the crop
        `<path d="M22.4 13.6 Q21.4 16.4 22.4 19 M28.6 12.2 Q27.6 15.4 28.6 18.6 M35.4 12.2 Q34.6 15.2 35.6 18.4 M41.6 14 Q40.8 16.6 41.6 19.2" stroke="#000" stroke-opacity="0.2" stroke-width="1.1" stroke-linecap="round" fill="none"/>` +
        `<path d="M25.4 12 Q24.6 14.4 25.2 16.6 M32 11.4 Q31.4 13.8 32 16 M38.6 12.6 Q38 14.6 38.6 16.6" stroke="#fff" stroke-opacity="0.2" stroke-width="1" stroke-linecap="round" fill="none"/>` +
        mulletSides(c)
      );
    // --- balding stages (appended after the mullet: never reorder) ---
    case 9: // receding: M-shaped hairline, temples pulled back, widow's peak
      return `<path d="${headCap(32)} C46.6 27.5 45 23.5 42.5 19.8 Q38.5 18 36.2 20 Q32 24.8 27.8 20 Q25.5 18 21.5 19.8 C19 23.5 17.4 27.5 16.3 32Z" fill="${c}"/>`;
    case 10: // thinning crown: hair kept round the front and sides, bald patch on top (the hole shows the head)
      return `<path fill-rule="evenodd" d="${headCap(32)} C46.5 27.5 44.5 25 41 24 C36 25.6 28.5 25.6 23 24 C19.5 25 17.5 28 16.5 32Z M23.8 21.6 C22.8 15.4 41.2 15.4 40.2 21.6 C38.6 23.4 25.4 23.4 23.8 21.6Z" fill="${c}"/>`;
    case 11: // horseshoe: bald on top, a band of hair above each ear (the rest is the back layer)
      return `<path d="M18.4 22.2 C15.2 25.4 14.8 29.2 15.8 31.4 L18.4 30.6 C18 27.6 18.9 25 20.2 23.4Z M45.6 22.2 C48.8 25.4 49.2 29.2 48.2 31.4 L45.6 30.6 C46 27.6 45.1 25 43.8 23.4Z" fill="${c}"/>`;
    case 12: // shaved: a head shaved close, just the shadow of hair where it grew (same trick as stubble, kept inside the head outline)
      return `<path d="M17.02 30 A15 17 0 0 1 46.98 30 C45.5 23 40 19.5 32 19.5 C24 19.5 18.5 23 17.02 30Z" fill="${c}" opacity="0.3"/>`;
    default:
      return "";
  }
}

function eyes(style: number): string {
  const L = 25.5;
  const R = 38.5;
  const dot = (x: number, r: number, hl = true) =>
    `<circle cx="${x}" cy="31" r="${r}" fill="${INK}"/>` +
    (hl ? `<circle cx="${x - r * 0.35}" cy="${31 - r * 0.38}" r="${Math.max(0.7, r * 0.3)}" fill="#fff"/>` : "");
  const arcUp = (x: number) => `<path d="M${x - 3.2} 32.2 Q${x} 27.6 ${x + 3.2} 32.2" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const arcDown = (x: number) => `<path d="M${x - 3.2} 30.6 Q${x} 33.8 ${x + 3.2} 30.6" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  switch (style) {
    case 1:
      return dot(L, 3.3) + dot(R, 3.3);
    case 2:
      return arcUp(L) + arcUp(R);
    case 3:
      return arcDown(L) + arcDown(R);
    case 4:
      return dot(L, 2.7) + arcUp(R);
    case 5: {
      const tall = (x: number) =>
        `<ellipse cx="${x}" cy="31" rx="2.3" ry="3.4" fill="${INK}"/><circle cx="${x - 0.8}" cy="29.6" r="0.9" fill="#fff"/>`;
      return tall(L) + tall(R);
    }
    default:
      return dot(L, 2.8) + dot(R, 2.8);
  }
}

function brows(style: number, c: string): string {
  const line = (d: string, w: number) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  switch (style) {
    case 1:
      return line("M22 26.8 L29 25.8", 2) + line("M35 25.8 L42 26.8", 2);
    case 2:
      return line("M22 27 Q25.5 23.4 29 26", 2) + line("M35 26 Q38.5 23.4 42 27", 2);
    case 3:
      return line("M22 26.6 L29 25.6", 3.4) + line("M35 25.6 L42 26.6", 3.4);
    case 4:
      return line("M22.5 25 Q25.5 21.4 28.5 24", 2) + line("M35.5 24 Q38.5 21.4 41.5 25", 2);
    default:
      return "";
  }
}

function mouth(style: number, ink: string): string {
  const stroke = (d: string) => `<path d="${d}" stroke="${ink}" stroke-width="2.3" fill="none" stroke-linecap="round"/>`;
  switch (style) {
    case 1: // grin
      return `<path d="M26.5 40.5 Q32 41.8 37.5 40.5 Q36.5 47.5 32 47.5 Q27.5 47.5 26.5 40.5Z" fill="#3a0f10"/><path d="M27.6 41.2 Q32 42.2 36.4 41.2 L36 43.4 Q32 44.2 28 43.4Z" fill="#fff"/>`;
    case 2:
      return stroke("M28 43.5 L36 43.5");
    case 3: // open "o"
      return `<ellipse cx="32" cy="43.5" rx="3" ry="3.6" fill="#3a0f10"/><ellipse cx="32" cy="45" rx="1.8" ry="1.3" fill="#d9605f"/>`;
    case 4: // smirk
      return stroke("M28 43.8 Q33 45.4 37 41");
    case 5: // tongue out
      return `<path d="M32 44.5 v3.2 a2.6 2.6 0 0 0 5.2 0 v-4.2Z" fill="#e0707a" transform="translate(-2.6 0)"/>` + stroke("M27 41.5 Q32 46.2 37 41.5");
    case 6: // sad
      return stroke("M28 45 Q32 41.6 36 45");
    default: // smile
      return stroke("M27 41.4 Q32 46.4 37 41.4");
  }
}

// Beard drawn between face and mouth so the mouth reads on top; "full" gets
// a skin-coloured patch around the mouth so it isn't lost in the hair.
function beard(style: number, hair: string, skin: string): string {
  const jaw = "M17.4 35 A15 17 0 0 0 46.6 35";
  switch (style) {
    case 1: // stubble
      return `<path d="${jaw} Q32 39 17.4 35Z" fill="${hair}" opacity="0.28"/>`;
    case 2: // moustache
      return `<path d="M25.5 40.6 Q28.5 37.6 32 39.4 Q35.5 37.6 38.5 40.6 Q35 41.2 32 40.6 Q29 41.2 25.5 40.6Z" fill="${hair}"/>`;
    case 3: // full beard
      return (
        `<path d="${jaw} C44 41 40 38.2 32 38.2 C24 38.2 20 41 17.4 35Z" fill="${hair}"/>` +
        `<ellipse cx="32" cy="43" rx="6.4" ry="3.9" fill="${skin}"/>`
      );
    default:
      return "";
  }
}

function glasses(style: number, outfit: string): string {
  if (style === 0) return "";
  const frame = "#26211e";
  const L = 25.5;
  const R = 38.5;
  const lens = (x: number, shape: "round" | "square", fill: string, op: number) =>
    shape === "round"
      ? `<circle cx="${x}" cy="31.4" r="5.2" fill="${fill}" fill-opacity="${op}" stroke="${frame}" stroke-width="1.7"/>`
      : `<rect x="${x - 5.4}" y="26.6" width="10.8" height="9.2" rx="2.4" fill="${fill}" fill-opacity="${op}" stroke="${frame}" stroke-width="1.7"/>`;
  const bridge = `<path d="M30.7 31 Q32 29.8 33.3 31" stroke="${frame}" stroke-width="1.5" fill="none"/>`;
  const arms = `<path d="M20.2 31 L17.2 30.2 M43.8 31 L46.8 30.2" stroke="${frame}" stroke-width="1.5" stroke-linecap="round"/>`;
  switch (style) {
    case 2:
      return arms + bridge + lens(L, "square", "#fff", 0.12) + lens(R, "square", "#fff", 0.12);
    case 3: // shades: dark, opaque
      return arms + bridge + lens(L, "square", "#15110f", 0.92) + lens(R, "square", "#15110f", 0.92);
    case 4: // tinted round, in the outfit colour
      return arms + bridge + lens(L, "round", outfit, 0.55) + lens(R, "round", outfit, 0.55);
    default:
      return arms + bridge + lens(L, "round", "#fff", 0.12) + lens(R, "round", "#fff", 0.12);
  }
}

function extras(style: number, outfit: string): string {
  const dark = shade(outfit, 0.78);
  switch (style) {
    case 1: // beanie
      return (
        `<path d="M15.5 26 C14 4 50 4 48.5 26Z" fill="${outfit}"/>` +
        `<rect x="14.5" y="22" width="35" height="7" rx="3.2" fill="${dark}"/>` +
        `<circle cx="32" cy="8.6" r="3.4" fill="${dark}"/>`
      );
    case 2: // cap
      return (
        `<path d="M16 25 C14.5 5 49.5 5 48 25Z" fill="${outfit}"/>` +
        `<path d="M13.5 25.2 Q32 20.5 50.5 25.2 Q51 29.4 32 28.2 Q13 29.4 13.5 25.2Z" fill="${dark}"/>`
      );
    case 3: // headband
      return `<path d="M16.2 23 Q32 16.6 47.8 23 L47.4 27.4 Q32 21 16.6 27.4Z" fill="${outfit}"/>`;
    case 4: // gold earrings
      return `<circle cx="16.4" cy="38" r="2.3" fill="none" stroke="#e3b23c" stroke-width="1.6"/><circle cx="47.6" cy="38" r="2.3" fill="none" stroke="#e3b23c" stroke-width="1.6"/>`;
    case 5: // flower tucked above the ear
      return (
        [[0, -3.2], [3.1, -1], [1.9, 2.6], [-1.9, 2.6], [-3.1, -1]]
          .map(([dx, dy]) => `<circle cx="${45 + dx}" cy="${19 + dy}" r="2.6" fill="#f08cb4"/>`)
          .join("") + `<circle cx="45" cy="19" r="1.8" fill="#f7c948"/>`
      );
    case 6: // headphones
      return (
        `<path d="M15.6 33 C14 5 50 5 48.4 33" stroke="${outfit}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        `<rect x="11.4" y="28.5" width="6" height="11" rx="2.8" fill="${dark}"/><rect x="46.6" y="28.5" width="6" height="11" rx="2.8" fill="${dark}"/>`
      );
    case 7: // party hat
      return (
        `<path d="M23.5 19 L33 0.5 L41.5 19 Q32.5 21.4 23.5 19Z" fill="${outfit}"/>` +
        `<path d="M27 12.6 L38 14.2 M25 16.6 L40.2 17.6" stroke="#fff" stroke-width="1.7" stroke-linecap="round" opacity="0.75"/>` +
        `<circle cx="33" cy="1.6" r="2.6" fill="#f7c948"/>`
      );
    default:
      return "";
  }
}

export function renderFaceSvg(face: FaceConfig): string {
  const skin = SKINS[face.sk];
  const hair = HAIRS[face.hc];
  const outfit = OUTFITS[face.of];
  // A beanie/cap covers the front hair; the party hat perches on top of it,
  // and headphones/headband/flower don't cover it at all.
  const hatCovers = face.ex === 1 || face.ex === 2;
  const volume = face.hs === 5 || face.hs === 6;
  // an afro/curly cloud under a snug hat just sticks out like a halo
  const backHair = hatCovers && volume ? "" : hairBack(face.hs, hair.base);

  return [
    `<rect width="64" height="64" fill="${BACKDROPS[face.bg]}"/>`,
    backHair,
    // neck + shoulders
    `<path d="M27 40 h10 v10 q-5 4.4 -10 0Z" fill="${skin.shade}"/>`,
    `<path d="M5 66 C5 55 15 50.4 25 49.4 Q32 53.4 39 49.4 C49 50.4 59 55 59 66Z" fill="${outfit}"/>`,
    `<path d="M25 49.4 Q32 53.4 39 49.4 Q32 58 25 49.4Z" fill="${skin.shade}"/>`,
    // ears, then head
    `<circle cx="17" cy="33.5" r="3.4" fill="${skin.shade}"/><circle cx="47" cy="33.5" r="3.4" fill="${skin.shade}"/>`,
    `<ellipse cx="32" cy="31" rx="15" ry="17" fill="${skin.base}"/>`,
    `<circle cx="21.5" cy="38" r="2.8" fill="#e8746a" opacity="0.2"/><circle cx="42.5" cy="38" r="2.8" fill="#e8746a" opacity="0.2"/>`,
    `<path d="M31 34.6 Q32.2 37 34.2 36.4" stroke="${skin.shade}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    beard(face.bd, hair.base, skin.base),
    mouth(face.mo, skin.ink),
    hatCovers ? (face.hs === 8 ? mulletSides(hair.base) : "") : hairFront(face.hs, hair.base),
    eyes(face.ey),
    brows(face.br, hair.dark),
    glasses(face.gl, outfit),
    extras(face.ex, outfit),
  ].join("");
}

// --- the public entry point --------------------------------------------------

export function isLegacyAvatarId(value: string): boolean {
  return avatarById(value) !== undefined;
}

// Inner markup for <svg viewBox="0 0 64 64">. Always returns something drawable.
export function renderAvatarSvg(avatarValue: string): string {
  const face = parseAvatar(avatarValue);
  if (face) return renderFaceSvg(face);
  const legacy = avatarById(avatarValue);
  if (legacy) return legacy.svg;
  return renderFaceSvg(DEFAULT_FACE);
}
