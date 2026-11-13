// SPEC 20: "מסך התחברות עם טוקן". With no server token, the site opens here: nothing from Airtable shows
// until a token and a base load. The token goes only to api.airtable.com and is kept only if asked.
import { useState } from 'react'
import { Database, Download, KeyRound, Link2, MonitorPlay } from 'lucide-react'
import { extractBaseId, validBaseId, validToken } from '../../domain/airtable'
import { useStore } from '../../store/store'
import { Logo } from '../../components/layout/Sidebar'

const TEMPLATE = `${import.meta.env.BASE_URL}airtable-template/Leads.csv`

export default function ConnectGate() {
  const { connectAirtable, chooseDemo, airtableBusy, savedConnection, gateError } = useStore()
  const [token, setToken] = useState('')
  const [baseId, setBaseId] = useState(savedConnection?.baseId ?? '')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(gateError)

  const connect = async () => {
    setError(null)
    const base = extractBaseId(baseId)
    if (!validToken(token)) return setError('טוקן של Airtable מתחיל ב-pat. העתיקו אותו שוב מ-Builder hub.')
    if (!validBaseId(base)) return setError('לא מצאתי Base ID. הוא מתחיל ב-app ויש בו 17 תווים, ומופיע בכתובת של הבסיס.')
    setBaseId(base)
    try {
      await connectAirtable({ token, baseId: base }, remember)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="gate">
      <main className="gate-card card" aria-labelledby="gate-h">
        <Logo />
        <h1 id="gate-h" className="gate-title">
          <KeyRound size={22} aria-hidden="true" />
          התחברות ל-Airtable
        </h1>
        <p className="muted">
          הדאשבורד מציג נתונים מבסיס ב-Airtable. כדי לראות אותם, הדביקו טוקן אישי ואת ה-Base ID. הטוקן נשלח רק ל-api.airtable.com, לא נשמר בקוד ולא בשרת.
        </p>

        <form className="at-form" onSubmit={(e) => { e.preventDefault(); connect() }}>
          <label className="field" htmlFor="gate-token">
            Personal access token
            <input id="gate-token" type="password" dir="ltr" autoComplete="off" spellCheck={false} placeholder="pat..." value={token} autoFocus
              aria-invalid={!!error} aria-describedby={error ? 'gate-err' : 'gate-help'} onChange={(e) => setToken(e.target.value)} />
          </label>
          <label className="field" htmlFor="gate-base">
            Base ID או הכתובת של הבסיס
            <input id="gate-base" type="text" dir="ltr" spellCheck={false} placeholder="app... / https://airtable.com/app..." value={baseId}
              onChange={(e) => setBaseId(e.target.value)} />
          </label>
          <label className="at-remember small">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            לזכור את החיבור בדפדפן הזה
          </label>
          {error && <p className="field-error" id="gate-err" role="alert">{error}</p>}
          <button type="submit" className="btn primary gate-submit" disabled={airtableBusy}>
            <Link2 size={17} aria-hidden="true" />
            {airtableBusy ? 'טוען מ-Airtable...' : 'התחברות'}
          </button>
        </form>

        <details className="gate-help" id="gate-help">
          <summary>איך מוציאים טוקן ומה צריך להיות בבסיס</summary>
          <ol className="at-steps muted small">
            <li>ב-Airtable: תמונת הפרופיל, Builder hub, ואז Personal access tokens ו-Create token.</li>
            <li>הרשאות (scopes): <span dir="ltr">data.records:read</span> ו-<span dir="ltr">schema.bases:read</span>. גישה (access): רק הבסיס שרוצים להציג.</li>
            <li>בבסיס צריכה להיות טבלה בשם <b dir="ltr">Leads</b>. הטבלאות Owners ו-Tasks לא חובה.</li>
            <li>אין בסיס? אפשר ליצור בסיס חדש ולייבא אליו את התבנית (נתוני דמה) לטבלה בשם Leads.</li>
          </ol>
          <a className="btn ghost sm" href={TEMPLATE} download="Leads.csv">
            <Download size={15} aria-hidden="true" />
            תבנית Leads.csv (נתוני דמה)
          </a>
        </details>

        <div className="gate-alt">
          <span className="faint small">בלי Airtable:</span>
          <button type="button" className="btn ghost sm" onClick={chooseDemo} disabled={airtableBusy}>
            <MonitorPlay size={15} aria-hidden="true" />
            הצג נתוני הדגמה
          </button>
        </div>
        <p className="faint small gate-foot">
          <Database size={13} aria-hidden="true" /> הדאשבורד קורא בלבד מהבסיס. נתוני ההדגמה נוצרים בקוד ומסומנים ככאלה בסרגל העליון.
        </p>
      </main>
    </div>
  )
}
