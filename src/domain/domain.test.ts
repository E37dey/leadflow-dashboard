import { describe, expect, it } from 'vitest'
import { createFixture } from '../data/fixture'
import { DEFAULT_RANGE, DEMO_NOW, HOUR, TODAY, addDays, dayKey, iso, localTime } from './clock'
import { leadsCsv, cell } from './csv'
import { followUpTasks, insights } from './insights'
import { HOT_THRESHOLD, isHot, isOpen, score } from './score'
import { applyGlobal, applyTable, leadsOverTime, metrics, sortLeads, sourceDistribution, stageDistribution, taskBucket } from './selectors'
import type { GlobalFilter, Lead, TableFilter } from './types'
import { parseSaved } from '../store/persist'

const fx = createFixture()
const ALL: GlobalFilter = { range: DEFAULT_RANGE, source: 'all', ownerId: 'all' }
const NO_TABLE: TableFilter = { stage: 'all', priority: 'all', query: '', ids: null, idsLabel: null }
const count = (leads: Lead[], stage: string) => leads.filter((l) => l.stage === stage).length

describe('demo data', () => {
  it('the period is 90 calendar days ending on 3.11.2026, inclusive', () => {
    expect(TODAY).toBe('2026-11-03')
    expect(DEFAULT_RANGE).toEqual({ from: '2026-08-06', to: '2026-11-03' })
  })

  it('128 leads, all created inside the period, with the exact stage counts', () => {
    expect(fx.leads).toHaveLength(128)
    expect(fx.leads.every((l) => dayKey(l.createdAt) >= DEFAULT_RANGE.from && dayKey(l.createdAt) <= TODAY)).toBe(true)
    expect([count(fx.leads, 'new'), count(fx.leads, 'contacted'), count(fx.leads, 'qualified'), count(fx.leads, 'proposal'), count(fx.leads, 'won'), count(fx.leads, 'lost')])
      .toEqual([24, 28, 25, 14, 31, 6])
  })

  it('open leads are 91 and their values total exactly ILS 248,000, all positive', () => {
    const open = fx.leads.filter(isOpen)
    expect(open).toHaveLength(91)
    expect(open.reduce((s, l) => s + l.estimatedValueILS, 0)).toBe(248_000)
    expect(open.every((l) => l.estimatedValueILS > 0)).toBe(true)
  })

  it('same seed returns the same data; fake contacts only', () => {
    expect(JSON.stringify(createFixture())).toBe(JSON.stringify(fx))
    expect(fx.leads.every((l) => !l.email || l.email.endsWith('@example.com'))).toBe(true)
    expect(fx.leads.every((l) => l.email || l.phone)).toBe(true)
    expect(fx.owners).toHaveLength(4)
    expect(fx.tasks.length).toBeGreaterThanOrEqual(18)
  })

  it('no contact happens before the lead was created', () => {
    expect(fx.leads.every((l) => !l.lastContactAt || l.lastContactAt >= l.createdAt)).toBe(true)
  })
})

describe('metrics', () => {
  it('initial KPIs are 128 / 32 / 24.2% / ILS 248,000', () => {
    const m = metrics(applyGlobal(fx.leads, ALL), DEMO_NOW)
    expect(m.total).toBe(128)
    expect(m.hot).toBe(32)
    expect((m.conversion * 100).toFixed(1)).toBe('24.2')
    expect(m.pipeline).toBe(248_000)
  })

  it('conversion with no leads is 0, never NaN', () => {
    const m = metrics([], DEMO_NOW)
    expect(m.conversion).toBe(0)
    expect(m.total).toBe(0)
  })

  it('a lead marked won raises conversion and leaves the open pipeline', () => {
    const before = metrics(fx.leads, DEMO_NOW)
    const target = fx.leads.find((l) => l.stage === 'proposal')!
    const after = metrics(fx.leads.map((l) => (l.id === target.id ? { ...l, stage: 'won' as const } : l)), DEMO_NOW)
    expect(after.won).toBe(before.won + 1)
    expect(after.pipeline).toBe(before.pipeline - target.estimatedValueILS)
  })
})

