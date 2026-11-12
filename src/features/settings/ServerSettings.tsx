// SPEC: "שרת API ל-Airtable (סעיף 19)": connection status from the server, and the opportunity score weights.
import { CheckCircle2, CircleAlert, RefreshCw, Server, SlidersHorizontal } from 'lucide-react'
import { fmt } from '../../components/ui/format'
import { DEFAULT_WEIGHTS, PART_KEYS, PART_LABEL, PART_RULE } from '../../domain/opportunity'
import { REGIONS, REGION_LABEL } from '../../domain/regions'
import { useStore } from '../../store/store'

const STATE: Record<string, { label: string; ok: boolean }> = {
  connected: { label: 'מחובר. קריאה אמיתית מ-Airtable הצליחה.', ok: true },
  empty: { label: 'מחובר, אבל אין מאפיות בבסיס.', ok: false },
  error: { label: 'שגיאת חיבור.', ok: false },
  missing_config: { label: 'חסרה הגדרה בשרת.', ok: false },
  unavailable: { label: 'אין שרת API (למשל ב-GitHub Pages).', ok: false },
}

export function ServerStatusCard() {
  const { server, source, airtableBusy, reloadAirtable, toast } = useStore()
  const st = server?.state ?? 'unavailable'
  const s = STATE[st]
  return (
    <section className="card span-12" aria-labelledby="srv-h">
      <h2 id="srv-h" className="card-title"><Server size={18} aria-hidden="true" />חיבור Airtable דרך השרת</h2>
      <div className={`at-status ${s.ok ? '' : 'bad'}`} role="status">
        {s.ok ? <CheckCircle2 size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
        <div>
          <b>{airtableBusy ? 'מסנכרן…' : s.label}</b>
          {st === 'error' && server?.error && <p className="field-error">{server.error.message}</p>}
          {st === 'missing_config' && (
            <p className="muted small">חסר: {[...(server?.missing ?? []), ...(server?.invalid ?? []).map((x) => `${x} (לא תקין)`)].join(', ')}. מגדירים במשתני סביבה של השרת, לא בדפדפן. ההוראות ב-README.</p>
          )}
        </div>
        <button type="button" className="btn ghost sm" disabled={airtableBusy || st === 'unavailable' || st === 'missing_config'} onClick={() => reloadAirtable().catch((e: Error) => toast(e.message, { tone: 'error' }))}>
          <RefreshCw size={15} aria-hidden="true" />רענון מ-Airtable
        </button>
      </div>
      {server?.tables && (
        <dl className="srv-facts">
          <div><dt>בסיס</dt><dd dir="ltr">{server.base}</dd></div>
          <div><dt>סנכרון אחרון שהצליח</dt><dd>{source.kind === 'airtable' ? `${fmt.date(source.loadedAt)} ${fmt.time(source.loadedAt)}` : server.lastSuccessfulSyncAt ? `${fmt.date(server.lastSuccessfulSyncAt)} ${fmt.time(server.lastSuccessfulSyncAt)}` : 'עוד לא'}</dd></div>
          {(['leads', 'activities', 'owners', 'tasks'] as const).map((t) => (
            <div key={t}><dt>טבלה <span dir="ltr">{server.tables![t]}</span></dt><dd>{server.counts ? `${fmt.num(server.counts[t])} רשומות` : '—'}</dd></div>
          ))}
          <div><dt>רשומות שנדחו</dt><dd>{source.kind === 'airtable' ? source.rejected : server.rejected ?? 0}</dd></div>
        </dl>
      )}
      <p className="faint small">הטוקן נשאר בשרת (משתנה סביבה AIRTABLE_TOKEN) ולא מגיע לדפדפן. הדפדפן מדבר רק עם /api של הדאשבורד. ״מחובר״ מוצג רק אחרי קריאה אמיתית שהצליחה.</p>
    </section>
  )
}

export function WeightsCard() {
  const { weights, setWeights, toast } = useStore()
  const total = PART_KEYS.reduce((s, k) => s + weights.parts[k], 0)
  return (
    <section className="card span-12" aria-labelledby="w-h">
      <h2 id="w-h" className="card-title"><SlidersHorizontal size={18} aria-hidden="true" />ציון הזדמנות: משקלים</h2>
      <p className="muted">ציון בין 0 ל-100 לכל מאפייה. כללים קבועים, לא חיזוי. רכיב שאין לו נתון לא נספר כאפס: הוא יוצא מהחישוב והמשקלים של השאר מתחלקים מחדש. נשמר בדפדפן הזה.</p>
      <div className="w-grid">
        {PART_KEYS.map((k) => (
          <label key={k} className="field w-row">
            <span><b>{PART_LABEL[k]}</b> <span className="faint small">{PART_RULE[k]}</span></span>
            <span className="w-input">
              <input type="range" min={0} max={50} step={5} value={weights.parts[k]} onChange={(e) => setWeights({ ...weights, parts: { ...weights.parts, [k]: Number(e.target.value) } })} />
              <b>{total ? Math.round((100 * weights.parts[k]) / total) : 0}%</b>
            </span>
          </label>
        ))}
      </div>
      <h3 className="sec-h">רלוונטיות של כל אזור (לרכיב ״אזור״)</h3>
      <div className="w-regions">
        {REGIONS.map((r) => (
          <label key={r} className="field">{REGION_LABEL[r]}
            <select value={weights.regions[r]} onChange={(e) => setWeights({ ...weights, regions: { ...weights.regions, [r]: Number(e.target.value) } })}>
              <option value={1}>מלאה</option><option value={0.5}>חלקית</option><option value={0}>לא רלוונטי</option>
            </select>
          </label>
        ))}
      </div>
      <button type="button" className="btn ghost sm" onClick={() => { setWeights(DEFAULT_WEIGHTS); toast('המשקלים חזרו לברירת המחדל') }}>חזרה לברירת המחדל</button>
    </section>
  )
}
