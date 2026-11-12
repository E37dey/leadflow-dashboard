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

/** Owners, then Leads, then Tasks: one table at a time, well under 5 requests per second. */
export async function loadFromAirtable(conn: AtConnection): Promise<AtData> {
  const owners = await fetchTable(conn, AT_TABLES.owners)
  const leads = await fetchTable(conn, AT_TABLES.leads)
  const tasks = await fetchTable(conn, AT_TABLES.tasks)
  return fromAirtable(owners, leads, tasks)
}
