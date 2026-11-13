// SPEC: "מקור נתונים: Airtable". Read-only client for the Airtable REST API.
// The token comes from the user at runtime and is sent only to api.airtable.com.
import { AT_TABLES, explainError, fromAirtable } from '../domain/airtable'
import type { AtConnection, AtData, AtRecord } from '../domain/airtable'

const API = 'https://api.airtable.com/v0'

export class AirtableError extends Error {
  status: number | null
  constructor(status: number | null, message: string) {
    super(explainError(status, message))
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

/** Leads first (required: any error stops the load), then Owners and Tasks (optional).
 *  One table at a time, well under 5 requests per second. */
export async function loadFromAirtable(conn: AtConnection): Promise<AtData & { missingTables: string[] }> {
  const leads = await fetchTable(conn, AT_TABLES.leads)
  const missingTables: string[] = []
  const owners = await optionalTable(conn, AT_TABLES.owners, missingTables)
  const tasks = await optionalTable(conn, AT_TABLES.tasks, missingTables)
  return { ...fromAirtable(owners, leads, tasks), missingTables }
}
