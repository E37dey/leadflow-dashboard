import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, CloudDownload, Database, Menu, RefreshCw, Search } from 'lucide-react'
import { addDays, daysBetween, defaultRange, today } from '../../domain/clock'
import { SOURCES, SOURCE_LABEL } from '../../domain/types'
import type { Source } from '../../domain/types'
import { THEMES } from '../../store/persist'
import { useStore } from '../../store/store'
import { defaultGlobal, THEME_LABEL } from '../../store/constants'
import { fmt } from '../ui/format'

const PRESETS: { label: string; days: number }[] = [
  { label: '7 הימים האחרונים', days: 7 },
  { label: '30 הימים האחרונים', days: 30 },
  { label: '90 הימים האחרונים', days: 90 },
]

function rangeLabel(from: string, to: string) {
  const preset = PRESETS.find((p) => to === today() && daysBetween(from, to) + 1 === p.days)
  return preset ? preset.label : `${fmt.date(from + 'T12:00:00Z')} עד ${fmt.date(to + 'T12:00:00Z')}`
}

function DateRangeControl() {
  const { global, setGlobal } = useStore()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const r = global.range
  const set = (from: string, to: string) => from && to && from <= to && setGlobal({ ...global, range: { from, to } })
  return (
    <div className="pop-wrap" ref={box}>
      <button type="button" className="ctl" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <CalendarDays size={17} aria-hidden="true" />
        <span>
          <span className="sr-only">טווח תאריכי יצירה: </span>
          {rangeLabel(r.from, r.to)}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="בחירת טווח תאריכים">
          <div className="preset-list">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                className="chip"
                aria-pressed={r.to === today() && daysBetween(r.from, r.to) + 1 === p.days}
                onClick={() => {
                  set(addDays(today(), -(p.days - 1)), today())
                  setOpen(false)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="range-inputs">
            <label>
              מתאריך
              <input type="date" value={r.from} min={defaultRange().from} max={r.to} onChange={(e) => set(e.target.value, r.to)} />
            </label>
            <label>
              עד תאריך
              <input type="date" value={r.to} min={r.from} max={today()} onChange={(e) => set(r.from, e.target.value)} />
            </label>
          </div>
          <p className="hint">ימים קלנדריים בשעון ישראל, כולל שני הקצוות.</p>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { theme, dispatch, go } = useStore()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="pop-wrap" ref={box}>
      <button type="button" className="user-btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <span className="avatar lg">א</span>
        <span className="sr-only">איליה, עיצוב והגדרות</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="popover menu" role="menu" aria-label="עיצוב">
          <p className="menu-title">כיוון עיצוב</p>
          {THEMES.map((t) => (
            <button key={t} type="button" role="menuitemradio" aria-checked={theme === t} className="menu-item" onClick={() => dispatch({ type: 'setTheme', theme: t })}>
              <span className={`swatch sw-${t}`} aria-hidden="true" />
              {THEME_LABEL[t]}
            </button>
          ))}
          <button type="button" role="menuitem" className="menu-item" onClick={() => { go('settings'); setOpen(false) }}>
            כל ההגדרות
          </button>
        </div>
      )}
    </div>
  )
}

const STATE_TEXT = { connected: 'Airtable מחובר', empty: 'Airtable: בסיס ריק', error: 'Airtable: שגיאת חיבור', missing_config: 'Airtable: חסרה הגדרה', unavailable: '' } as const

