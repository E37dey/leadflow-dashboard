import { dayKey } from './clock'
import { score } from './score'
import type { Lead, Owner } from './types'
import { SOURCE_LABEL, STAGE_LABEL } from './types'

/** Neutralize spreadsheet formulas in user-entered text, then quote for CSV. */
export function cell(v: string | number): string {
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s
  return '"' + s.replace(/"/g, '""') + '"'
}

export function leadsCsv(leads: Lead[], owners: Owner[], now: number): string {
  const owner = (id: string) => owners.find((o) => o.id === id)?.name ?? ''
  const header = ['מזהה', 'שם', 'חברה', 'מייל', 'טלפון', 'מקור', 'שלב', 'ציון', 'שווי (₪)', 'אחראי', 'מעקב הבא', 'נוצר']
  const rows = leads.map((l) => [
    l.id, l.fullName, l.company, l.email ?? '', l.phone ?? '', SOURCE_LABEL[l.source], STAGE_LABEL[l.stage],
    score(l, now), l.estimatedValueILS, owner(l.ownerId), l.nextFollowUpAt ? dayKey(l.nextFollowUpAt) : '', dayKey(l.createdAt),
  ])
  // BOM so Excel opens Hebrew as UTF-8.
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}
