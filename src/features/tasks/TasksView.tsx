import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Empty } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { addDays, iso, localTime, nowMs, today } from '../../domain/clock'
import { isOpen } from '../../domain/score'
import { tasksIn } from '../../domain/selectors'
import type { TaskBucket } from '../../domain/selectors'
import { useStore } from '../../store/store'

const TABS: { id: TaskBucket; label: string }[] = [
  { id: 'today', label: 'היום' },
  { id: 'overdue', label: 'באיחור' },
  { id: 'upcoming', label: 'בהמשך' },
  { id: 'done', label: 'בוצעו' },
]

export default function TasksView() {
  const { tasks, now, dispatch, toast, leads, openLead } = useStore()
  const [tab, setTab] = useState<TaskBucket>('today')
  const [form, setForm] = useState({ title: '', date: addDays(today(), 1), time: '10:00', leadId: '' })
  const [error, setError] = useState('')
  const list = tasksIn(tasks, tab, now)
  const openLeads = leads.filter(isOpen).sort((a, b) => a.fullName.localeCompare(b.fullName, 'he'))

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('צריך לכתוב מה המשימה.')
      document.getElementById('task-title')?.focus()
      return
    }
    const [h, m] = form.time.split(':').map(Number)
    dispatch({
      type: 'addTasks',
      tasks: [{ id: `T-u-${Date.now()}`, title: form.title.trim(), leadId: form.leadId || null, dueAt: iso(localTime(form.date, h, m)), done: false, createdAt: iso(nowMs()) }],
    })
    setError('')
    setForm({ ...form, title: '' })
    toast('המשימה נוספה', { undoable: true })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>משימות</h1>
          <p className="page-sub">מעקבים ופגישות, לפי שעון ההדגמה ({fmt.longDay(now)}).</p>
        </div>
      </div>
      <div className="grid-12">
        <section className="card span-8" aria-labelledby="tasks-h">
          <h2 id="tasks-h" className="sr-only">רשימת משימות</h2>
          <div className="tabs" role="tablist" aria-label="סוג משימות">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="task-panel" className={`tab${t.id === 'overdue' ? ' late-tab' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
                <span className="tab-count">{tasksIn(tasks, t.id, now).length}</span>
              </button>
            ))}
          </div>
          <div id="task-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {list.length === 0 ? (
              <Empty>{tab === 'overdue' ? 'אין משימות באיחור.' : tab === 'done' ? 'עוד לא סומנו משימות כבוצעו.' : 'אין משימות כאן.'}</Empty>
            ) : (
              <ul className="today">
                {list.map((t) => {
                  const lead = leads.find((l) => l.id === t.leadId)
                  return (
                    <li key={t.id} className={`task-row${t.done ? ' done' : ''}`}>
                      <input
                        type="checkbox"
                        id={`chk-${t.id}`}
                        checked={t.done}
                        onChange={() => { dispatch({ type: 'toggleTask', id: t.id }); toast(t.done ? 'המשימה נפתחה מחדש' : 'המשימה סומנה כבוצעה', { undoable: true }) }}
                      />
                      <label htmlFor={`chk-${t.id}`} className="task-text">
                        <b>{t.title}</b>
                        <span>{t.done ? 'בוצעה. סימון חוזר פותח אותה מחדש' : tab === 'overdue' ? `הייתה אמורה להתבצע ב-${fmt.date(t.dueAt)}` : fmt.date(t.dueAt)}</span>
                      </label>
                      {lead && (
                        <button type="button" className="btn ghost sm" onClick={() => openLead(lead.id)}>
                          {lead.fullName}
                        </button>
                      )}
                      <time className={`time-chip${tab === 'overdue' ? ' late' : ''}`} dateTime={t.dueAt} dir="ltr">{fmt.time(t.dueAt)}</time>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <form className="card span-4 edit-form" onSubmit={create} aria-labelledby="new-task-h" noValidate>
          <h2 id="new-task-h" className="card-title"><Plus size={18} aria-hidden="true" />משימה חדשה</h2>
          <label className="field">
            מה צריך לעשות?
            <input id="task-title" type="text" value={form.title} aria-invalid={!!error} aria-describedby={error ? 'task-err' : undefined}
              onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="לדוגמה: חזרה עם הצעת מחיר" />
          </label>
          {error && <p className="field-error" id="task-err" role="alert">{error}</p>}
          <div className="form-grid">
            <label className="field">
              תאריך
              <input type="date" value={form.date} onChange={(e) => e.target.value && setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="field">
              שעה
              <input type="time" value={form.time} onChange={(e) => e.target.value && setForm({ ...form, time: e.target.value })} />
            </label>
          </div>
          <label className="field">
            קישור לליד (לא חובה)
            <select value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
              <option value="">בלי ליד</option>
              {openLeads.map((l) => <option key={l.id} value={l.id}>{l.fullName}, {l.company}</option>)}
            </select>
          </label>
          <button type="submit" className="btn primary">הוספת משימה</button>
        </form>
      </div>
    </div>
  )
}
