// SPEC: "מקור נתונים: Airtable" (round trip without loss, bad records rejected, same metrics).
import { describe, expect, it } from 'vitest'
import { createFixture } from '../data/fixture'
import { DEFAULT_RANGE, DEMO_NOW } from './clock'
import { F, explainError, fromAirtable, leadFields, ownerFields, taskFields, validBaseId, validToken } from './airtable'
import type { AtRecord } from './airtable'
import { applyGlobal, metrics } from './selectors'

const fx = createFixture()

/** Build the records the way Airtable would return them: rec ids, links as rec ids, empty fields omitted. */
function asAirtable() {
  const ownerRec = new Map(fx.owners.map((o, i) => [o.id, `recO${i}`]))
  const leadRec = new Map(fx.leads.map((l, i) => [l.id, `recL${i}`]))
  const owners: AtRecord[] = fx.owners.map((o) => ({ id: ownerRec.get(o.id)!, fields: ownerFields(o) }))
  const leads: AtRecord[] = fx.leads.map((l) => ({ id: leadRec.get(l.id)!, fields: leadFields(l, ownerRec.get(l.ownerId)) }))
  const tasks: AtRecord[] = fx.tasks.map((t, i) => ({ id: `recT${i}`, fields: taskFields(t, t.leadId ? leadRec.get(t.leadId) : undefined) }))
  return { owners, leads, tasks }
}
const byId = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id))

describe('Airtable data source', () => {
  it('round trip: demo data -> Airtable records -> app data, nothing lost', () => {
    const r = asAirtable()
    const back = fromAirtable(r.owners, r.leads, r.tasks)
    expect(back.rejected).toEqual([])
    expect(back.owners).toEqual(byId(fx.owners))
    expect(back.leads).toEqual(byId(fx.leads))
    expect(back.tasks).toEqual(byId(fx.tasks))
  })

  it('the base fits the free plan: 4 + 128 + tasks, under 1,000 records', () => {
    const r = asAirtable()
    expect(r.owners.length + r.leads.length + r.tasks.length).toBeLessThan(1000)
  })

  it('same metrics as the demo data: 128 leads, ₪248,000, 32 hot, 24.2%', () => {
    const r = asAirtable()
    const back = fromAirtable(r.owners, r.leads, r.tasks)
    const m = metrics(applyGlobal(back.leads, { range: DEFAULT_RANGE, source: 'all', ownerId: 'all' }), DEMO_NOW)
    expect(m.total).toBe(128)
    expect(m.pipeline).toBe(248_000)
    expect(m.hot).toBe(32)
    expect(m.conversion).toBeCloseTo(31 / 128, 5)
  })

  it('a bad record is rejected with a reason, the rest still load', () => {
    const r = asAirtable()
    r.leads[0] = { ...r.leads[0], fields: { ...r.leads[0].fields, [F.stage]: 'done' } }
    r.leads[1] = { ...r.leads[1], fields: { ...r.leads[1].fields, [F.fullName]: '' } }
    r.leads[2] = { ...r.leads[2], fields: { ...r.leads[2].fields, [F.createdAt]: 'yesterday' } }
    const back = fromAirtable(r.owners, r.leads, r.tasks)
    expect(back.leads).toHaveLength(125)
    expect(back.rejected).toHaveLength(3)
    expect(back.rejected[0].reason).toContain('שלב לא מוכר')
  })

  it('a broken activity log does not break the lead', () => {
    const r = asAirtable()
    r.leads[0] = { ...r.leads[0], fields: { ...r.leads[0].fields, [F.activity]: '{not json' } }
    const back = fromAirtable(r.owners, r.leads, r.tasks)
    expect(back.rejected).toEqual([])
    expect(back.leads.find((l) => l.id === fx.leads[0].id)!.activityLog).toEqual([])
  })

  it('token and base id checks, and Hebrew error messages', () => {
    expect(validToken('patAbc123.def456789')).toBe(true)
    expect(validToken('sk-123')).toBe(false)
    expect(validBaseId('appoBEQVNkMFcKm1K')).toBe(true)
    expect(validBaseId('app123')).toBe(false)
    expect(explainError(401)).toContain('401')
    expect(explainError(null)).toContain('רשת')
  })
})
