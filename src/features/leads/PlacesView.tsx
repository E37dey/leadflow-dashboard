// SPEC: "מקור נתונים: Airtable". The leads screen when the data is real places: filters, sort and CSV of real fields only.
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react'
import { fmt } from '../../components/ui/format'
import { nowMs, today } from '../../domain/clock'
import { marketStats } from '../../domain/maps'
import { EMPTY_PLACE_FILTER, QUADRANT_LABEL, filterPlaces, isOpenAt, placesCsv, positiveShare, quadrantOf, sortPlaces } from '../../domain/places'
import type { PlaceFilter, PlaceSortKey, Quadrant } from '../../domain/places'
import { RECORD_CLASS_LABEL } from '../../domain/quality'
import type { RecordClass } from '../../domain/quality'
import { useDerived } from '../../store/derived'
import { REGIONS, REGION_LABEL, isRegion } from '../../domain/regions'
import { opportunity } from '../../domain/opportunity'
import { STAGE_LABEL } from '../../domain/types'
import { useStore } from '../../store/store'

const PAGE = 15
const COLS: [PlaceSortKey | null, string][] = [['name', 'מאפייה'], ['area', 'עיר ואזור'], ['rating', 'דירוג'], ['reviews', 'ביקורות'], ['positive', '4-5 כוכבים'], ['score', 'הזדמנות'], [null, 'עכשיו'], [null, 'סיווג'], [null, 'צנרת'], [null, 'קישורים']]

/** #/bakeries?region=haifa opens the screen filtered to a region (from the regions screen). */
const regionFromHash = () => {
  const r = new URLSearchParams(location.hash.split('?')[1] ?? '').get('region')
  return isRegion(r) ? r : 'all'
}

