// Seeded demo data (SPEC: "נתוני הדגמה"). Same seed = same data, so tests and screenshots are stable.
import { DEFAULT_RANGE, DEMO_NOW, HOUR, DAY, TODAY, addDays, iso, localTime } from '../domain/clock'
import { HOT_THRESHOLD, score } from '../domain/score'
import type { Activity, Lead, Owner, Source, Stage, Task } from '../domain/types'
import { SOURCE_LABEL } from '../domain/types'

export const SEED = 20261103
export const TARGET_OPEN_VALUE = 248_000
export const STAGE_COUNTS: Record<Stage, number> = { new: 24, contacted: 28, qualified: 25, proposal: 14, won: 31, lost: 6 }
/** How many open leads per stage are built to score >= 80 (32 in total). */
const HOT_PER_STAGE: Partial<Record<Stage, number>> = { proposal: 11, qualified: 17, contacted: 4 }

export const OWNERS: Owner[] = [
  { id: 'o1', name: 'אלה דהן', initials: 'א״ד' },
  { id: 'o2', name: 'מיכאל שושן', initials: 'מ״ש' },
  { id: 'o3', name: 'בן רוזן', initials: 'ב״ר' },
  { id: 'o4', name: 'נועה כץ', initials: 'נ״כ' },
]

