// SPEC: "שרת API ל-Airtable (סעיף 19)": opportunity score and regions, fixed rules.
import { describe, expect, it } from 'vitest'
import { apifyToLead } from './maps'
import { DEFAULT_WEIGHTS, cleanWeights, opportunity } from './opportunity'
import { regionOf } from './regions'

const base = { categoryName: 'מאפייה', city: 'חיפה', scrapedAt: '2026-11-12T15:13:30.000Z', searchString: 'מאפייה' }
const mk = (o: Record<string, unknown>) => apifyToLead({ ...base, placeId: 'A', title: 'א', ...o })!

describe('regions', () => {
  it('the city decides; unknown city falls back to the searched region', () => {
    expect(regionOf('רמת גן')).toBe('center')
    expect(regionOf('הרצליה')).toBe('sharon')
    expect(regionOf('אחוזת ברק')).toBe('north')
    expect(regionOf('+972536661432', 'north')).toBe('north')
    expect(regionOf(null)).toBeNull()
    expect(mk({}).place!.region).toBe('haifa')
    const phoneCity = mk({ city: '+972536661432' })
    expect(phoneCity.place!.city).toBeNull()
    expect(apifyToLead({ ...base, placeId: 'A', title: 'א', city: '+972536661432' }, 'north')!.place!.region).toBe('north')
  })
})

describe('opportunity score', () => {
  it('full data: weighted parts add up to the score', () => {
    const l = mk({ totalScore: 5, reviewsCount: 1000, website: 'https://x.co.il', phone: '04-1', openingHours: [{ day: 'יום ראשון', hours: '7:00 to 14:00' }] })
    const o = opportunity(l)
    expect(o.score).toBe(100)
    expect(o.missing).toEqual([])
  })
  it('a missing part is left out, not counted as zero', () => {
    // 3 reviews: too few for a reputation. The other parts are re-weighted.
    const l = mk({ totalScore: 5, reviewsCount: 3, website: 'https://x.co.il', phone: '04-1', openingHours: [{ day: 'יום ראשון', hours: '7:00 to 14:00' }] })
    const o = opportunity(l)
    expect(o.missing).toEqual(['מוניטין'])
    expect(o.parts.find((p) => p.key === 'reputation')!.points).toBe(0)
    const volume = Math.log10(4) / Math.log10(1001)
    expect(o.score).toBe(Math.round(100 * (25 * volume + 15 + 15 + 15) / 70))
  })
  it('not enough data: no reviews at all means no score, even with website and phone', () => {
    const l = mk({ totalScore: null, reviewsCount: null, website: 'https://x.co.il', phone: '04-1', openingHours: [{ day: 'יום ראשון', hours: '7:00 to 14:00' }] })
    const o = opportunity(l)
    expect(o.score).toBeNull()
    expect(o.coverage).toBeCloseTo(0.45)
  })
  it('known zero still counts: no website and no phone pull the score down', () => {
    const full = opportunity(mk({ totalScore: 4.5, reviewsCount: 200, website: 'https://x.co.il', phone: '04-1' })).score!
    const bare = opportunity(mk({ totalScore: 4.5, reviewsCount: 200 })).score!
    expect(bare).toBeLessThan(full)
  })
  it('weights are configurable, and broken saved weights fall back to the defaults', () => {
    const l = mk({ totalScore: 5, reviewsCount: 50 })
    const onlyRep = opportunity(l, { ...DEFAULT_WEIGHTS, parts: { reputation: 1, volume: 0, presence: 0, contact: 0, region: 0 } })
    expect(onlyRep.score).toBe(100)
    expect(cleanWeights({ parts: { reputation: -5, volume: 'x' } })).toEqual(DEFAULT_WEIGHTS)
  })
})
