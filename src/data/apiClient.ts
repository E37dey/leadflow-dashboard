// SPEC: "שרת API ל-Airtable (סעיף 19)". The browser talks only to our own /api. No token here.
import type { Lead, Owner, Stage, Task } from '../domain/types'

export type ServerState = 'connected' | 'empty' | 'error' | 'missing_config' | 'unavailable'

export interface ServerMeta {
  source: 'airtable'
  base: string
  tables: Record<'owners' | 'leads' | 'tasks' | 'activities', string>
  counts: Record<'owners' | 'leads' | 'tasks' | 'activities', number>
  syncedAt: string
  durationMs: number
  rejected: { table: string; id: string; reason: string }[]
}

export interface ServerStatus {
  state: ServerState
  verifiedAt?: string
  base?: string
  tables?: ServerMeta['tables']
  counts?: ServerMeta['counts']
  rejected?: number
  missing?: string[]
  invalid?: string[]
  error?: { message: string; status: number | null; at: string } | null
  lastSuccessfulSyncAt?: string | null
}

export class ApiError extends Error {}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.message ?? `שגיאה מהשרת (${res.status})`)
  return body as T
}

/** null when there is no API at all (static hosting such as GitHub Pages). */
export async function fetchStatus(refresh = false): Promise<ServerStatus> {
  let res: Response
  try {
    res = await fetch(`/api/integrations/airtable/status${refresh ? '?refresh=1' : ''}`, { headers: { Accept: 'application/json' } })
  } catch {
    return { state: 'unavailable' }
  }
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return { state: 'unavailable' }
  return res.json()
}

export interface ServerData { meta: ServerMeta; owners: Owner[]; leads: Lead[]; tasks: Task[] }

export async function fetchData(refresh: boolean): Promise<ServerData> {
  return json(await fetch(`/api/data${refresh ? '?refresh=1' : ''}`))
}

const WRITE = { 'Content-Type': 'application/json', 'x-leadflow-write': '1' }

export interface LeadPatch { inPipeline?: boolean; stage?: Stage; value?: number | null; nextFollowUpAt?: string | null }

export async function patchLead(id: string, patch: LeadPatch): Promise<void> {
  await json(await fetch(`/api/leads/${encodeURIComponent(id)}`, { method: 'PATCH', headers: WRITE, body: JSON.stringify(patch) }))
}

export async function postActivity(a: { leadId: string; type: 'note' | 'call' | 'email' | 'meeting'; text: string; nextAction?: string }): Promise<void> {
  await json(await fetch('/api/activities', { method: 'POST', headers: WRITE, body: JSON.stringify(a) }))
}