describe('score', () => {
  it('follows the documented formula and stays within 0-100', () => {
    const l: Lead = { ...fx.leads[0], stage: 'proposal', estimatedValueILS: 6000, lastContactAt: iso(DEMO_NOW - 5 * HOUR), nextFollowUpAt: iso(DEMO_NOW - HOUR) }
    expect(score(l, DEMO_NOW)).toBe(100)
    expect(score({ ...l, nextFollowUpAt: iso(localTime(TODAY, 15)) }, DEMO_NOW)).toBe(97)
    expect(score({ ...l, stage: 'won' }, DEMO_NOW)).toBe(0)
    expect(score({ ...l, stage: 'new', estimatedValueILS: 0, lastContactAt: null, createdAt: iso(DEMO_NOW - 100 * HOUR), nextFollowUpAt: null }, DEMO_NOW)).toBe(10)
    expect(fx.leads.every((x) => score(x, DEMO_NOW) >= 0 && score(x, DEMO_NOW) <= 100)).toBe(true)
  })

  it('hot = open lead with score >= 80; closed leads are never hot', () => {
    expect(fx.leads.filter((l) => isHot(l, DEMO_NOW)).every((l) => isOpen(l) && score(l, DEMO_NOW) >= HOT_THRESHOLD)).toBe(true)
    expect(fx.leads.filter((l) => !isOpen(l)).some((l) => isHot(l, DEMO_NOW))).toBe(false)
  })
})

describe('filters', () => {
  it('global filters stack, and every aggregate reconciles with the filtered leads', () => {
    const f: GlobalFilter = { range: { from: addDays(TODAY, -29), to: TODAY }, source: 'website', ownerId: 'o2' }
    const leads = applyGlobal(fx.leads, f)
    expect(leads.every((l) => l.source === 'website' && l.ownerId === 'o2' && dayKey(l.createdAt) >= f.range.from)).toBe(true)
    const m = metrics(leads, DEMO_NOW)
    const series = leadsOverTime(leads, f.range)
    expect(series.points.reduce((s, p) => s + p.digital + p.referralPhone, 0)).toBe(m.total)
    expect(stageDistribution(leads).reduce((s, x) => s + x.count, 0)).toBe(m.total)
    expect(sourceDistribution(leads).reduce((s, x) => s + x.count, 0)).toBe(m.total)
  })

  it('date range is inclusive on both ends, by Israel calendar day', () => {
    const late = { ...fx.leads[0], createdAt: iso(localTime('2026-10-01', 23, 30)) }
    const early = { ...fx.leads[0], createdAt: iso(localTime('2026-10-01', 0, 15)) }
    const f: GlobalFilter = { ...ALL, range: { from: '2026-10-01', to: '2026-10-01' } }
    expect(applyGlobal([late, early], f)).toHaveLength(2)
    expect(applyGlobal([late], { ...f, range: { from: '2026-10-02', to: '2026-10-02' } })).toHaveLength(0)
  })

  it('the 90-day chart groups by week, a short range by day', () => {
    expect(leadsOverTime(fx.leads, DEFAULT_RANGE).grouping).toBe('week')
    expect(leadsOverTime(fx.leads, DEFAULT_RANGE).points).toHaveLength(13)
    expect(leadsOverTime(fx.leads, { from: addDays(TODAY, -13), to: TODAY }).points).toHaveLength(14)
  })

  it('table filters only narrow the table; empty filter keeps all; ids show exactly those leads', () => {
    expect(applyTable(fx.leads, NO_TABLE, DEMO_NOW)).toHaveLength(128)
    const name = fx.leads[5].fullName
    expect(applyTable(fx.leads, { ...NO_TABLE, query: name }, DEMO_NOW).every((l) => l.fullName.includes(name) || l.company.includes(name))).toBe(true)
    expect(applyTable(fx.leads, { ...NO_TABLE, priority: 'hot' }, DEMO_NOW)).toHaveLength(32)
    const ids = [fx.leads[1].id, fx.leads[9].id]
    expect(applyTable(fx.leads, { ...NO_TABLE, ids }, DEMO_NOW).map((l) => l.id).sort()).toEqual(ids.sort())
  })

  it('default sort surfaces hot open leads first', () => {
    const sorted = sortLeads(fx.leads, 'priority', 'desc', DEMO_NOW, () => '')
    expect(sorted.slice(0, 32).every((l) => isHot(l, DEMO_NOW))).toBe(true)
  })
})

