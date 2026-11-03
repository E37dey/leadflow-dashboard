// Deterministic insight rules (SPEC: "תובנות"). Each rule returns the exact leads that support it.
import { DAY, HOUR, iso, localTime, dayKey } from './clock'
import { isHot, isOpen, score } from './score'
import { sourceDistribution } from './selectors'
import type { Lead, Task } from './types'
import { SOURCE_LABEL } from './types'

export type RuleId = 'hot-no-contact' | 'overdue-follow-up' | 'stale-proposal' | 'best-source'

export interface Insight {
  id: RuleId
  title: string
  reason: string
  count: number
  leadIds: string[]
  /** Rules that make sense as follow-up tasks. */
  actionable: boolean
}

const byScore = (now: number) => (a: Lead, b: Lead) => score(b, now) - score(a, now)

export function insights(leads: Lead[], now: number): Insight[] {
  const hotNoContact = leads
    .filter((l) => isHot(l, now) && (!l.lastContactAt || now - Date.parse(l.lastContactAt) > 48 * HOUR))
    .sort(byScore(now))
  const overdue = leads
    .filter((l) => isOpen(l) && l.nextFollowUpAt && Date.parse(l.nextFollowUpAt) < now)
    .sort((a, b) => a.nextFollowUpAt!.localeCompare(b.nextFollowUpAt!))
  const stale = leads
    .filter((l) => l.stage === 'proposal' && (!l.lastContactAt || now - Date.parse(l.lastContactAt) > 7 * DAY))
    .sort(byScore(now))

  const sources = sourceDistribution(leads).filter((s) => s.count >= 5)
  const best = sources.length ? sources.reduce((a, b) => (b.conversion > a.conversion ? b : a)) : null

  const list: Insight[] = [
    {
      id: 'hot-no-contact',
      title: 'לידים חמים ממתינים',
      reason: 'ציון 80 ומעלה, בלי קשר מעל 48 שעות',
      count: hotNoContact.length,
      leadIds: hotNoContact.map((l) => l.id),
      actionable: true,
    },
    {
      id: 'overdue-follow-up',
      title: 'מעקבים באיחור',
      reason: 'תאריך המעקב של ליד פתוח כבר עבר',
      count: overdue.length,
      leadIds: overdue.map((l) => l.id),
      actionable: true,
    },
    {
      id: 'stale-proposal',
      title: 'הצעות מחיר שלא טופלו',
      reason: 'הצעה נשלחה, בלי קשר מעל 7 ימים',
      count: stale.length,
      leadIds: stale.map((l) => l.id),
      actionable: true,
    },
  ]
  if (best) {
    const ids = leads.filter((l) => l.source === best.source).map((l) => l.id)
    list.push({
      id: 'best-source',
      title: `המקור עם ההמרה הגבוהה: ${SOURCE_LABEL[best.source]}`,
      reason: `${best.won} מתוך ${best.count} לידים נסגרו בהצלחה (${Math.round(best.conversion * 1000) / 10}%). נבדקו רק מקורות עם 5 לידים לפחות`,
      count: ids.length,
      leadIds: ids,
      actionable: false,
    })
  }
  return list
}

/** One follow-up task per lead that has no open task from the same rule yet. */
export function followUpTasks(insight: Insight, leads: Lead[], tasks: Task[], now: number): Task[] {
  const taken = new Set(tasks.filter((t) => !t.done && t.ruleId === insight.id).map((t) => t.leadId))
  const due = iso(localTime(dayKey(now), 16))
  return insight.leadIds
    .filter((id) => !taken.has(id))
    .map((id, i) => {
      const lead = leads.find((l) => l.id === id)!
      return {
        id: `T-${insight.id}-${id}-${now + i}`,
        title: `${insight.id === 'stale-proposal' ? 'מעקב אחרי הצעה' : 'חזרה לליד'}: ${lead.fullName}`,
        leadId: id,
        dueAt: due,
        done: false,
        createdAt: iso(now),
        ruleId: insight.id,
      }
    })
}