const FIRST: [string, string][] = [
  ['רותם', 'rotem'], ['יובל', 'yuval'], ['נועה', 'noa'], ['דן', 'dan'], ['טל', 'tal'], ['אורי', 'ori'], ['מאיה', 'maya'],
  ['עומר', 'omer'], ['שירה', 'shira'], ['איתי', 'itay'], ['ליאור', 'lior'], ['הילה', 'hila'], ['גיא', 'guy'], ['ענבל', 'inbal'],
  ['עידו', 'ido'], ['מיכל', 'michal'], ['אסף', 'asaf'], ['קרן', 'keren'], ['רועי', 'roy'], ['דנה', 'dana'], ['אלון', 'alon'],
  ['יעל', 'yael'], ['ניר', 'nir'], ['שני', 'shani'],
]
const LAST: [string, string][] = [
  ['כהן', 'cohen'], ['לוי', 'levi'], ['מזרחי', 'mizrahi'], ['פרץ', 'peretz'], ['ביטון', 'biton'], ['אברהם', 'avraham'],
  ['פרידמן', 'friedman'], ['אזולאי', 'azulay'], ['גבאי', 'gabay'], ['שפירא', 'shapira'], ['חדד', 'hadad'], ['ברק', 'barak'],
  ['גולן', 'golan'], ['נחום', 'nahum'], ['סגל', 'segal'], ['אלמוג', 'almog'],
]
const COMPANIES = [
  'סולאריקה בע״מ', 'יובל מערכות', 'ברק טכנולוגיות', 'אברהם פתרונות', 'שחר דיגיטל', 'גל-ים לוגיסטיקה', 'אופק הנדסה',
  'נטע מזון', 'מגדלי הצפון', 'קלאודי סטודיו', 'דרור שיווק', 'אלפא מדיקל', 'זוהר נכסים', 'תבור אנרגיה', 'רימון קפה',
  'ענבר הפקות', 'פסגה ייעוץ', 'כרמל תוכנה', 'מעיין חינוך', 'אורות תאורה', 'שקד פיננסים', 'נוף בנייה', 'צוק אבטחה',
  'הדס אופנה', 'ליבנה רהיטים', 'ספיר קליניק', 'גפן אירועים', 'ארז תעשיות',
]
const NOTES = [
  'מעוניין בחבילה שנתית, ביקש הצעה מפורטת.', 'השווה מול מתחרה, רגיש למחיר.', 'צריך אישור של השותף לפני החלטה.',
  'הגיע דרך המלצה של לקוח קיים.', 'ביקש הדגמה בזום.', 'מתעניין בהרחבה לסניף נוסף.', 'תקציב מאושר לרבעון הבא.',
  'רוצה להתחיל בפיילוט קטן.', '',
]
const SOURCE_WEIGHTS: [Source, number][] = [['website', 30], ['facebook', 22], ['instagram', 16], ['referral', 18], ['telephone', 14]]
/** How many days back each stage is typically created (older stages = older leads). */
const CREATED_SPAN: Record<Stage, [number, number]> = {
  new: [0, 20], contacted: [3, 60], qualified: [8, 75], proposal: [14, 85], won: [18, 89], lost: [18, 89],
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Fixture {
  leads: Lead[]
  tasks: Task[]
  owners: Owner[]
}

export function createFixture(seed = SEED): Fixture {
  const r = mulberry32(seed)
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const shuffle = <T,>(xs: T[]) => {
    const out = [...xs]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  const weighted = () => {
    let x = r() * 100
    for (const [s, w] of SOURCE_WEIGHTS) if ((x -= w) < 0) return s
    return 'website' as Source
  }
  const hoursAgo = (h: number) => iso(DEMO_NOW - h * HOUR)
  const daysAgoAt = (d: number) => iso(localTime(addDays(TODAY, -d), int(9, 17), pick([0, 15, 30, 45])))

  const stages = shuffle((Object.keys(STAGE_COUNTS) as Stage[]).flatMap((s) => Array(STAGE_COUNTS[s]).fill(s) as Stage[]))
  const hotLeft = { ...HOT_PER_STAGE }
  const used = new Set<string>()

  const leads: Lead[] = stages.map((stage, i) => {
    let first: [string, string], last: [string, string]
    do {
      first = pick(FIRST)
      last = pick(LAST)
    } while (used.has(first[0] + last[0]))
    used.add(first[0] + last[0])

    const [minAge, maxAge] = CREATED_SPAN[stage]
    const createdAge = Math.min(int(minAge, maxAge), 89)
    const createdAt = iso(localTime(addDays(TODAY, -createdAge), int(8, 18), pick([0, 10, 20, 30, 40, 50])))
    const hot = (hotLeft[stage] ?? 0) > 0
    if (hot) hotLeft[stage]! -= 1

    let lastContactAt: string | null = null
    let nextFollowUpAt: string | null = null
    let value: number

    if (stage === 'won' || stage === 'lost') {
      value = int(20, 120) * 100
      lastContactAt = daysAgoAt(int(1, Math.max(1, createdAge - 3)))
    } else if (hot) {
      value = int(35, 75) * 100
      // Most hot leads were contacted in the last two days; some are waiting 3-6 days.
      lastContactAt = r() < 0.2 ? daysAgoAt(int(3, 6)) : hoursAgo(int(3, 44))
      const f = r()
      nextFollowUpAt = f < 0.2 ? daysAgoAt(int(1, 2)) : f < 0.7 ? iso(localTime(TODAY, int(13, 17), pick([0, 30]))) : daysAgoAt(-int(1, 3))
    } else {
      value = int(6, 32) * 100
      if (stage === 'new') {
        lastContactAt = r() < 0.5 ? null : daysAgoAt(int(0, Math.min(createdAge, 5)))
      } else if (stage === 'proposal') {
        lastContactAt = daysAgoAt(int(9, 14)) // proposals that went quiet
      } else {
        lastContactAt = daysAgoAt(int(1, Math.min(20, Math.max(1, createdAge))))
      }
      const f = r()
      nextFollowUpAt = stage === 'new' && f < 0.3 ? null : f < 0.25 ? daysAgoAt(int(1, 4)) : daysAgoAt(-int(4, 14))
    }
    // A contact cannot happen before the lead existed.
    if (lastContactAt && Date.parse(lastContactAt) < Date.parse(createdAt)) lastContactAt = iso(Date.parse(createdAt) + 2 * HOUR)

    const id = `L-${String(1001 + i)}`
    const name = `${first[0]} ${last[0]}`
    const lead: Lead = {
      id,
      fullName: name,
      company: pick(COMPANIES),
      email: r() < 0.88 ? `${first[1]}.${last[1]}@example.com` : null,
      phone: r() < 0.9 ? `05${int(0, 8)}-555-${String(int(0, 9999)).padStart(4, '0')}` : null,
      source: weighted(),
      stage,
      estimatedValueILS: value,
      ownerId: OWNERS[i % 4].id,
      createdAt,
      lastContactAt,
      nextFollowUpAt,
      notes: pick(NOTES),
      activityLog: [],
    }
    if (!lead.email && !lead.phone) lead.phone = `052-555-${String(int(0, 9999)).padStart(4, '0')}`
    return lead
  })

  // Hot leads: make sure each one reaches the threshold with the documented formula.
  const hotIds = new Set<string>()
  const remaining = { ...HOT_PER_STAGE }
  for (const l of leads) {
    if ((remaining[l.stage] ?? 0) > 0) {
      remaining[l.stage]! -= 1
      hotIds.add(l.id)
    }
  }
  for (const l of leads.filter((x) => hotIds.has(x.id))) {
    if (score(l, DEMO_NOW) < HOT_THRESHOLD) l.nextFollowUpAt = iso(localTime(TODAY, 15))
    if (score(l, DEMO_NOW) < HOT_THRESHOLD) l.lastContactAt = hoursAgo(20)
    if (score(l, DEMO_NOW) < HOT_THRESHOLD) l.estimatedValueILS = 6000
  }

  // Open pipeline must total exactly ILS 248,000: hot values are fixed, the rest share the remainder.
  const others = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost' && !hotIds.has(l.id))
  const hotSum = leads.filter((l) => hotIds.has(l.id)).reduce((s, l) => s + l.estimatedValueILS, 0)
  const rest = TARGET_OPEN_VALUE - hotSum
  const raw = others.reduce((s, l) => s + l.estimatedValueILS, 0)
  others.forEach((l) => (l.estimatedValueILS = Math.max(100, Math.round((l.estimatedValueILS / raw) * rest / 50) * 50)))
  const diff = rest - others.reduce((s, l) => s + l.estimatedValueILS, 0)
  others.reduce((a, b) => (b.estimatedValueILS > a.estimatedValueILS ? b : a)).estimatedValueILS += diff

  // Non-hot open leads must stay under the threshold: push the follow-up out (max 35+20+20+4 = 79).
  for (const l of others) if (score(l, DEMO_NOW) >= HOT_THRESHOLD) l.nextFollowUpAt = daysAgoAt(-int(4, 10))

  for (const l of leads) l.activityLog = activityFor(l, r)
  return { leads, tasks: createTasks(leads, r), owners: OWNERS }
}

function activityFor(l: Lead, r: () => number): Activity[] {
  const log: Activity[] = [{ id: `${l.id}-a0`, at: l.createdAt, text: `ליד נוצר, מקור: ${SOURCE_LABEL[l.source]}` }]
  const created = Date.parse(l.createdAt)
  const contact = l.lastContactAt ? Date.parse(l.lastContactAt) : null
  const between = (k: number) => iso(created + Math.max(HOUR, ((contact ?? created + DAY) - created) * k))
  const steps: Record<string, string[]> = {
    contacted: ['שיחת היכרות ראשונה'],
    qualified: ['שיחת היכרות ראשונה', 'נבדקה התאמה: יש צורך ותקציב'],
    proposal: ['שיחת היכרות ראשונה', 'פגישת אפיון', 'נשלחה הצעת מחיר'],
    won: ['שיחת היכרות ראשונה', 'נשלחה הצעת מחיר', 'העסקה נסגרה בהצלחה'],
    lost: ['שיחת היכרות ראשונה', 'הלקוח בחר בספק אחר'],
  }
  ;(steps[l.stage] ?? []).forEach((text, i, all) => {
    log.push({ id: `${l.id}-a${i + 1}`, at: i === all.length - 1 && contact ? iso(contact) : between((i + 1) / (all.length + 1)), text })
  })
  if (r() < 0.3 && l.notes) log.push({ id: `${l.id}-n`, at: log[log.length - 1].at, text: `הערה: ${l.notes}` })
  return log.sort((a, b) => b.at.localeCompare(a.at))
}

function createTasks(leads: Lead[], r: () => number): Task[] {
  const open = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost')
  const byScore = [...open].sort((a, b) => score(b, DEMO_NOW) - score(a, DEMO_NOW))
  const plan: [number, string, (l: Lead) => string][] = [
    // [day offset, time, title]
    [0, '10:30', (l) => `חזרה לליד: ${l.fullName}`],
    [0, '13:00', (l) => `פגישה: ${l.company}`],
    [0, '15:30', (l) => `מעקב: ${l.company}`],
    [0, '17:00', (l) => `שליחת הצעת מחיר ל${l.fullName}`],
    [-1, '11:00', (l) => `מעקב אחרי הצעה: ${l.company}`],
    [-2, '09:30', (l) => `חזרה לליד: ${l.fullName}`],
    [-3, '14:00', (l) => `שיחת אפיון: ${l.company}`],
    [-5, '10:00', (l) => `עדכון פרטי קשר: ${l.fullName}`],
    [1, '09:00', (l) => `פגישה: ${l.company}`],
    [1, '12:30', (l) => `הדגמה בזום: ${l.company}`],
    [2, '10:00', (l) => `חזרה לליד: ${l.fullName}`],
    [2, '16:00', (l) => `שליחת חוזה: ${l.company}`],
    [3, '11:30', (l) => `מעקב: ${l.fullName}`],
    [4, '09:30', (l) => `פגישת המשך: ${l.company}`],
    [6, '13:00', (l) => `בדיקת שביעות רצון: ${l.company}`],
    [8, '10:00', (l) => `חזרה לליד: ${l.fullName}`],
    [10, '15:00', (l) => `הצעת הרחבה: ${l.company}`],
    [12, '11:00', (l) => `מעקב: ${l.fullName}`],
    [-4, '12:00', (l) => `שיחת היכרות: ${l.fullName}`],
    [-7, '10:30', (l) => `שליחת חומרים: ${l.company}`],
  ]
  return plan.map(([offset, time, title], i) => {
    const lead = byScore[(i * 3 + Math.floor(r() * 3)) % byScore.length]
    const [h, m] = time.split(':').map(Number)
    return {
      id: `T-${String(i + 1).padStart(3, '0')}`,
      title: title(lead),
      leadId: lead.id,
      dueAt: iso(localTime(addDays(TODAY, offset), h, m)),
      done: i >= 18, // the last two are already done
      createdAt: iso(DEMO_NOW - (5 + i) * DAY),
    }
  })
}

export const INITIAL_RANGE = DEFAULT_RANGE