/** SPEC: "שרת API ל-Airtable (סעיף 19)": connection status, last good sync and a refresh button. Never the token. */
function AirtableStatus() {
  const { source, server, airtableBusy, reloadAirtable, toast } = useStore()
  const st = server?.state ?? 'unavailable'
  const viaServer = source.kind === 'airtable' && source.via === 'server'
  if (!viaServer && source.kind !== 'airtable' && (st === 'unavailable' || !server)) {
    return (
      <span className="demo-badge" title="כל הנתונים במסך בדויים ונוצרים בדפדפן">
        <Database size={15} aria-hidden="true" />
        נתוני הדגמה
      </span>
    )
  }
  const tone = airtableBusy ? 'sync' : viaServer || source.kind === 'airtable' ? (st === 'error' ? 'err' : 'ok') : st === 'missing_config' || st === 'error' ? 'err' : 'warn'
  const label = airtableBusy ? 'מסנכרן מ-Airtable…' : viaServer ? STATE_TEXT[st === 'unavailable' ? 'connected' : st] : source.kind === 'airtable' ? 'Airtable (טוקן בדפדפן)' : STATE_TEXT[st]
  const synced = source.kind === 'airtable' ? source.loadedAt : server?.lastSuccessfulSyncAt ?? null
  return (
    <div className={`at-chip ${tone}`} role="status" aria-live="polite">
      <a href="#/settings" className="at-chip-main" title={source.kind === 'airtable' ? `${source.leads} רשומות · בסיס ${source.baseId}` : server?.error?.message ?? ''}>
        <span className="at-chip-dot" aria-hidden="true" />
        <CloudDownload size={15} aria-hidden="true" />
        <span>{label}</span>
        {synced && <span className="at-chip-time">סנכרון {new Date(synced).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}</span>}
      </a>
      {(viaServer || source.kind === 'airtable') && (
        <button type="button" className="icon-btn at-refresh" aria-label="רענון נתונים מ-Airtable" title="רענון נתונים מ-Airtable" disabled={airtableBusy}
          onClick={() => reloadAirtable().catch((e: Error) => toast(e.message, { tone: 'error' }))}>
          <RefreshCw size={16} className={airtableBusy ? 'spin' : undefined} />
        </button>
      )}
    </div>
  )
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { showLeads, table, view, setTable, source, go } = useStore()
  const live = source.kind === 'airtable'
  const [draft, setDraft] = useState('')
  // On the leads screen the box edits the table search directly; elsewhere it is a draft until Enter.
  const q = view === 'leads' && !live ? table.query : draft
  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="פתיחת התפריט">
        <Menu size={20} />
      </button>
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (live) {
            location.hash = `#/bakeries?q=${encodeURIComponent(q)}`
            go('bakeries')
          } else showLeads({ query: q })
          setDraft('')
        }}
      >
        <Search size={17} aria-hidden="true" />
        <label htmlFor="global-q" className="sr-only">
          {live ? 'חיפוש מאפיות' : 'חיפוש לידים'}
        </label>
        <input
          id="global-q"
          type="search"
          placeholder={live ? 'חיפוש מאפייה, עיר, רשת, טלפון...' : 'חיפוש לידים, עסקאות, חברות...'}
          value={q}
          onChange={(e) => (view === 'leads' && !live ? setTable({ ...table, query: e.target.value }) : setDraft(e.target.value))}
        />
      </form>
      <DateRangeControl />
      <AirtableStatus />
      <UserMenu />
    </header>
  )
}

/** Global filters: source and owner. They change every number on every screen. */
export function GlobalFilters() {
  const { global, setGlobal, owners } = useStore()
  const changed = global.source !== 'all' || global.ownerId !== 'all' || global.range.from !== defaultRange().from || global.range.to !== defaultRange().to
  return (
    <div className="gfilters" role="group" aria-label="סינון לכל הדאשבורד">
      <label>
        <span>מקור</span>
        <select value={global.source} onChange={(e) => setGlobal({ ...global, source: e.target.value as Source | 'all' })}>
          <option value="all">כל המקורות</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>אחראי</span>
        <select value={global.ownerId} onChange={(e) => setGlobal({ ...global, ownerId: e.target.value })}>
          <option value="all">כל הצוות</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {changed && (
        <button type="button" className="link-btn" onClick={() => setGlobal(defaultGlobal())}>
          ניקוי סינון
        </button>
      )}
    </div>
  )
}
