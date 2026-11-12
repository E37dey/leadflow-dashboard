// SPEC: "מקור נתונים: Airtable". Data quality for real places: duplicate classification and opening hours.
// Fixed, visible rules. Nothing here invents data: every class is derived from real fields and carries its reason.
import type { Lead } from './types'

export type RecordClass = 'unique' | 'branch' | 'suspected_duplicate'
export const RECORD_CLASS_LABEL: Record<RecordClass, string> = {
  unique: 'עסק יחיד',
  branch: 'סניף של רשת',
  suspected_duplicate: 'כפילות חשודה',
}

/** Domains that host many unrelated businesses: never a brand. */
const GENERIC_DOMAINS = ['instagram.com', 'facebook.com', 'wolt.com', 'b144.co.il', 'linktr.ee', 'google.com', 'goo.gl', 'tiktok.com', 'business.site', 'wixsite.com', 'mishloha.co.il', '10bis.co.il', 'easy.co.il', 'zap.co.il', 'd.co.il', 'dunsguide.co.il']

export function domainOf(url: string | null): string | null {
  if (!url) return null
  const m = url.trim().toLowerCase().match(/^https?:\/\/(?:www\.)?([^/?#]+)/)
  if (!m) return null
  const host = m[1]
  return GENERIC_DOMAINS.some((g) => host === g || host.endsWith('.' + g)) ? null : host
}

/** Name without legal suffixes, punctuation and the branch part after " - " or " | ". */
export function normalizeName(name: string): string {
  return name
    .split(/\s[-–|]\s/)[0]
    .toLowerCase()
    .replace(/בע["״']?מ|\bltd\b|\binc\b/g, '')
    .replace(/["'״׳.,()|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const digits = (p: string | null) => (p ?? '').replace(/\D/g, '')

/** Metres between two points (haversine). */
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const NEAR_METRES = 100

/**
 * Classify real places. Rules, in order:
 * 1. Suspected duplicate: within 100 m of another place AND (same brand, same phone, or one name contains the other).
 *    The one with fewer reviews points at the one with more.
 * 2. Branch: shares a brand (website domain, or the normalized name) with another place that is not its duplicate.
 * 3. Otherwise: unique.
 */
export function classifyPlaces(leads: Lead[]): Lead[] {
  const out = leads.map((l) => (l.place ? { ...l, place: { ...l.place } } : l))
  const places = out.filter((l) => l.place)
  for (const l of places) {
    const p = l.place!
    p.brand = domainOf(p.website) ?? normalizeName(l.fullName)
    p.recordClass = 'unique'
    p.duplicateOf = null
  }
  const byReviews = [...places].sort((a, b) => (b.place!.reviews ?? 0) - (a.place!.reviews ?? 0) || a.id.localeCompare(b.id))
  for (let i = 0; i < byReviews.length; i++) {
    const a = byReviews[i]
    if (a.place!.recordClass === 'suspected_duplicate') continue
    for (let j = i + 1; j < byReviews.length; j++) {
      const b = byReviews[j]
      if (b.place!.recordClass === 'suspected_duplicate') continue
      const pa = a.place!, pb = b.place!
      if (pa.lat == null || pa.lng == null || pb.lat == null || pb.lng == null) continue
      const d = metres({ lat: pa.lat, lng: pa.lng }, { lat: pb.lat, lng: pb.lng })
      if (d > NEAR_METRES) continue
      const na = normalizeName(a.fullName), nb = normalizeName(b.fullName)
      const reason = pa.brand === pb.brand ? 'אותו מותג' : digits(a.phone) && digits(a.phone) === digits(b.phone) ? 'אותו טלפון' : na && nb && (na.includes(nb) || nb.includes(na)) ? 'שם דומה' : null
      if (!reason) continue
      pb.recordClass = 'suspected_duplicate'
      pb.duplicateOf = `${a.id} (${reason}, ${Math.round(d)} מ׳)`
    }
  }
  const brandCount = new Map<string, number>()
  for (const l of places) if (l.place!.recordClass !== 'suspected_duplicate') brandCount.set(l.place!.brand!, (brandCount.get(l.place!.brand!) ?? 0) + 1)
  for (const l of places) if (l.place!.recordClass === 'unique' && (brandCount.get(l.place!.brand!) ?? 0) > 1) l.place!.recordClass = 'branch'
  return out
}

// ---------- opening hours ----------
export const DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'] as const
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

/** Google hours text -> list of [from, to) minute ranges in that day. "סגור" = none, "פתוח 24 שעות" = all day. */
export function parseHours(text: string): [number, number][] | null {
  const t = text.trim()
  if (!t) return null
  if (t.includes('סגור')) return []
  if (t.includes('24')) return [[0, 24 * 60]]
  const ranges: [number, number][] = []
  for (const part of t.split(',')) {
    const m = part.match(/(\d{1,2}):(\d{2})\s*(?:to|–|-)\s*(\d{1,2}):(\d{2})/)
    if (!m) return null
    const from = +m[1] * 60 + +m[2]
    let to = +m[3] * 60 + +m[4]
    if (to <= from) to = 24 * 60 // past midnight: count until the end of this day
    ranges.push([from, to])
  }
  return ranges
}

/** How many places are open in each day x hour slot (open at hh:30). Places without hours are not counted. */
export function openGrid(leads: Lead[]): { grid: number[][]; withHours: number } {
  const grid = DAYS.map(() => Array(24).fill(0) as number[])
  let withHours = 0
  for (const l of leads) {
    const hours = l.place?.hours
    if (!hours?.length) continue
    withHours++
    for (const h of hours) {
      const d = DAYS.indexOf(h.day as (typeof DAYS)[number])
      const ranges = d >= 0 ? parseHours(h.hours) : null
      if (!ranges) continue
      for (let hr = 0; hr < 24; hr++) if (ranges.some(([a, b]) => hr * 60 + 30 >= a && hr * 60 + 30 < b)) grid[d][hr]++
    }
  }
  return { grid, withHours }
}
