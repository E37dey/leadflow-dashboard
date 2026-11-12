// SPEC: "מקור נתונים: Airtable": duplicate classification and opening hours, on fixed rules.
import { describe, expect, it } from 'vitest'
import { apifyToLead } from './maps'
import { classifyPlaces, domainOf, normalizeName, openGrid, parseHours } from './quality'

const base = { categoryName: 'מאפייה', city: 'תל אביב-יפו', totalScore: 4.5, reviewsCount: 10, scrapedAt: '2026-11-12T15:13:30.000Z', searchString: 'מאפייה' }
const mk = (o: Record<string, unknown>) => apifyToLead({ ...base, ...o })!

describe('data quality: duplicates, branches, opening hours', () => {
  it('the same place listed twice nearby is a suspected duplicate of the one with more reviews', () => {
    const a = mk({ placeId: 'A', title: 'מאפיית השוק', phone: '03-111', reviewsCount: 50, location: { lat: 32.08, lng: 34.78 } })
    const b = mk({ placeId: 'B', title: 'מאפיית השוק בע"מ', phone: '03-111', reviewsCount: 3, location: { lat: 32.0802, lng: 34.7801 } })
    const [ca, cb] = classifyPlaces([a, b])
    expect(ca.place!.recordClass).toBe('unique')
    expect(cb.place!.recordClass).toBe('suspected_duplicate')
    expect(cb.place!.duplicateOf).toContain('M-A')
  })
  it('the same brand far apart is a branch, not a duplicate', () => {
    const a = mk({ placeId: 'A', title: 'רולדין דיזנגוף', website: 'https://www.roladin.co.il/x', location: { lat: 32.08, lng: 34.78 } })
    const b = mk({ placeId: 'B', title: 'רולדין רמת גן', website: 'https://roladin.co.il/', location: { lat: 32.07, lng: 34.82 } })
    const out = classifyPlaces([a, b])
    expect(out.map((l) => l.place!.recordClass)).toEqual(['branch', 'branch'])
    expect(out[0].place!.brand).toBe('roladin.co.il')
  })
  it('generic domains are never a brand, names are normalized', () => {
    expect(domainOf('https://www.instagram.com/some_bakery')).toBeNull()
    expect(domainOf('https://shop.example.co.il/a')).toBe('shop.example.co.il')
    expect(normalizeName('מאפיית אריאל בע"מ - סניף הצפון')).toBe('מאפיית אריאל')
  })
  it('opening hours: ranges, closed, 24 hours, past midnight', () => {
    expect(parseHours('8:00 to 19:00')).toEqual([[480, 1140]])
    expect(parseHours('סגור')).toEqual([])
    expect(parseHours('פתוח 24 שעות')).toEqual([[0, 1440]])
    expect(parseHours('7:00 to 14:00, 16:00 to 19:00')).toEqual([[420, 840], [960, 1140]])
    expect(parseHours('22:00 to 2:00')).toEqual([[1320, 1440]])
  })
  it('the open grid counts each place once per open slot', () => {
    const a = mk({ placeId: 'A', title: 'א', openingHours: [{ day: 'יום שישי', hours: '7:00 to 9:00' }, { day: 'יום שבת', hours: 'סגור' }] })
    const { grid, withHours } = openGrid([a])
    expect(withHours).toBe(1)
    expect(grid[5][7]).toBe(1)
    expect(grid[5][9]).toBe(0)
    expect(grid[6].every((v) => v === 0)).toBe(true)
  })
})
