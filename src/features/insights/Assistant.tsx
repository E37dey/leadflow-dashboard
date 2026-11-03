import { useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Overlay } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { tasksIn } from '../../domain/selectors'
import { SOURCE_LABEL } from '../../domain/types'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'

type Q = 'attention' | 'source' | 'pipeline' | 'today'
const SUGGESTED: { id: Q; text: string; words: string[] }[] = [
  { id: 'attention', text: 'אילו לידים דורשים טיפול?', words: ['טיפול', 'דחוף', 'חמים'] },
  { id: 'source', text: 'מה מקור הלידים המוביל?', words: ['מקור', 'מקורות'] },
  { id: 'pipeline', text: 'כמה כסף פתוח בצנרת?', words: ['צנרת', 'כסף', 'שווי'] },
  { id: 'today', text: 'מה יש לי היום?', words: ['היום', 'משימות', 'לו״ז'] },
]

interface Msg { who: 'me' | 'bot'; text: string; ids?: string[]; idsLabel?: string }

/** A demo helper with fixed questions answered from local selectors. Not a language model. */
export default function Assistant() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const { insights, sources, metrics } = useDerived()
  const { tasks, now, showLeads } = useStore()

  const answer = (q: Q | null): Msg => {
    if (q === 'attention') {
      const parts = insights.filter((i) => i.actionable && i.count).map((i) => `${i.count} ${i.title}`)
      const ids = [...new Set(insights.filter((i) => i.actionable).flatMap((i) => i.leadIds))]
      return { who: 'bot', text: parts.length ? `${parts.join(', ')}. בסך הכול ${ids.length} לידים שונים.` : 'אין כרגע לידים שעונים על כללי הטיפול.', ids, idsLabel: 'לידים שדורשים טיפול' }
    }
    if (q === 'source') {
      const top = [...sources].sort((a, b) => b.count - a.count)[0]
      const best = insights.find((i) => i.id === 'best-source')
      return { who: 'bot', text: top?.count ? `הכי הרבה לידים הגיעו מ${SOURCE_LABEL[top.source]}: ${top.count} מתוך ${metrics.total}. ${best ? `${best.title}. ${best.reason}.` : ''}` : 'אין לידים בסינון הנוכחי.' }
    }
    if (q === 'pipeline') return { who: 'bot', text: `${fmt.ils(metrics.pipeline)} פתוחים ב-${metrics.open} לידים. מתוכם ${metrics.hot} לידים חמים.` }
    if (q === 'today') {
      const t = tasksIn(tasks, 'today', now)
      const late = tasksIn(tasks, 'overdue', now).length
      return { who: 'bot', text: t.length ? `${t.length} משימות להיום: ${t.map((x) => `${fmt.time(x.dueAt)} ${x.title}`).join('; ')}.${late ? ` ועוד ${late} באיחור.` : ''}` : 'אין משימות להיום.' }
    }
    return { who: 'bot', text: 'אני עוזר הדגמה, ואני עונה רק על השאלות המוצעות למטה מתוך הנתונים במסך. אין כאן מודל שפה, ולא נשלחת שום הודעה החוצה.' }
  }

  const ask = (text: string, q: Q | null) => setMsgs((m) => [...m, { who: 'me', text }, answer(q)])
  const free = (e: React.FormEvent) => {
    e.preventDefault()
    const t = input.trim()
    if (!t) return
    ask(t, SUGGESTED.find((s) => s.words.some((w) => t.includes(w)))?.id ?? null)
    setInput('')
  }

  return (
    <>
      <button type="button" className="assist-fab" onClick={() => setOpen(true)} aria-label="עוזר הדגמה: שאלות על הנתונים">
        <MessageSquareText size={22} aria-hidden="true" />
      </button>
      {open && (
        <Overlay kind="dialog" title="עוזר הדגמה" onClose={() => setOpen(false)}>
          <p className="muted small">עונה על שאלות קבועות מתוך הנתונים שבמסך ובסינון הנוכחי. לא מחובר למודל שפה.</p>
          <div className="chat" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`bubble ${m.who}`}>
                {m.text}
                {m.ids && m.ids.length > 0 && (
                  <button type="button" className="link-btn" onClick={() => { setOpen(false); showLeads({ ids: m.ids, idsLabel: m.idsLabel ?? null }) }}>
                    הצג לידים
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="suggest">
            {SUGGESTED.map((s) => (
              <button key={s.id} type="button" className="chip" onClick={() => ask(s.text, s.id)}>{s.text}</button>
            ))}
          </div>
          <form onSubmit={free} className="chat-form">
            <label htmlFor="assist-q" className="sr-only">שאלה</label>
            <input id="assist-q" type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="אפשר גם לכתוב, למשל: מה יש לי היום?" />
            <button type="submit" className="btn primary sm">שליחה</button>
          </form>
        </Overlay>
      )}
    </>
  )
}