describe('insights', () => {
  const list = insights(fx.leads, DEMO_NOW)
  const get = (id: string) => list.find((i) => i.id === id)!

  it('each rule lists exactly the leads that match it', () => {
    const hot = get('hot-no-contact')
    expect(hot.count).toBe(hot.leadIds.length)
    for (const id of hot.leadIds) {
      const l = fx.leads.find((x) => x.id === id)!
      expect(isHot(l, DEMO_NOW)).toBe(true)
      expect(!l.lastContactAt || DEMO_NOW - Date.parse(l.lastContactAt) > 48 * HOUR).toBe(true)
    }
    const stale = get('stale-proposal')
    expect(stale.leadIds.every((id) => fx.leads.find((x) => x.id === id)!.stage === 'proposal')).toBe(true)
    const overdue = get('overdue-follow-up')
    const expected = fx.leads.filter((l) => isOpen(l) && l.nextFollowUpAt && Date.parse(l.nextFollowUpAt) < DEMO_NOW).length
    expect(overdue.count).toBe(expected)
    expect(list.every((i) => i.count > 0)).toBe(true)
  })

  it('a lead with no contact at all counts as "no contact for 48 hours"', () => {
    const l = { ...fx.leads.find((x) => isHot(x, DEMO_NOW))!, lastContactAt: null }
    const forced = { ...l, nextFollowUpAt: iso(DEMO_NOW - HOUR), estimatedValueILS: 9000, stage: 'proposal' as const, createdAt: iso(DEMO_NOW - HOUR) }
    expect(insights([forced], DEMO_NOW).find((i) => i.id === 'hot-no-contact')!.leadIds).toEqual([forced.id])
  })

  it('best source only considers sources with at least 5 leads', () => {
    const best = get('best-source')
    const dist = sourceDistribution(fx.leads).filter((s) => s.count >= 5)
    const top = Math.max(...dist.map((s) => s.conversion))
    const winner = dist.find((s) => s.conversion === top)!
    expect(best.leadIds).toHaveLength(winner.count)
  })

  it('follow-up tasks are created once per lead, never duplicated', () => {
    const rule = get('overdue-follow-up')
    const first = followUpTasks(rule, fx.leads, fx.tasks, DEMO_NOW)
    expect(first).toHaveLength(rule.count)
    expect(followUpTasks(rule, fx.leads, [...fx.tasks, ...first], DEMO_NOW)).toHaveLength(0)
  })

  it('tasks: overdue before today, today, upcoming after', () => {
    const t = fx.tasks[0]
    expect(taskBucket({ ...t, done: false, dueAt: iso(localTime(addDays(TODAY, -1), 23)) }, DEMO_NOW)).toBe('overdue')
    expect(taskBucket({ ...t, done: false, dueAt: iso(localTime(TODAY, 9)) }, DEMO_NOW)).toBe('today')
    expect(taskBucket({ ...t, done: false, dueAt: iso(localTime(addDays(TODAY, 1), 9)) }, DEMO_NOW)).toBe('upcoming')
    expect(taskBucket({ ...t, done: true }, DEMO_NOW)).toBe('done')
  })
})

describe('CSV export', () => {
  it('header row, one row per lead, BOM for Hebrew in Excel', () => {
    const csv = leadsCsv(fx.leads.slice(0, 3), fx.owners, DEMO_NOW)
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('"שם"')
  })

  it('neutralizes spreadsheet formulas and escapes quotes', () => {
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(cell('+972')).toBe(`"'+972"`)
    expect(cell('@cmd')).toBe(`"'@cmd"`)
    expect(cell(-5)).toBe('"-5"')
  })
})

describe('saved state', () => {
  it('broken or old saves are rejected, so the app falls back to demo data', () => {
    expect(parseSaved(null)).toBeNull()
    expect(parseSaved('{not json')).toBeNull()
    expect(parseSaved(JSON.stringify({ version: 0, leads: [], tasks: [] }))).toBeNull()
    expect(parseSaved(JSON.stringify({ version: 1, leads: [{ id: 1 }], tasks: [] }))).toBeNull()
    const ok = parseSaved(JSON.stringify({ version: 1, leads: fx.leads, tasks: fx.tasks, theme: 'nope' }))
    expect(ok?.leads).toHaveLength(128)
    expect(ok?.theme).toBe('aurora')
  })
})
