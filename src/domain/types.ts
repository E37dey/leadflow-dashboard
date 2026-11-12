export type Source = 'website' | 'facebook' | 'instagram' | 'referral' | 'telephone' | 'maps'
export type Stage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'

export const SOURCES: Source[] = ['website', 'facebook', 'instagram', 'referral', 'telephone', 'maps']
export const STAGES: Stage[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']
export const OPEN_STAGES: Stage[] = ['new', 'contacted', 'qualified', 'proposal']
export const DIGITAL_SOURCES: Source[] = ['website', 'facebook', 'instagram', 'maps']

export const SOURCE_LABEL: Record<Source, string> = {
  website: 'אתר',
  facebook: 'פייסבוק',
  instagram: 'אינסטגרם',
  referral: 'הפניה',
  telephone: 'טלפון',
  maps: 'Google Maps',
}

export const STAGE_LABEL: Record<Stage, string> = {
  new: 'חדש',
  contacted: 'נוצר קשר',
  qualified: 'מתאים',
  proposal: 'הצעה נשלחה',
  won: 'נסגר בהצלחה',
  lost: 'אבוד',
}

export interface Activity {
  id: string
  /** ISO timestamp (UTC) */
  at: string
  text: string
}

/** Real data about a business from Google Maps (SPEC: מקור נתונים: Airtable). Unknown = null, never invented. */
export interface Place {
  area: string | null
  category: string | null
  website: string | null
  rating: number | null
  reviews: number | null
  price: string | null
  lat: number | null
  lng: number | null
  mapsUrl: string | null
  status: 'open' | 'temporarily_closed' | 'closed'
  /** Review counts by stars: [5, 4, 3, 2, 1]. */
  stars: [number, number, number, number, number] | null
  hours: { day: string; hours: string }[] | null
  categories: string[]
  images: number | null
  /** Derived at import by fixed rules (domain/quality.ts). */
  brand: string | null
  recordClass: 'unique' | 'branch' | 'suspected_duplicate'
  duplicateOf: string | null
}

export interface Lead {
  id: string
  fullName: string
  company: string
  email: string | null
  phone: string | null
  source: Source
  stage: Stage
  estimatedValueILS: number
  ownerId: string
  /** All timestamps are ISO strings in UTC. Local days are derived with dayKey(). */
  createdAt: string
  lastContactAt: string | null
  nextFollowUpAt: string | null
  notes: string
  activityLog: Activity[]
  /** Only for real places loaded from Airtable. */
  place?: Place
}

export interface Owner {
  id: string
  name: string
  initials: string
}

export interface Task {
  id: string
  title: string
  leadId: string | null
  dueAt: string
  done: boolean
  createdAt: string
  /** Set when the task was created from an insight rule, to prevent duplicates. */
  ruleId?: string
}

export interface DateRange {
  /** Local calendar days (Asia/Jerusalem), inclusive, as YYYY-MM-DD. */
  from: string
  to: string
}

export interface GlobalFilter {
  range: DateRange
  source: Source | 'all'
  ownerId: string | 'all'
}

export type Priority = 'hot' | 'warm' | 'cold'
export const PRIORITY_LABEL: Record<Priority, string> = { hot: 'חם', warm: 'בינוני', cold: 'נמוך' }

export interface TableFilter {
  stage: Stage | 'all'
  priority: Priority | 'all'
  query: string
  /** Set by an insight: show exactly these leads. */
  ids: string[] | null
  idsLabel: string | null
}
