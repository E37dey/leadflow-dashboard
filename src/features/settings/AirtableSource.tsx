// SPEC: Should 14, "מקור נתונים: Airtable". Connect a base with a read-only token; the data loads from it.
import { useState } from 'react'
import { CloudDownload, Link2, Link2Off, RefreshCw } from 'lucide-react'
import { validBaseId, validToken } from '../../domain/airtable'
import { useStore } from '../../store/store'
import { fmt } from '../../components/ui/format'

export const DEFAULT_BASE_ID = 'appxPmVAUAsA7yIIm'

export default function AirtableSource() {
  const { source, connectAirtable, reloadAirtable, disconnectAirtable, airtableBusy, savedConnection } = useStore()
  const [token, setToken] = useState(savedConnection?.token ?? '')
  const [baseId, setBaseId] = useState(savedConnection?.baseId ?? DEFAULT_BASE_ID)
  const [remember, setRemember] = useState(!!savedConnection)
  const [error, setError] = useState<string | null>(null)
  const connected = source.kind === 'airtable'

  const connect = async () => {
    setError(null)
    if (!validToken(token)) return setError('טוקן של Airtable מתחיל ב-pat.')
    if (!validBaseId(baseId)) return setError('Base ID מתחיל ב-app ויש בו 17 תווים.')
    try {
      await connectAirtable({ token, baseId }, remember)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const reload = async () => {
    setError(null)
    try {
      await reloadAirtable()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="card span-12" aria-labelledby="at-h">
      <h2 id="at-h" className="card-title">
        <CloudDownload size={18} aria-hidden="true" />
        מקור נתונים: Airtable
      </h2>
      <p className="muted">
        הלידים, המשימות ואנשי המכירות יכולים להגיע מבסיס נתונים ב-Airtable במקום מהקוד. הדאשבורד קורא בלבד, ולא כותב ל-Airtable. הטוקן נשלח רק ל-api.airtable.com, ולא נשמר בקוד או בריפו.
      </p>

      {connected ? (
        <div className="at-status" role="status">
          <span className="at-dot" aria-hidden="true" />
          <div>
            <b>מחובר ל-Airtable</b>
            <span className="muted small">
              {' '}בסיס <span dir="ltr">{source.baseId}</span> · נטענו {fmt.num(source.leads)} לידים, {fmt.num(source.tasks)} משימות ו-{fmt.num(source.owners)} אנשי מכירות
              {source.rejected ? ` · ${source.rejected} רשומות נדחו` : ''} · {fmt.date(source.loadedAt)}
            </span>
          </div>
          <div className="row-actions">
            <button type="button" className="btn ghost sm" onClick={reload} disabled={airtableBusy}>
              <RefreshCw size={15} aria-hidden="true" />
              טעינה מחדש מ-Airtable
            </button>
            <button type="button" className="btn ghost sm" onClick={disconnectAirtable} disabled={airtableBusy}>
              <Link2Off size={15} aria-hidden="true" />
              התנתקות וחזרה לנתוני ההדגמה
            </button>
          </div>
        </div>
      ) : (
        <form className="at-form" onSubmit={(e) => { e.preventDefault(); connect() }}>
          <ol className="at-steps muted small">
            <li>ב-airtable.com/create/tokens יוצרים טוקן עם הרשאות data.records:read ו-schema.bases:read בלבד.</li>
            <li>בגישה בוחרים רק את הבסיס של LEADFLOW.</li>
            <li>מדביקים כאן ולוחצים התחברות.</li>
          </ol>
          <div className="form-grid">
            <label className="field" htmlFor="at-token">
              Personal access token
              <input id="at-token" type="password" dir="ltr" autoComplete="off" spellCheck={false} placeholder="pat..." value={token}
                aria-invalid={!!error} aria-describedby={error ? 'at-err' : undefined} onChange={(e) => setToken(e.target.value)} />
            </label>
            <label className="field" htmlFor="at-base">
              Base ID
              <input id="at-base" type="text" dir="ltr" spellCheck={false} value={baseId} onChange={(e) => setBaseId(e.target.value)} />
            </label>
          </div>
          <div className="row-actions at-actions">
            <button type="submit" className="btn primary" disabled={airtableBusy}>
              <Link2 size={17} aria-hidden="true" />
              {airtableBusy ? 'טוען...' : 'התחברות'}
            </button>
            <label className="at-remember small">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              לזכור בדפדפן הזה (localStorage)
            </label>
          </div>
        </form>
      )}
      {error && <p className="field-error" id="at-err" role="alert">{error}</p>}
      <p className="faint small at-note">שינויים שעושים בדאשבורד אחרי הטעינה נשמרים בדפדפן בלבד. טעינה מחדש מחליפה אותם בנתונים מ-Airtable.</p>
    </section>
  )
}
