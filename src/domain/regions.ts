// SPEC: "שרת API ל-Airtable (סעיף 19)": six regions. A region comes from the Google city by a fixed table,
// and when the city is not in the table, from the area that was searched. Nothing is guessed from coordinates.

export type RegionId = 'haifa' | 'center' | 'jerusalem' | 'sharon' | 'north' | 'south'
export const REGIONS: RegionId[] = ['haifa', 'center', 'jerusalem', 'sharon', 'north', 'south']
export const REGION_LABEL: Record<RegionId, string> = {
  haifa: 'חיפה והקריות',
  center: 'תל אביב והמרכז',
  jerusalem: 'ירושלים והסביבה',
  sharon: 'השרון',
  north: 'צפון',
  south: 'דרום',
}
/** The searches behind each region (Apify, "מאפייה" around these places). */
export const REGION_SEARCH: Record<RegionId, string> = {
  haifa: 'חיפה',
  center: 'תל אביב, רמת גן',
  jerusalem: 'ירושלים',
  sharon: 'הרצליה, נתניה',
  north: 'עפולה',
  south: 'באר שבע',
}

const CITY_REGION: Record<string, RegionId> = {
  'חיפה': 'haifa', 'קריית ביאליק': 'haifa', 'קריית מוצקין': 'haifa', 'קריית ים': 'haifa', 'קריית אתא': 'haifa', 'טירת כרמל': 'haifa', 'נשר': 'haifa',
  'תל אביב-יפו': 'center', 'תל אביב': 'center', 'רמת גן': 'center', 'גבעתיים': 'center', 'בני ברק': 'center', 'חולון': 'center', 'בת ים': 'center', 'פתח תקווה': 'center', 'אלעד': 'center',
  'ירושלים': 'jerusalem', 'מבשרת ציון': 'jerusalem', 'בית שמש': 'jerusalem',
  'הרצליה': 'sharon', 'רמת השרון': 'sharon', 'נתניה': 'sharon', 'כפר סבא': 'sharon', 'רעננה': 'sharon', 'הוד השרון': 'sharon', 'כפר יונה': 'sharon',
  'עפולה': 'north', 'עפולה עילית': 'north', 'אחוזת ברק': 'north', 'מרחביה': 'north', 'נצרת': 'north', 'נוף הגליל': 'north', 'מגדל העמק': 'north',
  'באר שבע': 'south', 'עומר': 'south', 'מיתר': 'south', 'להבים': 'south',
}

export const isRegion = (v: unknown): v is RegionId => typeof v === 'string' && (REGIONS as string[]).includes(v)

/** Region of a place: by its city, else the searched region, else unknown. */
export function regionOf(city: string | null | undefined, searched?: RegionId | null): RegionId | null {
  const c = city?.trim()
  if (c && CITY_REGION[c]) return CITY_REGION[c]
  return searched ?? null
}
