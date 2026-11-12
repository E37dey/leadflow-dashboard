// SPEC: "מקור נתונים: Airtable". The overview when the data is real (Google Maps places loaded from Airtable).
// Every number here is a count, sum, share or average of real fields. Unknown values are shown as unknown, never as 0.
import { useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { BadgeCheck, Clock3, Copy, Database, ExternalLink, GitBranch, Globe, Layers, MapPin, MessageSquare, Percent, Phone, ShieldCheck, Sparkles, Star, Store, Tags, Target, Wallet } from 'lucide-react'
import { QualityScatter } from './QualityScatter'
import { Panel } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { marketStats } from '../../domain/maps'
import { DAY_SHORT, RECORD_CLASS_LABEL, openGrid } from '../../domain/quality'
import { isOpenAt } from '../../domain/places'
import { nowMs } from '../../domain/clock'
import type { Lead } from '../../domain/types'
import { REGIONS, REGION_LABEL } from '../../domain/regions'
import { pipelineSummary, regionRows } from '../../domain/summary'
import { REGION_COLOR, UNKNOWN_COLOR } from '../regions/regionColors'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'

const STAR_COLORS = ['#3fd29b', '#9bd36a', '#f0c24c', '#f08f4c', '#ef5f6b']
const STAR_LABELS = ['5★', '4★', '3★', '2★', '1★']
const pct = (r: number) => `${Math.round(r * 100)}%`
const rating = (r: number | null) => (r == null ? 'אין דירוג' : r.toFixed(1))
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5) // 05:00 to 23:00

