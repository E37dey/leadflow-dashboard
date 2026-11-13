import { BarChart3, CheckSquare, Home, Layers, MapPinned, Settings, Store, Users, X } from 'lucide-react'
import type { View } from '../../store/constants'
import { useStore } from '../../store/store'
import { useDerived } from '../../store/derived'
import { tasksIn } from '../../domain/selectors'

const NAV: { view: View; label: string; icon: typeof Home }[] = [
  { view: 'overview', label: 'סקירה כללית', icon: Home },
  { view: 'bakeries', label: 'מאפיות', icon: Store },
  { view: 'regions', label: 'השוואת אזורים', icon: MapPinned },
  { view: 'leads', label: 'לידים', icon: Users },
  { view: 'pipeline', label: 'צנרת מכירה', icon: Layers },
  { view: 'tasks', label: 'משימות', icon: CheckSquare },
  { view: 'insights', label: 'תובנות', icon: BarChart3 },
]

export function Logo() {
  return (
    <span className="logo" aria-label="LEADFLOW">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--violet)" />
            <stop offset="1" stopColor="var(--violet-strong)" />
          </linearGradient>
        </defs>
        <path d="M9 3 22 3 15 14 24 14 9 29 13 17 5 17Z" fill="url(#lg)" />
      </svg>
      <span>LEADFLOW</span>
    </span>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { view, go, tasks, now, source } = useStore()
  const live = source.kind === 'airtable'
  // Bakeries and regions exist only with real data; tasks and insights belong to the demo data.
  const nav = NAV.filter((n) => (live ? !['tasks', 'insights'].includes(n.view) : !['bakeries', 'regions'].includes(n.view)))
  const { insights } = useDerived()
  const badge: Partial<Record<View, { n: number; word: string; label: string }>> = {
    tasks: { n: tasksIn(tasks, 'overdue', now).length + tasksIn(tasks, 'today', now).length, word: 'לביצוע', label: 'משימות להיום ובאיחור' },
    insights: { n: insights.filter((i) => i.actionable && i.count > 0).length, word: 'לטיפול', label: 'תובנות שדורשות פעולה' },
  }
  const item = (v: View, label: string, Icon: typeof Home) => (
    <li key={v}>
      <a
        href={`#/${v}`}
        className="nav-item"
        aria-current={view === v ? 'page' : undefined}
        onClick={(e) => {
          e.preventDefault()
          go(v)
          onClose()
        }}
      >
        <Icon size={19} aria-hidden="true" />
        <span>{label}</span>
        {badge[v] && badge[v]!.n > 0 && (
          <span className="nav-badge" title={badge[v]!.label}>
            {badge[v]!.n} {badge[v]!.word}
            <span className="sr-only">: {badge[v]!.label}</span>
          </span>
        )}
      </a>
    </li>
  )
  return (
    <nav className={`sidebar${open ? ' open' : ''}`} aria-label="ניווט ראשי">
      <div className="side-top">
        <Logo />
        <button type="button" className="icon-btn side-close" onClick={onClose} aria-label="סגירת התפריט">
          <X size={18} />
        </button>
      </div>
      <ul className="nav-list">{nav.map((n) => item(n.view, n.label, n.icon))}</ul>
      <ul className="nav-list nav-bottom">{item('settings', 'הגדרות', Settings)}</ul>
    </nav>
  )
}
