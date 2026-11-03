import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { Lead, Stage } from '../../domain/types'
import { STAGES, STAGE_LABEL } from '../../domain/types'
import { useStore } from '../../store/store'
import { stamp } from '../../store/stamp'

/** Row actions: open, log a call, move stage. Keyboard: Enter opens, arrows move, Esc closes. */
export function RowMenu({ lead }: { lead: Lead }) {
  const { openLead, dispatch, toast } = useStore()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    box.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(box.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
      btn.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    }
  }
  const move = (to: Stage) => {
    dispatch({ type: 'updateLead', id: lead.id, patch: { stage: to }, log: `השלב שונה מ״${STAGE_LABEL[lead.stage]}״ ל״${STAGE_LABEL[to]}״` })
    toast(`${lead.fullName} הועבר ל״${STAGE_LABEL[to]}״`, { undoable: true })
    setOpen(false)
    btn.current?.focus()
  }

  return (
    <div className="pop-wrap" ref={box} onKeyDown={onKey}>
      <button ref={btn} type="button" className="icon-btn more" aria-haspopup="menu" aria-expanded={open} aria-label={`פעולות עבור ${lead.fullName}`} onClick={() => setOpen(!open)}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="popover menu row-menu" role="menu" aria-label={`פעולות עבור ${lead.fullName}`}>
          <button type="button" role="menuitem" className="menu-item" onClick={() => { setOpen(false); openLead(lead.id) }}>
            פתיחת כרטיס ליד
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              dispatch({ type: 'updateLead', id: lead.id, patch: { lastContactAt: stamp() }, log: 'נרשמה שיחה' })
              toast(`נרשמה שיחה עם ${lead.fullName}`, { undoable: true })
              setOpen(false)
              btn.current?.focus()
            }}
          >
            רישום שיחה עכשיו
          </button>
          <p className="menu-title">העברה לשלב</p>
          {STAGES.filter((s) => s !== lead.stage).map((s) => (
            <button key={s} type="button" role="menuitem" className="menu-item" onClick={() => move(s)}>
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
