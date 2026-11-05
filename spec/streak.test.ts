import { describe, expect, inject, it } from "vitest";
import {
  flairHtml,
  STREAK_BONUS_CAP,
  streakBadgeHtml,
  streakBonus,
  streakFromWeeks,
  streakLine,
} from "../src/lib/levels";
import { canberraWeekStart, canberraWeekStarts } from "../src/lib/week";
import { createHouse, signup, uniqueName } from "./auth-helpers";

// The weekly streak (PROCESS.md, "Weekly streaks, not daily ones"). Most of
// this is the week arithmetic, checked directly against src/lib/week.ts and
// src/lib/levels.ts --- both pure, no database --- because the server can't
// be made to live through a gap week or a DST switch inside a test run. The
// last test checks the running app wires it up.

const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);

// The same bucketing the SQL CASE in activity.ts's streaksFor() does: the
// first (newest) week start at or before the timestamp gives its index.
function weekIndexes(timestamps: number[], nowSeconds: number): Set<number> {
  const starts = canberraWeekStarts(nowSeconds, 52);
  const set = new Set<number>();
  for (const t of timestamps) {
    const i = starts.findIndex((s) => t >= s);
    if (i >= 0) set.add(i);
  }
  return set;
}
const streakAt = (timestamps: number[], now: string) => streakFromWeeks(weekIndexes(timestamps, at(now)));

describe("Canberra week starts", () => {
  it("is Monday 00:00 Canberra time (AEDT, UTC+11) in summer", () => {
    // Thu 5 Nov 2026, 15:00 Canberra = 04:00Z
    expect(canberraWeekStart(at("2026-11-05T04:00:00Z"))).toBe(at("2026-11-01T13:00:00Z"));
  });

  it("is Monday 00:00 Canberra time (AEST, UTC+10) in winter", () => {
    expect(canberraWeekStart(at("2026-07-15T02:00:00Z"))).toBe(at("2026-07-12T14:00:00Z"));
  });

  it("puts Monday 00:00 itself in the new week and Sunday 23:59 in the old one", () => {
    const monday = at("2026-11-01T13:00:00Z");
    expect(canberraWeekStart(monday)).toBe(monday);
    expect(canberraWeekStart(monday - 60)).toBe(at("2026-10-25T13:00:00Z"));
    // Sunday evening in UTC is already Monday in Canberra
    expect(canberraWeekStart(at("2026-11-01T13:30:00Z"))).toBe(monday);
  });

  it("is exact across the April DST end (a 169-hour week)", () => {
    // clocks go back 3am -> 2am on Sun 5 Apr 2026
    const start = at("2026-03-29T13:00:00Z"); // Mon 30 Mar 00:00 AEDT
    const next = at("2026-04-05T14:00:00Z"); // Mon 6 Apr 00:00 AEST
    expect(next - start).toBe(169 * 3600);
    // Sun 5 Apr, 02:30 in the repeated hour (once AEDT, once AEST)
    expect(canberraWeekStart(at("2026-04-04T15:30:00Z"))).toBe(start);
    expect(canberraWeekStart(at("2026-04-04T16:30:00Z"))).toBe(start);
    expect(canberraWeekStart(next - 1)).toBe(start);
    expect(canberraWeekStart(next)).toBe(next);
    expect(canberraWeekStarts(at("2026-04-08T00:00:00Z"), 2)).toEqual([next, start]);
  });

  it("is exact across the October DST start (a 167-hour week)", () => {
    // clocks go forward 2am -> 3am on Sun 4 Oct 2026
    const start = at("2026-09-27T14:00:00Z"); // Mon 28 Sep 00:00 AEST
    const next = at("2026-10-04T13:00:00Z"); // Mon 5 Oct 00:00 AEDT
    expect(next - start).toBe(167 * 3600);
    expect(canberraWeekStart(at("2026-10-03T16:30:00Z"))).toBe(start); // Sun 4 Oct, 03:30 AEDT
    expect(canberraWeekStart(next - 1)).toBe(start);
    expect(canberraWeekStart(next)).toBe(next);
    expect(canberraWeekStarts(at("2026-10-07T00:00:00Z"), 3)).toEqual([next, start, at("2026-09-20T14:00:00Z")]);
  });

  it("steps back a whole year of weeks, each exactly one Monday apart", () => {
    const starts = canberraWeekStarts(at("2026-11-05T04:00:00Z"), 52);
    expect(starts).toHaveLength(52);
    for (const [i, s] of starts.entries()) {
      expect(canberraWeekStart(s)).toBe(s);
      if (i > 0) expect([167, 168, 169].map((h) => h * 3600)).toContain(starts[i - 1] - s);
    }
  });
});

