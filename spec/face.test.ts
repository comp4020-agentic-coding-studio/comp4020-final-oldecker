import { describe, expect, it } from "vitest";
import {
  DEFAULT_FACE,
  FACE_KEYS,
  parseAvatar,
  randomFace,
  serializeFace,
  type FaceConfig,
} from "../src/lib/face";

// Pure logic (no server call needed), but it still runs under the shared
// vitest config/global-setup like every other spec/*.test.ts file.

describe("parseAvatar backward compatibility (ec, the eye-colour key)", () => {
  it("accepts an OLD stored avatar (every key except ec) and defaults ec to 0", () => {
    // Exactly what a row written before eye colour existed holds: the old
    // 11-key shape, no "ec" anywhere.
    const oldStored = JSON.stringify({
      bg: 2,
      sk: 3,
      hc: 1,
      hs: 4,
      br: 2,
      ey: 0,
      mo: 1,
      bd: 0,
      gl: 0,
      ex: 0,
      of: 5,
    });
    const face = parseAvatar(oldStored);
    expect(face).not.toBeNull();
    expect(face!.ec).toBe(0);
    // every other field survives untouched
    expect(face).toMatchObject({
      bg: 2,
      sk: 3,
      hc: 1,
      hs: 4,
      br: 2,
      ey: 0,
      mo: 1,
      bd: 0,
      gl: 0,
      ex: 0,
      of: 5,
    });

    // and the result still round-trips cleanly through serialize -> parse,
    // this time WITH ec explicit, since serializeFace always writes every
    // FACE_KEYS entry.
    const serialized = serializeFace(face!);
    expect(JSON.parse(serialized)).toHaveProperty("ec", 0);
    const reparsed = parseAvatar(serialized);
    expect(reparsed).toEqual(face);
  });

  it("round-trips a NEW avatar with a non-default ec through serialize -> parse", () => {
    const face: FaceConfig = { ...DEFAULT_FACE, ec: 3 };
    const serialized = serializeFace(face);
    const reparsed = parseAvatar(serialized);
    expect(reparsed).toEqual(face);
    expect(reparsed!.ec).toBe(3);
  });

  it("still rejects a config with an unknown/extra key", () => {
    const withExtra = JSON.stringify({ ...DEFAULT_FACE, zz: 0 });
    expect(parseAvatar(withExtra)).toBeNull();
  });

  it("still rejects a config missing an OLD, always-required key (not just ec)", () => {
    const obj: Record<string, number> = { ...DEFAULT_FACE };
    delete obj.sk; // sk predates ec; it must still be required
    expect(parseAvatar(JSON.stringify(obj))).toBeNull();
  });

  it("still rejects an out-of-range value for a key that IS present", () => {
    const tooHigh = JSON.stringify({ ...DEFAULT_FACE, ec: 9999 });
    expect(parseAvatar(tooHigh)).toBeNull();
    const negative = JSON.stringify({ ...DEFAULT_FACE, sk: -1 });
    expect(parseAvatar(negative)).toBeNull();
    const nonInteger = JSON.stringify({ ...DEFAULT_FACE, hc: 1.5 });
    expect(parseAvatar(nonInteger)).toBeNull();
  });

  it("rejects a value with the right key COUNT but a genuinely unrecognised key swapped in for a required one", () => {
    const obj: Record<string, number> = { ...DEFAULT_FACE };
    delete (obj as any).sk;
    (obj as any).sk2 = 0; // same key count as the full 12, but sk is missing and sk2 is unknown
    expect(parseAvatar(JSON.stringify(obj))).toBeNull();
  });
});

describe("randomFace", () => {
  it("never produces an invalid config, across many draws", () => {
    for (let i = 0; i < 500; i++) {
      const face = randomFace();
      const serialized = serializeFace(face);
      const parsed = parseAvatar(serialized);
      expect(parsed).not.toBeNull();
      expect(parsed).toEqual(face);
      for (const key of FACE_KEYS) {
        expect(Number.isInteger(face[key])).toBe(true);
        expect(face[key]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
