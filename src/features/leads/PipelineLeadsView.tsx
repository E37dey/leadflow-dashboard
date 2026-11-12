// SPEC: "שרת API ל-Airtable (סעיף 19)". Leads = bakeries the user added to the pipeline. Nothing here is invented.
import { useMemo, useState } from 'react'
import { StageBadge } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { opportunity } from '../../domain/opportunity'
import { REGION_LABEL } from '../../domain/regions'
import { pipelineLeads, pipelineSummary } from '../../domain/summary'
import { STAGES, STAGE_LABEL } from '../../domain/types'
import type { Stage } from '../../domain/types'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'

export default function PipelineLeadsView() {
  const { openLead, weights, go, now } = useStore()
  const { filtered } = useDerived()
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const all = useMemo(() => pipelineLeads(filtered), [filtered])
  const sum = pipelineSummary(filtered)
  const rows = useMemo(
    () => all.filter((l) => stage === 'all' || l.stage === stage).map((l) => ({ l, o: opportunity(l, weights).score })).sort((a, b) => (b.o ?? -1) - (a.o ?? -1)),
    [all, stage, weights],
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="page-label">נתונים חיים מ-Airtable</p>
          <h1>לידים</h1>
          <p className="page-sub">{all.length ? `${all.length} מאפיות בצנרת. כל שינוי כאן נשמר ב-Airtable.` : 'עוד אין לידים. ליד נוצר כשמוסיפים מאפייה לצנרת.'}</p>
        </div>
      </div>

      <div className="chips" role="group" aria-label="סינון לפי שלב">
        <button type="button" className="chip" aria-pressed={stage === 'all'} onClick={() => setStage('all')}>הכול ({all.length})</button>
        {STAGES.map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={stage === s} onClick={() => setStage(s)}>{STAGE_LABEL[s]} ({sum.byStage[s]})</button>
        ))}
      </div>

      <section className="card">
        {!all.length ? (
          <div className="empty-state">
            <b>הצנרת ריקה, וזה בכוונה.</b>
            <p className="muted">אין כאן לידים מומצאים. פותחים מאפייה במסך ״מאפיות״, לוחצים ״הוספה לצנרת״, והיא נשמרת ב-Airtable ומופיעה כאן.</p>
            <button type="button" className="btn primary sm" onClick={() => go('bakeries')}>למסך מאפיות</button>
          </div>
        ) : (
          <div className="tbl-scroll" role="region" aria-label="טבלת לידים" tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr><th>מאפייה</th><th>אזור</th><th>שלב</th><th>ציון הזדמנות</th><th>שווי</th><th>מעקב הבא</th><th>פעילות אחרונה</th></tr>
              </thead>
              <tbody>
                {rows.map(({ l, o }) => {
                  const late = l.nextFollowUpAt && Date.parse(l.nextFollowUpAt) < now && !['won', 'lost'].includes(l.stage)
                  return (
                    <tr key={l.id} onClick={() => openLead(l.id)}>
                      <th scope="row"><button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); openLead(l.id) }}>{l.fullName}</button></th>
                      <td>{l.place?.region ? REGION_LABEL[l.place.region] : 'לא ידוע'}</td>
                      <td><StageBadge stage={l.stage} /></td>
                      <td>{o ?? '—'}</td>
                      <td>{l.estimatedValueILS ? fmt.ils(l.estimatedValueILS) : <span className="faint">לא הוזן</span>}</td>
                      <td className={late ? 'late' : undefined}>{l.nextFollowUpAt ? `${fmt.date(l.nextFollowUpAt)}${late ? ' · באיחור' : ''}` : <span className="faint">לא נקבע</span>}</td>
                      <td className="small">{l.activityLog[0] ? `${fmt.date(l.activityLog[0].at)} · ${l.activityLog[0].text}` : ''}</td>
                    </tr>
                  )
                })}
                {!rows.length && <tr><td colSpan={7} className="muted">אין לידים בשלב הזה.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
