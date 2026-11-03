export type Source = 'website' | 'facebook' | 'instagram' | 'referral' | 'telephone'
export type Stage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'

export const SOURCES: Source[] = ['website', 'facebook', 'instagram', 'referral', 'telephone']
export const STAGES: Stage[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']
export const OPEN_STAGES: Stage[] = ['new', 'contacted', 'qualified', 'proposal']
export const DIGITAL_SOURCES: Source[] = ['website', 'facebook', 'instagram']

export const SOURCE_LABEL: Record<Source, string> = {
  website: 'אתר',
  facebook: 'פייסבוק',
  instagram: 'אינסטגרם',
  referral: 'הפניה',
  telephone: 'טלפון',
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
