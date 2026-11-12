// SPEC: "שרת API ל-Airtable (סעיף 19)". The JSON API. Runs inside the Vite dev and preview servers (see vite.config.ts).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { F } from '../src/domain/airtable'
import { STAGE_LABEL } from '../src/domain/types'
import { dashboardSummary, pipelineLeads } from '../src/domain/summary'
import { AirtableClient, UpstreamError, maskBase, readAll, readConfig } from './airtable'
import type { Config, ServerEnv, Snapshot } from './airtable'
import { validateActivity, validateLeadPatch } from './validate'

/** Process state: the cache and the last result. Reset only by a refresh or a write. */
interface State {
  snap: Snapshot | null
  lastError: { message: string; status: number | null; at: string } | null
  inflight: Promise<Snapshot> | null
  client: AirtableClient | null
  key: string
}
const state: State = { snap: null, lastError: null, inflight: null, client: null, key: '' }
export const resetState = () => Object.assign(state, { snap: null, lastError: null, inflight: null, client: null, key: '' })

function clientFor(cfg: Config, fetchFn?: typeof fetch) {
  const key = `${cfg.baseId}|${cfg.token.slice(-6)}|${JSON.stringify(cfg.tables)}`
  if (!state.client || state.key !== key) {
    Object.assign(state, { snap: null, inflight: null, client: new AirtableClient(cfg, fetchFn, fetchFn ? 0 : 220), key })
  }
  return state.client!
}

async function sync(cfg: Config, force: boolean, fetchFn?: typeof fetch): Promise<Snapshot> {
  const client = clientFor(cfg, fetchFn)
  if (state.snap && !force) return state.snap
  if (!state.inflight) {
    state.inflight = readAll(client, cfg)
      .then((s) => { state.snap = s; state.lastError = null; return s })
      .catch((e: unknown) => {
        const err = e instanceof UpstreamError ? e : new UpstreamError(null)
        state.lastError = { message: err.message, status: err.status, at: new Date().toISOString() }
        throw err
      })
      .finally(() => { state.inflight = null })
  }
  return state.inflight
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 10_000) throw new Error('too large')
  }
  return raw ? JSON.parse(raw) : {}
}

