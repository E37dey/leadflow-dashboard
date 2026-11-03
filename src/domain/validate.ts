import type { Source, Stage } from './types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface NewLeadInput {
  fullName: string
  company: string
  email: string
  phone: string
  source: Source
  stage: Stage
  value: string
  ownerId: string
}

/** Name is required, plus at least one way to reach the lead. Email must look valid when given. */
export function validateLead(f: NewLeadInput): Partial<Record<keyof NewLeadInput | 'contact', string>> {
  const e: Partial<Record<keyof NewLeadInput | 'contact', string>> = {}
  if (!f.fullName.trim()) e.fullName = 'צריך שם מלא.'
  if (!f.email.trim() && !f.phone.trim()) e.contact = 'צריך לפחות דרך קשר אחת: מייל או טלפון.'
  if (f.email.trim() && !EMAIL.test(f.email.trim())) e.email = 'המייל לא תקין. לדוגמה: name@example.com'
  if (f.phone.trim() && !/^[0-9+\-\s()]{7,}$/.test(f.phone.trim())) e.phone = 'הטלפון יכול להכיל ספרות, רווחים ומקפים בלבד.'
  if (f.value.trim() && (!Number.isFinite(Number(f.value)) || Number(f.value) < 0)) e.value = 'השווי צריך להיות מספר חיובי.'
  return e
}
