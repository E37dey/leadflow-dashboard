import { CalendarClock, Flame, Handshake, ListPlus, Sparkles, Users } from 'lucide-react'
import { GlobalFilters } from '../../components/layout/Topbar'
import { fmt } from '../../components/ui/format'
import { followUpTasks } from '../../domain/insights'
import type { Insight, RuleId } from '../../domain/insights'
import { score } from '../../domain/score'
import { SOURCE_LABEL, STAGE_LABEL } from '../../domain/types'
import type { Lead } from '../../domain/types'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'

const ICON: Record<RuleId, typeof Flame> = { 'hot-no-contact': Flame, 'overdue-follow-up': CalendarClock, 'stale-proposal': Handshake, 'best-source': Sparkles }

/** One line of evidence per lead, matching the rule. */
function evidence(rule: RuleId, l: Lead, now: number) {
  if (rule === 'hot-no-contact') return `ציון ${score(l, now)}, קשר אחרון ${fmt.ago(l.lastContactAt, now)}`
  if (rule === 'overdue-follow-up') return `מעקב היה ב-${fmt.date(l.nextFollowUpAt!)}`
  if (rule === 'stale-proposal') return `קשר אחרון ${fmt.ago(l.lastContactAt, now)}, שווי ${fmt.ils(l.estimatedValueILS)}`
  return `${STAGE_LABEL[l.stage]}, ${SOURCE_LABEL[l.source]}`
}

export default function InsightsView() {
  const { insights, filtered } = useDerived()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>תובנות</h1>
          <p className="page-sub">תובנות הדגמה המחושבות מנתוני המערכת. כל תובנה היא כלל קבוע, והלידים שמאחוריה מופיעים כאן.</p>
        </div>
      </div>
      <GlobalFilters />
      <div className="grid-12">
        {insights.map((i) => <InsightCard key={i.id} insight={i} leads={filtered} />)}
      </div>
    </div>
  )
}

function InsightCard({ insight: i, leads }: { insight: Insight; leads: Lead[] }) {
  const { showLeads, dispatch, toast, tasks, now, leads: all } = useStore()
  const I = ICON[i.id]
  const shown = i.leadIds.slice(0, 4).map((id) => leads.find((l) => l.id === id)!).filter(Boolean)
  const create = () => {
    const created = followUpTasks(i, all, tasks, now)
    if (!created.length) {
      toast('לכל הלידים בתובנה הזו כבר יש משימת המשך פתוחה')
      return
    }
    dispatch({ type: 'addTasks', tasks: created })
    const names = created.slice(0, 3).map((t) => all.find((l) => l.id === t.leadId)?.fullName).join(', ')
    toast(`נוצרו ${created.length} משימות להיום ב-16:00: ${names}${created.length > 3 ? ' ועוד' : ''}`, { undoable: true })
  }
  return (
    <section className="card span-6 insight" aria-labelledby={`ins-${i.id}`}>
      <header className="ins-head">
        <span className={`act-icon ${i.id === 'overdue-follow-up' ? 'late' : ''}`}><I size={20} aria-hidden="true" /></span>
        <div>
          <h2 id={`ins-${i.id}`}>{i.title}</h2>
          <p className="muted small">{i.reason}</p>
        </div>
        <b className="ins-count">{i.count}<span>לידים</span></b>
      </header>
      {shown.length ? (
        <ul className="evidence" aria-label="ראיות">
          {shown.map((l) => (
            <li key={l.id}>
              <b>{l.fullName}</b>
              <span>{evidence(i.id, l, now)}</span>
            </li>
          ))}
          {i.count > shown.length && <li className="faint">ועוד {i.count - shown.length}</li>}
        </ul>
      ) : (
        <p className="muted small">אין כרגע לידים שעונים על הכלל הזה.</p>
      )}
      <div className="row-actions">
        <button type="button" className="btn ghost sm" disabled={!i.count} onClick={() => showLeads({ ids: i.leadIds, idsLabel: i.title })}>
          <Users size={16} aria-hidden="true" />
          הצג לידים
        </button>
        {i.actionable && (
          <button type="button" className="btn ghost sm" disabled={!i.count} onClick={create}>
            <ListPlus size={16} aria-hidden="true" />
            צור משימות המשך
          </button>
        )}
      </div>
    </section>
  )
}
