import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { SortKey } from '../../domain/selectors'
import { isOpen, score } from '../../domain/score'
import type { Lead } from '../../domain/types'
import { Avatar, ScoreRing, SourceTag, StageBadge } from '../../components/ui/ui'
import { fmt } from '../../components/ui/format'
import { useStore } from '../../store/store'
import { RowMenu } from './RowMenu'

const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'name', label: 'ליד וחברה' },
  { key: 'source', label: 'מקור' },
  { key: 'stage', label: 'שלב' },
  { key: 'score', label: 'ציון' },
  { key: 'value', label: 'שווי', num: true },
  { key: 'owner', label: 'אחראי' },
  { key: 'followUp', label: 'מעקב הבא' },
]

export function LeadTable({ leads, caption, sort, onSort }: {
  leads: Lead[]
  caption: string
  sort?: { key: SortKey; dir: 'asc' | 'desc' }
  onSort?: (key: SortKey) => void
}) {
  const { now, owners, openLead } = useStore()
  return (
    <div className="tbl-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="tbl">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {COLS.map((c) => {
              const active = sort?.key === c.key
              const aria = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'
              return (
                <th key={c.key} scope="col" className={c.num ? 'num' : undefined} aria-sort={onSort ? aria : undefined}>
                  {onSort ? (
                    <button type="button" className="th-btn" onClick={() => onSort(c.key)}>
                      {c.label}
                      {active ? sort!.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={13} className="faint" />}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              )
            })}
            <th scope="col">
              <span className="sr-only">פעולות</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const s = score(l, now)
            const late = isOpen(l) && l.nextFollowUpAt && Date.parse(l.nextFollowUpAt) < now
            return (
              <tr key={l.id} onClick={() => openLead(l.id)}>
                <th scope="row">
                  <button type="button" className="lead-cell" onClick={(e) => { e.stopPropagation(); openLead(l.id) }}>
                    <b>{l.fullName}</b>
                    <span>{l.company}</span>
                  </button>
                </th>
                <td><SourceTag source={l.source} /></td>
                <td><StageBadge stage={l.stage} /></td>
                <td><ScoreRing value={s} open={isOpen(l)} /></td>
                <td className="num">{fmt.ils(l.estimatedValueILS)}</td>
                <td><Avatar owner={owners.find((o) => o.id === l.ownerId)} /></td>
                <td>
                  {l.nextFollowUpAt ? (
                    <span className={late ? 'due late' : 'due'}>
                      {fmt.dateShort(l.nextFollowUpAt)}
                      {late && <em> באיחור</em>}
                    </span>
                  ) : (
                    <span className="faint">לא נקבע</span>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <RowMenu lead={l} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
