// SPEC: "מקור נתונים: Airtable": the places screen helpers, on fixed rules and real fields only.
import { describe, expect, it } from 'vitest'
import { apifyToLead } from './maps'
import { EMPTY_PLACE_FILTER, filterPlaces, isOpenAt, israelTime, placesCsv, positiveShare, quadrantOf, sortPlaces } from './places'

const base = { categoryName: 'מאפייה', city: 'תל אביב-יפו', totalScore: 4.5, reviewsCount: 10, scrapedAt: '2026-11-12T15:13:30.000Z', searchString: 'מאפייה' }
const mk = (o: Record<string, unknown>) => apifyToLead({ ...base, ...o })!

// Friday 13.11.2026, 08:30 Israel time (UTC+2 in November).
const FRI_0830 = Date.UTC(2026, 10, 13, 6, 30)
const FRI_1500 = Date.UTC(2026, 10, 13, 13, 0)

describe('places screen helpers', () => {
  it('reads Israel weekday and minute from a moment', () => {
    expect(israelTime(FRI_0830)).toEqual({ day: 5, minute: 510 })
  })
  it('open now comes from the real hours; unknown hours stay unknown', () => {
    const a = mk({ placeId: 'A', title: 'א', openingHours: [{ day: 'יום שישי', hours: '7:00 to 14:00' }] })
    expect(isOpenAt(a, FRI_0830)).toBe(true)
    expect(isOpenAt(a, FRI_1500)).toBe(false)
    expect(isOpenAt(mk({ placeId: 'B', title: 'ב' }), FRI_0830)).toBeNull()
  })
  it('quadrant: rating 4.5 and the median reviews; no rating means no quadrant', () => {
    expect(quadrantOf(mk({ placeId: 'A', title: 'א', totalScore: 4.8, reviewsCount: 500 }), 100)).toBe('stars')
    expect(quadrantOf(mk({ placeId: 'A', title: 'א', totalScore: 4.8, reviewsCount: 20 }), 100)).toBe('hidden')
    expect(quadrantOf(mk({ placeId: 'A', title: 'א', totalScore: 4.1, reviewsCount: 500 }), 100)).toBe('crowded')
    expect(quadrantOf(mk({ placeId: 'A', title: 'א', totalScore: 4.1, reviewsCount: 20 }), 100)).toBe('weak')
    expect(quadrantOf(mk({ placeId: 'A', title: 'א', totalScore: 0, reviewsCount: 0 }), 100)).toBeNull()
  })
  it('positive share is 4 and 5 stars out of all reviews', () => {
    const a = mk({ placeId: 'A', title: 'א', reviewsDistribution: { fiveStar: 6, fourStar: 2, threeStar: 1, twoStar: 0, oneStar: 1 } })
    expect(positiveShare(a)).toBeCloseTo(0.8)
    expect(positiveShare(mk({ placeId: 'B', title: 'ב' }))).toBeNull()
  })
  it('filters by text, area and open now, and sorts by reviews', () => {
    const a = mk({ placeId: 'A', title: 'מאפיית השוק', reviewsCount: 50, openingHours: [{ day: 'יום שישי', hours: '6:00 to 13:00' }] })
    const b = mk({ placeId: 'B', title: 'לחם ארז', city: 'רמת גן', reviewsCount: 300 })
    expect(filterPlaces([a, b], { ...EMPTY_PLACE_FILTER, query: 'ארז' }, 10, FRI_0830).map((l) => l.id)).toEqual([b.id])
    expect(filterPlaces([a, b], { ...EMPTY_PLACE_FILTER, openNow: true }, 10, FRI_0830).map((l) => l.id)).toEqual([a.id])
    expect(sortPlaces([a, b], 'reviews', 'desc').map((l) => l.id)).toEqual([b.id, a.id])
  })
  it('CSV has a BOM, a header and one row per place, escaped', () => {
    const csv = placesCsv([mk({ placeId: 'A', title: 'מאפייה, "טובה"', phone: '03-111' })])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0].startsWith('"מזהה","שם","אזור"')).toBe(true)
    expect(lines[1]).toContain('"מאפייה, ""טובה"""')
  })
})
