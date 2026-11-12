// SPEC: "מקור נתונים: Airtable". Real leads: public businesses from Google Maps, collected with Apify.
// One row from the Apify dataset becomes one lead: stage "new", no contact yet, value unknown (0), owner o5.
import type { Lead } from './types'

export const MAPS_OWNER = { id: 'o5', name: 'איליה נודלמן', initials: 'א״נ' }

export interface MapsPlace {
  placeId: string
  title: string
  category: string | null
  address: string | null
  phone: string | null
  website: string | null
  score: number | null
  reviews: number | null
  scrapedAt: string
  search: string
  area: string
}

/** The compact file keeps rows as arrays, in the order of `columns`. */
export function rowsToPlaces(file: { columns: string[]; rows: unknown[][] }): MapsPlace[] {
  return file.rows.map((r) => Object.fromEntries(file.columns.map((c, i) => [c, r[i] ?? null])) as unknown as MapsPlace)
}

export const mapsUrl = (placeId: string) => `https://www.google.com/maps/place/?q=place_id:${placeId}`

/** A Google Maps place -> a LEADFLOW lead. Nothing is invented: unknown value stays 0. */
export function placeToLead(p: MapsPlace): Lead | null {
  if (!p.placeId || !p.title?.trim() || Number.isNaN(Date.parse(p.scrapedAt))) return null
  const id = `M-${p.placeId}`
  const notes = [
    p.address && `כתובת: ${p.address}`,
    p.website && `אתר: ${p.website}`,
    p.score != null && `דירוג בגוגל: ${p.score} (${p.reviews ?? 0} ביקורות)`,
    `Google Maps: ${mapsUrl(p.placeId)}`,
  ].filter(Boolean).join('\n')
  const at = new Date(Date.parse(p.scrapedAt)).toISOString()
  return {
    id,
    fullName: p.title.trim(),
    company: [p.category, p.area].filter(Boolean).join(' · '),
    email: null,
    phone: p.phone?.trim() || null,
    source: 'maps',
    stage: 'new',
    estimatedValueILS: 0,
    ownerId: MAPS_OWNER.id,
    createdAt: at,
    lastContactAt: null,
    nextFollowUpAt: null,
    notes,
    activityLog: [{ id: `${id}-a0`, at, text: `ליד נוצר מ-Google Maps דרך Apify. חיפוש: ${p.search}, ${p.area}` }],
  }
}
