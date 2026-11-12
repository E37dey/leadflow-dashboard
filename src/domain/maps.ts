// SPEC: "מקור נתונים: Airtable". Real data: public businesses from Google Maps, collected with Apify.
// One Apify item becomes one lead plus its real place data. Nothing is invented: unknown stays null.
import type { Lead, Place } from './types'

export const MAPS_OWNER = { id: 'o5', name: 'איליה נודלמן', initials: 'א״נ' }

/** The Apify fields the import reads (compass/crawler-google-places). */
export const APIFY_FIELDS = [
  'placeId', 'title', 'categoryName', 'address', 'city', 'neighborhood', 'phone', 'website', 'totalScore', 'reviewsCount',
  'price', 'location', 'url', 'permanentlyClosed', 'temporarilyClosed', 'scrapedAt', 'searchString',
] as const

export interface ApifyPlace {
  placeId?: string
  title?: string
  categoryName?: string | null
  address?: string | null
  city?: string | null
  neighborhood?: string | null
  phone?: string | null
  website?: string | null
  totalScore?: number | null
  reviewsCount?: number | null
  price?: string | null
  location?: { lat?: number; lng?: number } | null
  url?: string | null
  permanentlyClosed?: boolean
  temporarilyClosed?: boolean
  scrapedAt?: string
  searchString?: string
}

export const mapsUrl = (placeId: string) => `https://www.google.com/maps/place/?q=place_id:${placeId}`
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function placeStatus(p: ApifyPlace): Place['status'] {
  if (p.permanentlyClosed) return 'closed'
  if (p.temporarilyClosed) return 'temporarily_closed'
  return 'open'
}

/** An Apify Google Maps item -> a LEADFLOW lead with its real place data. Returns null when the item is not usable. */
export function apifyToLead(p: ApifyPlace): Lead | null {
  const title = txt(p.title)
  if (!p.placeId || !title || !p.scrapedAt || Number.isNaN(Date.parse(p.scrapedAt))) return null
  const id = `M-${p.placeId}`
  const area = txt(p.neighborhood) ?? txt(p.city)
  const reviews = num(p.reviewsCount)
  const place: Place = {
    area,
    category: txt(p.categoryName),
    website: txt(p.website),
    // Google shows no rating without reviews: keep it unknown, never 0.
    rating: reviews ? num(p.totalScore) : null,
    reviews,
    price: txt(p.price),
    lat: num(p.location?.lat),
    lng: num(p.location?.lng),
    mapsUrl: mapsUrl(p.placeId),
    status: placeStatus(p),
  }
  const at = new Date(Date.parse(p.scrapedAt)).toISOString()
  return {
    id,
    fullName: title,
    company: [place.category, area].filter(Boolean).join(' · '),
    email: null,
    phone: txt(p.phone),
    source: 'maps',
    stage: 'new',
    estimatedValueILS: 0,
    ownerId: MAPS_OWNER.id,
    createdAt: at,
    lastContactAt: null,
    nextFollowUpAt: null,
    notes: txt(p.address) ? `כתובת: ${txt(p.address)}` : '',
    activityLog: [{ id: `${id}-a0`, at, text: `נאסף מ-Google Maps דרך Apify. חיפוש: ${p.searchString ?? ''}${area ? `, ${area}` : ''}` }],
    place,
  }
}

/** Real numbers for the market view. Averages only over places that have a rating. */
export function marketStats(leads: Lead[]) {
  const places = leads.filter((l) => l.place)
  const rated = places.filter((l) => l.place!.rating != null)
  const byArea = new Map<string, { count: number; rated: number; ratingSum: number; reviews: number }>()
  for (const l of places) {
    const a = l.place!.area ?? 'לא ידוע'
    const s = byArea.get(a) ?? { count: 0, rated: 0, ratingSum: 0, reviews: 0 }
    s.count++
    s.reviews += l.place!.reviews ?? 0
    if (l.place!.rating != null) { s.rated++; s.ratingSum += l.place!.rating }
    byArea.set(a, s)
  }
  const buckets = [
    { label: 'מתחת ל-4', test: (r: number) => r < 4 },
    { label: '4 עד 4.4', test: (r: number) => r >= 4 && r < 4.5 },
    { label: '4.5 עד 4.7', test: (r: number) => r >= 4.5 && r < 4.8 },
    { label: '4.8 ומעלה', test: (r: number) => r >= 4.8 },
  ]
  const categories = new Map<string, number>()
  for (const l of places) {
    const c = l.place!.category ?? 'לא ידוע'
    categories.set(c, (categories.get(c) ?? 0) + 1)
  }
  return {
    total: places.length,
    rated: rated.length,
    avgRating: rated.length ? rated.reduce((s, l) => s + l.place!.rating!, 0) / rated.length : null,
    reviews: places.reduce((s, l) => s + (l.place!.reviews ?? 0), 0),
    withWebsite: places.filter((l) => l.place!.website).length,
    withPhone: places.filter((l) => l.phone).length,
    closed: places.filter((l) => l.place!.status !== 'open').length,
    areas: [...byArea.entries()]
      .map(([area, s]) => ({ area, count: s.count, reviews: s.reviews, avgRating: s.rated ? s.ratingSum / s.rated : null }))
      .sort((a, b) => b.count - a.count),
    ratingBuckets: buckets.map((b) => ({ label: b.label, count: rated.filter((l) => b.test(l.place!.rating!)).length })),
    categories: [...categories.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    mostReviewed: [...places].sort((a, b) => (b.place!.reviews ?? 0) - (a.place!.reviews ?? 0)).slice(0, 10),
  }
}
