// The house page's "invite" button: shows the full invite link and copies
// it. The server renders an absolute URL too, but the origin it sees behind
// Fly's proxy isn't necessarily the one people type --- the browser's own
// location.origin is --- so the link is rebuilt here from the house's
// /join/<code> path (data-path), and that one string is both what's shown
// in the box and what goes on the clipboard.
//
// Copying has three tiers, because navigator.clipboard only exists in a
// secure context (https or localhost): the async API; then the old
// execCommand("copy") on the selected input (works over plain http, e.g.
// testing on a phone via a LAN address); then just leaving the text selected
// with a "press and hold to copy" hint. An earlier version stopped at tier
// three without telling anyone: the clipboard silently kept whatever had been
// copied before, which read as "it copies the wrong link".
const button = document.querySelector<HTMLButtonElement>("#invite-button");
const panel = document.querySelector<HTMLElement>("#invite-panel");
const input = document.querySelector<HTMLInputElement>("#invite-link");
const copy = document.querySelector<HTMLButtonElement>("#invite-copy");
const statusEl = document.querySelector<HTMLElement>("#invite-status");

const inviteUrl = () => new URL(input?.dataset.path ?? "", window.location.origin).toString();

if (input) input.value = inviteUrl();

function selectLink(): void {
  if (!input) return;
  input.focus();
  input.select();
  // iOS Safari ignores select() on a readonly input without an explicit range
  input.setSelectionRange(0, input.value.length);
}

let resetTimer: ReturnType<typeof setTimeout> | undefined;
function say(label: string, message: string): void {
  if (copy) copy.textContent = label;
  if (statusEl) statusEl.textContent = message;
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    if (copy) copy.textContent = "copy";
    if (statusEl) statusEl.textContent = "";
  }, 2000);
}

async function copyLink(): Promise<boolean> {
  const url = inviteUrl();
  if (input) input.value = url;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // fall through to execCommand
  }
  selectLink();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

button?.addEventListener("click", () => {
  if (!panel) return;
  panel.hidden = !panel.hidden;
  button.setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden) selectLink();
});

input?.addEventListener("focus", () => input.select());

copy?.addEventListener("click", async () => {
  if (await copyLink()) {
    say("copied!", "Invite link copied.");
  } else {
    selectLink();
    say("selected", "Couldn't copy automatically. The link is selected: press and hold, then choose copy.");
  }
});
