// SPEC: "מקור נתונים: Airtable". Pure mapping between Airtable records and the app's types.
// The base has three tables: Owners, Leads (linked to Owners), Tasks (linked to Leads).
// Every record carries the app's own id in the "ID" field, so links survive the round trip.
import { isRegion } from './regions'
import { SOURCES, STAGES } from './types'
import type { Activity, Lead, Owner, Place, Source, Stage, Task } from './types'

export const AT_TABLES = { owners: 'Owners', leads: 'Leads', tasks: 'Tasks', activities: 'Activities' } as const

export const F = {
  id: 'ID',
  // Owners
  name: 'Name',
  initials: 'Initials',
  // Leads
  fullName: 'Full name',
  company: 'Company',
  email: 'Email',
  phone: 'Phone',
  source: 'Source',
  stage: 'Stage',
  value: 'Estimated value',
  owner: 'Owner',
  createdAt: 'Created at',
  lastContactAt: 'Last contact at',
  nextFollowUpAt: 'Next follow-up at',
  notes: 'Notes',
  activity: 'Activity log',
  area: 'Area',
  city: 'City',
  region: 'Region',
  pipeline: 'Pipeline',
  category: 'Category',
  website: 'Website',
  rating: 'Rating',
  reviews: 'Reviews',
  price: 'Price',
  lat: 'Lat',
  lng: 'Lng',
  mapsUrl: 'Maps URL',
  status: 'Status',
  stars: ['Stars 5', 'Stars 4', 'Stars 3', 'Stars 2', 'Stars 1'] as const,
  hours: 'Hours',
  categories: 'Categories',
  images: 'Images',
  brand: 'Brand',
  recordClass: 'Record class',
  duplicateOf: 'Duplicate of',
  // Tasks
  title: 'Title',
  lead: 'Lead',
  dueAt: 'Due at',
  done: 'Done',
  ruleId: 'Rule ID',
  // Activities
  actType: 'Type',
  actText: 'Description',
  actDate: 'Date',
  actNext: 'Next action',
} as const

export interface AtRecord {
  id: string
  fields: Record<string, unknown>
}