describe("the streak", () => {
  const now = "2026-11-05T04:00:00Z"; // Thu, week of Mon 2 Nov

  it("counts consecutive weeks ending this week", () => {
    const ts = ["2026-11-03T01:00:00Z", "2026-10-28T01:00:00Z", "2026-10-21T01:00:00Z"].map(at);
    expect(streakAt(ts, now)).toBe(3);
  });

  it("counts a week with one day in it the same as a week with seven", () => {
    const busy = [0, 1, 2, 3, 4, 5, 6].map((d) => at("2026-10-26T01:00:00Z") + d * 86400);
    expect(streakAt([...busy, at("2026-11-03T01:00:00Z")], now)).toBe(2);
  });

  it("keeps last week's streak alive while this week has nothing yet", () => {
    const ts = ["2026-10-28T01:00:00Z", "2026-10-21T01:00:00Z"].map(at);
    expect(streakAt(ts, now)).toBe(2);
    // ... right up to Sunday 23:59 Canberra time
    expect(streakFromWeeks(weekIndexes(ts, at("2026-11-08T12:59:00Z")))).toBe(2);
    // and Monday 00:00 ends it: last week (26 Oct) is now two weeks ago
    expect(streakFromWeeks(weekIndexes(ts, at("2026-11-08T13:00:00Z")))).toBe(0);
  });

  it("is broken by a gap week", () => {
    // this week, (gap: 26 Oct), 19 Oct, 12 Oct
    const ts = ["2026-11-03T01:00:00Z", "2026-10-21T01:00:00Z", "2026-10-14T01:00:00Z"].map(at);
    expect(streakAt(ts, now)).toBe(1);
  });

  it("splits weeks at Canberra's Monday midnight, not UTC's", () => {
    // Sun 1 Nov 23:30 Canberra (12:30Z) and Mon 2 Nov 00:30 Canberra (13:30Z)
    const ts = [at("2026-11-01T12:30:00Z"), at("2026-11-01T13:30:00Z")];
    expect(streakAt(ts, now)).toBe(2);
  });

  it("runs through a DST-switch week without a gap", () => {
    // one visit a week across the April switch: Wed 25 Mar, Sun 5 Apr
    // 23:00 AEST (13:00Z, the long week's last hour), Wed 8 Apr
    const ts = ["2026-03-25T01:00:00Z", "2026-04-05T13:00:00Z", "2026-04-08T01:00:00Z"].map(at);
    expect(streakAt(ts, "2026-04-09T01:00:00Z")).toBe(3);
    // and across October's: Wed 23 Sep, Sun 4 Oct 23:30 AEDT (12:30Z, the
    // short week's last half hour), Mon 5 Oct 00:30 AEDT (13:30Z) --- the
    // last two are an hour apart but in different weeks
    const oct = ["2026-09-23T01:00:00Z", "2026-10-04T12:30:00Z", "2026-10-04T13:30:00Z"].map(at);
    expect(streakAt(oct, "2026-10-07T01:00:00Z")).toBe(3);
    // and two visits in the same DST week are still one week
    const same = ["2026-09-28T01:00:00Z", "2026-10-04T12:30:00Z"].map(at);
    expect(weekIndexes(same, at("2026-10-07T01:00:00Z"))).toEqual(new Set([1]));
  });

  it("is zero with nothing, and one week is not shown", () => {
    expect(streakAt([], now)).toBe(0);
    expect(streakBadgeHtml(1)).toBe("");
    expect(streakBadgeHtml(2)).toContain(">2</span>");
  });
});

describe("the bonus and the badge", () => {
  it("adds +1 per week from 2 weeks, capped at +8", () => {
    expect([0, 1, 2, 3, 8, 9, 30].map(streakBonus)).toEqual([0, 0, 2, 3, 8, 8, 8]);
    expect(STREAK_BONUS_CAP).toBe(8);
  });

  it("puts the flame after the level badge, so the ring still finds the avatar first", () => {
    const html = flairHtml(3, "<i>face</i>", 4);
    expect(html.startsWith('<span class="lvl-flair" data-level="3" data-streak="4"><i>face</i><span class="lvl-badge"')).toBe(
      true,
    );
    expect(html).toContain('aria-label="4-week streak"');
    expect(flairHtml(3, "<i>face</i>", "<script>")).not.toContain("<script>");
  });

  it("says whether this week has counted yet", () => {
    expect(streakLine(3, true)).toContain("this week: ✓ counted");
    expect(streakLine(3, false)).toContain("this week: not yet");
    expect(streakLine(3, true)).toContain("+3 pts");
    expect(streakLine(0, false)).toContain("no streak yet");
  });
});

const baseUrl = inject("baseUrl");

describe("on the running app", () => {
  it("counts this week as soon as someone shows up, without changing their points", async () => {
    const cookie = await signup(baseUrl, uniqueName("Streak"));
    const slug = await createHouse(baseUrl, cookie, "Streak House");
    const html = await (await fetch(new URL(`/h/${encodeURIComponent(slug)}`, baseUrl), { headers: { cookie } })).text();
    expect(html).toContain('id="level-streak"');
    expect(html).toContain("this week: ✓ counted");
    const level = (await (await fetch(new URL("/api/level", baseUrl), { headers: { cookie } })).json()) as {
      level: number;
      points: number;
      streak: number;
      countedThisWeek: boolean;
    };
    // a brand-new account: one week, so no flame and no bonus yet
    expect(level).toMatchObject({ level: 1, points: 0, streak: 1, countedThisWeek: true });
  });
});
