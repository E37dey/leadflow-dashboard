// SPEC: "מקור נתונים: Airtable": quality vs popularity. Colors = the four quadrants (fixed rule: rating 4.5 and the
// median review count). Shaded zones show the rule itself. Region chips filter the points, quadrant chips highlight.
import { useMemo, useState } from 'react'
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { fmt } from '../../components/ui/format'
import { QUADRANT_LABEL, quadrantOf } from '../../domain/places'
import type { Quadrant } from '../../domain/places'
import { REGIONS, REGION_LABEL } from '../../domain/regions'
import type { RegionId } from '../../domain/regions'
import type { Lead } from '../../domain/types'
import { REGION_COLOR } from '../regions/regionColors'

const QUADRANT_COLOR: Record<Quadrant, string> = { stars: '#3fd29b', hidden: '#39D8E8', crowded: '#F4B752', weak: '#8b8fb0' }
const ORDER: Quadrant[] = ['stars', 'hidden', 'crowded', 'weak']

interface Pt { id: string; name: string; city: string; region: RegionId | null; rating: number; reviews: number; q: Quadrant }

export function QualityScatter({ leads, median, onPick }: { leads: Lead[]; median: number; onPick: (id: string) => void }) {
  const [region, setRegion] = useState<RegionId | 'all'>('all')
  const [focus, setFocus] = useState<Quadrant | null>(null)
  const all = useMemo<Pt[]>(
    () => leads.filter((l) => l.place?.rating != null && (l.place.reviews ?? 0) > 0).map((l) => ({
      id: l.id, name: l.fullName, city: l.place!.city ?? l.place!.area ?? '', region: l.place!.region,
      rating: l.place!.rating!, reviews: l.place!.reviews!, q: quadrantOf(l, median)!,
    })),
    [leads, median],
  )
  const pts = region === 'all' ? all : all.filter((p) => p.region === region)
  const maxX = Math.max(10, ...all.map((p) => p.reviews)) * 1.15
  const mid = Math.max(1, median)
  const count = (q: Quadrant) => pts.filter((p) => p.q === q).length
  const zone = (x1: number, x2: number, y1: number, y2: number, q: Quadrant, pos: 'insideTopLeft' | 'insideTopRight' | 'insideBottomLeft' | 'insideBottomRight') => (
    <ReferenceArea x1={x1} x2={x2} y1={y1} y2={y2} fill={QUADRANT_COLOR[q]} fillOpacity={focus && focus !== q ? 0.015 : 0.06} stroke="none" ifOverflow="hidden"
      label={{ value: `${QUADRANT_LABEL[q]} · ${count(q)}`, position: pos, fill: QUADRANT_COLOR[q], fontSize: 12, fontWeight: 700 }} />
  )

  return (
    <div className="qs">
      <div className="qs-chips" role="group" aria-label="סינון לפי אזור">
        <button type="button" className="chip" aria-pressed={region === 'all'} onClick={() => setRegion('all')}>כל האזורים · {all.length}</button>
        {REGIONS.filter((r) => all.some((p) => p.region === r)).map((r) => (
          <button key={r} type="button" className="chip" aria-pressed={region === r} onClick={() => setRegion(region === r ? 'all' : r)}>
            <i className="qs-dot" style={{ background: REGION_COLOR[r] }} />{REGION_LABEL[r]}
          </button>
        ))}
      </div>
      <div className="mk-scatter qs-chart" role="img" aria-label={`פיזור ${pts.length} מאפיות לפי דירוג ומספר ביקורות. ${ORDER.map((q) => `${QUADRANT_LABEL[q]} ${count(q)}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 18, bottom: 22, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            {zone(mid, maxX, 4.5, 5.15, 'stars', 'insideTopRight')}
            {zone(1, mid, 4.5, 5.15, 'hidden', 'insideTopLeft')}
            {zone(mid, maxX, 0.85, 4.5, 'crowded', 'insideBottomRight')}
            {zone(1, mid, 0.85, 4.5, 'weak', 'insideBottomLeft')}
            <XAxis type="number" dataKey="reviews" scale="log" domain={[1, maxX]} allowDataOverflow ticks={[1, 3, 10, 30, 100, 300, 1000, 3000].filter((t) => t < maxX)}
              tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(v) => fmt.num(v)} axisLine={{ stroke: 'var(--border)' }} tickLine={false}
              label={{ value: 'מספר ביקורות בגוגל (סקאלה לוגריתמית)', position: 'insideBottom', offset: -12, fill: 'var(--faint)', fontSize: 11 }} />
            <YAxis type="number" dataKey="rating" domain={[0.85, 5.15]} ticks={[1, 2, 3, 4, 4.5, 5]} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={34} axisLine={false} tickLine={false}
              label={{ value: 'דירוג', angle: -90, position: 'insideLeft', fill: 'var(--faint)', fontSize: 11 }} />
            <ZAxis range={[30, 30]} />
            <ReferenceLine y={4.5} stroke="var(--text)" strokeOpacity={0.35} strokeDasharray="4 4" />
            <ReferenceLine x={mid} stroke="var(--text)" strokeOpacity={0.35} strokeDasharray="4 4" label={{ value: `חציון ${fmt.num(Math.round(median))}`, position: 'top', fill: 'var(--faint)', fontSize: 11 }} />
            <Tooltip cursor={false} content={({ payload }) => {
              const p = payload?.[0]?.payload as Pt | undefined
              return p ? (
                <div className="mk-tip">
                  <b>{p.name}</b>
                  <span>{p.city}{p.region ? `, ${REGION_LABEL[p.region]}` : ''}</span>
                  <span>★ {p.rating.toFixed(1)} · {fmt.num(p.reviews)} ביקורות · <span style={{ color: QUADRANT_COLOR[p.q] }}>{QUADRANT_LABEL[p.q]}</span></span>
                </div>
              ) : null
            }} />
            {ORDER.map((q) => (
              <Scatter key={q} name={QUADRANT_LABEL[q]} data={pts.filter((p) => p.q === q)} fill={QUADRANT_COLOR[q]}
                fillOpacity={focus && focus !== q ? 0.08 : 0.8} stroke="var(--bg)" strokeWidth={0.8} isAnimationActive={false}
                onClick={(d) => onPick((d as unknown as { id: string }).id)} style={{ cursor: 'pointer' }} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="qs-legend" aria-label="ארבעה רבעים">
        {ORDER.map((q) => (
          <li key={q}>
            <button type="button" aria-pressed={focus === q} onClick={() => setFocus(focus === q ? null : q)} onMouseEnter={() => setFocus(q)} onMouseLeave={() => setFocus(null)}>
              <i style={{ background: QUADRANT_COLOR[q] }} />{QUADRANT_LABEL[q]} <b>{count(q)}</b>
            </button>
          </li>
        ))}
        <li className="faint small">לחיצה על נקודה פותחת את המאפייה</li>
      </ul>
    </div>
  )
}
