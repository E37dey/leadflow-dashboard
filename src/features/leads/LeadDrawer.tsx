import { useState } from 'react'
import { CalendarPlus, Mail, Phone, PhoneCall } from 'lucide-react'
import { Overlay, ScoreRing, SourceTag, StageBadge } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { addDays, dayKey, iso, localTime, nowMs, today } from '../../domain/clock'
import { isOpen, priority, score, scoreParts } from '../../domain/score'
import { PRIORITY_LABEL, STAGES, STAGE_LABEL } from '../../domain/types'
import type { Lead, Stage } from '../../domain/types'
import { useStore } from '../../store/store'
import { stamp } from '../../store/stamp'

export default function LeadDrawer() {
  const { leads, openLeadId, openLead } = useStore()
  const lead = leads.find((l) => l.id === openLeadId)
  if (!lead) return null
  // Keyed by id so the edit form resets when another lead opens.
  return <DrawerBody key={lead.id} lead={lead} onClose={() => openLead(null)} />
}

function DrawerBody({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { now, owners, dispatch, toast, ownerName } = useStore()
  const [form, setForm] = useState({
    stage: lead.stage,
    ownerId: lead.ownerId,
    value: String(lead.estimatedValueILS),
    followUp: lead.nextFollowUpAt ? dayKey(lead.nextFollowUpAt) : '',
    notes: lead.notes,
  })
  const [error, setError] = useState('')
  const s = score(lead, now)
  const parts = scoreParts(lead, now)
  const open = isOpen(lead)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(form.value)
    if (!Number.isFinite(value) || value < 0) {
      setError('השווי צריך להיות מספר חיובי בשקלים.')
      return
    }
    const patch: Partial<Lead> = {}
    const log: string[] = []
    if (form.stage !== lead.stage) {
      patch.stage = form.stage
      log.push(`השלב שונה מ״${STAGE_LABEL[lead.stage]}״ ל״${STAGE_LABEL[form.stage]}״`)
    }
    if (form.ownerId !== lead.ownerId) {
      patch.ownerId = form.ownerId
      log.push(`האחראי שונה ל${ownerName(form.ownerId)}`)
    }
    if (value !== lead.estimatedValueILS) {
      patch.estimatedValueILS = value
      log.push(`השווי עודכן ל-${fmt.ils(value)}`)
    }
    const followIso = form.followUp ? iso(localTime(form.followUp, 10)) : null
    if ((followIso ? dayKey(followIso) : '') !== (lead.nextFollowUpAt ? dayKey(lead.nextFollowUpAt) : '')) {
      patch.nextFollowUpAt = followIso
      log.push(followIso ? `נקבע מעקב ל-${fmt.date(followIso)}` : 'המעקב בוטל')
    }
    if (form.notes !== lead.notes) {
      patch.notes = form.notes
      log.push('ההערות עודכנו')
    }
    if (!log.length) {
      toast('אין שינויים לשמירה')
      return
    }
    setError('')
    dispatch({ type: 'updateLead', id: lead.id, patch, log: log.join('. ') })
    toast('השינויים נשמרו', { undoable: true })
  }

  const logCall = () => {
    dispatch({ type: 'updateLead', id: lead.id, patch: { lastContactAt: stamp() }, log: 'נרשמה שיחה' })
    toast(`נרשמה שיחה עם ${lead.fullName}`, { undoable: true })
  }
  const addTask = () => {
    dispatch({
      type: 'addTasks',
      tasks: [{ id: `T-${lead.id}-${Date.now()}`, title: `חזרה לליד: ${lead.fullName}`, leadId: lead.id, dueAt: iso(localTime(addDays(today(), 1), 10)), done: false, createdAt: iso(nowMs()) }],
    })
    toast('נוצרה משימה למחר ב-10:00', { undoable: true })
  }

  return (
    <Overlay kind="drawer" title={<>{lead.fullName}<span className="title-sub">{lead.company}</span></>} onClose={onClose}>
      <div className="drawer-tags">
        <StageBadge stage={lead.stage} />
        <SourceTag source={lead.source} />
        <span className="faint">{lead.id}</span>
      </div>

      <section className="score-box" aria-label="ציון עדיפות">
        <ScoreRing value={s} open={open} />
        <div>
          <b>{open ? `ציון ${s}, עדיפות ${PRIORITY_LABEL[priority(s)]}` : 'ליד סגור, אין ציון עדיפות'}</b>
          {open && (
            <p className="muted small">
              שלב {parts.stage} + שווי {parts.value} + קשר אחרון {parts.contact} + מעקב {parts.followUp}. נוסחה גלויה, לא חיזוי.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="contact-h" className="facts">
        <h3 id="contact-h">פרטי קשר</h3>
        <dl>
          <div><dt><Mail size={15} aria-hidden="true" />מייל</dt><dd dir="ltr">{lead.email ?? 'לא נמסר'}</dd></div>
          <div><dt><Phone size={15} aria-hidden="true" />טלפון</dt><dd dir="ltr">{lead.phone ?? 'לא נמסר'}</dd></div>
          <div><dt>נוצר</dt><dd>{fmt.date(lead.createdAt)}</dd></div>
          <div><dt>קשר אחרון</dt><dd>{lead.lastContactAt ? `${fmt.date(lead.lastContactAt)}, ${fmt.ago(lead.lastContactAt, now)}` : 'אין קשר עדיין'}</dd></div>
        </dl>
        <div className="row-actions">
          <button type="button" className="btn ghost sm" onClick={logCall}><PhoneCall size={16} aria-hidden="true" />רישום שיחה עכשיו</button>
          <button type="button" className="btn ghost sm" onClick={addTask}><CalendarPlus size={16} aria-hidden="true" />משימת המשך למחר</button>
        </div>
      </section>

      <form onSubmit={save} className="edit-form" aria-labelledby="edit-h" noValidate>
        <h3 id="edit-h">עדכון ליד</h3>
        <div className="form-grid">
          <label className="field">
            שלב
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}>
              {STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
            </select>
          </label>
          <label className="field">
            אחראי
            <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="field">
            שווי משוער (₪)
            <input type="number" min={0} step={100} inputMode="numeric" value={form.value} aria-invalid={!!error} aria-describedby={error ? 'val-err' : undefined}
              onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </label>
          <label className="field">
            מעקב הבא
            <input type="date" value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} />
          </label>
        </div>
        <label className="field">
          הערות
          <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        {error && <p className="field-error" id="val-err" role="alert">{error}</p>}
        <button type="submit" className="btn primary">שמירת שינויים</button>
      </form>

      <section aria-labelledby="log-h">
        <h3 id="log-h" className="sec-h">יומן פעילות</h3>
        <ol className="timeline">
          {lead.activityLog.map((a) => (
            <li key={a.id}>
              <time dateTime={a.at}>{fmt.date(a.at)}</time>
              <span>{a.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </Overlay>
  )
}
