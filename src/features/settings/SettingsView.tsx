import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Overlay } from '../../components/ui/ui'
import { THEMES } from '../../store/persist'
import { useStore } from '../../store/store'
import { EMPTY_TABLE, THEME_LABEL, defaultGlobal } from '../../store/constants'
import AirtableSource from './AirtableSource'

export default function SettingsView() {
  const { theme, dispatch, toast, setGlobal, setTable, source } = useStore()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>הגדרות</h1>
          <p className="page-sub">עיצוב, מקור הנתונים ואיך מחושב הציון.</p>
        </div>
      </div>
      <div className="grid-12">
        <AirtableSource />

        <section className="card span-6" aria-labelledby="theme-h">
          <h2 id="theme-h" className="card-title">כיוון עיצוב</h2>
          <div className="theme-list" role="radiogroup" aria-labelledby="theme-h">
            {THEMES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={theme === t} className="theme-opt" onClick={() => dispatch({ type: 'setTheme', theme: t })}>
                <span className={`swatch lg sw-${t}`} aria-hidden="true" />
                <span>{THEME_LABEL[t]}</span>
                {t === 'aurora' && <span className="faint small">ברירת מחדל</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="card span-6" aria-labelledby="data-h">
          <h2 id="data-h" className="card-title">נתוני הדגמה</h2>
          <p className="muted">
            {source.kind === 'airtable'
              ? 'כרגע מוצגים לידים אמיתיים מ-Airtable, והשעון הוא השעה האמיתית. נתוני ההדגמה הבדויים חוזרים אחרי התנתקות מ-Airtable.'
              : 'כל הלידים, החברות והטלפונים בדויים. השינויים שלך נשמרים רק בדפדפן הזה. שעון ההדגמה קבוע: 3.11.2026 בשעה 12:00, כדי שהמספרים יהיו זהים בכל פתיחה.'}
          </p>
          <button type="button" className="btn danger" onClick={() => setConfirm(true)}>
            <RotateCcw size={17} aria-hidden="true" />
            איפוס נתוני ההדגמה
          </button>
        </section>

        <section className="card span-12" aria-labelledby="score-h">
          <h2 id="score-h" className="card-title">איך מחושב ציון העדיפות</h2>
          <p className="muted">נוסחה גלויה, בין 0 ל-100. זה לא חיזוי של מודל. ליד חם = ליד פתוח עם ציון 80 ומעלה.</p>
          <ul className="formula">
            <li><b>שלב</b>חדש 10, נוצר קשר 18, מתאים 28, הצעה נשלחה 35</li>
            <li><b>שווי</b>עד 20 נקודות, יחסית לשווי, מקסימום מ-₪6,000</li>
            <li><b>קשר אחרון</b>עד יומיים 20, עד שבוע 14, עד שבועיים 8, אחרת 2. בלי קשר: 15 לליד מהיומיים האחרונים, אחרת 0</li>
            <li><b>מעקב הבא</b>באיחור 25, היום 22, תוך 3 ימים 12, מאוחר יותר 4, לא נקבע 0</li>
          </ul>
        </section>
      </div>

      {confirm && (
        <Overlay kind="dialog" title="לאפס את נתוני ההדגמה?" onClose={() => setConfirm(false)}
          footer={<>
            <button type="button" className="btn ghost" data-autofocus onClick={() => setConfirm(false)}>ביטול</button>
            <button type="button" className="btn danger" onClick={() => {
              dispatch({ type: 'reset' })
              setGlobal(defaultGlobal())
              setTable(EMPTY_TABLE)
              setConfirm(false)
              toast('נתוני ההדגמה אופסו')
            }}>כן, לאפס</button>
          </>}>
          <p>כל הלידים, המשימות והשינויים שעשית יוחלפו בנתוני ההדגמה המקוריים. כיוון העיצוב נשאר.</p>
        </Overlay>
      )}
    </div>
  )
}
