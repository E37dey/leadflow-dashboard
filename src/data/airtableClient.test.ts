// SPEC 20: "מסך התחברות עם טוקן" — a test base with only a Leads table, imported from the CSV template.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadFromAirtable } from './airtableClient'
import { extractBaseId } from '../domain/airtable'
import type { AtRecord } from '../domain/airtable'
import templateCsv from '../../public/airtable-template/Leads.csv?raw'

const CONN = { token: 'patTEST1234567890.abc', baseId: 'appAAAAAAAAAAAAAA' }

/** The template CSV as Airtable returns it after a plain CSV import: every value is text. */
function templateRecords(): AtRecord[] {
  const text = templateCsv.replace(/^\uFEFF/, '')
  const [head, ...lines] = text.trim().split('\n').map((l) => l.split(','))
  return lines.map((cells, i) => ({
    id: `rec${i}`,
    createdTime: '2026-11-01T10:00:00.000Z',
    fields: Object.fromEntries(head.map((h, k) => [h, cells[k]]).filter(([, v]) => v !== '')),
  }))
}

/** A fake Airtable: tables by name; a missing table answers like Airtable (403 model not found).
 *  `schemaOpen`: the base's schema endpoint answers (the token reaches the base). */
function fakeAirtable(tables: Record<string, AtRecord[]>, leadsStatus = 200, schemaOpen = true) {
  return vi.fn(async (url: string) => {
    const path = new URL(url).pathname.split('/')
    if (path[2] === 'meta') {
      return schemaOpen
        ? new Response(JSON.stringify({ tables: Object.keys(tables).map((name, i) => ({ id: `tbl${i}`, name })) }), { status: 200 })
        : new Response(JSON.stringify({ error: { type: 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND' } }), { status: 403 })
    }
    const table = decodeURIComponent(path[3])
    if (table === 'Leads' && leadsStatus !== 200) return new Response(JSON.stringify({ error: { type: 'AUTHENTICATION_REQUIRED' } }), { status: leadsStatus })
    if (!tables[table]) return new Response(JSON.stringify({ error: { type: 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND' } }), { status: 403 })
    return new Response(JSON.stringify({ records: tables[table] }), { status: 200 })
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('test base from the CSV template', () => {
  it('loads with only a Leads table: Owners and Tasks come back empty and are named', async () => {
    vi.stubGlobal('fetch', fakeAirtable({ Leads: templateRecords() }))
    const d = await loadFromAirtable(CONN)
    expect(d.rejected).toEqual([])
    expect(d.leads).toHaveLength(12)
    expect(d.owners).toEqual([])
    expect(d.tasks).toEqual([])
    expect(d.missingTables).toEqual(['Owners', 'Tasks'])
  })

  it('reads numbers and checkboxes that arrived as text', async () => {
    vi.stubGlobal('fetch', fakeAirtable({ Leads: templateRecords() }))
    const d = await loadFromAirtable(CONN)
    const l = d.leads.find((x) => x.id === 'DEMO-03')!
    expect(l.place?.rating).toBe(4.8)
    expect(l.place?.reviews).toBe(1240)
    expect(l.place?.region).toBe('center')
    expect(l.inPipeline).toBe(true)
    expect(l.stage).toBe('proposal')
    expect(l.estimatedValueILS).toBe(12000)
    expect(d.leads.filter((x) => x.inPipeline)).toHaveLength(5)
    expect(d.leads.find((x) => x.id === 'DEMO-12')!.place?.rating).toBeNull()
  })

  it('an empty "Created at" takes the record creation time; a bad one is still rejected', async () => {
    const recs = templateRecords()
    delete recs[0].fields['Created at']
    recs[1].fields['Created at'] = 'yesterday'
    vi.stubGlobal('fetch', fakeAirtable({ Leads: recs }))
    const d = await loadFromAirtable(CONN)
    expect(d.leads.find((x) => x.id === 'DEMO-01')!.createdAt).toBe('2026-11-01T10:00:00.000Z')
    expect(d.rejected).toEqual([{ table: 'Leads', id: 'DEMO-02', reason: 'תאריך יצירה לא תקין' }])
  })

  it('an error on the Leads table stops the load with the Hebrew reason (no fake success)', async () => {
    vi.stubGlobal('fetch', fakeAirtable({}, 401))
    await expect(loadFromAirtable(CONN)).rejects.toThrow('401')
    vi.stubGlobal('fetch', fakeAirtable({}))
    await expect(loadFromAirtable(CONN)).rejects.toThrow('Leads')
  })

  it('403 on Leads in a base that opens: says the Leads table is missing and lists the tables', async () => {
    vi.stubGlobal('fetch', fakeAirtable({ Orders: [], Branches: [] }))
    const err = (await loadFromAirtable(CONN).then(() => new Error("loaded"), (e: Error) => e)) as Error
    expect(err.message).toContain('אין טבלה בשם Leads')
    expect(err.message).toContain('Orders, Branches')
  })

  it('403 on Leads in a base the token cannot open: says wrong Base ID or no access', async () => {
    vi.stubGlobal('fetch', fakeAirtable({}, 200, false))
    const err = (await loadFromAirtable(CONN).then(() => new Error("loaded"), (e: Error) => e)) as Error
    expect(err.message).toContain('Base ID שגוי')
    expect(err.message).not.toContain('אין טבלה')
  })

  it('the token goes only to api.airtable.com', async () => {
    const f = fakeAirtable({ Leads: templateRecords() })
    vi.stubGlobal('fetch', f)
    await loadFromAirtable(CONN)
    for (const [url, init] of f.mock.calls as unknown as [string, RequestInit][]) {
      expect(new URL(url).host).toBe('api.airtable.com')
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${CONN.token}`)
    }
  })

  it('Base ID from a pasted base URL', () => {
    expect(extractBaseId('https://airtable.com/appAbCdEfGh123456/tblX1234567890abc/viwY?blocks=hide')).toBe('appAbCdEfGh123456')
    expect(extractBaseId('  appoBEQVNkMFcKm1K ')).toBe('appoBEQVNkMFcKm1K')
    expect(extractBaseId('not a base')).toBe('not a base')
  })
})
