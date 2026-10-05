// Where post photos land on disk. Compression happens client-side before
// upload (see src/scripts/compress-image.ts) --- the 256MB box doing
// server-side image processing on every upload is the kind of thing that
// quietly OOMs, so the server here just validates size/type and writes
// bytes, nothing more.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const MAX_IMAGES_PER_POST = 3;
// Generous ceiling for an already-compressed client-side image; catches a
// request that skipped compression, not a normal photo.
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const uploadsDir = process.env.UPLOADS_DIR ?? "./data/uploads";

export class UploadRejected extends Error {}

export function saveUpload(file: File): string {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new UploadRejected(`unsupported image type: ${file.type || "unknown"}`);
  if (file.size > MAX_BYTES)
    throw new UploadRejected(`image too large (${Math.round(file.size / 1024)}KB)`);

  mkdirSync(uploadsDir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  return name;
}

export async function writeUpload(name: string, file: File): Promise<void> {
  const bytes = Buffer.from(await file.arrayBuffer());
  writeFileSync(path.join(uploadsDir, name), bytes);
}

export function uploadsPath(name: string): string {
  return path.join(uploadsDir, name);
}
