// Shared selectors: every card, chart and table reads from these, so numbers always reconcile.
import { addDays, dayKey, daysBetween } from './clock'
import { isHot, isOpen, priority, score } from './score'
import type { GlobalFilter, Lead, Source, Stage, TableFilter, Task } from './types'
import { DIGITAL_SOURCES, SOURCES, STAGES } from './types'

export function inRange(l: Lead, f: GlobalFilter['range']): boolean {
  const k = dayKey(l.createdAt)
  return k >= f.from && k <= f.to
}

export function applyGlobal(leads: Lead[], f: GlobalFilter): Lead[] {
  return leads.filter(
    (l) => inRange(l, f.range) && (f.source === 'all' || l.source === f.source) && (f.ownerId === 'all' || l.ownerId === f.ownerId),
  )
}

export function metrics(leads: Lead[], now: number) {
  const open = leads.filter(isOpen)
  const won = leads.filter((l) => l.stage === 'won').length
  return {
    total: leads.length,
    open: open.length,
    won,
    hot: open.filter((l) => isHot(l, now)).length,
    pipeline: open.reduce((s, l) => s + l.estimatedValueILS, 0),
    /** won / all leads in the cohort, 0 when there are none (never NaN). */
    conversion: leads.length ? won / leads.length : 0,
  }
}

export interface SeriesPoint {
  label: string
  from: string
  to: string
  digital: number
  referralPhone: number
}

/** Leads created over time: weekly buckets for ranges longer than 31 days, else daily. */
export function leadsOverTime(leads: Lead[], range: GlobalFilter['range']): { grouping: 'day' | 'week'; points: SeriesPoint[] } {
  const span = daysBetween(range.from, range.to) + 1
  const step = span > 31 ? 7 : 1
  const points: SeriesPoint[] = []
  for (let from = range.from; from <= range.to; from = addDays(from, step)) {
    const end = addDays(from, step - 1)
    points.push({ label: shortDate(from), from, to: end > range.to ? range.to : end, digital: 0, referralPhone: 0 })
  }
  for (const l of leads) {
    const k = dayKey(l.createdAt)
    const idx = Math.floor(daysBetween(range.from, k) / step)
    const p = points[idx]
    if (!p) continue
    if (DIGITAL_SOURCES.includes(l.source)) p.digital++
    else p.referralPhone++
  }
  return { grouping: step === 7 ? 'week' : 'day', points }
}

export const shortDate = (key: string) => {
  const [, m, d] = key.split('-')
  return `${Number(d)}.${Number(m)}`
}

export function stageDistribution(leads: Lead[]) {
  return STAGES.map((stage) => {
    const items = leads.filter((l) => l.stage === stage)
    return { stage, count: items.length, value: items.reduce((s, l) => s + l.estimatedValueILS, 0), share: leads.length ? items.length / leads.length : 0 }
  })
}

export function sourceDistribution(leads: Lead[]) {
  return SOURCES.map((source) => {
    const items = leads.filter((l) => l.source === source)
    const won = items.filter((l) => l.stage === 'won').length
    return { source, count: items.length, share: leads.length ? items.length / leads.length : 0, won, conversion: items.length ? won / items.length : 0 }
  })
}

// ---------- lead table ----------
export type SortKey = 'priority' | 'name' | 'source' | 'stage' | 'score' | 'value' | 'owner' | 'followUp'

export function applyTable(leads: Lead[], f: TableFilter, now: number): Lead[] {
  const q = f.query.trim().toLowerCase()
  const ids = f.ids ? new Set(f.ids) : null
  return leads.filter((l) => {
    if (ids && !ids.has(l.id)) return false
    if (f.stage !== 'all' && l.stage !== f.stage) return false
    if (f.priority !== 'all' && (!isOpen(l) || priority(score(l, now)) !== f.priority)) return false
    if (q && ![l.fullName, l.company, l.email ?? '', l.phone ?? '', l.id].some((s) => s.toLowerCase().includes(q))) return false
    return true
  })
}

const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i])) as Record<Stage, number>
const SOURCE_ORDER = Object.fromEntries(SOURCES.map((s, i) => [s, i])) as Record<Source, number>
const followUpTime = (l: Lead) => (l.nextFollowUpAt ? Date.parse(l.nextFollowUpAt) : Number.MAX_SAFE_INTEGER)

/** Default ('priority'): open leads first, highest score first, then the nearest follow-up. */
export function sortLeads(leads: Lead[], key: SortKey, dir: 'asc' | 'desc', now: number, ownerName: (id: string) => string): Lead[] {
  const sign = dir === 'asc' ? 1 : -1
  const cmp: Record<SortKey, (a: Lead, b: Lead) => number> = {
    priority: (a, b) => Number(isOpen(b)) - Number(isOpen(a)) || score(b, now) - score(a, now) || followUpTime(a) - followUpTime(b),
    name: (a, b) => a.fullName.localeCompare(b.fullName, 'he'),
    source: (a, b) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source],
    stage: (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage],
    score: (a, b) => score(a, now) - score(b, now),
    value: (a, b) => a.estimatedValueILS - b.estimatedValueILS,
    owner: (a, b) => ownerName(a.ownerId).localeCompare(ownerName(b.ownerId), 'he'),
    followUp: (a, b) => followUpTime(a) - followUpTime(b),
  }
  return [...leads].sort((a, b) => (key === 'priority' ? cmp.priority(a, b) : sign * cmp[key](a, b) || a.id.localeCompare(b.id)))
}

export function paginate<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(Math.max(1, page), pages)
  return { rows: rows.slice((p - 1) * size, p * size), page: p, pages }
}

// ---------- tasks ----------
export type TaskBucket = 'today' | 'overdue' | 'upcoming' | 'done'

/** A task is overdue when its day has passed, "today" for any time today, upcoming after today. */
export function taskBucket(t: Task, now: number): TaskBucket {
  if (t.done) return 'done'
  const d = daysBetween(dayKey(now), dayKey(t.dueAt))
  return d < 0 ? 'overdue' : d === 0 ? 'today' : 'upcoming'
}

export function tasksIn(tasks: Task[], bucket: TaskBucket, now: number) {
  return tasks.filter((t) => taskBucket(t, now) === bucket).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
}
