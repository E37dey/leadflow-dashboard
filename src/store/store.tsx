import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createFixture } from '../data/fixture'
import { DEMO_NOW, setClock } from '../domain/clock'
import { EMPTY_TABLE, VIEWS, defaultGlobal } from './constants'
import type { View } from './constants'
import { stamp } from './stamp'
import type { GlobalFilter, Lead, Owner, TableFilter, Task } from '../domain/types'
import { readSaved, writeSaved } from './persist'
import { loadFromAirtable } from '../data/airtableClient'
import type { AtConnection } from '../domain/airtable'
import { clearConnection, readConnection, writeConnection } from './airtableConn'
import type { ThemeId } from './persist'
import { fetchData, fetchStatus, patchLead, postActivity } from '../data/apiClient'
import type { LeadPatch, ServerStatus } from '../data/apiClient'
import { DEFAULT_WEIGHTS, cleanWeights } from '../domain/opportunity'
import type { Weights } from '../domain/opportunity'

const WEIGHTS_KEY = 'leadflow:weights'
const readWeights = (): Weights => {
  try {
    return cleanWeights(JSON.parse(localStorage.getItem(WEIGHTS_KEY) ?? 'null'))
  } catch {
    return DEFAULT_WEIGHTS
  }
}


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

/** Where the data on screen came from (SPEC: "מקור נתונים: Airtable"). */
export type DataSource =
  | { kind: 'demo' }
  | { kind: 'airtable'; via: 'server' | 'browser'; baseId: string; loadedAt: string; leads: number; tasks: number; owners: number; rejected: number }

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
  source: DataSource
  /** Load from Airtable. Resolves on success; rejects with a Hebrew message and keeps the current data. */
  connectAirtable: (conn: AtConnection, remember: boolean) => Promise<void>
  reloadAirtable: () => Promise<void>
  disconnectAirtable: () => void
  airtableBusy: boolean
  savedConnection: AtConnection | null
  /** The server API (token on the server). null until the first check. */
  server: ServerStatus | null
  /** Re-read everything from Airtable through the server (cache refresh). */
  refreshServer: () => Promise<void>
  /** Write to Airtable through the server, then reload. Resolves false and shows the error on failure. */
  updateLeadRemote: (id: string, patch: LeadPatch, done: string) => Promise<boolean>
  addActivity: (a: { leadId: string; type: 'note' | 'call' | 'email' | 'meeting'; text: string; nextAction?: string }) => Promise<boolean>
  weights: Weights
  setWeights: (w: Weights) => void
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
  const demoOwners = useMemo(() => createFixture().owners, [])
  const [owners, setOwners] = useState<Owner[]>(demoOwners)
  const [source, setSource] = useState<DataSource>({ kind: 'demo' })
  const [airtableBusy, setBusy] = useState(false)
  const conn = useRef<AtConnection | null>(readConnection())
  const [server, setServer] = useState<ServerStatus | null>(null)
  const [weights, setWeightsState] = useState<Weights>(readWeights)
  const setWeights = useCallback((w: Weights) => {
    setWeightsState(w)
    try { localStorage.setItem(WEIGHTS_KEY, JSON.stringify(w)) } catch { /* this session only */ }
  }, [])
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

  const [global, setGlobal] = useState<GlobalFilter>(defaultGlobal)
  const [now, setNow] = useState(DEMO_NOW)
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

  const load = useCallback(async (c: AtConnection) => {
    setBusy(true)
    try {
      const d = await loadFromAirtable(c)
      if (!d.leads.length) throw new Error('לא נמצאו לידים בטבלה Leads.')
      // Real data runs on the real clock, and the period becomes the last 90 days up to today.
      const t = Date.now()
      setClock(t)
      setNow(t)
      setGlobal(defaultGlobal())
      setOwners(d.owners.length ? d.owners : demoOwners)
      dispatchRaw({ type: 'restore', data: { leads: d.leads, tasks: d.tasks, theme: last.current.theme } })
      setSource({ kind: 'airtable', via: 'browser', baseId: c.baseId.trim(), loadedAt: new Date().toISOString(), leads: d.leads.length, tasks: d.tasks.length, owners: d.owners.length, rejected: d.rejected.length })
      return d
    } finally {
      setBusy(false)
    }
  }, [demoOwners])

  const connectAirtable = useCallback(async (c: AtConnection, remember: boolean) => {
    const d = await load(c)
    conn.current = c
    if (remember) writeConnection(c)
    else clearConnection()
    toast(`נטענו מ-Airtable ${d.leads.length} לידים ו-${d.tasks.length} משימות` + (d.rejected.length ? `, ${d.rejected.length} רשומות נדחו` : ''))
  }, [load, toast])

  /** Server path: same restore as above, data from /api/data. */
  const loadServer = useCallback(async (refresh: boolean) => {
    setBusy(true)
    try {
      const d = await fetchData(refresh)
      const t = Date.now()
      setClock(t)
      setNow(t)
      setGlobal((g) => (source.kind === 'airtable' ? g : defaultGlobal()))
      setOwners(d.owners.length ? d.owners : demoOwners)
      dispatchRaw({ type: 'restore', data: { leads: d.leads, tasks: d.tasks, theme: last.current.theme } })
      setSource({ kind: 'airtable', via: 'server', baseId: d.meta.base, loadedAt: d.meta.syncedAt, leads: d.leads.length, tasks: d.tasks.length, owners: d.owners.length, rejected: d.meta.rejected.length })
      return d
    } finally {
      setBusy(false)
    }
  }, [demoOwners, source.kind])

  const refreshServer = useCallback(async () => {
    const st = await fetchStatus(true)
    setServer(st)
    if (st.state === 'connected' || st.state === 'empty') {
      const d = await loadServer(false)
      toast(`סונכרן מ-Airtable: ${d.leads.length} מאפיות`)
    } else if (st.state === 'error') {
      toast(st.error?.message ?? 'שגיאת חיבור ל-Airtable', { tone: 'error' })
    }
  }, [loadServer, toast])

  const updateLeadRemote = useCallback(async (id: string, patch: LeadPatch, done: string) => {
    try {
      await patchLead(id, patch)
      await loadServer(false)
      toast(done)
      return true
    } catch (e) {
      toast(`לא נשמר ב-Airtable: ${(e as Error).message}`, { tone: 'error' })
      return false
    }
  }, [loadServer, toast])

  const addActivity = useCallback(async (a: { leadId: string; type: 'note' | 'call' | 'email' | 'meeting'; text: string; nextAction?: string }) => {
    try {
      await postActivity(a)
      await loadServer(false)
      toast('הפעילות נשמרה ב-Airtable')
      return true
    } catch (e) {
      toast(`לא נשמר ב-Airtable: ${(e as Error).message}`, { tone: 'error' })
      return false
    }
  }, [loadServer, toast])

  const reloadAirtable = useCallback(async () => {
    if (source.kind === 'airtable' && source.via === 'server') return refreshServer()
    if (!conn.current) return
    const d = await load(conn.current)
    toast(`נטען מחדש מ-Airtable: ${d.leads.length} לידים`)
  }, [load, toast, source, refreshServer])

  const disconnectAirtable = useCallback(() => {
    conn.current = null
    clearConnection()
    setClock(DEMO_NOW)
    setNow(DEMO_NOW)
    setGlobal(defaultGlobal())
    setOwners(demoOwners)
    setSource({ kind: 'demo' })
    dispatchRaw({ type: 'reset' })
    toast('התנתקת מ-Airtable. מוצגים נתוני ההדגמה.')
  }, [demoOwners, toast])

  // On start: the server API first (token on the server). Without it, a remembered browser connection.
  // On failure the local data stays and the error shows.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    fetchStatus().then((st) => {
      setServer(st)
      if (st.state === 'connected' || st.state === 'empty') return loadServer(false).then(() => undefined)
      if (st.state === 'error') toast(st.error?.message ?? 'שגיאת חיבור ל-Airtable', { tone: 'error' })
      if (conn.current) return load(conn.current).then(() => undefined)
    }).catch((e: Error) => toast(e.message, { tone: 'error' }))
  }, [load, loadServer, toast])

  const value: Ctx = {
    ...data,
    owners,
    now,
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
    source,
    connectAirtable,
    reloadAirtable,
    disconnectAirtable,
    airtableBusy,
    savedConnection: readConnection(),
    server,
    refreshServer,
    updateLeadRemote,
    addActivity,
    weights,
    setWeights,
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore outside StoreProvider')
  return c
}
