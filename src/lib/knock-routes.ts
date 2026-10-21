// The one handler behind the three "answer a knock" routes
// (/api/houses/knocks/{let-in,turn-away,cancel}), so the checks are written
// once. Form-encoded POSTs, like every mutation here: Astro's same-origin
// check only covers form-like or bodyless requests, and a JSON body would
// slip past it. The knock is named by id in a `knock` field.
//
// Who may do what, checked here on the server, never trusted from the page:
//   let in / turn away: a current member of the knock's house. The house is
//     named in the request like every house route (?house= or a `house`
//     field) and goes through houseAccess() (401/400/404/403); a knock that
//     isn't at THAT house's door is a 404, so being a member of one house
//     can't answer knocks at another.
//   cancel: only the person who knocked (403 for anyone else).
// Answering a knock that's already been answered is a no-op: 200 with
// changed:false, nothing logged, nothing broadcast, no membership touched.
//
// Responds with JSON to a fetch() that asks for it (the page's buttons),
// and with a 303 back to where the person was otherwise (the no-JS form).
import type { APIContext } from "astro";
import { eq } from "drizzle-orm";
import { logAction } from "./audit";
import { db } from "./db";
import { broadcast, tellPerson } from "./events";
import { houseAccess, type House } from "./houses";
import { currentPerson, type Person } from "./identity";
import { answerKnock, doorKnock, knockById } from "./knocks";
import { houses } from "./schema";

type Answer = "let_in" | "turned_away" | "cancelled";

const ACTION: Record<Answer, string> = {
  let_in: "house_let_in",
  turned_away: "house_turn_away",
  cancelled: "house_knock_cancel",
};

function houseById(id: number): House | undefined {
  return db
    .select({ id: houses.id, slug: houses.slug, name: houses.name, inviteCode: houses.inviteCode })
    .from(houses)
    .where(eq(houses.id, id))
    .get();
}

export async function answerKnockRoute(
  { request, cookies, url, redirect }: APIContext,
  outcome: Answer,
): Promise<Response> {
  const form = await request.formData().catch(() => null);
  if (!form) return new Response("expected a form-encoded body", { status: 400 });
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  const knockId = Number(form.get("knock") ?? "");

  let house: House | undefined;
  let person: Person | null;
  if (outcome === "cancelled") {
    person = currentPerson(cookies);
    if (!person) return new Response("log in first", { status: 401 });
  } else {
    const access = houseAccess(cookies, url, form);
    if (access instanceof Response) return access;
    ({ person, house } = access);
  }

  const knock = knockById(knockId);
  if (!knock || (house && knock.houseId !== house.id)) return new Response("no such knock", { status: 404 });
  if (outcome === "cancelled" && knock.personId !== person.id) {
    return new Response("only the person who knocked can walk away", { status: 403 });
  }
  house ??= houseById(knock.houseId);
  if (!house) return new Response("no such house", { status: 404 });

  const back = outcome === "cancelled" ? "/houses" : `/h/${encodeURIComponent(house.slug)}`;
  const knocker = doorKnock(knock.id);
  const changed = answerKnock(knock, outcome, person.id);

  if (changed) {
    const who = knocker?.name ?? knock.personId;
    logAction(person, ACTION[outcome], `house=${house.slug} knocker=${who} knock=${knock.id}`);
    broadcast(house.id, {
      type: "knock_answered",
      data: { id: knock.id, name: who, outcome, by: outcome === "cancelled" ? null : person.name },
    });
    tellPerson(knock.personId, {
      type: "my_knock",
      data: { id: knock.id, outcome, houseSlug: house.slug, houseName: house.name },
    });
  }

  if (wantsJson) {
    const now = knockById(knock.id);
    return new Response(JSON.stringify({ changed, outcome: now?.outcome ?? outcome }), {
      headers: { "content-type": "application/json" },
    });
  }
  return redirect(back, 303);
}
