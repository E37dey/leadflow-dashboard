// SPEC: "שרת API ל-Airtable (סעיף 19)": status, paging, errors without fake success, validation, writes.
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { beforeEach, describe, expect, it } from 'vitest'
import { F, leadFields, ownerFields } from '../src/domain/airtable'
import { MAPS_OWNER, apifyToLead } from '../src/domain/maps'
import { handle, resetState } from './api'
import { validateActivity, validateLeadPatch } from './validate'

const ENV = { AIRTABLE_TOKEN: 'patTESTTESTTEST.0123456789', AIRTABLE_BASE_ID: 'appxPmVAUAsA7yIIm' }
const place = (i: number) => apifyToLead({ placeId: `ChIJplace${i}`, title: `מאפייה ${i}`, city: i % 2 ? 'חיפה' : 'רמת גן', totalScore: 4.5, reviewsCount: 20 + i, scrapedAt: '2026-11-12T15:13:30.000Z' })!

/** A fake Airtable: 150 leads in two pages, plus write capture. */
function fakeAirtable(opts: { fail?: number } = {}) {
  const leads = Array.from({ length: 150 }, (_, i) => ({ id: `recL${i}`, fields: leadFields(place(i), 'recO5') as Record<string, unknown> }))
  const tables: Record<string, { id: string; fields: Record<string, unknown> }[]> = {
    Owners: [{ id: 'recO5', fields: ownerFields(MAPS_OWNER) }], Leads: leads, Tasks: [], Activities: [],
  }
  const calls: { method: string; url: string; body?: unknown }[] = []
  const fn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (opts.fail) return new Response(JSON.stringify({ error: { type: 'AUTHENTICATION_REQUIRED' } }), { status: opts.fail })
    const u = new URL(url)
    const [, , , table, rec] = u.pathname.split('/')
    const rows = tables[decodeURIComponent(table)]
    if (method === 'GET') {
      const off = Number(u.searchParams.get('offset') ?? 0)
      const page = rows.slice(off, off + 100)
      return Response.json({ records: page, ...(off + 100 < rows.length ? { offset: String(off + 100) } : {}) })
    }
    const body = JSON.parse(String(init!.body))
    if (method === 'PATCH') { const r = rows.find((x) => x.id === rec)!; Object.assign(r.fields, body.fields); return Response.json(r) }
    const created = body.records.map((r: { fields: Record<string, unknown> }, i: number) => ({ id: `recA${rows.length + i}`, fields: r.fields }))
    rows.push(...created)
    return Response.json({ records: created })
  }) as typeof fetch
  return { fn, calls, tables }
}

async function call(method: string, url: string, opts: { env?: Record<string, string>; body?: unknown; fetchFn?: typeof fetch; headers?: Record<string, string>; ip?: string } = {}) {
  const req = Readable.from(opts.body === undefined ? [] : [JSON.stringify(opts.body)]) as unknown as IncomingMessage
  Object.assign(req, { method, url, headers: { host: '127.0.0.1:5180', ...opts.headers }, socket: { remoteAddress: opts.ip ?? '127.0.0.1' } })
  let status = 0, text = ''
  const res = { statusCode: 0, setHeader() {}, end(this: { statusCode: number }, t: string) { status = this.statusCode; text = t } } as unknown as ServerResponse
  await handle(req, res, opts.env ?? ENV, opts.fetchFn)
  return { status, json: JSON.parse(text) }
}

beforeEach(() => resetState())

