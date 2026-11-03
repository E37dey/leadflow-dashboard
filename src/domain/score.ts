import { DAY, HOUR, dayKey, daysBetween } from './clock'
import type { Lead, Priority, Stage } from './types'

/*
 * Demo priority score, 0-100. A transparent formula, not a model prediction (SPEC: "ציון עדיפות").
 *   stage       new 10, contacted 18, qualified 28, proposal 35
 *   value       up to 20, linear, capped at ILS 6,000
 *   last contact  <=2 days 20, <=7 days 14, <=14 days 8, older 2.
 *               No contact yet: 15 if the lead was created in the last 2 days, else 0.
 *   follow-up   overdue 25, later today 22, within 3 days 12, later 4, none 0
 * Closed leads (won, lost) score 0.
 */
export const STAGE_POINTS: Partial<Record<Stage, number>> = { new: 10, contacted: 18, qualified: 28, proposal: 35 }
export const HOT_THRESHOLD = 80

export function scoreParts(lead: Lead, now: number) {
  const stage = STAGE_POINTS[lead.stage] ?? 0
  if (!stage) return { stage: 0, value: 0, contact: 0, followUp: 0 }
  const value = Math.round(20 * Math.min(1, lead.estimatedValueILS / 6000) * 10) / 10

  let contact: number
  if (lead.lastContactAt) {
    const age = now - Date.parse(lead.lastContactAt)
    contact = age <= 2 * DAY ? 20 : age <= 7 * DAY ? 14 : age <= 14 * DAY ? 8 : 2
  } else {
    contact = now - Date.parse(lead.createdAt) <= 2 * DAY ? 15 : 0
  }

  let followUp = 0
  if (lead.nextFollowUpAt) {
    const due = Date.parse(lead.nextFollowUpAt)
    const days = daysBetween(dayKey(now), dayKey(due))
    followUp = due < now ? 25 : days === 0 ? 22 : days <= 3 ? 12 : 4
  }
  return { stage, value, contact, followUp }
}

export function score(lead: Lead, now: number): number {
  const p = scoreParts(lead, now)
  return Math.round(p.stage + p.value + p.contact + p.followUp)
}

export function priority(s: number): Priority {
  return s >= HOT_THRESHOLD ? 'hot' : s >= 50 ? 'warm' : 'cold'
}

export const isOpen = (l: Lead) => l.stage !== 'won' && l.stage !== 'lost'
export const isHot = (l: Lead, now: number) => isOpen(l) && score(l, now) >= HOT_THRESHOLD
export const hoursSince = (t: string | null, now: number) => (t ? (now - Date.parse(t)) / HOUR : Infinity)
