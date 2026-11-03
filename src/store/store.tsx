import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createFixture } from '../data/fixture'
import { DEMO_NOW } from '../domain/clock'
import { DEFAULT_GLOBAL, EMPTY_TABLE, VIEWS } from './constants'
import type { View } from './constants'
import { stamp } from './stamp'
import type { GlobalFilter, Lead, Owner, TableFilter, Task } from '../domain/types'
import { readSaved, writeSaved } from './persist'
import type { ThemeId } from './persist'


interface Data {
  leads: Lead[]
  tasks: Task[]
  theme: ThemeId
}

type Action =
  | { type: 'updateLead'; id: string; patch: Partial<Lead>; log?: string }
  | { type: 'addLead'; lead: Lead }
  | { type: 'addTasks'; tasks: Task[] }
  | { type: 'toggleTask'; id: string }
  | { type: 'setTheme'; theme: ThemeId }
  | { type: 'restore'; data: Data }
  | { type: 'reset' }

const fresh = (theme: ThemeId = 'aurora'): Data => {
  const fx = createFixture()
  return { leads: fx.leads, tasks: fx.tasks, theme }
}

let seq = 0
const activityId = () => `act-${Date.now().toString(36)}-${(seq++).toString(36)}`

function reducer(s: Data, a: Action): Data {
  switch (a.type) {
    case 'updateLead':
      return {
        ...s,
        leads: s.leads.map((l) =>
          l.id === a.id
            ? { ...l, ...a.patch, activityLog: a.log ? [{ id: activityId(), at: stamp(), text: a.log }, ...l.activityLog] : l.activityLog }
            : l,
        ),
      }
    case 'addLead':
      return { ...s, leads: [a.lead, ...s.leads] }
    case 'addTasks':
      return { ...s, tasks: [...s.tasks, ...a.tasks] }
    case 'toggleTask':
      return { ...s, tasks: s.tasks.map((t) => (t.id === a.id ? { ...t, done: !t.done } : t)) }
    case 'setTheme':
      return { ...s, theme: a.theme }
    case 'restore':
      return a.data
    case 'reset':
      return fresh(s.theme)
  }
}

export interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
  undo?: Data
}


interface Ctx extends Data {
  owners: Owner[]
  now: number
  dispatch: (a: Action) => void
  view: View
  go: (v: View) => void
  global: GlobalFilter
  setGlobal: (g: GlobalFilter) => void
  table: TableFilter
  setTable: (t: TableFilter) => void
  /** Open the leads screen with a ready-made table filter (from search, insights, panels). */
  showLeads: (t: Partial<TableFilter>) => void
  openLeadId: string | null
  openLead: (id: string | null) => void
  newLeadOpen: boolean
  setNewLeadOpen: (v: boolean) => void
  toasts: Toast[]
  toast: (text: string, opts?: { tone?: 'ok' | 'error'; undoable?: boolean }) => void
  dismissToast: (id: number) => void
  ownerName: (id: string) => string
}

const StoreCtx = createContext<Ctx | null>(null)

const viewFromHash = (): View => {
  const v = location.hash.replace(/^#\/?/, '').split('?')[0] as View
  return VIEWS.includes(v) ? v : 'overview'
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatchRaw] = useReducer(reducer, undefined, () => {
    const saved = readSaved()
    return saved ? { leads: saved.leads, tasks: saved.tasks, theme: saved.theme } : fresh()
  })
  const owners = useMemo(() => createFixture().owners, [])
  const last = useRef(data)
  useEffect(() => {
    last.current = data
    writeSaved(data)
  }, [data])
  useEffect(() => {
    document.documentElement.dataset.theme = data.theme
  }, [data.theme])

  const [view, setView] = useState<View>(viewFromHash)
  useEffect(() => {
    const on = () => setView(viewFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((v: View) => {
    if (viewFromHash() !== v) location.hash = `#/${v}`
    setView(v)
  }, [])

  const [global, setGlobal] = useState<GlobalFilter>(DEFAULT_GLOBAL)
  const [table, setTable] = useState<TableFilter>(EMPTY_TABLE)
  const [openLeadId, openLead] = useState<string | null>(null)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const before = useRef<Data | null>(null)

  const dispatch = useCallback((a: Action) => {
    before.current = last.current
    dispatchRaw(a)
  }, [])

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const toast = useCallback(
    (text: string, opts: { tone?: 'ok' | 'error'; undoable?: boolean } = {}) => {
      const id = Date.now() + Math.random()
      setToasts((ts) => [...ts.slice(-2), { id, text, tone: opts.tone ?? 'ok', undo: opts.undoable && before.current ? before.current : undefined }])
      window.setTimeout(() => dismissToast(id), 6000)
    },
    [dismissToast],
  )

  const showLeads = useCallback(
    (t: Partial<TableFilter>) => {
      setTable({ ...EMPTY_TABLE, ...t })
      go('leads')
    },
    [go],
  )
  const ownerName = useCallback((id: string) => owners.find((o) => o.id === id)?.name ?? 'לא משויך', [owners])

  const value: Ctx = {
    ...data,
    owners,
    now: DEMO_NOW,
    dispatch,
    view,
    go,
    global,
    setGlobal,
    table,
    setTable,
    showLeads,
    openLeadId,
    openLead,
    newLeadOpen,
    setNewLeadOpen,
    toasts,
    toast,
    dismissToast,
    ownerName,
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore outside StoreProvider')
  return c
}
