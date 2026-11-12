// SPEC: "מקור נתונים: Airtable". Helpers for the places screen: open now, quadrant, filters and CSV of real fields.
import { cell } from './csv'
import { DAYS, parseHours } from './quality'
import type { RecordClass } from './quality'
import type { Lead } from './types'

const TZ = 'Asia/Jerusalem'
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' })
const hmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Israel weekday (0 = Sunday) and minute of the day for a moment in time. */
export function israelTime(t: number): { day: number; minute: number } {
  const [h, m] = hmFmt.format(t).split(':').map(Number)
  return { day: WEEKDAY.indexOf(dayFmt.format(t)), minute: h * 60 + m }
}

/** true / false from the real Google hours, null when the hours are unknown. */
export function isOpenAt(lead: Lead, t: number): boolean | null {
  const hours = lead.place?.hours
  if (!hours?.length) return null
  const { day, minute } = israelTime(t)
  const entry = hours.find((h) => h.day === DAYS[day])
  if (!entry) return null
  const ranges = parseHours(entry.hours)
  if (!ranges) return null
  return ranges.some(([a, b]) => minute >= a && minute < b)
}

export type Quadrant = 'stars' | 'hidden' | 'crowded' | 'weak'
export const QUADRANT_LABEL: Record<Quadrant, string> = { stars: 'כוכבים', hidden: 'יהלומים נסתרים', crowded: 'פופולריות, דירוג נמוך', weak: 'שקטות' }

/** Same fixed rule as the overview: rating 4.5 and the median review count. No rating = no quadrant. */
export function quadrantOf(lead: Lead, medianReviews: number): Quadrant | null {
  const p = lead.place
  if (!p || p.rating == null) return null
  const hi = p.rating >= 4.5, many = (p.reviews ?? 0) >= medianReviews
  return hi && many ? 'stars' : hi ? 'hidden' : many ? 'crowded' : 'weak'
}

export interface PlaceFilter {
  query: string
  area: string | 'all'
  recordClass: RecordClass | 'all'
  quadrant: Quadrant | 'all'
  openNow: boolean
}
export const EMPTY_PLACE_FILTER: PlaceFilter = { query: '', area: 'all', recordClass: 'all', quadrant: 'all', openNow: false }

export function filterPlaces(leads: Lead[], f: PlaceFilter, medianReviews: number, now: number): Lead[] {
  const q = f.query.trim().toLowerCase()
  return leads.filter((l) => {
    const p = l.place
    if (!p) return false
    if (q && ![l.fullName, p.area, p.category, p.brand, l.phone, p.website].some((v) => v?.toLowerCase().includes(q))) return false
    if (f.area !== 'all' && (p.area ?? 'לא ידוע') !== f.area) return false
    if (f.recordClass !== 'all' && p.recordClass !== f.recordClass) return false
    if (f.quadrant !== 'all' && quadrantOf(l, medianReviews) !== f.quadrant) return false
    if (f.openNow && isOpenAt(l, now) !== true) return false
    return true
  })
}

export type PlaceSortKey = 'name' | 'area' | 'rating' | 'reviews' | 'positive'
/** Share of 4 and 5 star reviews, from the real star breakdown. */
export const positiveShare = (l: Lead) => {
  const s = l.place?.stars
  const t = s ? s.reduce((a, b) => a + b, 0) : 0
  return s && t ? (s[0] + s[1]) / t : null
}
export function sortPlaces(leads: Lead[], key: PlaceSortKey, dir: 'asc' | 'desc'): Lead[] {
  const val = (l: Lead): string | number => {
    const p = l.place!
    if (key === 'name') return l.fullName
    if (key === 'area') return p.area ?? ''
    if (key === 'rating') return p.rating ?? -1
    if (key === 'reviews') return p.reviews ?? -1
    return positiveShare(l) ?? -1
  }
  const m = dir === 'asc' ? 1 : -1
  return [...leads].sort((a, b) => {
    const va = val(a), vb = val(b)
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'he')) * m
  })
}

const CLASS_HE: Record<RecordClass, string> = { unique: 'עסק יחיד', branch: 'סניף של רשת', suspected_duplicate: 'כפילות חשודה' }

/** CSV of the real fields only (Excel-safe, with BOM). */
export function placesCsv(leads: Lead[]): string {
  const header = ['מזהה', 'שם', 'אזור', 'קטגוריה', 'טלפון', 'אתר', 'דירוג', 'ביקורות', '5 כוכבים', '4', '3', '2', '1', 'סיווג', 'כפילות של', 'רשת', 'קו רוחב', 'קו אורך', 'Google Maps']
  const rows = leads.map((l) => {
    const p = l.place!
    return [l.id, l.fullName, p.area ?? '', p.category ?? '', l.phone ?? '', p.website ?? '', p.rating ?? '', p.reviews ?? '',
      ...(p.stars ?? ['', '', '', '', '']), CLASS_HE[p.recordClass], p.duplicateOf ?? '', p.recordClass === 'branch' ? p.brand ?? '' : '',
      p.lat ?? '', p.lng ?? '', p.mapsUrl ?? '']
  })
  return '﻿' + [header, ...rows].map((r) => r.map((v) => cell(v as string | number)).join(',')).join('\r\n')
}
