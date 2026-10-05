// Compress photos in the browser before they ever leave it. The server runs
// on a 256MB box with no image library installed on purpose --- resizing
// server-side, concurrently, on a box that small is the kind of thing that
// quietly OOMs. A canvas resize is cheap and runs on the visitor's device
// instead.
const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // no canvas support: ship the original rather than fail
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", QUALITY);
  });
}

const form = document.querySelector<HTMLFormElement>("#compose-form");
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  const fileInput = form.querySelector<HTMLInputElement>('input[name="images"]');
  const out = new FormData(form);
  out.delete("images");

  const files = Array.from(fileInput?.files ?? []);
  for (const file of files) {
    const compressed = await compressImage(file);
    out.append("images", compressed, file.name.replace(/\.\w+$/, ".jpg"));
  }

  try {
    const res = await fetch(form.action, { method: "POST", body: out });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    const message = await res.text();
    alert(`couldn't post: ${message}`);
  } catch {
    alert("couldn't post: network error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});
