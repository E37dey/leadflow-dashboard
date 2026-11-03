import { TZ } from '../../domain/clock'

const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('he-IL')
const pct = new Intl.NumberFormat('he-IL', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const date = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' })
const dateShort = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, day: 'numeric', month: 'numeric' })
const time = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const longDay = new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })

export const fmt = {
  ils: (n: number) => ils.format(n),
  num: (n: number) => num.format(n),
  pct: (r: number) => pct.format(r),
  date: (t: string | number) => date.format(typeof t === 'string' ? Date.parse(t) : t),
  dateShort: (t: string | number) => dateShort.format(typeof t === 'string' ? Date.parse(t) : t),
  time: (t: string | number) => time.format(typeof t === 'string' ? Date.parse(t) : t),
  longDay: (t: number) => longDay.format(t),
  /** "לפני 3 ימים" style relative age on the demo clock. */
  ago: (t: string | null, now: number) => {
    if (!t) return 'אין קשר עדיין'
    const h = (now - Date.parse(t)) / 3_600_000
    if (h < 1) return 'לפני פחות משעה'
    if (h < 24) return `לפני ${Math.floor(h)} שעות`
    const d = Math.floor(h / 24)
    return d === 1 ? 'אתמול' : `לפני ${d} ימים`
  },
}
