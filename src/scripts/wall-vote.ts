// Your own ballot in the wipe-the-wall vote: casting it, which also starts
// the vote if none is open yet (there's no separate "start" control --- see
// the house page's markup). Changing your mind while it's open is the same
// click, on the other button. Someone ELSE's ballot, or the vote resolving,
// arrives through live.ts instead --- see wall-vote-dom.ts for the DOM
// update both share.
import { applyWallVoteState, say, type WallVoteState } from "./wall-vote-dom";
import { houseUrl } from "./house-context";

const yesBtn = document.querySelector<HTMLButtonElement>("#wall-vote-yes-btn");
const noBtn = document.querySelector<HTMLButtonElement>("#wall-vote-no-btn");

async function cast(choice: "yes" | "no"): Promise<void> {
  try {
    const res = await fetch(houseUrl("/api/wall/vote"), { method: "POST", body: new URLSearchParams({ choice }) });
    if (!res.ok) {
      say("that didn't go through, try again");
      return;
    }
    const state = (await res.json()) as WallVoteState;
    applyWallVoteState(state, choice);
    if (state.status === "passed") say("more than half the house said yes --- the wall's been wiped!", 6000);
  } catch {
    say("that didn't go through, try again");
  }
}

yesBtn?.addEventListener("click", () => void cast("yes"));
noBtn?.addEventListener("click", () => void cast("no"));
