// SPEC: "מקור נתונים: Airtable". Read-only client for the Airtable REST API.
// The token comes from the user at runtime and is sent only to api.airtable.com.
import { AT_TABLES, explainError, fromAirtable } from '../domain/airtable'
import type { AtConnection, AtData, AtRecord } from '../domain/airtable'

const API = 'https://api.airtable.com/v0'

export class AirtableError extends Error {
  status: number | null
  /** `ready`: the message is already the Hebrew text to show. */
  constructor(status: number | null, message: string, ready = false) {
    super(ready ? message : explainError(status, message))
    this.status = status
  }
}

async function page(conn: AtConnection, table: string, offset?: string): Promise<{ records: AtRecord[]; offset?: string }> {
  const q = new URLSearchParams({ pageSize: '100' })
  if (offset) q.set('offset', offset)
  let res: Response
  try {
    res = await fetch(`${API}/${encodeURIComponent(conn.baseId.trim())}/${encodeURIComponent(table)}?${q}`, {
      headers: { Authorization: `Bearer ${conn.token.trim()}` },
    })
  } catch {
    throw new AirtableError(null, '')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new AirtableError(res.status, body?.error?.message ?? body?.error?.type ?? '')
  return body
}

/** All records of a table, following the offset until the last page (100 per request). */
export async function fetchTable(conn: AtConnection, table: string): Promise<AtRecord[]> {
  const out: AtRecord[] = []
  let offset: string | undefined
  do {
    const p = await page(conn, table, offset)
    out.push(...p.records)
    offset = p.offset
  } while (offset)
  return out
}

/** A table the base may not have. Once Leads loaded, the token and base are fine, so 403/404 here means "no such table". */
async function optionalTable(conn: AtConnection, table: string, missing: string[]): Promise<AtRecord[]> {
  try {
    return await fetchTable(conn, table)
  } catch (e) {
    if (e instanceof AirtableError && (e.status === 403 || e.status === 404)) {
      missing.push(table)
      return []
    }
    throw e
  }
}

/** Leads failed with 403/404, which Airtable returns both for "no access" and for "no such table".
 *  The base's schema (schema.bases:read) tells the two apart: if it opens, the base is fine and Leads is missing. */
async function explainLeadsMiss(conn: AtConnection, status: number): Promise<AirtableError> {
  try {
    const res = await fetch(`${API}/meta/bases/${encodeURIComponent(conn.baseId.trim())}/tables`, {
      headers: { Authorization: `Bearer ${conn.token.trim()}` },
    })
    if (res.ok) {
      const names = ((await res.json())?.tables ?? []).map((t: { name?: unknown }) => String(t.name)).filter(Boolean) as string[]
      const list = names.length ? ` הטבלאות בו: ${names.slice(0, 6).join(', ')}${names.length > 6 ? '…' : ''}.` : ''
      return new AirtableError(status, `הטוקן והבסיס תקינים, אבל בבסיס הזה אין טבלה בשם ${AT_TABLES.leads}.${list} בדקו שזה הבסיס הנכון, או שנו את שם הטבלה ל-${AT_TABLES.leads}.`, true)
    }
    if (res.status === 403 || res.status === 404) {
      return new AirtableError(status, `אין גישה לבסיס (${status}): ה-Base ID שגוי, או שבהגדרות הטוקן (Access) לא נבחר הבסיס הזה.`, true)
    }
  } catch {
    /* the schema call is only a hint: fall back to the general message */
  }
  return new AirtableError(status, '')
}

/** Leads first (required: any error stops the load), then Owners and Tasks (optional).
 *  One table at a time, well under 5 requests per second. */
export async function loadFromAirtable(conn: AtConnection): Promise<AtData & { missingTables: string[] }> {
  let leads: AtRecord[]
  try {
    leads = await fetchTable(conn, AT_TABLES.leads)
  } catch (e) {
    if (e instanceof AirtableError && (e.status === 403 || e.status === 404)) throw await explainLeadsMiss(conn, e.status)
    throw e
  }
  const missingTables: string[] = []
  const owners = await optionalTable(conn, AT_TABLES.owners, missingTables)
  const tasks = await optionalTable(conn, AT_TABLES.tasks, missingTables)
  return { ...fromAirtable(owners, leads, tasks), missingTables }
}
