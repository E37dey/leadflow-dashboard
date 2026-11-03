import { ArrowLeft, BarChart3, CalendarClock, CalendarDays, Flame, Handshake, Layers, PieChart, Plus, Sparkles, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { InfoTip, Panel, Empty } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { GlobalFilters } from '../../components/layout/Topbar'
import { sortLeads, tasksIn } from '../../domain/selectors'
import type { SeriesPoint } from '../../domain/selectors'
import { isOpen, score } from '../../domain/score'
import { SOURCE_LABEL, STAGE_LABEL } from '../../domain/types'
import type { Source } from '../../domain/types'
import type { RuleId } from '../../domain/insights'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'
import { LeadTable } from '../leads/LeadTable'

export function Overview() {
  const { setNewLeadOpen } = useStore()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="page-label">סקירה כללית: התמונה המלאה של העסק שלך</p>
          <h1>בוקר טוב, איליה</h1>
          <p className="page-sub">כל מה שחשוב לעסק שלך, במקום אחד</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setNewLeadOpen(true)}>
          <Plus size={18} aria-hidden="true" />
          ליד חדש
        </button>
      </div>
      <GlobalFilters />
      <div className="grid-12">
        <Hero />
        <ActionPanel />
        <StageBars />
        <SourceDonut />
        <TodayTasks />
        <PriorityLeads />
      </div>
    </div>
  )
}

function ChartTip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as SeriesPoint
  return (
    <div className="chart-tip" dir="rtl">
      <b>{p.from === p.to ? fmt.date(p.from + 'T12:00:00Z') : `${fmt.dateShort(p.from + 'T12:00:00Z')} עד ${fmt.dateShort(p.to + 'T12:00:00Z')}`}</b>
      <span><i className="dot violet" />דיגיטלי: {p.digital} לידים</span>
      <span><i className="dot aqua" />הפניה וטלפון: {p.referralPhone} לידים</span>
    </div>
  )
}

// Series animate once on entry, and not at all for people who asked for less motion.
const animate = typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches

