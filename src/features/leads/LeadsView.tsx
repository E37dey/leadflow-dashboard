import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Plus, X } from 'lucide-react'
import { GlobalFilters } from '../../components/layout/Topbar'
import { Empty } from '../../components/ui/ui'
import { TODAY } from '../../domain/clock'
import { leadsCsv } from '../../domain/csv'
import { applyTable, paginate, sortLeads } from '../../domain/selectors'
import type { SortKey } from '../../domain/selectors'
import { PRIORITY_LABEL, STAGES, STAGE_LABEL } from '../../domain/types'
import type { Priority, Stage } from '../../domain/types'
import { useDerived } from '../../store/derived'
import { useStore } from '../../store/store'
import { EMPTY_TABLE } from '../../store/constants'
import { LeadTable } from './LeadTable'

const PAGE = 12

export default function LeadsView() {
  const { table, setTable, now, ownerName, owners, setNewLeadOpen, toast } = useStore()
  const { filtered } = useDerived()
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'priority', dir: 'desc' })
  const [page, setPage] = useState(1)

  const rows = useMemo(() => sortLeads(applyTable(filtered, table, now), sort.key, sort.dir, now, ownerName), [filtered, table, now, sort, ownerName])
  const view = paginate(rows, page, PAGE)
  const tableFiltered = table.stage !== 'all' || table.priority !== 'all' || table.query.trim() !== '' || table.ids !== null
  const update = (patch: Partial<typeof table>) => {
    setTable({ ...table, ...patch })
    setPage(1)
  }
  const onSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'score' || key === 'value' ? 'desc' : 'asc' }))
    setPage(1)
  }
  const exportCsv = () => {
    const blob = new Blob([leadsCsv(rows, owners, now)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `leadflow-leads-${TODAY}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(a.href)
    toast(`יוצאו ${rows.length} לידים לקובץ CSV`)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>לידים</h1>
          <p className="page-sub">{filtered.length} לידים בטווח ובסינון הכללי, {rows.length} מוצגים בטבלה</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn ghost" onClick={exportCsv} disabled={!rows.length}>
            <Download size={17} aria-hidden="true" />
            ייצוא CSV
          </button>
          <button type="button" className="btn primary" onClick={() => setNewLeadOpen(true)}>
            <Plus size={18} aria-hidden="true" />
            ליד חדש
          </button>
        </div>
      </div>
      <GlobalFilters />

      <section className="card" aria-labelledby="tbl-title">
        <header className="card-head wrap">
          <h2 id="tbl-title">כל הלידים</h2>
          <p className="scope-note">הסינון כאן משפיע רק על הטבלה, לא על המדדים והגרפים.</p>
        </header>
        <div className="tfilters" role="group" aria-label="סינון הטבלה">
          <label className="field">
            חיפוש בטבלה
            <input type="text" value={table.query} placeholder="שם, חברה, מייל או טלפון" onChange={(e) => update({ query: e.target.value })} />
          </label>
          <label className="field">
            שלב
            <select value={table.stage} onChange={(e) => update({ stage: e.target.value as Stage | 'all' })}>
              <option value="all">כל השלבים</option>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="field">
            עדיפות
            <select value={table.priority} onChange={(e) => update({ priority: e.target.value as Priority | 'all' })}>
              <option value="all">כל העדיפויות</option>
              {(['hot', 'warm', 'cold'] as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]} ({p === 'hot' ? '80 ומעלה' : p === 'warm' ? '50 עד 79' : 'מתחת ל-50'})</option>
              ))}
            </select>
          </label>
          {tableFiltered && (
            <button type="button" className="btn ghost sm" onClick={() => { setTable(EMPTY_TABLE); setPage(1) }}>
              ניקוי סינון הטבלה
            </button>
          )}
        </div>
        {table.ids && (
          <p className="ids-chip">
            מוצגים רק הלידים של: <b>{table.idsLabel}</b> ({table.ids.length})
            <button type="button" className="icon-btn sm" aria-label="הסרת הסינון הזה" onClick={() => update({ ids: null, idsLabel: null })}>
              <X size={14} />
            </button>
          </p>
        )}
        {rows.length ? (
          <>
            <LeadTable leads={view.rows} caption="טבלת לידים" sort={sort} onSort={onSort} />
            <nav className="pager" aria-label="עמודים">
              <button type="button" className="icon-btn" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)} aria-label="העמוד הקודם">
                <ChevronRight size={18} />
              </button>
              <span>
                עמוד {view.page} מתוך {view.pages}, שורות {(view.page - 1) * PAGE + 1} עד {Math.min(view.page * PAGE, rows.length)} מתוך {rows.length}
              </span>
              <button type="button" className="icon-btn" disabled={view.page >= view.pages} onClick={() => setPage(view.page + 1)} aria-label="העמוד הבא">
                <ChevronLeft size={18} />
              </button>
            </nav>
          </>
        ) : (
          <Empty>
            אין לידים שמתאימים לסינון.{' '}
            <button type="button" className="link-btn" onClick={() => { setTable(EMPTY_TABLE); setPage(1) }}>ניקוי סינון הטבלה</button>
          </Empty>
        )}
      </section>
    </div>
  )
}
