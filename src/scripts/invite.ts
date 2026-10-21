// The house page's "invite" button: shows the full invite link and copies
// it. The server renders only the path (/join/<code>), since the origin it
// sees behind Fly's proxy isn't necessarily the one people type --- the
// browser's own location.origin is.
const button = document.querySelector<HTMLButtonElement>("#invite-button");
const panel = document.querySelector<HTMLElement>("#invite-panel");
const input = document.querySelector<HTMLInputElement>("#invite-link");
const copy = document.querySelector<HTMLButtonElement>("#invite-copy");

if (input) input.value = new URL(input.dataset.path ?? "", window.location.origin).toString();

button?.addEventListener("click", () => {
  if (!panel) return;
  panel.hidden = !panel.hidden;
  button.setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden) input?.select();
});

copy?.addEventListener("click", async () => {
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    // clipboard API unavailable (plain http, old browser): select it so a
    // long-press / Ctrl-C does the rest
    input.select();
    copy.textContent = "selected";
    setTimeout(() => (copy.textContent = "copy"), 1500);
    return;
  }
  copy.textContent = "copied";
  setTimeout(() => (copy.textContent = "copy"), 1500);
});
