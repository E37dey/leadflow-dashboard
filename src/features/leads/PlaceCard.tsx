// SPEC: "מקור נתונים: Airtable". The real Google Maps data of a place, inside the lead drawer.
import { ExternalLink, Globe, MapPin, Phone, ShieldCheck, Star } from 'lucide-react'
import { fmt } from '../../components/ui/format'
import { nowMs } from '../../domain/clock'
import { isOpenAt, israelTime, positiveShare } from '../../domain/places'
import { DAYS, RECORD_CLASS_LABEL } from '../../domain/quality'
import type { Lead } from '../../domain/types'

const STAR_COLORS = ['#3fd29b', '#9bd36a', '#f0c24c', '#f08f4c', '#ef5f6b']

export function PlaceCard({ lead }: { lead: Lead }) {
  const p = lead.place!
  const now = nowMs()
  const open = isOpenAt(lead, now)
  const todayIdx = israelTime(now).day
  const total = p.stars ? p.stars.reduce((a, b) => a + b, 0) : 0
  const pos = positiveShare(lead)
  return (
    <section className="pc" aria-labelledby="pc-h">
      <h3 id="pc-h" className="sec-h">נתונים מ-Google Maps</h3>
      <div className="pc-top">
        <div className="pc-rating">
          <b>{p.rating == null ? '—' : p.rating.toFixed(1)}</b>
          <span><Star size={14} aria-hidden="true" /> {p.rating == null ? 'אין דירוג' : `${fmt.num(p.reviews ?? 0)} ביקורות`}</span>
        </div>
        <div className="pc-badges">
          {open != null && <span className={`pl-open ${open ? 'on' : ''}`}>{open ? 'פתוח עכשיו' : 'סגור עכשיו'}</span>}
          <span className={`pl-class pl-class-${p.recordClass}`}>{RECORD_CLASS_LABEL[p.recordClass]}</span>
          {p.status !== 'open' && <span className="pl-class pl-class-suspected_duplicate">{p.status === 'closed' ? 'סגור לצמיתות' : 'סגור זמנית'}</span>}
        </div>
      </div>

      {p.stars && total > 0 && (
        <div className="pc-stars">
          {p.stars.map((v, i) => (
            <div key={i}><span>{5 - i}★</span><span className="mk-bar-track"><span className="mk-bar-fill" style={{ width: `${(100 * v) / total}%`, background: STAR_COLORS[i] }} /></span><b>{fmt.num(v)}</b></div>
          ))}
          {pos != null && <p className="faint small">{Math.round(pos * 100)}% מהביקורות הן 4 או 5 כוכבים.</p>}
        </div>
      )}

      {p.duplicateOf && <p className="pc-dup"><ShieldCheck size={15} aria-hidden="true" /> כפילות חשודה של {p.duplicateOf}</p>}

      <dl className="pc-facts">
        <div><dt><MapPin size={14} aria-hidden="true" />אזור</dt><dd>{p.area ?? 'לא ידוע'}</dd></div>
        <div><dt>קטגוריות</dt><dd>{p.categories.length ? p.categories.join(', ') : p.category ?? 'לא ידוע'}</dd></div>
        <div><dt><Phone size={14} aria-hidden="true" />טלפון</dt><dd dir="ltr">{lead.phone ? <a href={`tel:${lead.phone.replace(/\s/g, '')}`}>{lead.phone}</a> : 'לא ידוע'}</dd></div>
        <div><dt><Globe size={14} aria-hidden="true" />אתר</dt><dd dir="ltr">{p.website ? <a href={p.website} target="_blank" rel="noreferrer">{p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : 'לא ידוע'}</dd></div>
        {p.recordClass === 'branch' && <div><dt>רשת</dt><dd dir="ltr">{p.brand}</dd></div>}
        {p.mapsUrl && <div><dt>מפה</dt><dd><a href={p.mapsUrl} target="_blank" rel="noreferrer">פתיחה ב-Google Maps <ExternalLink size={13} aria-hidden="true" /></a></dd></div>}
      </dl>

      {p.hours?.length ? (
        <table className="pc-hours">
          <tbody>
            {DAYS.map((d, i) => {
              const h = p.hours!.find((x) => x.day === d)
              return <tr key={d} className={i === todayIdx ? 'pc-today' : undefined}><th>{d.replace('יום ', '')}</th><td dir="ltr">{h ? h.hours.replace(/ to /g, '–') : 'לא ידוע'}</td></tr>
            })}
          </tbody>
        </table>
      ) : <p className="faint small">שעות פתיחה: לא ידוע.</p>}
    </section>
  )
}
