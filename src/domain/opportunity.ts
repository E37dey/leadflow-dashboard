// SPEC: "שרת API ל-Airtable (סעיף 19)": opportunity score, 0-100. Fixed business rules with weights the user can change.
// Not a prediction. A part without data is left out and the other weights are re-normalized: missing is not zero.
// Reputation (what customers think) is kept apart from the pipeline stage (how far the sale got).
import { REGIONS } from './regions'
import type { RegionId } from './regions'
import type { Lead } from './types'

export type PartKey = 'reputation' | 'volume' | 'presence' | 'contact' | 'region'
export const PART_KEYS: PartKey[] = ['reputation', 'volume', 'presence', 'contact', 'region']
export const PART_LABEL: Record<PartKey, string> = {
  reputation: 'מוניטין',
  volume: 'היקף ביקורות',
  presence: 'אתר',
  contact: 'פרטי קשר',
  region: 'אזור',
}
export const PART_RULE: Record<PartKey, string> = {
  reputation: 'דירוג 3.0 = 0, דירוג 5.0 = מלא. רק מ-10 ביקורות.',
  volume: 'לוגריתמי: 1,000 ביקורות ומעלה = מלא.',
  presence: 'יש אתר בפרופיל גוגל = מלא.',
  contact: 'טלפון ושעות פתיחה: חצי על כל אחד.',
  region: 'הרלוונטיות שהגדרת לאזור.',
}

export interface Weights {
  parts: Record<PartKey, number>
  /** 0 to 1 for each region. */
  regions: Record<RegionId, number>
}
export const DEFAULT_WEIGHTS: Weights = {
  parts: { reputation: 30, volume: 25, presence: 15, contact: 15, region: 15 },
  regions: Object.fromEntries(REGIONS.map((r) => [r, 1])) as Record<RegionId, number>,
}
export const MIN_REVIEWS_FOR_RATING = 10
/** A score needs data for at least half of the total weight. */
export const MIN_COVERAGE = 0.5

const clamp = (v: number) => Math.max(0, Math.min(1, v))

/** Each part as 0..1, or null when the data is not there. */
export function partValues(lead: Lead, w: Weights): Record<PartKey, number | null> {
  const p = lead.place
  if (!p) return { reputation: null, volume: null, presence: null, contact: null, region: null }
  return {
    reputation: p.rating != null && (p.reviews ?? 0) >= MIN_REVIEWS_FOR_RATING ? clamp((p.rating - 3) / 2) : null,
    volume: p.reviews == null ? null : clamp(Math.log10(1 + p.reviews) / Math.log10(1001)),
    presence: p.website ? 1 : 0,
    contact: (lead.phone ? 0.5 : 0) + (p.hours?.length ? 0.5 : 0),
    region: p.region ? clamp(w.regions[p.region] ?? 1) : null,
  }
}

export interface Opportunity {
  score: number | null
  parts: { key: PartKey; label: string; value: number | null; weight: number; points: number }[]
  missing: string[]
  /** Share of the weight that had data (0..1). */
  coverage: number
}

export function opportunity(lead: Lead, w: Weights = DEFAULT_WEIGHTS): Opportunity {
  const v = partValues(lead, w)
  const known = PART_KEYS.filter((k) => v[k] != null && w.parts[k] > 0)
  const total = known.reduce((s, k) => s + w.parts[k], 0)
  const parts = PART_KEYS.map((k) => {
    const value = v[k]
    const share = value != null && total ? w.parts[k] / total : 0
    return { key: k, label: PART_LABEL[k], value, weight: w.parts[k], points: Math.round(share * (value ?? 0) * 1000) / 10 }
  })
  // Not enough data: when the parts we know carry less than half of the weight, there is no score.
  // (Otherwise a bakery with no reviews at all would score 100 on website and phone alone.)
  const all = PART_KEYS.reduce((s, k) => s + w.parts[k], 0)
  const coverage = all ? total / all : 0
  const score = total && coverage >= MIN_COVERAGE ? Math.round(parts.reduce((s, p) => s + p.points, 0)) : null
  return { score, parts, missing: PART_KEYS.filter((k) => v[k] == null && w.parts[k] > 0).map((k) => PART_LABEL[k]), coverage }
}

/** Read saved weights, falling back to the defaults for anything missing or broken. */
export function cleanWeights(raw: unknown): Weights {
  const r = (raw ?? {}) as Partial<Weights>
  const num = (x: unknown, d: number, max: number) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max ? x : d)
  return {
    parts: Object.fromEntries(PART_KEYS.map((k) => [k, num(r.parts?.[k], DEFAULT_WEIGHTS.parts[k], 100)])) as Weights['parts'],
    regions: Object.fromEntries(REGIONS.map((k) => [k, num(r.regions?.[k], 1, 1)])) as Weights['regions'],
  }
}