export default function PlacesView() {
  const { openLead, toast, weights } = useStore()
  const { filtered } = useDerived()
  const m = useMemo(() => marketStats(filtered), [filtered])
  const [f, setF] = useState<PlaceFilter>(() => ({ ...EMPTY_PLACE_FILTER, region: regionFromHash(), query: new URLSearchParams(location.hash.split('?')[1] ?? '').get('q') ?? '' }))
  const [sort, setSort] = useState<{ key: PlaceSortKey; dir: 'asc' | 'desc' }>({ key: 'reviews', dir: 'desc' })
  const [page, setPage] = useState(1)
  // A new search from the top bar (or a region from the regions screen) while this screen is open.
  useEffect(() => {
    const on = () => {
      const qs = new URLSearchParams(location.hash.split('?')[1] ?? '')
      if (!location.hash.startsWith('#/bakeries') || ![...qs.keys()].length) return
      setF((cur) => ({ ...cur, query: qs.get('q') ?? cur.query, region: qs.has('region') ? regionFromHash() : cur.region }))
      setPage(1)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const now = nowMs()
  const rows = useMemo(() => sortPlaces(filterPlaces(filtered, f, m.medianReviews, now), sort.key, sort.dir, weights), [filtered, f, m.medianReviews, now, sort, weights])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const view = rows.slice((page - 1) * PAGE, page * PAGE)
  const set = (patch: Partial<PlaceFilter>) => { setF({ ...f, ...patch }); setPage(1) }
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY_PLACE_FILTER)

  const exportCsv = () => {
    const blob = new Blob([placesCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `leadflow-bakeries-${today()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(a.href)
    toast(`יוצאו ${rows.length} מאפיות לקובץ CSV`)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="page-label">נתונים חיים מ-Airtable</p>
          <h1>מאפיות</h1>
          <p className="page-sub">{fmt.num(filtered.length)} מאפיות בבסיס, {fmt.num(rows.length)} מוצגות לפי הסינון.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn ghost" onClick={exportCsv} disabled={!rows.length}>
            <Download size={17} aria-hidden="true" />
            ייצוא CSV
          </button>
        </div>
      </div>

      <section className="card">
        <div className="pl-filters">
          <label className="field pl-q">חיפוש
            <input type="search" value={f.query} placeholder="שם, אזור, קטגוריה, רשת, טלפון" onChange={(e) => set({ query: e.target.value })} />
          </label>
          <label className="field">אזור
            <select value={f.region} onChange={(e) => set({ region: e.target.value as PlaceFilter['region'], area: 'all' })}>
              <option value="all">כל האזורים</option>
              {REGIONS.map((r) => <option key={r} value={r}>{REGION_LABEL[r]} ({filtered.filter((l) => l.place?.region === r).length})</option>)}
            </select>
          </label>
          <label className="field">עיר או שכונה
            <select value={f.area} onChange={(e) => set({ area: e.target.value })}>
              <option value="all">הכול</option>
              {m.areas.filter((a) => f.region === 'all' || filtered.some((l) => l.place?.area === a.area && l.place?.region === f.region)).map((a) => <option key={a.area} value={a.area}>{a.area} ({a.count})</option>)}
            </select>
          </label>
          <label className="field">דירוג מינימלי
            <select value={f.minRating} onChange={(e) => set({ minRating: Number(e.target.value) })}>
              <option value={0}>הכול</option><option value={4}>4.0+</option><option value={4.5}>4.5+</option><option value={4.8}>4.8+</option>
            </select>
          </label>
          <label className="field">ביקורות לפחות
            <select value={f.minReviews} onChange={(e) => set({ minReviews: Number(e.target.value) })}>
              <option value={0}>הכול</option><option value={10}>10</option><option value={50}>50</option><option value={200}>200</option><option value={1000}>1,000</option>
            </select>
          </label>
          <label className="field">אתר
            <select value={f.website} onChange={(e) => set({ website: e.target.value as PlaceFilter['website'] })}>
              <option value="all">הכול</option><option value="yes">יש אתר</option><option value="no">אין אתר</option>
            </select>
          </label>
          <label className="field">צנרת
            <select value={f.pipeline} onChange={(e) => set({ pipeline: e.target.value as PlaceFilter['pipeline'] })}>
              <option value="all">הכול</option><option value="in">בצנרת</option><option value="out">לא בצנרת</option>
            </select>
          </label>
          <label className="field">רבע
            <select value={f.quadrant} onChange={(e) => set({ quadrant: e.target.value as Quadrant | 'all' })}>
              <option value="all">כל הרבעים</option>
              {(Object.keys(QUADRANT_LABEL) as Quadrant[]).map((q) => <option key={q} value={q}>{QUADRANT_LABEL[q]}</option>)}
            </select>
          </label>
          <label className="field">סיווג
            <select value={f.recordClass} onChange={(e) => set({ recordClass: e.target.value as RecordClass | 'all' })}>
              <option value="all">כל הרשומות</option>
              {(Object.keys(RECORD_CLASS_LABEL) as RecordClass[]).map((c) => <option key={c} value={c}>{RECORD_CLASS_LABEL[c]} ({m.classes[c]})</option>)}
            </select>
          </label>
          <label className="pl-check"><input type="checkbox" checked={f.openNow} onChange={(e) => set({ openNow: e.target.checked })} /> פתוחות עכשיו</label>
          {dirty && <button type="button" className="btn ghost sm" onClick={() => { setF(EMPTY_PLACE_FILTER); setPage(1) }}><X size={15} aria-hidden="true" />ניקוי</button>}
        </div>

        <div className="tbl-scroll" role="region" aria-label="טבלת מאפיות" tabIndex={0}>
          <table className="tbl">
            <thead>
              <tr>
                {COLS.map(([k, label]) => (
                  <th key={label} aria-sort={k && sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {k ? (
                      <button type="button" className="th-sort" onClick={() => { setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'name' || k === 'area' ? 'asc' : 'desc' })); setPage(1) }}>
                        {label}{sort.key === k ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((l) => {
                const p = l.place!
                const open = isOpenAt(l, now)
                const pos = positiveShare(l)
                const q = quadrantOf(l, m.medianReviews)
                return (
                  <tr key={l.id}>
                    <td><button type="button" className="link-btn" onClick={() => openLead(l.id)}>{l.fullName}</button><div className="faint small">{p.category ?? ''}{q ? ` · ${QUADRANT_LABEL[q]}` : ''}</div></td>
                    <td>{p.city ?? p.area ?? 'לא ידוע'}<div className="faint small">{p.region ? REGION_LABEL[p.region] : 'אזור לא ידוע'}</div></td>
                    <td>{p.rating == null ? <span className="faint">אין דירוג</span> : `★ ${p.rating.toFixed(1)}`}</td>
                    <td>{fmt.num(p.reviews ?? 0)}</td>
                    <td>{pos == null ? <span className="faint">לא ידוע</span> : <span className="pl-pos"><span style={{ width: `${Math.round(pos * 100)}%` }} /><b>{Math.round(pos * 100)}%</b></span>}</td>
                    <td><b>{opportunity(l, weights).score ?? '—'}</b></td>
                    <td>{open == null ? <span className="faint">לא ידוע</span> : <span className={`pl-open ${open ? 'on' : ''}`}>{open ? 'פתוח' : 'סגור'}</span>}</td>
                    <td><span className={`pl-class pl-class-${p.recordClass}`} title={p.duplicateOf ?? undefined}>{RECORD_CLASS_LABEL[p.recordClass]}</span></td>
                    <td>{l.inPipeline ? <span className="pl-class pl-class-branch">{STAGE_LABEL[l.stage]}</span> : <span className="faint">—</span>}</td>
                    <td className="pl-links">
                      {p.website && <a href={p.website} target="_blank" rel="noreferrer">אתר</a>}
                      {l.phone && <a href={`tel:${l.phone.replace(/\s/g, '')}`} dir="ltr">{l.phone}</a>}
                      {p.mapsUrl && <a href={p.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Google Maps: ${l.fullName}`}><ExternalLink size={14} aria-hidden="true" /></a>}
                    </td>
                  </tr>
                )
              })}
              {!view.length && <tr><td colSpan={COLS.length} className="muted">אין מאפיות שמתאימות לסינון.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <button type="button" className="icon-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="הקודם"><ChevronRight size={18} /></button>
          <span>עמוד {page} מתוך {pages}</span>
          <button type="button" className="icon-btn" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="הבא"><ChevronLeft size={18} /></button>
        </div>
      </section>
    </div>
  )
}
