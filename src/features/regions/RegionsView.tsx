// SPEC: "שרת API ל-Airtable (סעיף 19)": regions compared. Points on the map are the real coordinates; no borders are drawn.
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt } from '../../components/ui/format'
import { REGION_SEARCH } from '../../domain/regions'
import type { RegionId } from '../../domain/regions'
import { regionRows } from '../../domain/summary'
import type { RegionRow } from '../../domain/summary'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'
import { REGION_COLOR } from './regionColors'


type Key = 'bakeries' | 'avgRating' | 'medianReviews' | 'web' | 'phone' | 'stars' | 'pipeline'
const COLS: [Key, string][] = [['bakeries', 'מאפיות'], ['avgRating', 'דירוג ממוצע'], ['medianReviews', 'חציון ביקורות'], ['web', 'עם אתר'], ['phone', 'עם טלפון'], ['stars', '״כוכבים״'], ['pipeline', 'בצנרת']]
const val = (r: RegionRow, k: Key) =>
  k === 'web' ? (r.bakeries ? r.withWebsite / r.bakeries : -1) : k === 'phone' ? (r.bakeries ? r.withPhone / r.bakeries : -1) : (r[k] ?? -1)
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—')

/**
 * Equirectangular projection fitted to the real points (with a margin). Longitude is scaled by cos(latitude)
 * so distances look right. Enough for a dot map; no borders are drawn because we do not have them.
 */
function projection(pts: { lat: number; lng: number }[]) {
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng)
  const box = { lat0: Math.min(...lats) - 0.12, lat1: Math.max(...lats) + 0.12, lng0: Math.min(...lngs) - 0.12, lng1: Math.max(...lngs) + 0.12 }
  const k = Math.cos((((box.lat0 + box.lat1) / 2) * Math.PI) / 180)
  const W = 230
  const H = Math.round((W * (box.lat1 - box.lat0)) / ((box.lng1 - box.lng0) * k))
  return { W, H, px: (lat: number, lng: number) => [((lng - box.lng0) / (box.lng1 - box.lng0)) * W, ((box.lat1 - lat) / (box.lat1 - box.lat0)) * H] as const }
}

/** Labels in a column next to the map, pushed apart so they never overlap. */
function spread(ys: number[], gap: number, max: number) {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  let last = -Infinity
  for (const o of order) { o.y = Math.max(o.y, last + gap); last = o.y }
  const over = last - max
  if (over > 0) for (const o of order) o.y -= over
  const out: number[] = []
  for (const o of order) out[o.i] = o.y
  return out
}

