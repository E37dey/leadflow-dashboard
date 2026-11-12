import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Camera, Globe, Info, MapPin, MessageCircle, Phone, UserPlus, X } from 'lucide-react'
import type { Owner, Source, Stage } from '../../domain/types'
import { PRIORITY_LABEL, SOURCE_LABEL, STAGE_LABEL } from '../../domain/types'
import { priority } from '../../domain/score'
import { useStore } from '../../store/store'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Drawer or dialog: traps focus, closes on Esc and on the backdrop, returns focus to the opener. */
export function Overlay({ kind, title, onClose, children, footer, wide }: {
  kind: 'drawer' | 'dialog'
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const [a, z] = [items[0], items[items.length - 1]]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [onClose])

  return (
    <div className="overlay" data-kind={kind}>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className={`panel-${kind}${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <header className="ov-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה">
            <X size={18} />
          </button>
        </header>
        <div className="ov-body">{children}</div>
        {footer && <footer className="ov-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function InfoTip({ text }: { text: string }) {
  const id = useId()
  return (
    <span className="tip">
      <button type="button" className="tip-btn" aria-describedby={id} aria-label="הסבר">
        <Info size={14} />
      </button>
      <span role="tooltip" id={id} className="tip-body">
        {text}
      </span>
    </span>
  )
}

const SOURCE_ICON: Record<Source, typeof Globe> = { website: Globe, facebook: MessageCircle, instagram: Camera, referral: UserPlus, telephone: Phone, maps: MapPin }
export function SourceTag({ source }: { source: Source }) {
  const I = SOURCE_ICON[source]
  return (
    <span className={`source src-${source}`}>
      <I size={15} aria-hidden="true" />
      {SOURCE_LABEL[source]}
    </span>
  )
}

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`stage st-${stage}`}>{STAGE_LABEL[stage]}</span>
}

/** Score in a thin ring; the word for the priority is always there, not only the color. */
export function ScoreRing({ value, open }: { value: number; open: boolean }) {
  const p = priority(value)
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <span className={`score pr-${open ? p : 'closed'}`} title={open ? `ציון ${value}, עדיפות ${PRIORITY_LABEL[p]}` : 'ליד סגור, אין ציון'}>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={r} className="ring-bg" />
        <circle cx="18" cy="18" r={r} className="ring-fg" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 18 18)" />
      </svg>
      <b>{open ? value : '–'}</b>
      <span className="sr-only">{open ? `ציון ${value}, עדיפות ${PRIORITY_LABEL[p]}` : 'ליד סגור'}</span>
    </span>
  )
}

export function Avatar({ owner }: { owner: Owner | undefined }) {
  return (
    <span className="avatar" title={owner?.name}>
      {owner?.initials ?? '?'}
      <span className="sr-only">{owner?.name}</span>
    </span>
  )
}

export function Toasts() {
  const { toasts, dismissToast, dispatch } = useStore()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.text}</span>
          {t.undo && (
            <button type="button" className="link-btn" onClick={() => { dispatch({ type: 'restore', data: t.undo! }); dismissToast(t.id) }}>
              ביטול
            </button>
          )}
          <button type="button" className="icon-btn sm" onClick={() => dismissToast(t.id)} aria-label="סגירת הודעה">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Panel({ title, icon, action, children, className = '', id }: {
  title: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section className={`card ${className}`} aria-labelledby={id}>
      <header className="card-head">
        <h2 id={id}>
          {icon}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
