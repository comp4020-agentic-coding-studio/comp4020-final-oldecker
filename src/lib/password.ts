// Password hashing with Node's built-in scrypt --- no dependency to audit or
// keep patched. Every hash gets its own random 16-byte salt, and the stored
// string carries its own cost parameters, so the cost can be raised later
// without invalidating anyone's existing hash (verify reads the parameters
// back out of the string it's checking, not from a constant).
//
// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384; // 2^14, ~16 MB and tens of ms: Node's default, fine for ~15 people
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  let actual: Buffer;
  try {
    actual = await derive(password, Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }
  // both are the same length by construction (we asked scrypt for exactly
  // expected.length bytes), which timingSafeEqual requires
  return timingSafeEqual(actual, expected);
}

// A real hash of a throwaway password, computed once. Logging in as a name
// that doesn't exist verifies against this instead of returning early, so
// "no such name" and "wrong password" take the same time and a stranger
// can't use response speed to learn which names have accounts.
let dummyHash: Promise<string> | undefined;
export async function dummyVerify(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return verifyPassword(password, await dummyHash);
}
