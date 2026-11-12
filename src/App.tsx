import { lazy, Suspense, useEffect, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { Toasts } from './components/ui/ui'
import { Overview } from './features/overview/Overview'
import { useStore } from './store/store'
import { VIEW_LABEL } from './store/constants'

const LeadsView = lazy(() => import('./features/leads/LeadsView'))
const PipelineView = lazy(() => import('./features/pipeline/PipelineView'))
const PlacesView = lazy(() => import('./features/leads/PlacesView'))
const RegionsView = lazy(() => import('./features/regions/RegionsView'))
const TasksView = lazy(() => import('./features/tasks/TasksView'))
const InsightsView = lazy(() => import('./features/insights/InsightsView'))
const SettingsView = lazy(() => import('./features/settings/SettingsView'))
const LeadDrawer = lazy(() => import('./features/leads/LeadDrawer'))
const NewLeadDialog = lazy(() => import('./features/leads/NewLeadDialog'))
const Assistant = lazy(() => import('./features/insights/Assistant'))

export default function App() {
  const { view, openLeadId, newLeadOpen } = useStore()
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    document.title = `LEADFLOW | ${VIEW_LABEL[view]}`
    document.getElementById('main')?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [view])
  return (
    <div className="app">
      <a href="#main" className="skip">דילוג לתוכן</a>
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      {menu && <div className="side-scrim" onClick={() => setMenu(false)} aria-hidden="true" />}
      <div className="main-col">
        <Topbar onMenu={() => setMenu(true)} />
        <main id="main" tabIndex={-1}>
          <Suspense fallback={null}>
            {view === 'overview' && <Overview />}
            {view === 'bakeries' && <PlacesView />}
            {view === 'regions' && <RegionsView />}
            {view === 'leads' && <LeadsView />}
            {view === 'pipeline' && <PipelineView />}
            {view === 'tasks' && <TasksView />}
            {view === 'insights' && <InsightsView />}
            {view === 'settings' && <SettingsView />}
          </Suspense>
        </main>
      </div>
      <Suspense fallback={null}>
        {openLeadId && <LeadDrawer />}
        {newLeadOpen && <NewLeadDialog />}
        <Assistant />
      </Suspense>
      <Toasts />
    </div>
  )
}
