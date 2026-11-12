// Demo clock and timezone-safe day arithmetic. Every "today", "overdue" and "48 hours" uses DEMO_NOW.
export const TZ = 'Asia/Jerusalem'
export const DEMO_NOW = Date.parse('2026-11-03T12:00:00+02:00')
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' })

/** Local calendar day in Israel, YYYY-MM-DD. */
export function dayKey(t: number | string): string {
  return dayFmt.format(typeof t === 'string' ? Date.parse(t) : t)
}

/** Shift a YYYY-MM-DD key by n calendar days (pure, no local timezone involved). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY)
}

/** Epoch ms for a local Israel wall-clock time on a given day (handles the DST change). */
export function localTime(key: string, hour: number, minute = 0): number {
  const [y, m, d] = key.split('-').map(Number)
  for (const offset of [2, 3]) {
    const t = Date.UTC(y, m - 1, d, hour - offset, minute)
    if (dayKey(t) === key && Number(hourFmt.format(t)) === hour) return t
  }
  return Date.UTC(y, m - 1, d, hour - 2, minute)
}

export const iso = (t: number) => new Date(t).toISOString()
export const TODAY = dayKey(DEMO_NOW)
/** The initial period: 90 calendar days ending today, inclusive. */
export const DEFAULT_RANGE = { from: addDays(TODAY, -89), to: TODAY }

// SPEC "מקור נתונים: Airtable": demo data uses the fixed demo clock, real data from Airtable uses the real clock.
let clockNow = DEMO_NOW
export function setClock(t: number) { clockNow = t }
/** The clock the app runs on right now (demo or real). */
export const nowMs = () => clockNow
export const today = () => dayKey(clockNow)
export const defaultRange = () => ({ from: addDays(today(), -89), to: today() })
