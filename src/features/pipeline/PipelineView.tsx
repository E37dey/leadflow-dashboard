import { useState } from 'react'
import { GlobalFilters } from '../../components/layout/Topbar'
import { Avatar, ScoreRing } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { isOpen, score } from '../../domain/score'
import { sortLeads, stageDistribution } from '../../domain/selectors'
import { STAGES, STAGE_LABEL } from '../../domain/types'
import type { Stage } from '../../domain/types'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'
import { RowMenu } from '../leads/RowMenu'

const MAX_CARDS = 8

/** Six stage columns. Moving a lead works from the card menu (keyboard), drag and drop is extra. */
export default function PipelineView() {
  const { now, owners, openLead, dispatch, toast, leads, showLeads, ownerName } = useStore()
  const { filtered } = useDerived()
  const dist = stageDistribution(filtered)
  const [over, setOver] = useState<Stage | null>(null)

  const drop = (to: Stage, id: string) => {
    const lead = leads.find((l) => l.id === id)
    setOver(null)
    if (!lead || lead.stage === to) return
    dispatch({ type: 'updateLead', id, patch: { stage: to }, log: `השלב שונה מ״${STAGE_LABEL[lead.stage]}״ ל״${STAGE_LABEL[to]}״` })
    toast(`${lead.fullName} הועבר ל״${STAGE_LABEL[to]}״`, { undoable: true })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>צנרת מכירה</h1>
          <p className="page-sub">כל ליד בשלב הנוכחי שלו. העברה בין שלבים מתפריט הפעולות בכרטיס, או בגרירה.</p>
        </div>
      </div>
      <GlobalFilters />
      <div className="board" role="list" aria-label="שלבי המכירה">
        {STAGES.map((st) => {
          const col = sortLeads(filtered.filter((l) => l.stage === st), 'priority', 'desc', now, ownerName)
          const d = dist.find((x) => x.stage === st)!
          return (
            <section
              key={st}
              role="listitem"
              className={`col${over === st ? ' over' : ''}`}
              aria-labelledby={`col-${st}`}
              onDragOver={(e) => { e.preventDefault(); setOver(st) }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => drop(st, e.dataTransfer.getData('text/plain'))}
            >
              <header className="col-head">
                <h2 id={`col-${st}`}>{STAGE_LABEL[st]}</h2>
                <span className="col-count">{d.count} לידים</span>
                <span className="col-value">{fmt.ils(d.value)}</span>
              </header>
              <ul className="col-cards">
                {col.slice(0, MAX_CARDS).map((l) => (
                  <li key={l.id} className="pcard" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)}>
                    <button type="button" className="pcard-main" onClick={() => openLead(l.id)}>
                      <b>{l.fullName}</b>
                      <span>{l.company}</span>
                      <span className="pcard-value">{fmt.ils(l.estimatedValueILS)}</span>
                    </button>
                    <div className="pcard-foot">
                      <span className="pcard-score">ציון<ScoreRing value={score(l, now)} open={isOpen(l)} /></span>
                      <Avatar owner={owners.find((o) => o.id === l.ownerId)} />
                      <RowMenu lead={l} />
                    </div>
                  </li>
                ))}
              </ul>
              {col.length > MAX_CARDS && (
                <button type="button" className="link-btn more-link" onClick={() => showLeads({ stage: st })}>
                  עוד {col.length - MAX_CARDS} לידים בשלב הזה
                </button>
              )}
              {!col.length && <p className="col-empty">אין לידים בשלב הזה.</p>}
            </section>
          )
        })}
      </div>
    </div>
  )
}
