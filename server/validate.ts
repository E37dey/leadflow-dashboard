// SPEC: "שרת API ל-Airtable (סעיף 19)": request validation for the write endpoints. Unknown keys are refused.
import { STAGES } from '../src/domain/types'
import type { Stage } from '../src/domain/types'

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface LeadPatch { inPipeline?: boolean; stage?: Stage; value?: number | null; nextFollowUpAt?: string | null }
export interface NewActivity { leadId: string; type: 'note' | 'call' | 'email' | 'meeting'; text: string; nextAction?: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function validateLeadPatch(body: unknown): Result<LeadPatch> {
  if (!isObj(body)) return { ok: false, error: 'צריך אובייקט JSON.' }
  const allowed = ['inPipeline', 'stage', 'value', 'nextFollowUpAt']
  const extra = Object.keys(body).filter((k) => !allowed.includes(k))
  if (extra.length) return { ok: false, error: `שדות לא מוכרים: ${extra.join(', ')}` }
  if (!Object.keys(body).length) return { ok: false, error: 'אין מה לעדכן.' }
  const out: LeadPatch = {}
  if ('inPipeline' in body) {
    if (typeof body.inPipeline !== 'boolean') return { ok: false, error: 'inPipeline צריך להיות true או false.' }
    out.inPipeline = body.inPipeline
  }
  if ('stage' in body) {
    if (!STAGES.includes(body.stage as Stage)) return { ok: false, error: `שלב לא מוכר. מותר: ${STAGES.join(', ')}` }
    out.stage = body.stage as Stage
  }
  if ('value' in body) {
    const v = body.value
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 10_000_000)) return { ok: false, error: 'שווי צריך להיות מספר בין 0 ל-10,000,000, או null.' }
    out.value = v === null ? null : Math.round(v)
  }
  if ('nextFollowUpAt' in body) {
    const v = body.nextFollowUpAt
    if (v !== null && (typeof v !== 'string' || Number.isNaN(Date.parse(v)))) return { ok: false, error: 'תאריך מעקב לא תקין.' }
    out.nextFollowUpAt = v === null ? null : new Date(Date.parse(v as string)).toISOString()
  }
  return { ok: true, value: out }
}

const TYPES: NewActivity['type'][] = ['note', 'call', 'email', 'meeting']

export function validateActivity(body: unknown): Result<NewActivity> {
  if (!isObj(body)) return { ok: false, error: 'צריך אובייקט JSON.' }
  const extra = Object.keys(body).filter((k) => !['leadId', 'type', 'text', 'nextAction'].includes(k))
  if (extra.length) return { ok: false, error: `שדות לא מוכרים: ${extra.join(', ')}` }
  const { leadId, type, text, nextAction } = body
  if (typeof leadId !== 'string' || !/^M-[A-Za-z0-9_-]{5,}$/.test(leadId)) return { ok: false, error: 'מזהה ליד לא תקין.' }
  if (!TYPES.includes(type as NewActivity['type'])) return { ok: false, error: `סוג פעילות לא מוכר. מותר: ${TYPES.join(', ')}` }
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) return { ok: false, error: 'תיאור חובה, עד 2,000 תווים.' }
  if (nextAction !== undefined && (typeof nextAction !== 'string' || nextAction.length > 200)) return { ok: false, error: 'הצעד הבא עד 200 תווים.' }
  return { ok: true, value: { leadId, type: type as NewActivity['type'], text: text.trim(), ...(nextAction && (nextAction as string).trim() ? { nextAction: (nextAction as string).trim() } : {}) } }
}
