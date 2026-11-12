// SPEC: "מקור נתונים: Airtable". The overview when the data is real (Google Maps places loaded from Airtable).
// Every number here is a count, sum or average of real fields. Unknown values are shown as unknown, never as 0.
import { useMemo } from 'react'
import { BarChart3, ExternalLink, Globe, MapPin, MessageSquare, Star, Store, Tags } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { marketStats } from '../../domain/maps'
import type { Lead } from '../../domain/types'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'

const AREA_COLORS = ['var(--violet)', 'var(--aqua)', 'color-mix(in oklab, var(--violet) 45%, var(--text))', 'color-mix(in oklab, var(--aqua) 45%, var(--text))']
const rating = (r: number | null) => (r == null ? 'אין דירוג' : r.toFixed(1))

export function MarketOverview() {
  const { source, openLead } = useStore()
  const { filtered } = useDerived()
  const m = useMemo(() => marketStats(filtered), [filtered])
  const areaColor = (a: string | null) => AREA_COLORS[Math.max(0, m.areas.findIndex((x) => x.area === (a ?? 'לא ידוע'))) % AREA_COLORS.length]
  const loaded = source.kind === 'airtable' ? fmt.date(source.loadedAt) + ' ' + fmt.time(source.loadedAt) : ''

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="page-label">נתונים חיים מ-Airtable · מקור: Google Maps דרך Apify</p>
          <h1>שוק המאפיות</h1>
          <p className="page-sub">{fmt.num(m.total)} מאפיות אמיתיות. כל מספר כאן מחושב מהשדות שנטענו מ-Airtable. נטען ב-{loaded}.</p>
        </div>
      </div>

      <div className="grid-12">
        <section className="card span-12 mk-kpis" aria-label="מדדים">
          <Kpi icon={<Store size={18} />} label="מאפיות" value={fmt.num(m.total)} note={`${m.areas.length} אזורים`} />
          <Kpi icon={<Star size={18} />} label="דירוג ממוצע" value={m.avgRating == null ? 'אין' : m.avgRating.toFixed(2)} note={`מתוך ${fmt.num(m.rated)} עם דירוג`} />
          <Kpi icon={<MessageSquare size={18} />} label="ביקורות בגוגל" value={fmt.num(m.reviews)} note="סך הכול" />
          <Kpi icon={<Globe size={18} />} label="עם אתר" value={fmt.num(m.withWebsite)} note={m.total ? `${Math.round((100 * m.withWebsite) / m.total)}%` : ''} />
          <Kpi icon={<MapPin size={18} />} label="סגורות" value={fmt.num(m.closed)} note="זמנית או לצמיתות" />
        </section>

        <Panel id="mk-area" title="לפי אזור" icon={<MapPin size={18} aria-hidden="true" />} className="span-6">
          <ul className="mk-bars" aria-label={`מאפיות לפי אזור: ${m.areas.map((a) => `${a.area} ${a.count}`).join(', ')}`}>
            {m.areas.map((a) => (
              <li key={a.area}>
                <span className="mk-bar-label">{a.area}</span>
                <span className="mk-bar-track"><span className="mk-bar-fill" style={{ width: `${(100 * a.count) / (m.areas[0]?.count || 1)}%`, background: areaColor(a.area) }} /></span>
                <span className="mk-bar-num">{fmt.num(a.count)}</span>
                <span className="mk-bar-note">דירוג ממוצע {rating(a.avgRating)} · {fmt.num(a.reviews)} ביקורות</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="mk-rating" title="התפלגות דירוגים" icon={<BarChart3 size={18} aria-hidden="true" />} className="span-6">
          <div className="mk-chart" role="img" aria-label={`התפלגות דירוגים: ${m.ratingBuckets.map((b) => `${b.label} ${b.count}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.ratingBuckets} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={30} label={{ value: 'מאפיות', angle: -90, position: 'insideLeft', fill: 'var(--faint)', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--violet) 10%, transparent)' }} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 10, direction: 'rtl' }} formatter={(v) => [`${v} מאפיות`, '']} />
                <Bar dataKey="count" fill="var(--violet)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="faint small">רק מאפיות עם ביקורות. {fmt.num(m.total - m.rated)} בלי ביקורות לא נכנסות לממוצע.</p>
        </Panel>

        <Panel id="mk-map" title="מפת מיקומים" icon={<MapPin size={18} aria-hidden="true" />} className="span-8">
          <PlaceMap leads={filtered} color={areaColor} onPick={openLead} />
          <p className="faint small">מיקום אמיתי מ-Google Maps. גודל הנקודה לפי מספר הביקורות. בלי רקע מפה, כדי לא לשלוח בקשות לשירות נוסף.</p>
        </Panel>

        <Panel id="mk-cat" title="קטגוריות בגוגל" icon={<Tags size={18} aria-hidden="true" />} className="span-4">
          <ul className="mk-cats">
            {m.categories.slice(0, 8).map((c) => (
              <li key={c.category}><span>{c.category}</span><b>{fmt.num(c.count)}</b></li>
            ))}
          </ul>
        </Panel>

        <Panel id="mk-top" title="הכי הרבה ביקורות" icon={<MessageSquare size={18} aria-hidden="true" />} className="span-12">
          <div className="tbl-scroll" role="region" aria-label="הכי הרבה ביקורות" tabIndex={0}>
            <table className="tbl">
              <thead><tr><th>מאפייה</th><th>אזור</th><th>דירוג</th><th>ביקורות</th><th>אתר</th><th>Google Maps</th></tr></thead>
              <tbody>
                {m.mostReviewed.map((l) => (
                  <tr key={l.id}>
                    <td><button type="button" className="link-btn" onClick={() => openLead(l.id)}>{l.fullName}</button></td>
                    <td>{l.place!.area ?? 'לא ידוע'}</td>
                    <td>{rating(l.place!.rating)}</td>
                    <td>{fmt.num(l.place!.reviews ?? 0)}</td>
                    <td>{l.place!.website ? <a href={l.place!.website} target="_blank" rel="noreferrer">יש</a> : 'אין'}</td>
                    <td>{l.place!.mapsUrl && <a href={l.place!.mapsUrl} target="_blank" rel="noreferrer" aria-label={`פתיחה ב-Google Maps: ${l.fullName}`}><ExternalLink size={15} aria-hidden="true" /></a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="mk-kpi">
      <span className="mk-kpi-label">{icon}{label}</span>
      <b className="mk-kpi-value">{value}</b>
      <span className="faint small">{note}</span>
    </div>
  )
}

/** Plain SVG scatter of the real coordinates (equirectangular, fine at city scale). */
function PlaceMap({ leads, color, onPick }: { leads: Lead[]; color: (area: string | null) => string; onPick: (id: string) => void }) {
  const pts = leads.filter((l) => l.place?.lat != null && l.place?.lng != null)
  if (!pts.length) return <p className="muted">אין מיקומים בנתונים.</p>
  const lats = pts.map((l) => l.place!.lat!), lngs = pts.map((l) => l.place!.lng!)
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const W = 600, H = 420, pad = 18
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const spanX = (maxLng - minLng) * kx || 0.01, spanY = maxLat - minLat || 0.01
  const s = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)
  const x = (lng: number) => W - pad - (W - 2 * pad - spanX * s) / 2 - (maxLng - lng) * kx * s
  const y = (lat: number) => pad + (H - 2 * pad - spanY * s) / 2 + (maxLat - lat) * s
  const maxRev = Math.max(1, ...pts.map((l) => l.place!.reviews ?? 0))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mk-map" role="img" aria-label={`${pts.length} מאפיות לפי מיקום`}>
      {[...pts].sort((a, b) => (b.place!.reviews ?? 0) - (a.place!.reviews ?? 0)).map((l) => (
        <circle key={l.id} cx={x(l.place!.lng!)} cy={y(l.place!.lat!)} r={3 + 11 * Math.sqrt((l.place!.reviews ?? 0) / maxRev)}
          fill={color(l.place!.area)} fillOpacity={0.55} stroke="var(--bg)" strokeWidth={1} onClick={() => onPick(l.id)} style={{ cursor: 'pointer' }}>
          <title>{`${l.fullName} · ${l.place!.area ?? ''} · ${rating(l.place!.rating)} · ${l.place!.reviews ?? 0} ביקורות`}</title>
        </circle>
      ))}
    </svg>
  )
}