export function MarketOverview() {
  const { source, openLead, go } = useStore()
  const { filtered } = useDerived()
  const m = useMemo(() => marketStats(filtered), [filtered])
  const hours = useMemo(() => openGrid(filtered), [filtered])
  const regions = useMemo(() => regionRows(filtered), [filtered])
  const pipe = useMemo(() => pipelineSummary(filtered), [filtered])
  const colorOf = (l: Lead) => (l.place?.region ? REGION_COLOR[l.place.region] : UNKNOWN_COLOR)
  const present = REGIONS.filter((r) => regions.find((x) => x.id === r)!.bakeries > 0)
  const loaded = source.kind === 'airtable' ? `${fmt.date(source.loadedAt)} ${fmt.time(source.loadedAt)}` : ''
  const starTotal = m.stars.reduce((s, v) => s + v, 0)
  const openNow = filtered.filter((l) => isOpenAt(l, nowMs()) === true).length

  // Facts read off the opening-hours grid (computed, not written by hand).
  const maxOpen = Math.max(1, ...hours.grid.flat())
  const satOpen = Math.max(...hours.grid[6])
  const friAt15 = hours.grid[5][15], thuAt15 = hours.grid[4][15]
  let peak = { d: 0, h: 0, v: -1 }
  hours.grid.forEach((row, d) => row.forEach((v, h) => { if (v > peak.v) peak = { d, h, v } }))

  return (
    <div className="page mk">
      <div className="page-head">
        <div>
          <p className="page-label mk-live"><span className="mk-pulse" aria-hidden="true" />נתונים חיים מ-Airtable · עודכן {loaded}</p>
          <h1>שוק המאפיות</h1>
          <p className="page-sub">{fmt.num(m.total)} מאפיות אמיתיות מ-Google Maps ב-{present.length} אזורים, מחיפה ועפולה עד באר שבע. כל מספר במסך מחושב מהשדות שבבסיס.</p>
        </div>
        <div className="mk-now" aria-live="polite">
          <span className="mk-pulse" aria-hidden="true" />
          <b>{fmt.num(openNow)}</b>
          <span>פתוחות עכשיו<small>לפי שעות הפתיחה בגוגל, מתוך {fmt.num(hours.withHours)} עם שעות</small></span>
        </div>
      </div>

      <div className="grid-12">
        <section className="card span-12 mk-flow" aria-label="מסלול הנתונים">
          <FlowStep icon={<MapPin size={18} />} title="Google Maps" value="מקור" sub="עסקים ציבוריים" />
          <FlowStep icon={<Database size={18} />} title="Apify" value={fmt.num(m.total)} sub="מקומות נאספו" />
          <FlowStep icon={<ShieldCheck size={18} />} title="ניקוי וסיווג" value={fmt.num(m.classes.suspected_duplicate)} sub="כפילויות חשודות סומנו" tone="warn" />
          <FlowStep icon={<Database size={18} />} title="Airtable" value={fmt.num(m.total)} sub="רשומות בבסיס" />
          <FlowStep icon={<BadgeCheck size={18} />} title="LEADFLOW" value={fmt.num(m.classes.unique + m.classes.branch)} sub="עסקים נקיים במסך" tone="ok" />
        </section>

        <section className="card span-12 mk-kpis" aria-label="מדדים">
          <Kpi icon={<Store size={18} />} label="מאפיות" value={fmt.num(m.total)} note={`${present.length} אזורים · ${fmt.num(m.chains.length)} רשתות`} />
          <Kpi icon={<Star size={18} />} label="דירוג ממוצע" value={m.avgRating == null ? 'אין' : m.avgRating.toFixed(2)} note={`מתוך ${fmt.num(m.rated)} עם דירוג`}>
            <StarRow value={m.avgRating ?? 0} />
          </Kpi>
          <Kpi icon={<MessageSquare size={18} />} label="ביקורות בגוגל" value={fmt.num(m.reviews)} note={`חציון ${fmt.num(m.medianReviews)} למאפייה`} />
          <Ring label="עם טלפון" icon={<Phone size={14} />} share={m.withPhone / (m.total || 1)} />
          <Ring label="עם אתר" icon={<Globe size={14} />} share={m.withWebsite / (m.total || 1)} />
          <Ring label="עם שעות" icon={<Clock3 size={14} />} share={hours.withHours / (m.total || 1)} />
        </section>

        <section className="card span-12 mk-kpis mk-pipe" aria-label="צנרת מכירה">
          <Kpi icon={<Layers size={18} />} label="לידים בצנרת" value={fmt.num(pipe.total)} note={pipe.total ? `${pipe.open} פתוחים` : 'מאפייה נכנסת רק כשמוסיפים אותה'} />
          <Kpi icon={<Sparkles size={18} />} label="לידים חדשים" value={fmt.num(pipe.byStage.new)} note="בשלב ״חדש״" />
          <Kpi icon={<Percent size={18} />} label="שיעור המרה" value={pipe.conversion == null ? 'אין עדיין' : pct(pipe.conversion)} note={pipe.conversion == null ? 'אין עסקאות סגורות' : `${pipe.won} נסגרו בהצלחה מתוך ${pipe.won + pipe.lost} סגורים`} />
          <Kpi icon={<Wallet size={18} />} label="שווי הזדמנויות" value={pipe.valued ? fmt.ils(pipe.openValue) : 'לא הוזן'} note={pipe.valued ? `סכום של ${pipe.valued} לידים פתוחים עם שווי` : 'רק שווי שהזנת, לא הערכה'} />
          <button type="button" className="btn ghost sm mk-pipe-go" onClick={() => go(pipe.total ? 'pipeline' : 'bakeries')}>{pipe.total ? 'לצנרת' : 'הוספת מאפיות לצנרת'}</button>
        </section>

        <Panel id="mk-quad" title="איכות מול פופולריות" icon={<Target size={18} aria-hidden="true" />} className="span-8">
          <QualityScatter leads={filtered} median={m.medianReviews} onPick={openLead} />
        </Panel>
        <Panel id="mk-quad-cards" title="ארבעה רבעים" icon={<Target size={18} aria-hidden="true" />} className="span-4">
          <div className="mk-quads">
            <Quad title="כוכבים" desc={`דירוג 4.5+ ולפחות ${fmt.num(m.medianReviews)} ביקורות`} n={m.quadrants.stars} tone="ok" />
            <Quad title="יהלומים נסתרים" desc="דירוג 4.5+, מעט ביקורות" n={m.quadrants.hidden} tone="aqua" />
            <Quad title="פופולריות, דירוג נמוך" desc="הרבה ביקורות, דירוג מתחת ל-4.5" n={m.quadrants.crowded} tone="warn" />
            <Quad title="שקטות" desc="מעט ביקורות, דירוג מתחת ל-4.5" n={m.quadrants.weak} tone="muted" />
          </div>
          <p className="faint small">הקווים: דירוג 4.5 וחציון הביקורות ({fmt.num(m.medianReviews)}). כלל קבוע, לא חיזוי.</p>
        </Panel>

        <Panel id="mk-stars" title="מה הלקוחות נותנים" icon={<Star size={18} aria-hidden="true" />} className="span-6">
          <p className="mk-big">{fmt.num(starTotal)} <span>ביקורות עם פירוט כוכבים</span></p>
          <StackBar values={m.stars} />
          <ul className="mk-starlegend">
            {m.stars.map((v, i) => <li key={i}><i style={{ background: STAR_COLORS[i] }} />{5 - i} כוכבים <b>{starTotal ? pct(v / starTotal) : '0%'}</b></li>)}
          </ul>
          <div className="mk-area-stars">
            {present.map((r) => {
              const st = [0, 1, 2, 3, 4].map((i) => filtered.filter((l) => l.place?.region === r && l.place.stars).reduce((s, l) => s + l.place!.stars![i], 0))
              return <div key={r}><span>{REGION_LABEL[r]}</span><StackBar values={st} thin /></div>
            })}
          </div>
        </Panel>

        <Panel id="mk-hours" title="מתי המאפיות פתוחות" icon={<Clock3 size={18} aria-hidden="true" />} className="span-6">
          <div className="mk-heat" role="table" aria-label="מספר מאפיות פתוחות לפי יום ושעה">
            <div className="mk-heat-row mk-heat-head" role="row"><span />{HOURS.map((h) => <span key={h} role="columnheader">{h % 3 === 0 ? h : ''}</span>)}</div>
            {DAY_SHORT.map((d, di) => (
              <div key={d} className="mk-heat-row" role="row">
                <span role="rowheader">{d}</span>
                {HOURS.map((h) => {
                  const v = hours.grid[di][h]
                  return <span key={h} role="cell" className="mk-cell" style={{ background: v ? `color-mix(in oklab, var(--violet) ${Math.round(15 + 85 * (v / maxOpen))}%, transparent)` : 'var(--surface-2)' }} title={`${d} ${h}:00 · ${v} פתוחות`} />
                })}
              </div>
            ))}
          </div>
          <ul className="mk-facts">
            <li>בשיא: <b>{peak.v}</b> מאפיות פתוחות ביום {DAY_SHORT[peak.d]} ב-{peak.h}:00.</li>
            <li>בשישי ב-15:00 פתוחות <b>{friAt15}</b>, לעומת <b>{thuAt15}</b> בחמישי באותה שעה.</li>
            <li>בשבת פתוחות לכל היותר <b>{satOpen}</b> מתוך {fmt.num(hours.withHours)} עם שעות.</li>
          </ul>
        </Panel>

        <Panel id="mk-map" title="מפת מיקומים" icon={<MapPin size={18} aria-hidden="true" />} className="span-8">
          <PlaceMap leads={filtered} colorOf={colorOf} onPick={openLead} />
          <p className="faint small">קואורדינטות אמיתיות מ-Google Maps. גודל הנקודה לפי מספר הביקורות, טבעת = סניף של רשת, שקופה = כפילות חשודה.</p>
        </Panel>
        <Panel id="mk-area" title="לפי אזור" icon={<MapPin size={18} aria-hidden="true" />} className="span-4">
          <ul className="mk-bars">
            {[...regions].sort((a, b) => b.bakeries - a.bakeries).filter((r) => r.bakeries).map((r) => (
              <li key={r.id}>
                <span className="mk-bar-label">{r.label}</span>
                <span className="mk-bar-track"><span className="mk-bar-fill" style={{ width: `${(100 * r.bakeries) / Math.max(1, ...regions.map((x) => x.bakeries))}%`, background: REGION_COLOR[r.id] }} /></span>
                <span className="mk-bar-num">{fmt.num(r.bakeries)}</span>
                <span className="mk-bar-note">★ {rating(r.avgRating)} · {fmt.num(r.reviews)} ביקורות</span>
              </li>
            ))}
          </ul>
          <button type="button" className="link-btn small" onClick={() => go('regions')}>להשוואת אזורים המלאה</button>
        </Panel>

        <Panel id="mk-chains" title="רשתות וסניפים" icon={<GitBranch size={18} aria-hidden="true" />} className="span-6">
          {m.chains.length ? (
            <ul className="mk-chains">
              {m.chains.slice(0, 8).map((c) => (
                <li key={c.brand}>
                  <span className="mk-chain-dots" aria-hidden="true">{Array.from({ length: c.branches }, (_, i) => <i key={i} />)}</span>
                  <span className="mk-chain-name"><b>{c.name}</b><small dir="ltr">{c.brand}</small></span>
                  <span className="mk-chain-num">{c.branches} סניפים · {fmt.num(c.reviews)} ביקורות</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">לא נמצאו רשתות בנתונים.</p>}
          <p className="faint small">רשת = אותו אתר (דומיין), או אותו שם אחרי ניקוי, בשני מקומות או יותר שאינם כפילות.</p>
        </Panel>
        <Panel id="mk-quality" title="איכות הנתונים ומניעת כפילויות" icon={<ShieldCheck size={18} aria-hidden="true" />} className="span-6">
          <div className="mk-classes">
            {(['unique', 'branch', 'suspected_duplicate'] as const).map((k) => (
              <div key={k} className={`mk-class mk-class-${k}`}>
                <b>{fmt.num(m.classes[k])}</b>
                <span>{RECORD_CLASS_LABEL[k]}</span>
              </div>
            ))}
          </div>
          <div className="mk-complete">
            {m.completeness.map((c) => (
              <div key={c.field}><span>{c.field}</span><span className="mk-bar-track"><span className="mk-bar-fill" style={{ width: pct(c.share), background: c.share > 0.8 ? 'var(--aqua)' : c.share > 0.4 ? 'var(--violet)' : '#f0b44c' }} /></span><b>{pct(c.share)}</b></div>
            ))}
          </div>
          {m.duplicates.length > 0 && (
            <details className="mk-dups">
              <summary><Copy size={14} aria-hidden="true" /> {m.duplicates.length} כפילויות חשודות, והסיבה</summary>
              <ul>{m.duplicates.map((l) => <li key={l.id}><button type="button" className="link-btn" onClick={() => openLead(l.id)}>{l.fullName}</button> <span className="faint">← {l.place!.duplicateOf}</span></li>)}</ul>
            </details>
          )}
          <p className="faint small">כפילות חשודה = עד 100 מטר ממקום אחר, וגם אותו מותג, אותו טלפון או שם דומה. הרשומה עם פחות ביקורות מסומנת. כפילות מדויקת (אותו מזהה גוגל) לא נכנסת לבסיס בכלל.</p>
        </Panel>

        <Panel id="mk-cat" title="קטגוריות בגוגל" icon={<Tags size={18} aria-hidden="true" />} className="span-4">
          <div className="mk-tags">
            {m.categories.slice(0, 14).map((c) => <span key={c.category} style={{ fontSize: `${12 + Math.min(10, (10 * c.count) / (m.categories[0]?.count || 1))}px` }}>{c.category} <b>{c.count}</b></span>)}
          </div>
          <p className="faint small">לכל מאפייה יכולות להיות כמה קטגוריות.</p>
        </Panel>
        <Panel id="mk-top" title="10 עם הכי הרבה ביקורות" icon={<MessageSquare size={18} aria-hidden="true" />} className="span-8">
          <div className="tbl-scroll" role="region" aria-label="10 עם הכי הרבה ביקורות" tabIndex={0}>
            <table className="tbl">
              <thead><tr><th>#</th><th>מאפייה</th><th>אזור</th><th>דירוג</th><th>ביקורות</th><th>פירוט כוכבים</th><th>מפה</th></tr></thead>
              <tbody>
                {m.mostReviewed.map((l, i) => (
                  <tr key={l.id}>
                    <td className="faint">{i + 1}</td>
                    <td><button type="button" className="link-btn" onClick={() => openLead(l.id)}>{l.fullName}</button>{l.place!.recordClass === 'branch' && <span className="mk-chip">רשת</span>}</td>
                    <td>{l.place!.city ?? l.place!.area ?? 'לא ידוע'}<div className="faint small">{l.place!.region ? REGION_LABEL[l.place!.region] : ''}</div></td>
                    <td>★ {rating(l.place!.rating)}</td>
                    <td>{fmt.num(l.place!.reviews ?? 0)}</td>
                    <td style={{ minWidth: 120 }}>{l.place!.stars ? <StackBar values={l.place!.stars} thin /> : 'לא ידוע'}</td>
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

function FlowStep({ icon, title, value, sub, tone }: { icon: ReactNode; title: string; value: string; sub: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`mk-step ${tone ? `mk-step-${tone}` : ''}`}>
      <span className="mk-step-icon">{icon}</span>
      <span className="mk-step-title">{title}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  )
}

function Kpi({ icon, label, value, note, children }: { icon: ReactNode; label: string; value: string; note: string; children?: ReactNode }) {
  return (
    <div className="mk-kpi">
      <span className="mk-kpi-label">{icon}{label}</span>
      <b className="mk-kpi-value">{value}</b>
      {children}
      <span className="faint small">{note}</span>
    </div>
  )
}

function Ring({ label, icon, share }: { label: string; icon: ReactNode; share: number }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <div className="mk-kpi mk-ring">
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--aqua)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <div><b className="mk-kpi-value">{pct(share)}</b><span className="mk-kpi-label">{icon}{label}</span></div>
    </div>
  )
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="mk-stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ '--fill': `${Math.max(0, Math.min(1, value - i)) * 100}%` } as CSSProperties}>★</span>)}
    </span>
  )
}

function StackBar({ values, thin }: { values: number[]; thin?: boolean }) {
  const t = values.reduce((s, v) => s + v, 0) || 1
  return (
    <span className={`mk-stack ${thin ? 'thin' : ''}`} role="img" aria-label={values.map((v, i) => `${STAR_LABELS[i]} ${Math.round((100 * v) / t)}%`).join(', ')}>
      {values.map((v, i) => (v ? <i key={i} style={{ width: `${(100 * v) / t}%`, background: STAR_COLORS[i] }} title={`${STAR_LABELS[i]}: ${fmt.num(v)}`} /> : null))}
    </span>
  )
}

function Quad({ title, desc, n, tone }: { title: string; desc: string; n: number; tone: string }) {
  return <div className={`mk-quad mk-quad-${tone}`}><b>{n}</b><span>{title}</span><small>{desc}</small></div>
}

/** Plain SVG scatter of the real coordinates (equirectangular), with region labels. */
function PlaceMap({ leads, colorOf, onPick }: { leads: Lead[]; colorOf: (l: Lead) => string; onPick: (id: string) => void }) {
  const pts = leads.filter((l) => l.place?.lat != null && l.place?.lng != null)
  if (!pts.length) return <p className="muted">אין מיקומים בנתונים.</p>
  const lats = pts.map((l) => l.place!.lat!), lngs = pts.map((l) => l.place!.lng!)
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const W = 760, H = 460, pad = 26
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const spanX = (maxLng - minLng) * kx || 0.01, spanY = maxLat - minLat || 0.01
  const s = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)
  const x = (lng: number) => W - pad - (W - 2 * pad - spanX * s) / 2 - (maxLng - lng) * kx * s
  const y = (lat: number) => pad + (H - 2 * pad - spanY * s) / 2 + (maxLat - lat) * s
  const maxRev = Math.max(1, ...pts.map((l) => l.place!.reviews ?? 0))
  const labels = REGIONS.map((r) => {
    const ps = pts.filter((l) => l.place!.region === r)
    if (ps.length < 5) return null
    return { a: REGION_LABEL[r], x: ps.reduce((t, l) => t + x(l.place!.lng!), 0) / ps.length, y: Math.min(...ps.map((l) => y(l.place!.lat!))) - 10, n: ps.length }
  }).filter(Boolean) as { a: string; x: number; y: number; n: number }[]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mk-map" role="img" aria-label={`${pts.length} מאפיות לפי מיקום`}>
      <defs>
        <pattern id="mk-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" fill="none" stroke="var(--border)" strokeWidth="0.6" /></pattern>
      </defs>
      <rect width={W} height={H} fill="url(#mk-grid)" />
      {[...pts].sort((a, b) => (b.place!.reviews ?? 0) - (a.place!.reviews ?? 0)).map((l) => (
        <circle key={l.id} cx={x(l.place!.lng!)} cy={y(l.place!.lat!)} r={3 + 13 * Math.sqrt((l.place!.reviews ?? 0) / maxRev)}
          fill={colorOf(l)} fillOpacity={l.place!.recordClass === 'suspected_duplicate' ? 0.2 : 0.6}
          stroke={l.place!.recordClass === 'branch' ? 'var(--text)' : 'var(--bg)'} strokeWidth={l.place!.recordClass === 'branch' ? 1.4 : 0.8}
          onClick={() => onPick(l.id)} style={{ cursor: 'pointer' }}>
          <title>{`${l.fullName} · ${l.place!.area ?? ''} · ★ ${rating(l.place!.rating)} · ${l.place!.reviews ?? 0} ביקורות`}</title>
        </circle>
      ))}
      {labels.map((t) => <text key={t.a} x={t.x} y={Math.max(14, t.y)} textAnchor="middle" className="mk-map-label">{t.a} · {t.n}</text>)}
    </svg>
  )
}
