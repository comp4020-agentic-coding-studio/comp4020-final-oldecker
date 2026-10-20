// A fixed-calendar-week cutoff for the plant's watering counter (see
// plant.ts) --- Monday 00:00 in Australia/Canberra, not a rolling lookback.
// The Fly machine runs UTC (nothing in this repo sets TZ), so plain
// Date getters/setters don't reflect Canberra time; Intl.DateTimeFormat
// carries the actual AEST/AEDT table, so no date library is needed for
// that part --- hand-rolling the "which day/hour is it there right now"
// read is small enough on its own.
const CANBERRA_TZ = "Australia/Canberra";
const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

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