export interface AtData {
  owners: Owner[]
  leads: Lead[]
  tasks: Task[]
  /** Records that failed validation and were not loaded, with the reason. */
  rejected: { table: string; id: string; reason: string }[]
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const isoOrNull = (v: unknown): string | null => {
  const s = str(v)
  return s && !Number.isNaN(Date.parse(s)) ? new Date(Date.parse(s)).toISOString() : null
}
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const STATUSES: Place['status'][] = ['open', 'temporarily_closed', 'closed']
const CLASSES: Place['recordClass'][] = ['unique', 'branch', 'suspected_duplicate']
function parseHoursField(v: unknown): Place['hours'] {
  const s = str(v)
  if (!s) return null
  try {
    const a = JSON.parse(s)
    return Array.isArray(a) ? a.filter((h) => h && typeof h.day === 'string' && typeof h.hours === 'string') : null
  } catch {
    return null
  }
}

/** Real place fields, present only on leads that came from Google Maps. */
function readPlace(f: Record<string, unknown>): Place | undefined {
  const keys = [F.area, F.category, F.website, F.rating, F.reviews, F.price, F.lat, F.lng, F.mapsUrl, F.status, F.recordClass]
  if (!keys.some((k) => f[k] != null && f[k] !== '')) return undefined
  const status = f[F.status] as Place['status']
  return {
    area: placeName(f[F.area]), city: placeName(f[F.city]), region: regionField(f[F.region]), category: str(f[F.category]), website: str(f[F.website]),
    rating: numOrNull(f[F.rating]), reviews: numOrNull(f[F.reviews]), price: str(f[F.price]),
    lat: numOrNull(f[F.lat]), lng: numOrNull(f[F.lng]), mapsUrl: str(f[F.mapsUrl]),
    status: STATUSES.includes(status) ? status : 'open',
    stars: F.stars.some((k) => typeof f[k] === 'number') ? (F.stars.map((k) => numOrNull(f[k]) ?? 0) as [number, number, number, number, number]) : null,
    hours: parseHoursField(f[F.hours]),
    categories: (str(f[F.categories]) ?? '').split(',').map((c) => c.trim()).filter(Boolean),
    images: numOrNull(f[F.images]),
    brand: str(f[F.brand]),
    recordClass: CLASSES.includes(f[F.recordClass] as Place['recordClass']) ? (f[F.recordClass] as Place['recordClass']) : 'unique',
    duplicateOf: str(f[F.duplicateOf]),
  }
}

export const ACT_LABEL: Record<string, string> = { note: 'הערה', call: 'שיחה', email: 'מייל', meeting: 'פגישה', stage: 'שינוי שלב' }

// Google sometimes puts a phone number in the city field: a place name must contain letters.
const placeName = (v: unknown) => { const s = str(v); return s && /\p{L}/u.test(s) ? s : null }
const regionField = (v: unknown) => (isRegion(v) ? v : null)
const firstLink = (v: unknown): string | null => (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null)

function parseActivity(v: unknown): Activity[] {
  const s = str(v)
  if (!s) return []
  try {
    const a = JSON.parse(s)
    return Array.isArray(a) ? a.filter((x) => x && typeof x.id === 'string' && typeof x.at === 'string' && typeof x.text === 'string') : []
  } catch {
    return []
  }
}

/** Airtable records -> app data. Links are resolved through each record's own "ID" field. */
export function fromAirtable(ownersRec: AtRecord[], leadsRec: AtRecord[], tasksRec: AtRecord[], activitiesRec: AtRecord[] = []): AtData {
  const rejected: AtData['rejected'] = []
  const reject = (table: string, r: AtRecord, reason: string) => rejected.push({ table, id: str(r.fields[F.id]) ?? r.id, reason })

  const owners: Owner[] = []
  const ownerByRec = new Map<string, string>()
  for (const r of ownersRec) {
    const id = str(r.fields[F.id]), name = str(r.fields[F.name])
    if (!id || !name) { reject(AT_TABLES.owners, r, 'חסר ID או שם'); continue }
    owners.push({ id, name, initials: str(r.fields[F.initials]) ?? name.slice(0, 2) })
    ownerByRec.set(r.id, id)
  }

  const leads: Lead[] = []
  const leadByRec = new Map<string, string>()
  for (const r of leadsRec) {
    const f = r.fields
    const id = str(f[F.id]), fullName = str(f[F.fullName]), createdAt = isoOrNull(f[F.createdAt])
    const place = readPlace(f)
    const source = f[F.source] as Source, stage = (f[F.stage] ?? (place ? 'new' : undefined)) as Stage
    const value = typeof f[F.value] === 'number' ? (f[F.value] as number) : 0
    if (!id || !fullName) { reject(AT_TABLES.leads, r, 'חסר ID או שם'); continue }
    if (!createdAt) { reject(AT_TABLES.leads, r, 'תאריך יצירה לא תקין'); continue }
    if (!SOURCES.includes(source)) { reject(AT_TABLES.leads, r, `מקור לא מוכר: ${String(f[F.source])}`); continue }
    if (!STAGES.includes(stage)) { reject(AT_TABLES.leads, r, `שלב לא מוכר: ${String(f[F.stage])}`); continue }
    if (value < 0) { reject(AT_TABLES.leads, r, 'שווי שלילי'); continue }
    const ownerRec = firstLink(f[F.owner])
    leads.push({
      id,
      fullName,
      company: str(f[F.company]) ?? '',
      email: str(f[F.email]),
      phone: str(f[F.phone]),
      source,
      stage,
      estimatedValueILS: value,
      ownerId: (ownerRec && ownerByRec.get(ownerRec)) ?? '',
      createdAt,
      lastContactAt: isoOrNull(f[F.lastContactAt]),
      nextFollowUpAt: isoOrNull(f[F.nextFollowUpAt]),
      notes: str(f[F.notes]) ?? '',
      activityLog: parseActivity(f[F.activity]),
      ...(place ? { place, inPipeline: f[F.pipeline] === true } : {}),
    })
    leadByRec.set(r.id, id)
  }

  const tasks: Task[] = []
  for (const r of tasksRec) {
    const f = r.fields
    const id = str(f[F.id]), title = str(f[F.title]), dueAt = isoOrNull(f[F.dueAt])
    if (!id || !title || !dueAt) { reject(AT_TABLES.tasks, r, 'חסר ID, כותרת או תאריך יעד'); continue }
    const leadRec = firstLink(f[F.lead])
    const task: Task = {
      id,
      title,
      leadId: (leadRec && leadByRec.get(leadRec)) ?? null,
      dueAt,
      done: f[F.done] === true,
      createdAt: isoOrNull(f[F.createdAt]) ?? dueAt,
    }
    const rule = str(f[F.ruleId])
    if (rule) task.ruleId = rule
    tasks.push(task)
  }

  // Activities (written from the dashboard) go into the lead's log, newest first. A broken link is a rejected record.
  const byId = new Map(leads.map((l) => [l.id, l]))
  for (const r of activitiesRec) {
    const f = r.fields
    const id = str(f[F.id]), text = str(f[F.actText]), at = isoOrNull(f[F.actDate])
    const leadRec = firstLink(f[F.lead]), leadId = leadRec ? leadByRec.get(leadRec) : undefined
    if (!id || !text || !at) { reject(AT_TABLES.activities, r, 'חסר ID, תיאור או תאריך'); continue }
    const lead = leadId ? byId.get(leadId) : undefined
    if (!lead) { reject(AT_TABLES.activities, r, 'הפעילות לא מקושרת לליד קיים'); continue }
    const kind = str(f[F.actType]), next = str(f[F.actNext])
    lead.activityLog.push({ id, at, text: `${kind && ACT_LABEL[kind] ? `${ACT_LABEL[kind]}: ` : ''}${text}${next ? ` · הצעד הבא: ${next}` : ''}` })
  }
  for (const l of leads) l.activityLog.sort((a, b) => b.at.localeCompare(a.at))

  // Stable order, same as the demo data (by id).
  leads.sort((a, b) => a.id.localeCompare(b.id))
  tasks.sort((a, b) => a.id.localeCompare(b.id))
  owners.sort((a, b) => a.id.localeCompare(b.id))
  return { owners, leads, tasks, rejected }
}

/** App data -> Airtable fields (used to seed the base). Links are given as the target's Airtable record id. */
export function ownerFields(o: Owner) {
  return { [F.id]: o.id, [F.name]: o.name, [F.initials]: o.initials }
}

export function leadFields(l: Lead, ownerRecId: string | undefined) {
  const out: Record<string, unknown> = {
    [F.id]: l.id,
    [F.fullName]: l.fullName,
    [F.company]: l.company,
    [F.source]: l.source,
    [F.createdAt]: l.createdAt,
    // For a place this is only the import record (where it came from). User notes go to the Activities table.
    [F.activity]: JSON.stringify(l.activityLog),
  }
  // Sales fields belong to the user. For a Google Maps place the import never writes them.
  if (!l.place) {
    out[F.stage] = l.stage
    out[F.value] = l.estimatedValueILS
  }
  if (l.email) out[F.email] = l.email
  if (l.phone) out[F.phone] = l.phone
  if (l.notes) out[F.notes] = l.notes
  if (!l.place && l.lastContactAt) out[F.lastContactAt] = l.lastContactAt
  if (!l.place && l.nextFollowUpAt) out[F.nextFollowUpAt] = l.nextFollowUpAt
  if (ownerRecId) out[F.owner] = [ownerRecId]
  if (l.place) {
    const p = l.place
    const put = (k: string, v: unknown) => { if (v != null && v !== '') out[k] = v }
    put(F.area, p.area); put(F.city, p.city); put(F.region, p.region); put(F.category, p.category); put(F.website, p.website); put(F.rating, p.rating); put(F.reviews, p.reviews)
    put(F.price, p.price); put(F.lat, p.lat); put(F.lng, p.lng); put(F.mapsUrl, p.mapsUrl); put(F.status, p.status)
    if (p.stars) F.stars.forEach((k, i) => put(k, p.stars![i]))
    if (p.hours) put(F.hours, JSON.stringify(p.hours))
    if (p.categories.length) put(F.categories, p.categories.join(', '))
    put(F.images, p.images); put(F.brand, p.brand); put(F.recordClass, p.recordClass); put(F.duplicateOf, p.duplicateOf)
  }
  return out
}

export function taskFields(t: Task, leadRecId: string | undefined) {
  const out: Record<string, unknown> = { [F.id]: t.id, [F.title]: t.title, [F.dueAt]: t.dueAt, [F.done]: t.done, [F.createdAt]: t.createdAt }
  if (t.ruleId) out[F.ruleId] = t.ruleId
  if (leadRecId) out[F.lead] = [leadRecId]
  return out
}

export interface AtConnection {
  token: string
  baseId: string
}

export const validToken = (t: string) => /^pat[A-Za-z0-9.]{10,}$/.test(t.trim())
export const validBaseId = (b: string) => /^app[A-Za-z0-9]{14}$/.test(b.trim())

/** Hebrew message for an API failure (SPEC: errors do not replace the data). */
export function explainError(status: number | null, message = ''): string {
  if (status === 401) return 'הטוקן לא תקין או שפג תוקפו (401).'
  if (status === 403) return 'לטוקן אין הרשאה לבסיס הזה (403). בדקו הרשאות קריאה וגישה לבסיס.'
  if (status === 404) return 'הבסיס או הטבלה לא נמצאו (404). בדקו את ה-Base ID ואת שמות הטבלאות.'
  if (status === 429) return 'יותר מדי בקשות (429). נסו שוב בעוד כמה שניות.'
  if (status === null) return 'אין חיבור לרשת או ש-Airtable לא זמין.'
  return `שגיאה מ-Airtable (${status}). ${message}`.trim()
}
