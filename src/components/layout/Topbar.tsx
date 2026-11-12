import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, CloudDownload, Database, Menu, Search } from 'lucide-react'
import { DEFAULT_RANGE, TODAY, addDays, daysBetween } from '../../domain/clock'
import { SOURCES, SOURCE_LABEL } from '../../domain/types'
import type { Source } from '../../domain/types'
import { THEMES } from '../../store/persist'
import { useStore } from '../../store/store'
import { DEFAULT_GLOBAL, THEME_LABEL } from '../../store/constants'
import { fmt } from '../ui/format'

const PRESETS: { label: string; days: number }[] = [
  { label: '7 הימים האחרונים', days: 7 },
  { label: '30 הימים האחרונים', days: 30 },
  { label: '90 הימים האחרונים', days: 90 },
]

function rangeLabel(from: string, to: string) {
  const preset = PRESETS.find((p) => to === TODAY && daysBetween(from, to) + 1 === p.days)
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
                aria-pressed={r.to === TODAY && daysBetween(r.from, r.to) + 1 === p.days}
                onClick={() => {
                  set(addDays(TODAY, -(p.days - 1)), TODAY)
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
              <input type="date" value={r.from} min={DEFAULT_RANGE.from} max={r.to} onChange={(e) => set(e.target.value, r.to)} />
            </label>
            <label>
              עד תאריך
              <input type="date" value={r.to} min={r.from} max={TODAY} onChange={(e) => set(r.from, e.target.value)} />
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

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { showLeads, table, view, setTable, source } = useStore()
  const [draft, setDraft] = useState('')
  // On the leads screen the box edits the table search directly; elsewhere it is a draft until Enter.
  const q = view === 'leads' ? table.query : draft
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
          showLeads({ query: q })
          setDraft('')
        }}
      >
        <Search size={17} aria-hidden="true" />
        <label htmlFor="global-q" className="sr-only">
          חיפוש לידים
        </label>
        <input
          id="global-q"
          type="search"
          placeholder="חיפוש לידים, עסקאות, חברות..."
          value={q}
          onChange={(e) => (view === 'leads' ? setTable({ ...table, query: e.target.value }) : setDraft(e.target.value))}
        />
      </form>
      <DateRangeControl />
      {source.kind === 'airtable' ? (
        <a className="demo-badge at-badge" href="#/settings" title={`הנתונים נטענו מ-Airtable, בסיס ${source.baseId}`}>
          <CloudDownload size={15} aria-hidden="true" />
          Airtable · {source.leads} לידים
        </a>
      ) : (
        <span className="demo-badge" title="כל הנתונים במסך בדויים ונוצרים בדפדפן">
          <Database size={15} aria-hidden="true" />
          נתוני הדגמה
        </span>
      )}
      <UserMenu />
    </header>
  )
}

/** Global filters: source and owner. They change every number on every screen. */
export function GlobalFilters() {
  const { global, setGlobal, owners } = useStore()
  const changed = global.source !== 'all' || global.ownerId !== 'all' || global.range.from !== DEFAULT_RANGE.from || global.range.to !== DEFAULT_RANGE.to
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
        <button type="button" className="link-btn" onClick={() => setGlobal(DEFAULT_GLOBAL)}>
          ניקוי סינון
        </button>
      )}
    </div>
  )
}