describe('server API for Airtable', () => {
  it('missing configuration is reported, never "connected"', async () => {
    const r = await call('GET', '/api/integrations/airtable/status', { env: {} })
    expect(r.json).toEqual({ state: 'missing_config', missing: ['AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID'], invalid: [] })
    expect((await call('GET', '/api/bakeries', { env: {} })).status).toBe(503)
  })
  it('connected only after a real read; all pages are read; the token is never in the answer', async () => {
    const at = fakeAirtable()
    const r = await call('GET', '/api/integrations/airtable/status', { fetchFn: at.fn })
    expect(r.json.state).toBe('connected')
    expect(r.json.counts).toEqual({ owners: 1, leads: 150, tasks: 0, activities: 0 })
    expect(at.calls.filter((c) => c.url.includes('/Leads')).length).toBe(2)
    expect(JSON.stringify(r.json)).not.toContain(ENV.AIRTABLE_TOKEN)
    expect(JSON.stringify(r.json)).not.toContain(ENV.AIRTABLE_BASE_ID)
  })
  it('a failed request is an error with the reason, not a fake success', async () => {
    const at = fakeAirtable({ fail: 401 })
    const s = await call('GET', '/api/integrations/airtable/status', { fetchFn: at.fn })
    expect(s.json.state).toBe('error')
    expect(s.json.error.status).toBe(401)
    const b = await call('GET', '/api/bakeries', { fetchFn: at.fn })
    expect(b.status).toBe(502)
    expect(b.json.message).toContain('401')
  })
  it('cache until refresh=1', async () => {
    const at = fakeAirtable()
    await call('GET', '/api/bakeries', { fetchFn: at.fn })
    const n = at.calls.length
    await call('GET', '/api/bakeries', { fetchFn: at.fn })
    expect(at.calls.length).toBe(n)
    await call('GET', '/api/bakeries?refresh=1', { fetchFn: at.fn })
    expect(at.calls.length).toBeGreaterThan(n)
  })
  it('summary and bakeries come from the records, regions included', async () => {
    const at = fakeAirtable()
    const s = await call('GET', '/api/dashboard/summary', { fetchFn: at.fn })
    expect(s.json.summary.bakeries).toBe(150)
    expect(s.json.summary.regions.find((r: { id: string }) => r.id === 'haifa').bakeries).toBe(75)
    expect(s.json.summary.pipeline.total).toBe(0)
    expect(s.json.summary.pipeline.conversion).toBeNull()
  })
  it('a change made in Airtable shows after refresh', async () => {
    const at = fakeAirtable()
    await call('GET', '/api/bakeries', { fetchFn: at.fn })
    at.tables.Leads[0].fields[F.rating] = 3.1
    const stale = await call('GET', '/api/bakeries', { fetchFn: at.fn })
    expect(stale.json.bakeries.find((b: { id: string }) => b.id === 'M-ChIJplace0').rating).toBe(4.5)
    const fresh = await call('GET', '/api/bakeries?refresh=1', { fetchFn: at.fn })
    expect(fresh.json.bakeries.find((b: { id: string }) => b.id === 'M-ChIJplace0').rating).toBe(3.1)
  })
  it('writes: add to pipeline, change stage, add a note. Each one lands in Airtable', async () => {
    const at = fakeAirtable()
    const H = { 'x-leadflow-write': '1', origin: 'http://127.0.0.1:5180' }
    const a = await call('PATCH', '/api/leads/M-ChIJplace1', { fetchFn: at.fn, headers: H, body: { inPipeline: true } })
    expect(a.status).toBe(200)
    expect(a.json.lead.inPipeline).toBe(true)
    expect(a.json.lead.stage).toBe('new')
    const b = await call('PATCH', '/api/leads/M-ChIJplace1', { fetchFn: at.fn, headers: H, body: { stage: 'qualified', value: 3500 } })
    expect(b.json.lead.stage).toBe('qualified')
    expect(b.json.lead.estimatedValueILS).toBe(3500)
    const c = await call('POST', '/api/activities', { fetchFn: at.fn, headers: H, body: { leadId: 'M-ChIJplace1', type: 'call', text: 'שיחה ראשונה' } })
    expect(c.status).toBe(201)
    const acts = await call('GET', '/api/activities', { fetchFn: at.fn })
    expect(acts.json.activities.map((x: { text: string }) => x.text)).toContain('שיחה ראשונה')
    const s = await call('GET', '/api/dashboard/summary', { fetchFn: at.fn })
    expect(s.json.summary.pipeline.byStage.qualified).toBe(1)
    expect(s.json.summary.pipeline.openValue).toBe(3500)
  })
  it('writes are refused without the app header, from another machine, or with bad input', async () => {
    const at = fakeAirtable()
    expect((await call('PATCH', '/api/leads/M-ChIJplace1', { fetchFn: at.fn, body: { inPipeline: true } })).status).toBe(403)
    expect((await call('PATCH', '/api/leads/M-ChIJplace1', { fetchFn: at.fn, ip: '10.0.0.5', headers: { 'x-leadflow-write': '1' }, body: { inPipeline: true } })).status).toBe(403)
    expect((await call('PATCH', '/api/leads/M-ChIJplace1', { fetchFn: at.fn, headers: { 'x-leadflow-write': '1', origin: 'https://evil.example' }, body: { inPipeline: true } })).status).toBe(403)
    const bad = await call('PATCH', '/api/leads/M-ChIJplace1', { fetchFn: at.fn, headers: { 'x-leadflow-write': '1' }, body: { stage: 'maybe' } })
    expect(bad.status).toBe(400)
    expect(at.calls.some((c) => c.method !== 'GET')).toBe(false)
  })
})

describe('public hosting (read only)', () => {
  it('reads and says readOnly; every write is refused before touching Airtable', async () => {
    const at = fakeAirtable()
    const env = { ...ENV, AIRTABLE_READONLY: '1' }
    const st = await call('GET', '/api/integrations/airtable/status', { env, fetchFn: at.fn })
    expect(st.json.state).toBe('connected')
    expect(st.json.readOnly).toBe(true)
    const H = { 'x-leadflow-write': '1' }
    const before = at.calls.length
    expect((await call('PATCH', '/api/leads/M-ChIJplace1', { env, fetchFn: at.fn, headers: H, body: { inPipeline: true } })).status).toBe(403)
    expect((await call('POST', '/api/activities', { env, fetchFn: at.fn, headers: H, body: { leadId: 'M-ChIJplace1', type: 'note', text: 'x' } })).json.error).toBe('read_only')
    expect(at.calls.length).toBe(before)
  })
})

describe('request validation', () => {
  it('lead patch', () => {
    expect(validateLeadPatch({ stage: 'won', value: 1200.4 })).toEqual({ ok: true, value: { stage: 'won', value: 1200 } })
    expect(validateLeadPatch({ value: -1 }).ok).toBe(false)
    expect(validateLeadPatch({ owner: 'x' }).ok).toBe(false)
    expect(validateLeadPatch({}).ok).toBe(false)
  })
  it('activity', () => {
    expect(validateActivity({ leadId: 'M-ChIJabc12', type: 'note', text: '  שלום  ' })).toEqual({ ok: true, value: { leadId: 'M-ChIJabc12', type: 'note', text: 'שלום' } })
    expect(validateActivity({ leadId: 'L-1', type: 'note', text: 'x' }).ok).toBe(false)
    expect(validateActivity({ leadId: 'M-ChIJabc12', type: 'sms', text: 'x' }).ok).toBe(false)
  })
})
