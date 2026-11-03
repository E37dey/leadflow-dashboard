import { useState } from 'react'
import { Overlay } from '../../components/ui/ui'
import { SOURCES, SOURCE_LABEL, STAGE_LABEL } from '../../domain/types'
import type { Lead, Source, Stage } from '../../domain/types'
import { useStore } from '../../store/store'
import { stamp } from '../../store/stamp'
import { validateLead } from '../../domain/validate'
import type { NewLeadInput } from '../../domain/validate'

export default function NewLeadDialog() {
  const { setNewLeadOpen, dispatch, owners, toast, leads, openLead } = useStore()
  const [f, setF] = useState<NewLeadInput>({ fullName: '', company: '', email: '', phone: '', source: 'website', stage: 'new', value: '', ownerId: owners[0].id })
  const [errors, setErrors] = useState<ReturnType<typeof validateLead>>({})
  const close = () => setNewLeadOpen(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateLead(f)
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0]
      document.getElementById(`nl-${first === 'contact' ? 'email' : first}`)?.focus()
      return
    }
    const n = Math.max(1000, ...leads.map((l) => Number(l.id.slice(2)) || 0)) + 1
    const at = stamp()
    const lead: Lead = {
      id: `L-${n}`,
      fullName: f.fullName.trim(),
      company: f.company.trim() || 'ללא חברה',
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      source: f.source,
      stage: f.stage,
      estimatedValueILS: Number(f.value) || 0,
      ownerId: f.ownerId,
      createdAt: at,
      lastContactAt: null,
      nextFollowUpAt: null,
      notes: '',
      activityLog: [{ id: `L-${n}-a0`, at, text: `ליד נוצר ידנית, מקור: ${SOURCE_LABEL[f.source]}` }],
    }
    dispatch({ type: 'addLead', lead })
    toast(`הליד ${lead.fullName} נוסף`)
    close()
    openLead(lead.id)
  }

  const field = (key: keyof NewLeadInput, label: string, input: React.ReactNode, err?: string) => (
    <label className="field" htmlFor={`nl-${key}`}>
      {label}
      {input}
      {err && <span className="field-error" id={`nl-${key}-err`}>{err}</span>}
    </label>
  )
  const text = (key: keyof NewLeadInput, type: string, dir?: 'ltr', extra: Record<string, unknown> = {}) => (
    <input id={`nl-${key}`} type={type} dir={dir} value={f[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `nl-${key}-err` : undefined}
      onChange={(e) => setF({ ...f, [key]: e.target.value })} {...extra} />
  )

  return (
    <Overlay kind="dialog" wide title="ליד חדש" onClose={close}
      footer={<>
        <button type="button" className="btn ghost" onClick={close}>ביטול</button>
        <button type="submit" form="new-lead" className="btn primary">הוספת הליד</button>
      </>}>
      <form id="new-lead" onSubmit={submit} noValidate className="edit-form">
        <p className="muted small">שדות חובה: שם, ולפחות מייל או טלפון. אפשר להשתמש בטלפון דמה.</p>
        <div className="form-grid">
          {field('fullName', 'שם מלא *', text('fullName', 'text', undefined, { 'data-autofocus': true, autoComplete: 'off' }), errors.fullName)}
          {field('company', 'חברה', text('company', 'text'))}
          {field('email', 'מייל', text('email', 'email', 'ltr'), errors.email)}
          {field('phone', 'טלפון', text('phone', 'tel', 'ltr'), errors.phone)}
        </div>
        {errors.contact && <p className="field-error" role="alert">{errors.contact}</p>}
        <div className="form-grid">
          {field('source', 'מקור',
            <select id="nl-source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as Source })}>
              {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
            </select>)}
          {field('stage', 'שלב',
            <select id="nl-stage" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as Stage })}>
              {(['new', 'contacted', 'qualified', 'proposal'] as Stage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>)}
          {field('value', 'שווי משוער (₪)', text('value', 'number', undefined, { min: 0, step: 100, inputMode: 'numeric' }), errors.value)}
          {field('ownerId', 'אחראי',
            <select id="nl-ownerId" value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>)}
        </div>
      </form>
    </Overlay>
  )
}