/** Writes only from this machine, same origin, with the app's own header (a cross-site form cannot send it). */
export function writeAllowed(req: IncomingMessage): boolean {
  const ip = req.socket?.remoteAddress ?? ''
  const local = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
  const origin = req.headers.origin
  const sameOrigin = !origin || origin.replace(/^https?:\/\//, '') === req.headers.host
  return local && sameOrigin && req.headers['x-leadflow-write'] === '1'
}

function meta(snap: Snapshot, cfg: Config) {
  return { source: 'airtable', base: maskBase(cfg.baseId), tables: cfg.tables, counts: snap.counts, syncedAt: snap.syncedAt, durationMs: snap.durationMs, rejected: snap.data.rejected }
}

const bakery = (l: Snapshot['data']['leads'][number]) => {
  const p = l.place!
  return {
    id: l.id, name: l.fullName, city: p.city, region: p.region, area: p.area, rating: p.rating, reviews: p.reviews,
    website: p.website, phone: l.phone, mapsUrl: p.mapsUrl, lat: p.lat, lng: p.lng, recordClass: p.recordClass,
    inPipeline: !!l.inPipeline, stage: l.inPipeline ? l.stage : null,
  }
}

export async function handle(req: IncomingMessage, res: ServerResponse, env: ServerEnv, fetchFn?: typeof fetch): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://local')
  const path = url.pathname.replace(/\/+$/, '')
  const force = url.searchParams.get('refresh') === '1'
  const conf = readConfig(env)
  const readOnly = env.AIRTABLE_READONLY === '1'

  if (path === '/api/integrations/airtable/status') {
    if (!conf.ok) return send(res, 200, { state: 'missing_config', missing: conf.missing, invalid: conf.invalid, ...(readOnly ? { readOnly } : {}) })
    try {
      const snap = await sync(conf.config, force, fetchFn)
      const places = snap.data.leads.filter((l) => l.place).length
      return send(res, 200, { state: places ? 'connected' : 'empty', verifiedAt: snap.syncedAt, ...meta(snap, conf.config), rejected: snap.data.rejected.length, ...(readOnly ? { readOnly } : {}) })
    } catch {
      return send(res, 200, { state: 'error', error: state.lastError, lastSuccessfulSyncAt: state.snap?.syncedAt ?? null, base: maskBase(conf.config.baseId), tables: conf.config.tables })
    }
  }

  if (!conf.ok) return send(res, 503, { error: 'missing_config', message: 'חסרה הגדרה בשרת: ' + [...conf.missing, ...conf.invalid].join(', '), missing: conf.missing, invalid: conf.invalid })

  try {
    if (req.method === 'GET') {
      const snap = await sync(conf.config, force, fetchFn)
      const m = meta(snap, conf.config)
      if (path === '/api/data') return send(res, 200, { meta: m, owners: snap.data.owners, leads: snap.data.leads, tasks: snap.data.tasks })
      if (path === '/api/bakeries') return send(res, 200, { meta: m, bakeries: snap.data.leads.filter((l) => l.place).map(bakery) })
      if (path === '/api/leads') {
        const leads = pipelineLeads(snap.data.leads).map((l) => ({ id: l.id, bakery: l.fullName, region: l.place!.region, stage: l.stage, estimatedValue: l.estimatedValueILS || null, nextFollowUp: l.nextFollowUpAt, lastContact: l.lastContactAt, activities: l.activityLog.length }))
        return send(res, 200, { meta: m, leads })
      }
      if (path === '/api/activities') return send(res, 200, { meta: m, activities: snap.activities })
      if (path === '/api/dashboard/summary') return send(res, 200, { meta: m, summary: dashboardSummary(snap.data.leads) })
      return send(res, 404, { error: 'not_found' })
    }

    const leadMatch = path.match(/^\/api\/leads\/([^/]+)$/)
    if ((req.method === 'PATCH' && leadMatch) || (req.method === 'POST' && path === '/api/activities')) {
      if (readOnly) return send(res, 403, { error: 'read_only', message: 'באתר הציבורי הדאשבורד לקריאה בלבד. שינויים נשמרים רק כשהוא רץ במחשב עם השרת.' })
      if (!writeAllowed(req)) return send(res, 403, { error: 'forbidden', message: 'כתיבה מותרת רק מהדאשבורד שרץ במחשב הזה.' })
      let body: unknown
      try { body = await readBody(req) } catch { return send(res, 400, { error: 'bad_json', message: 'גוף הבקשה לא תקין.' }) }
      const snap = await sync(conf.config, false, fetchFn)
      const client = clientFor(conf.config, fetchFn)

      if (leadMatch) {
        const id = decodeURIComponent(leadMatch[1])
        const lead = snap.data.leads.find((l) => l.id === id)
        const rec = snap.leadRec.get(id)
        if (!lead || !rec || !lead.place) return send(res, 404, { error: 'not_found', message: 'המאפייה לא נמצאה ב-Airtable.' })
        const v = validateLeadPatch(body)
        if (!v.ok) return send(res, 400, { error: 'invalid', message: v.error })
        const fields: Record<string, unknown> = {}
        const p = v.value
        if (p.inPipeline !== undefined) fields[F.pipeline] = p.inPipeline
        if (p.inPipeline === true && !lead.inPipeline) fields[F.stage] = p.stage ?? 'new'
        if (p.stage !== undefined) fields[F.stage] = p.stage
        if (p.value !== undefined) fields[F.value] = p.value ?? 0
        if (p.nextFollowUpAt !== undefined) fields[F.nextFollowUpAt] = p.nextFollowUpAt
        if (p.stage !== undefined || p.inPipeline !== undefined) fields[F.lastContactAt] = new Date().toISOString()
        await client.update(conf.config.tables.leads, rec, fields)
        const note = p.inPipeline === true && !lead.inPipeline ? 'נוסף לצנרת' : p.inPipeline === false ? 'הוצא מהצנרת' : p.stage && p.stage !== lead.stage ? `השלב שונה מ״${STAGE_LABEL[lead.stage]}״ ל״${STAGE_LABEL[p.stage]}״` : null
        if (note) await client.create(conf.config.tables.activities, { [F.id]: newId(), [F.lead]: [rec], [F.actType]: 'stage', [F.actText]: note, [F.actDate]: new Date().toISOString() })
        const fresh = await sync(conf.config, true, fetchFn)
        return send(res, 200, { ok: true, lead: fresh.data.leads.find((l) => l.id === id) ?? null, meta: meta(fresh, conf.config) })
      }

      const v = validateActivity(body)
      if (!v.ok) return send(res, 400, { error: 'invalid', message: v.error })
      const rec = snap.leadRec.get(v.value.leadId)
      if (!rec) return send(res, 404, { error: 'not_found', message: 'הליד לא נמצא ב-Airtable.' })
      const fields: Record<string, unknown> = { [F.id]: newId(), [F.lead]: [rec], [F.actType]: v.value.type, [F.actText]: v.value.text, [F.actDate]: new Date().toISOString() }
      if (v.value.nextAction) fields[F.actNext] = v.value.nextAction
      await client.create(conf.config.tables.activities, fields)
      const fresh = await sync(conf.config, true, fetchFn)
      return send(res, 201, { ok: true, meta: meta(fresh, conf.config) })
    }
    return send(res, 405, { error: 'method_not_allowed' })
  } catch (e) {
    const err = e instanceof UpstreamError ? e : new UpstreamError(null, (e as Error).message)
    return send(res, 502, { error: 'airtable', message: err.message, status: err.status, lastSuccessfulSyncAt: state.snap?.syncedAt ?? null })
  }
}

let n = 0
const newId = () => `A-${Date.now().toString(36)}-${(n++).toString(36)}`