export default function RegionsView() {
  const { filtered } = useDerived()
  const { go } = useStore()
  const rows = useMemo(() => regionRows(filtered), [filtered])
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: 'bakeries', dir: -1 })
  const sorted = [...rows].sort((a, b) => (val(a, sort.k) - val(b, sort.k)) * sort.dir)
  const [hover, setHover] = useState<RegionId | null>(null)
  const places = filtered.filter((l) => l.place?.lat != null && l.place?.lng != null && l.place.region)
  const open = (id: RegionId) => { location.hash = `#/bakeries?region=${id}`; go('bakeries') }
  const chart = rows.map((r) => ({ name: r.label, מאפיות: r.bakeries, דירוג: r.avgRating ? Number(r.avgRating.toFixed(2)) : 0, color: REGION_COLOR[r.id] }))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="page-label">נתונים חיים מ-Airtable</p>
          <h1>השוואת אזורים</h1>
          <p className="page-sub">שישה אזורים, {fmt.num(places.length)} מאפיות עם מיקום. אזור נקבע לפי העיר בגוגל, ואם היא לא בטבלה, לפי אזור החיפוש.</p>
        </div>
      </div>

      <div className="rg-grid">
        <section className="card rg-map" aria-labelledby="rg-map-h">
          <h2 id="rg-map-h" className="card-title">מפת מאפיות</h2>
          {(() => {
            if (!places.length) return <p className="muted">אין מאפיות עם מיקום.</p>
            const { W, H, px } = projection(places.map((l) => ({ lat: l.place!.lat!, lng: l.place!.lng! })))
            const pins = rows.filter((r) => r.lat != null)
            const ly = spread(pins.map((r) => px(r.lat!, r.lng!)[1]), 44, H - 10)
            return (
              <svg viewBox={`-8 -24 ${W + 150} ${H + 48}`} style={{ direction: 'ltr' }} role="img" aria-label={`מפה: ${rows.map((r) => `${r.label} ${r.bakeries}`).join(', ')}`}>
                {places.map((l) => {
                  const [x, y] = px(l.place!.lat!, l.place!.lng!)
                  const dim = hover && hover !== l.place!.region
                  return <circle key={l.id} cx={x} cy={y} r={2.4} fill={REGION_COLOR[l.place!.region!]} opacity={dim ? 0.1 : 0.7} />
                })}
                {pins.map((r, i) => {
                  const [x, y] = px(r.lat!, r.lng!)
                  const lx = W + 22
                  return (
                    <g key={r.id} className="rg-pin" onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => open(r.id)} role="button" tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && open(r.id)} aria-label={`${r.label}: ${r.bakeries} מאפיות`}>
                      <polyline points={`${x},${y} ${W + 8},${ly[i]} ${lx},${ly[i]}`} fill="none" stroke={REGION_COLOR[r.id]} strokeOpacity={0.55} strokeDasharray="2 3" />
                      <circle cx={x} cy={y} r={7} fill="none" stroke={REGION_COLOR[r.id]} strokeWidth={2} />
                      <rect x={lx} y={ly[i] - 18} width={124} height={36} rx={9} fill="var(--surface-2)" stroke={REGION_COLOR[r.id]} strokeOpacity={hover === r.id ? 1 : 0.55} />
                      <text x={lx + 114} y={ly[i] - 3} textAnchor="start" className="rg-pin-name">{r.label}</text>
                      <text x={lx + 114} y={ly[i] + 12} textAnchor="start" className="rg-pin-num">{r.bakeries} מאפיות{r.avgRating ? ` · ★ ${r.avgRating.toFixed(2)}` : ''}</text>
                    </g>
                  )
                })}
              </svg>
            )
          })()}
          <p className="faint small">כל נקודה היא מאפייה במיקום האמיתי שלה בגוגל. אין גבולות מצוירים.</p>
        </section>

        <section className="card rg-table" aria-labelledby="rg-t-h">
          <h2 id="rg-t-h" className="card-title">השוואה לפי אזור</h2>
          <div className="tbl-scroll" role="region" aria-label="טבלת אזורים" tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>אזור</th>
                  {COLS.map(([k, label]) => (
                    <th key={k} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="th-sort" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>{label}{sort.k === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} onClick={() => open(r.id)} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
                    <th scope="row"><span className="rg-dot" style={{ background: REGION_COLOR[r.id] }} />{r.label}<div className="faint small">חיפוש: {REGION_SEARCH[r.id]}</div></th>
                    <td>{fmt.num(r.bakeries)}</td>
                    <td>{r.avgRating == null ? '—' : `★ ${r.avgRating.toFixed(2)}`}<div className="faint small">{r.rated} עם דירוג</div></td>
                    <td>{r.medianReviews == null ? '—' : fmt.num(Math.round(r.medianReviews))}</td>
                    <td>{pct(r.withWebsite, r.bakeries)}</td>
                    <td>{pct(r.withPhone, r.bakeries)}</td>
                    <td>{r.stars}</td>
                    <td>{r.pipeline ? `${r.pipeline}${r.openValue ? ` · ${fmt.ils(r.openValue)}` : ''}` : <span className="faint">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint small">״כוכבים״ = דירוג 4.5 ומעלה וגם לפחות חציון הביקורות הכללי. לחיצה על אזור פותחת את המאפיות שלו.</p>
        </section>

        <section className="card rg-chart" aria-labelledby="rg-c-h">
          <h2 id="rg-c-h" className="card-title">מאפיות ודירוג ממוצע לפי אזור</h2>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 12 }} reversed />
                <YAxis yAxisId="n" orientation="right" tick={{ fill: 'var(--muted)', fontSize: 12 }} label={{ value: 'מאפיות', angle: 90, position: 'insideRight', fill: 'var(--faint)', fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="left" domain={[3, 5]} tick={{ fill: 'var(--muted)', fontSize: 12 }} label={{ value: 'דירוג', angle: -90, position: 'insideLeft', fill: 'var(--faint)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <Bar yAxisId="n" dataKey="מאפיות" fill="var(--violet)" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="r" dataKey="דירוג" fill="#44DEB7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">{rows.map((r) => `${r.label}: ${r.bakeries} מאפיות, דירוג ממוצע ${r.avgRating?.toFixed(2) ?? 'לא ידוע'}`).join('. ')}</p>
        </section>
      </div>
    </div>
  )
}
