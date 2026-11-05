// A fixed-calendar-week cutoff for the plant's watering counter (see
// plant.ts) --- Monday 00:00 in Australia/Canberra, not a rolling lookback.
// The Fly machine runs UTC (nothing in this repo sets TZ), so plain
// Date getters/setters don't reflect Canberra time; Intl.DateTimeFormat
// carries the actual AEST/AEDT table, so no date library is needed for
// that part --- hand-rolling the "which day/hour is it there right now"
// read is small enough on its own.
const CANBERRA_TZ = "Australia/Canberra";
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

// Today's date in Canberra as "YYYY-MM-DD" --- the "day" the lieb limit
// (once per sender -> recipient per day, src/lib/lieb.ts) counts in. en-CA
// formats dates ISO-style, so this needs no assembling by hand.
export function canberraDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CANBERRA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function mostRecentCanberraMonday(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CANBERRA_TZ,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const get = (type: string) => fmt.formatToParts(now).find((p) => p.type === type)!.value;
  const hour = Number(get("hour") === "24" ? "0" : get("hour"));
  const daysSinceMonday = WEEKDAY_INDEX[get("weekday")];

  // Subtract Canberra's current hour-of-day to land near local midnight,
  // then whole days back to Monday. Off by up to ~1h on the two DST-switch
  // days a year (23h/25h-long local days) --- acceptable at this app's
  // scale; not worth a bisection for sub-hour precision on those two days.
  const todayMidnightMs = Math.floor((now.getTime() - hour * 60 * 60 * 1000) / (60 * 60 * 1000)) * 60 * 60 * 1000;
  return Math.floor((todayMidnightMs - daysSinceMonday * 24 * 60 * 60 * 1000) / 1000);
}

// --- exact week starts, for the weekly streak (src/lib/levels.ts) ---------
// mostRecentCanberraMonday() above is allowed to be ~1h off on a DST-switch
// day; a streak isn't, because a post at 00:30 on a Monday landing in the
// wrong week would break someone's streak for no reason they could see. So
// this finds the exact instant of local Monday 00:00: read the Canberra
// calendar date, step back to Monday, then turn that wall-clock midnight
// into UTC using Canberra's offset at that midnight (asked of Intl twice, so
// a first guess on the wrong side of a switch corrects itself). Canberra's
// DST switches happen at 2-3am on a Sunday, never at Monday midnight, so
// local Monday 00:00 always exists and is never ambiguous.
const PARTS_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: CANBERRA_TZ,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const DAY_MS = 24 * 60 * 60 * 1000;

function canberraParts(ms: number): { weekday: number; wallMs: number } {
  const parts = PARTS_FMT.formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const hour = Number(get("hour")) % 24; // some engines say "24" at midnight
  return {
    weekday: WEEKDAY_INDEX[get("weekday")],
    // this instant's Canberra wall-clock time, written as if it were UTC
    wallMs: Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), hour, Number(get("minute")), Number(get("second"))),
  };
}

// Canberra's UTC offset at an instant, in ms: +10h (AEST) or +11h (AEDT).
function canberraOffsetMs(ms: number): number {
  return canberraParts(ms).wallMs - Math.floor(ms / 1000) * 1000;
}

// Epoch seconds of Monday 00:00 Canberra time for the week `atSeconds` is in.
export function canberraWeekStart(atSeconds: number): number {
  const { weekday, wallMs } = canberraParts(atSeconds * 1000);
  const mondayWallMs = Math.floor(wallMs / DAY_MS) * DAY_MS - weekday * DAY_MS;
  let utcMs = mondayWallMs - 10 * 60 * 60 * 1000; // guess AEST first
  for (let i = 0; i < 2; i++) utcMs = mondayWallMs - canberraOffsetMs(utcMs);
  return Math.floor(utcMs / 1000);
}

// The starts of the `count` most recent Canberra weeks, newest (this week)
// first. A DST week is 167 or 169 hours long, so rather than subtracting a
// fixed 7 days, each step goes to the middle of the previous week and snaps
// to its Monday again.
export function canberraWeekStarts(nowSeconds: number, count: number): number[] {
  const starts: number[] = [];
  let start = canberraWeekStart(nowSeconds);
  for (let i = 0; i < count; i++) {
    starts.push(start);
    start = canberraWeekStart(start - 3 * 24 * 60 * 60);
  }
  return starts;
}
