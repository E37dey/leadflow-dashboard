// SPEC: "שרת API ל-Airtable (סעיף 19)". Opportunity score with its parts, and the pipeline controls that write to Airtable.
import { useState } from 'react'
import { Gauge, MessageSquarePlus, Minus, Plus, Save } from 'lucide-react'
import { fmt } from '../../components/ui/format'
import { dayKey, iso, localTime } from '../../domain/clock'
import { PART_RULE, opportunity } from '../../domain/opportunity'
import { STAGES, STAGE_LABEL } from '../../domain/types'
import type { Lead, Stage } from '../../domain/types'
import { useStore } from '../../store/store'

export function OpportunityCard({ lead }: { lead: Lead }) {
  const { weights, go } = useStore()
  const o = opportunity(lead, weights)
  return (
    <section className="pc op" aria-labelledby="op-h">
      <h3 id="op-h" className="sec-h"><Gauge size={16} aria-hidden="true" /> ציון הזדמנות</h3>
      <div className="op-top">
        <b className="op-score">{o.score ?? '—'}</b>
        <span className="muted small">מתוך 100. כללים קבועים, לא חיזוי. המוניטין נמדד בנפרד מהשלב בצנרת.</span>
      </div>
      <ul className="op-parts">
        {o.parts.map((p) => (
          <li key={p.key} title={PART_RULE[p.key]}>
            <span>{p.label}</span>
            <span className="mk-bar-track"><span className="mk-bar-fill" style={{ width: `${Math.round((p.value ?? 0) * 100)}%` }} /></span>
            <b>{p.value == null ? 'אין נתון' : `+${p.points}`}</b>
          </li>
        ))}
      </ul>
      {o.missing.length > 0 && <p className="faint small">לא נספר (חסר נתון, לא אפס): {o.missing.join(', ')}. המשקלים של השאר חולקו מחדש.</p>}
      <button type="button" className="link-btn small" onClick={() => go('settings')}>שינוי המשקלים בהגדרות</button>
    </section>
  )
}

export function PlacePipeline({ lead }: { lead: Lead }) {
  const { source, updateLeadRemote, addActivity, airtableBusy } = useStore()
  const live = source.kind === 'airtable' && source.via === 'server'
  const [form, setForm] = useState({
    stage: lead.stage,
    value: lead.estimatedValueILS ? String(lead.estimatedValueILS) : '',
    followUp: lead.nextFollowUpAt ? dayKey(lead.nextFollowUpAt) : '',
  })
  const [note, setNote] = useState({ type: 'note' as 'note' | 'call' | 'email' | 'meeting', text: '', next: '' })
  const [err, setErr] = useState('')

  if (!live) {
    return (
      <section className="pc" aria-labelledby="pp-h">
        <h3 id="pp-h" className="sec-h">צנרת מכירה</h3>
        <p className="muted small">{lead.inPipeline ? `בצנרת, שלב ${STAGE_LABEL[lead.stage]}.` : 'לא בצנרת.'} שינויים נשמרים ל-Airtable רק כשהדאשבורד רץ עם שרת ה-API (npm run dev).</p>
      </section>
    )
  }

  if (!lead.inPipeline) {
    return (
      <section className="pc" aria-labelledby="pp-h">
        <h3 id="pp-h" className="sec-h">צנרת מכירה</h3>
        <p className="muted small">המאפייה עוד לא ליד. הוספה לצנרת נשמרת ב-Airtable (שדה Pipeline) ונרשמת כפעילות.</p>
        <button type="button" className="btn primary" disabled={airtableBusy} onClick={() => updateLeadRemote(lead.id, { inPipeline: true }, `${lead.fullName} נוסף לצנרת ונשמר ב-Airtable`)}>
          <Plus size={16} aria-hidden="true" />הוספה לצנרת
        </button>
      </section>
    )
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const patch: { stage?: Stage; value?: number | null; nextFollowUpAt?: string | null } = {}
    const v = form.value.trim() === '' ? null : Number(form.value)
    if (v !== null && (!Number.isFinite(v) || v < 0)) return setErr('השווי צריך להיות מספר חיובי בשקלים, או ריק.')
    setErr('')
    if (form.stage !== lead.stage) patch.stage = form.stage
    if ((v ?? 0) !== lead.estimatedValueILS) patch.value = v
    const follow = form.followUp ? iso(localTime(form.followUp, 10)) : null
    if ((follow ? dayKey(follow) : '') !== (lead.nextFollowUpAt ? dayKey(lead.nextFollowUpAt) : '')) patch.nextFollowUpAt = follow
    if (!Object.keys(patch).length) return setErr('אין שינויים לשמירה.')
    await updateLeadRemote(lead.id, patch, 'נשמר ב-Airtable')
  }
  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.text.trim()) return setErr('כתוב מה קרה.')
    setErr('')
    if (await addActivity({ leadId: lead.id, type: note.type, text: note.text, ...(note.next.trim() ? { nextAction: note.next } : {}) })) setNote({ ...note, text: '', next: '' })
  }

  return (
    <section className="pc" aria-labelledby="pp-h">
      <h3 id="pp-h" className="sec-h">צנרת מכירה <span className="pl-class">נשמר ב-Airtable</span></h3>
      <form onSubmit={save} className="form-grid" noValidate>
        <label className="field">שלב
          <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field">שווי עסקה (₪)
          <input type="number" min={0} step={100} inputMode="numeric" placeholder="לא הוזן" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </label>
        <label className="field">מעקב הבא
          <input type="date" value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} />
        </label>
        <div className="pp-actions">
          <button type="submit" className="btn primary sm" disabled={airtableBusy}><Save size={15} aria-hidden="true" />שמירה</button>
          <button type="button" className="btn ghost sm" disabled={airtableBusy} onClick={() => updateLeadRemote(lead.id, { inPipeline: false }, `${lead.fullName} הוצא מהצנרת`)}><Minus size={15} aria-hidden="true" />הוצאה מהצנרת</button>
        </div>
      </form>
      <p className="faint small">שווי: {lead.estimatedValueILS ? fmt.ils(lead.estimatedValueILS) : 'לא הוזן'} · קשר אחרון: {lead.lastContactAt ? fmt.date(lead.lastContactAt) : 'אין'}</p>

      <form onSubmit={saveNote} className="pp-note" noValidate>
        <div className="form-grid">
          <label className="field">סוג
            <select value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value as typeof note.type })}>
              <option value="note">הערה</option><option value="call">שיחה</option><option value="email">מייל</option><option value="meeting">פגישה</option>
            </select>
          </label>
          <label className="field">הצעד הבא (לא חובה)
            <input type="text" maxLength={200} value={note.next} onChange={(e) => setNote({ ...note, next: e.target.value })} />
          </label>
        </div>
        <label className="field">מה קרה
          <textarea rows={2} maxLength={2000} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
        </label>
        <button type="submit" className="btn ghost sm" disabled={airtableBusy}><MessageSquarePlus size={15} aria-hidden="true" />הוספת פעילות</button>
      </form>
      {err && <p className="field-error" role="alert">{err}</p>}
    </section>
  )
}
