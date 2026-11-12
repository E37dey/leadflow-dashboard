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
import { RegionMap } from './RegionMap'


type Key = 'bakeries' | 'avgRating' | 'medianReviews' | 'web' | 'phone' | 'stars' | 'pipeline'
const COLS: [Key, string][] = [['bakeries', 'מאפיות'], ['avgRating', 'דירוג ממוצע'], ['medianReviews', 'חציון ביקורות'], ['web', 'עם אתר'], ['phone', 'עם טלפון'], ['stars', '״כוכבים״'], ['pipeline', 'בצנרת']]
const val = (r: RegionRow, k: Key) =>
  k === 'web' ? (r.bakeries ? r.withWebsite / r.bakeries : -1) : k === 'phone' ? (r.bakeries ? r.withPhone / r.bakeries : -1) : (r[k] ?? -1)
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—')

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
          {places.length ? <RegionMap places={places} hover={hover} setHover={setHover} onOpen={open} /> : <p className="muted">אין מאפיות עם מיקום.</p>}
          <ul className="rgm-legend">
            {rows.filter((r) => r.bakeries).map((r) => (
              <li key={r.id}><button type="button" aria-pressed={hover === r.id} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => open(r.id)}>
                <i style={{ background: REGION_COLOR[r.id] }} />{r.label} <b>{r.bakeries}</b>
              </button></li>
            ))}
          </ul>
          <p className="faint small">כל נקודה היא מאפייה במיקום האמיתי שלה בגוגל, והזוהר מראה איפה הן צפופות. עיגול = עיר עם 5 מאפיות ומעלה, לפי הכמות. הקווים הם קווי רוחב, ואין גבולות מצוירים.</p>
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
