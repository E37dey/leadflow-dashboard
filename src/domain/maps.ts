// SPEC: "מקור נתונים: Airtable". Real data: public businesses from Google Maps, collected with Apify.
// One Apify item becomes one lead plus its real place data. Nothing is invented: unknown stays null.
import { regionOf } from './regions'
import type { RegionId } from './regions'
import type { Lead, Place } from './types'

export const MAPS_OWNER = { id: 'o5', name: 'איליה נודלמן', initials: 'א״נ' }

/** The Apify fields the import reads (compass/crawler-google-places). */
export const APIFY_FIELDS = [
  'placeId', 'title', 'categoryName', 'address', 'city', 'neighborhood', 'phone', 'website', 'totalScore', 'reviewsCount',
  'price', 'location', 'url', 'permanentlyClosed', 'temporarilyClosed', 'scrapedAt', 'searchString',
  'reviewsDistribution', 'openingHours', 'categories', 'imagesCount',
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
  reviewsDistribution?: { fiveStar?: number; fourStar?: number; threeStar?: number; twoStar?: number; oneStar?: number } | null
  openingHours?: { day: string; hours: string }[] | null
  categories?: string[] | null
  imagesCount?: number | null
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
export function apifyToLead(p: ApifyPlace, searched?: RegionId | null): Lead | null {
  const title = txt(p.title)
  if (!p.placeId || !title || !p.scrapedAt || Number.isNaN(Date.parse(p.scrapedAt))) return null
  const id = `M-${p.placeId}`
  // Google sometimes puts a phone number in the city field: a place name must contain letters.
  const name = (v: unknown) => { const t = txt(v); return t && /\p{L}/u.test(t) ? t : null }
  const area = name(p.neighborhood) ?? name(p.city)
  const reviews = num(p.reviewsCount)
  const city = name(p.city)
  const place: Place = {
    area,
    city,
    region: regionOf(city, searched),
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
    stars: p.reviewsDistribution
      ? [p.reviewsDistribution.fiveStar ?? 0, p.reviewsDistribution.fourStar ?? 0, p.reviewsDistribution.threeStar ?? 0, p.reviewsDistribution.twoStar ?? 0, p.reviewsDistribution.oneStar ?? 0]
      : null,
    hours: p.openingHours?.length ? p.openingHours.map((h) => ({ day: h.day, hours: h.hours })) : null,
    categories: (p.categories ?? []).filter((c): c is string => typeof c === 'string' && !!c.trim()),
    images: num(p.imagesCount),
    brand: null,
    recordClass: 'unique',
    duplicateOf: null,
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
    inPipeline: false,
  }
}

/** Real numbers for the market view. Averages only over places that have a rating. */
export function marketStats(leads: Lead[]) {
  const places = leads.filter((l) => l.place)
  const rated = places.filter((l) => l.place!.rating != null)
  const byArea = new Map<string, { count: number; rated: number; ratingSum: number; reviews: number; stars: number[] }>()
  for (const l of places) {
    const a = l.place!.area ?? 'לא ידוע'
    const s = byArea.get(a) ?? { count: 0, rated: 0, ratingSum: 0, reviews: 0, stars: [0, 0, 0, 0, 0] }
    s.count++
    s.reviews += l.place!.reviews ?? 0
    if (l.place!.rating != null) { s.rated++; s.ratingSum += l.place!.rating }
    l.place!.stars?.forEach((v, i) => (s.stars[i] += v))
    byArea.set(a, s)
  }
  const buckets = [
    { label: 'מתחת ל-4', test: (r: number) => r < 4 },
    { label: '4 עד 4.4', test: (r: number) => r >= 4 && r < 4.5 },
    { label: '4.5 עד 4.7', test: (r: number) => r >= 4.5 && r < 4.8 },
    { label: '4.8 ומעלה', test: (r: number) => r >= 4.8 },
  ]
  const categories = new Map<string, number>()
  for (const l of places) for (const c of l.place!.categories.length ? l.place!.categories : [l.place!.category ?? 'לא ידוע']) categories.set(c, (categories.get(c) ?? 0) + 1)
  const stars = [0, 0, 0, 0, 0]
  for (const l of places) l.place!.stars?.forEach((v, i) => (stars[i] += v))
  // Popularity vs quality: split at the median review count of rated places and at rating 4.5 (fixed rule).
  const revs = rated.map((l) => l.place!.reviews ?? 0).sort((x, y) => x - y)
  const medianReviews = revs.length ? revs[Math.floor(revs.length / 2)] : 0
  const quad = { stars: 0, hidden: 0, crowded: 0, weak: 0 }
  for (const l of rated) {
    const hi = l.place!.rating! >= 4.5, many = (l.place!.reviews ?? 0) >= medianReviews
    if (hi && many) quad.stars++
    else if (hi) quad.hidden++
    else if (many) quad.crowded++
    else quad.weak++
  }
  const brands = new Map<string, Lead[]>()
  for (const l of places) if (l.place!.recordClass === 'branch' && l.place!.brand) brands.set(l.place!.brand, [...(brands.get(l.place!.brand) ?? []), l])
  const pct = (n: number) => (places.length ? n / places.length : 0)
  return {
    total: places.length,
    rated: rated.length,
    avgRating: rated.length ? rated.reduce((s, l) => s + l.place!.rating!, 0) / rated.length : null,
    reviews: places.reduce((s, l) => s + (l.place!.reviews ?? 0), 0),
    withWebsite: places.filter((l) => l.place!.website).length,
    withPhone: places.filter((l) => l.phone).length,
    closed: places.filter((l) => l.place!.status !== 'open').length,
    areas: [...byArea.entries()]
      .map(([area, s]) => ({ area, count: s.count, reviews: s.reviews, avgRating: s.rated ? s.ratingSum / s.rated : null, stars: s.stars }))
      .sort((a, b) => b.count - a.count),
    ratingBuckets: buckets.map((b) => ({ label: b.label, count: rated.filter((l) => b.test(l.place!.rating!)).length })),
    categories: [...categories.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    mostReviewed: [...places].sort((a, b) => (b.place!.reviews ?? 0) - (a.place!.reviews ?? 0)).slice(0, 10),
    stars,
    medianReviews,
    quadrants: quad,
    scatter: rated.map((l) => ({ id: l.id, name: l.fullName, area: l.place!.area, rating: l.place!.rating!, reviews: l.place!.reviews ?? 0 })),
    chains: [...brands.entries()]
      .map(([brand, ls]) => {
        const sorted = [...ls].sort((a, b) => (b.place!.reviews ?? 0) - (a.place!.reviews ?? 0))
        return { brand, name: sorted[0].fullName, branches: ls.length, reviews: ls.reduce((s, l) => s + (l.place!.reviews ?? 0), 0) }
      })
      .sort((a, b) => b.branches - a.branches || b.reviews - a.reviews),
    classes: {
      unique: places.filter((l) => l.place!.recordClass === 'unique').length,
      branch: places.filter((l) => l.place!.recordClass === 'branch').length,
      suspected_duplicate: places.filter((l) => l.place!.recordClass === 'suspected_duplicate').length,
    },
    duplicates: places.filter((l) => l.place!.recordClass === 'suspected_duplicate'),
    completeness: [
      { field: 'טלפון', share: pct(places.filter((l) => l.phone).length) },
      { field: 'אתר', share: pct(places.filter((l) => l.place!.website).length) },
      { field: 'שעות פתיחה', share: pct(places.filter((l) => l.place!.hours?.length).length) },
      { field: 'דירוג', share: pct(rated.length) },
      { field: 'מיקום', share: pct(places.filter((l) => l.place!.lat != null).length) },
      { field: 'רמת מחיר', share: pct(places.filter((l) => l.place!.price).length) },
    ],
  }
}