function Hero() {
  const { metrics: m, series } = useDerived()
  const digital = series.points.reduce((s, p) => s + p.digital, 0)
  const other = series.points.reduce((s, p) => s + p.referralPhone, 0)
  return (
    <section className="card hero span-8" aria-labelledby="hero-title">
      <div className="hero-top">
        <div className="hero-main">
          <h2 id="hero-title" className="eyebrow-h">
            <BarChart3 size={17} aria-hidden="true" />
            צנרת פתוחה
            <InfoTip text="סכום השווי המשוער של כל הלידים בשלב פתוח: חדש, נוצר קשר, מתאים, הצעה נשלחה." />
          </h2>
          <p className="big-money">{fmt.ils(m.pipeline)}</p>
          <p className="muted">סכום העסקאות הפתוחות ב-{m.open} לידים פעילים</p>
        </div>
        <ul className="kpi-strip">
          <li className="kpi">
            <span className="kpi-label">סה״כ לידים<InfoTip text="לידים שנוצרו בטווח התאריכים ובסינון הנוכחי." /></span>
            <b className="kpi-num"><Users size={18} aria-hidden="true" />{fmt.num(m.total)}</b>
            <span className="kpi-sub">בטווח שנבחר</span>
          </li>
          <li className="kpi">
            <span className="kpi-label">לידים חמים<InfoTip text="לידים פתוחים עם ציון עדיפות 80 ומעלה." /></span>
            <b className="kpi-num"><Flame size={18} aria-hidden="true" />{fmt.num(m.hot)}</b>
            <span className="kpi-sub">ציון 80 ומעלה</span>
          </li>
          <li className="kpi">
            <span className="kpi-label">שיעור המרה<InfoTip text="נסגר בהצלחה חלקי כל הלידים שנוצרו בטווח." /></span>
            <b className="kpi-num"><Handshake size={18} aria-hidden="true" />{fmt.pct(m.conversion)}</b>
            <span className="kpi-sub">{m.won} נסגרו מתוך {m.total}</span>
          </li>
        </ul>
      </div>
      <div className="chart-block">
        <div className="chart-head">
          <h3>לידים לאורך זמן</h3>
          <ul className="legend">
            <li><i className="dot violet" />דיגיטלי (אתר, פייסבוק, אינסטגרם)</li>
            <li><i className="dot aqua" />הפניה וטלפון</li>
          </ul>
        </div>
        {m.total === 0 ? (
          <Empty>אין לידים בטווח ובסינון שנבחרו. אפשר להרחיב את טווח התאריכים או לנקות את הסינון.</Empty>
        ) : (
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={series.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--violet)" stopOpacity={0.45} />
                    <stop offset="1" stopColor="var(--violet)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--aqua)" stopOpacity={0.35} />
                    <stop offset="1" stopColor="var(--aqua)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} width={44} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false}
                  label={{ value: 'מספר לידים', angle: -90, position: 'insideLeft', fill: 'var(--faint)', fontSize: 12, dx: 6, style: { textAnchor: 'middle' } }} />
                <Tooltip content={ChartTip} cursor={{ stroke: 'var(--border-strong)' }} />
                <Area type="monotone" dataKey="digital" name="דיגיטלי" stroke="var(--violet)" strokeWidth={2.5} fill="url(#gV)" dot={false} activeDot={{ r: 5 }} isAnimationActive={animate} animationDuration={220} />
                <Area type="monotone" dataKey="referralPhone" name="הפניה וטלפון" stroke="var(--aqua)" strokeWidth={2.5} fill="url(#gA)" dot={false} activeDot={{ r: 5 }} isAnimationActive={animate} animationDuration={220} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="chart-note">
          {series.grouping === 'week' ? 'קיבוץ שבועי' : 'קיבוץ יומי'}, {series.points.length} נקודות. סה״כ {digital} לידים דיגיטליים ו-{other} מהפניה וטלפון.
        </p>
      </div>
    </section>
  )
}

const RULE_ICON: Record<RuleId, typeof Flame> = { 'hot-no-contact': Flame, 'overdue-follow-up': CalendarClock, 'stale-proposal': Handshake, 'best-source': Sparkles }

function ActionPanel() {
  const { showLeads, openLead, now } = useStore()
  const { insights, filtered } = useDerived()
  const top = insights.filter((i) => i.actionable)
  const waiting = insights.find((i) => i.id === 'hot-no-contact')
  const nextId = waiting?.leadIds[0] ?? sortLeads(filtered.filter(isOpen), 'priority', 'desc', now, () => '')[0]?.id
  const next = filtered.find((l) => l.id === nextId)
  return (
    <Panel id="act-title" title="מה דורש טיפול היום?" icon={<Sparkles size={18} aria-hidden="true" />} className="span-4 action-panel">
      <ul className="act-list">
        {top.map((i) => {
          const I = RULE_ICON[i.id]
          return (
            <li key={i.id}>
              <button type="button" className="act-item" disabled={!i.count} onClick={() => showLeads({ ids: i.leadIds, idsLabel: i.title })}>
                <span className={`act-icon ${i.id === 'overdue-follow-up' ? 'late' : ''}`}><I size={20} aria-hidden="true" /></span>
                <span className="act-text">
                  <b>{i.count} {i.title}</b>
                  <span>{i.reason}</span>
                </span>
                <ArrowLeft size={18} className="act-go" aria-hidden="true" />
                <span className="sr-only">הצג את הלידים</span>
              </button>
            </li>
          )
        })}
      </ul>
      {next && (
        <div className="next-step">
          <p className="next-title"><Sparkles size={16} aria-hidden="true" />הפעולה הבאה המומלצת</p>
          <p>
            לחזור ל{next.fullName} מ{next.company}: ציון {score(next, now)}, שווי {fmt.ils(next.estimatedValueILS)}, קשר אחרון {fmt.ago(next.lastContactAt, now)}.
          </p>
          <button type="button" className="btn aqua sm" onClick={() => openLead(next.id)}>פתיחת הליד</button>
        </div>
      )}
    </Panel>
  )
}

function StageBars() {
  const { stages, metrics } = useDerived()
  const { showLeads } = useStore()
  const max = Math.max(1, ...stages.map((s) => s.count))
  return (
    <Panel id="stage-title" title="התפלגות לפי שלב" icon={<Layers size={18} aria-hidden="true" />} className="span-4"
      action={<InfoTip text="השלב הנוכחי של כל ליד בטווח. זה מצב נוכחי, לא משפך היסטורי." />}>
      {metrics.total === 0 ? <Empty>אין לידים להצגה.</Empty> : (
        <ul className="bars">
          {stages.map((s) => (
            <li key={s.stage}>
              <button type="button" className="bar-row" onClick={() => showLeads({ stage: s.stage })}>
                <span className="bar-label">{STAGE_LABEL[s.stage]}</span>
                <b className="bar-count">{s.count}</b>
                <span className="bar-track" aria-hidden="true"><span className={`bar-fill st-fill-${s.stage}`} style={{ width: `${(s.count / max) * 100}%` }} /></span>
                <span className="bar-pct">{Math.round(s.share * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const SOURCE_COLOR: Record<Source, string> = {
  website: 'var(--violet)',
  facebook: 'color-mix(in oklab, var(--violet) 62%, var(--text))',
  instagram: 'color-mix(in oklab, var(--violet) 55%, var(--bg))',
  referral: 'var(--aqua)',
  telephone: 'color-mix(in oklab, var(--aqua) 55%, var(--bg))',
}

function SourceDonut() {
  const { sources, metrics } = useDerived()
  const { setGlobal, global } = useStore()
  const r = 54
  const c = 2 * Math.PI * r
  const gap = metrics.total ? 3 : 0
  const arcs = sources.filter((s) => s.count).map((s, i, all) => ({
    ...s,
    len: (s.count / Math.max(1, metrics.total)) * c,
    offset: all.slice(0, i).reduce((sum, x) => sum + (x.count / Math.max(1, metrics.total)) * c, 0),
  }))
  return (
    <Panel id="src-title" title="מקורות לידים" icon={<PieChart size={18} aria-hidden="true" />} className="span-4">
      {metrics.total === 0 ? <Empty>אין לידים להצגה.</Empty> : (
        <div className="donut-wrap">
          <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={`מקורות לידים: ${sources.map((s) => `${SOURCE_LABEL[s.source]} ${s.count}`).join(', ')}`}>
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="11" />
            {arcs.map((s) => (
              <circle key={s.source} cx="70" cy="70" r={r} fill="none" stroke={SOURCE_COLOR[s.source]} strokeWidth="11" strokeLinecap="round"
                strokeDasharray={`${Math.max(0.1, s.len - gap)} ${c}`} strokeDashoffset={-s.offset} transform="rotate(-90 70 70)" />
            ))}
            <text x="70" y="68" textAnchor="middle" className="donut-num">{metrics.total}</text>
            <text x="70" y="88" textAnchor="middle" className="donut-cap">לידים</text>
          </svg>
          <ul className="donut-legend">
            {sources.map((s) => (
              <li key={s.source}>
                <button type="button" className="legend-row" aria-pressed={global.source === s.source}
                  onClick={() => setGlobal({ ...global, source: global.source === s.source ? 'all' : s.source })}>
                  <i className="dot" style={{ background: SOURCE_COLOR[s.source] }} />
                  <span>{SOURCE_LABEL[s.source]}</span>
                  <b>{s.count}</b>
                  <span className="pct">{Math.round(s.share * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

function TodayTasks() {
  const { tasks, now, dispatch, toast, leads, go } = useStore()
  const today = tasksIn(tasks, 'today', now)
  const overdue = tasksIn(tasks, 'overdue', now).length
  return (
    <Panel id="today-title" title="המשימות שלי להיום" icon={<CalendarDays size={18} aria-hidden="true" />} className="span-4"
      action={<button type="button" className="link-btn" onClick={() => go('tasks')}>כל המשימות</button>}>
      {today.length === 0 ? <Empty>אין משימות להיום.</Empty> : (
        <ul className="today">
          {today.map((t) => {
            const lead = leads.find((l) => l.id === t.leadId)
            return (
              <li key={t.id}>
                <label className="task-row">
                  <input type="checkbox" checked={t.done} onChange={() => { dispatch({ type: 'toggleTask', id: t.id }); toast('המשימה סומנה כבוצעה', { undoable: true }) }} />
                  <span className="task-text">
                    <b>{t.title}</b>
                    {lead && <span>{lead.company}</span>}
                  </span>
                  <time className="time-chip" dateTime={t.dueAt} dir="ltr">{fmt.time(t.dueAt)}</time>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {overdue > 0 && (
        <button type="button" className="late-note" onClick={() => go('tasks')}>
          <CalendarClock size={15} aria-hidden="true" />
          עוד {overdue} משימות באיחור
        </button>
      )}
    </Panel>
  )
}

function PriorityLeads() {
  const { now, showLeads, ownerName } = useStore()
  const { filtered } = useDerived()
  const top = sortLeads(filtered.filter(isOpen), 'priority', 'desc', now, ownerName).slice(0, 5)
  return (
    <Panel id="prio-title" title="לידים בעדיפות גבוהה" icon={<Flame size={18} aria-hidden="true" />} className="span-12"
      action={<button type="button" className="btn ghost sm" onClick={() => showLeads({})}>צפייה בכל הלידים<ArrowLeft size={16} aria-hidden="true" /></button>}>
      {top.length ? <LeadTable leads={top} caption="חמשת הלידים הפתוחים עם הציון הגבוה ביותר" /> : <Empty>אין לידים פתוחים בסינון הנוכחי.</Empty>}
    </Panel>
  )
}
