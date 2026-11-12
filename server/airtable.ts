// SPEC: "שרת API ל-Airtable (סעיף 19)". Server side only: the token lives here and never reaches the browser.
// Reads every page (offset), stays under 5 requests per second, retries 429 and 5xx, caches until a manual refresh.
import { AT_TABLES, F, explainError, fromAirtable } from '../src/domain/airtable'
import type { AtData, AtRecord } from '../src/domain/airtable'

export interface ServerEnv {
  AIRTABLE_TOKEN?: string
  AIRTABLE_BASE_ID?: string
  AIRTABLE_LEADS_TABLE?: string
  AIRTABLE_ACTIVITIES_TABLE?: string
  AIRTABLE_OWNERS_TABLE?: string
  AIRTABLE_TASKS_TABLE?: string
  /** '1' on public hosting: the API only reads, every write is refused. */
  AIRTABLE_READONLY?: string
}

export interface Config {
  token: string
  baseId: string
  tables: { owners: string; leads: string; tasks: string; activities: string }
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; missing: string[]; invalid: string[] }

export function readConfig(env: ServerEnv): ConfigResult {
  const token = env.AIRTABLE_TOKEN?.trim() ?? ''
  const baseId = env.AIRTABLE_BASE_ID?.trim() ?? ''
  const missing = [!token && 'AIRTABLE_TOKEN', !baseId && 'AIRTABLE_BASE_ID'].filter(Boolean) as string[]
  const invalid = [token && !/^pat[A-Za-z0-9.]{10,}$/.test(token) && 'AIRTABLE_TOKEN', baseId && !/^app[A-Za-z0-9]{14}$/.test(baseId) && 'AIRTABLE_BASE_ID'].filter(Boolean) as string[]
  if (missing.length || invalid.length) return { ok: false, missing, invalid }
  return {
    ok: true,
    config: {
      token,
      baseId,
      tables: {
        owners: env.AIRTABLE_OWNERS_TABLE?.trim() || AT_TABLES.owners,
        leads: env.AIRTABLE_LEADS_TABLE?.trim() || AT_TABLES.leads,
        tasks: env.AIRTABLE_TASKS_TABLE?.trim() || AT_TABLES.tasks,
        activities: env.AIRTABLE_ACTIVITIES_TABLE?.trim() || AT_TABLES.activities,
      },
    },
  }
}

/** Shown in the status instead of the base id itself. */
export const maskBase = (b: string) => (b.length > 8 ? `${b.slice(0, 5)}…${b.slice(-3)}` : '…')

export class UpstreamError extends Error {
  status: number | null
  constructor(status: number | null, detail = '') {
    super(explainError(status, detail))
    this.status = status
  }
}

type Fetch = typeof fetch
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class AirtableClient {
  private last = 0
  private cfg: Config
  private fetchFn: Fetch
  private gapMs: number
  constructor(cfg: Config, fetchFn: Fetch = fetch, gapMs = 220) {
    this.cfg = cfg
    this.fetchFn = fetchFn
    this.gapMs = gapMs
  }

  /** One request with throttling and retries. Never swallows an error. */
  async request(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.last + this.gapMs - Date.now()
      if (wait > 0) await sleep(wait)
      this.last = Date.now()
      let res: Response
      try {
        res = await this.fetchFn(`https://api.airtable.com/v0/${this.cfg.baseId}/${path}`, {
          method,
          headers: { Authorization: `Bearer ${this.cfg.token}`, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      } catch {
        if (attempt < 2) { await sleep(500 * 2 ** attempt); continue }
        throw new UpstreamError(null)
      }
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok) return json
      if ((res.status === 429 || res.status >= 500) && attempt < 3) { await sleep((res.status === 429 ? 1500 : 500) * 2 ** attempt); continue }
      const err = json.error as { message?: string; type?: string } | string | undefined
      throw new UpstreamError(res.status, typeof err === 'string' ? err : err?.message ?? err?.type ?? '')
    }
  }

  async table(name: string): Promise<AtRecord[]> {
    const out: AtRecord[] = []
    let offset: string | undefined
    do {
      const q = new URLSearchParams({ pageSize: '100' })
      if (offset) q.set('offset', offset)
      const page = await this.request('GET', `${encodeURIComponent(name)}?${q}`)
      out.push(...((page.records as AtRecord[]) ?? []))
      offset = page.offset as string | undefined
    } while (offset)
    return out
  }

  update(table: string, rec: string, fields: Record<string, unknown>) {
    return this.request('PATCH', `${encodeURIComponent(table)}/${rec}`, { fields, typecast: true })
  }
  create(table: string, fields: Record<string, unknown>) {
    return this.request('POST', encodeURIComponent(table), { records: [{ fields }], typecast: true })
  }
}

export interface ActivityRow { id: string; leadId: string | null; type: string | null; text: string; at: string; next: string | null }

export interface Snapshot {
  data: AtData
  activities: ActivityRow[]
  /** App id -> Airtable record id, for writes. */
  leadRec: Map<string, string>
  counts: Record<'owners' | 'leads' | 'tasks' | 'activities', number>
  syncedAt: string
  durationMs: number
}

/** Read all four tables and normalize. Referential problems end up in data.rejected. */
export async function readAll(client: AirtableClient, cfg: Config): Promise<Snapshot> {
  const t0 = Date.now()
  const owners = await client.table(cfg.tables.owners)
  const leads = await client.table(cfg.tables.leads)
  const tasks = await client.table(cfg.tables.tasks)
  const acts = await client.table(cfg.tables.activities)
  const data = fromAirtable(owners, leads, tasks, acts)
  const leadRec = new Map<string, string>()
  const idByRec = new Map<string, string>()
  for (const r of leads) {
    const id = r.fields[F.id]
    if (typeof id === 'string') { leadRec.set(id, r.id); idByRec.set(r.id, id) }
  }
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  const activities: ActivityRow[] = acts
    .map((r) => {
      const link = Array.isArray(r.fields[F.lead]) ? (r.fields[F.lead] as string[])[0] : undefined
      return { id: s(r.fields[F.id]) ?? r.id, leadId: (link && idByRec.get(link)) ?? null, type: s(r.fields[F.actType]), text: s(r.fields[F.actText]) ?? '', at: s(r.fields[F.actDate]) ?? '', next: s(r.fields[F.actNext]) }
    })
    .sort((a, b) => b.at.localeCompare(a.at))
  return {
    data, activities, leadRec,
    counts: { owners: owners.length, leads: leads.length, tasks: tasks.length, activities: acts.length },
    syncedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
  }
}
