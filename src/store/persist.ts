// Versioned localStorage with safe parsing. A broken or old save falls back to the demo data.
import type { Lead, Task } from '../domain/types'

export const STORAGE_KEY = 'leadflow:v1'
export const VERSION = 1
export type ThemeId = 'aurora' | 'graphite' | 'cloud' | 'studio'
export const THEMES: ThemeId[] = ['aurora', 'graphite', 'cloud', 'studio']

export interface Saved {
  version: number
  leads: Lead[]
  tasks: Task[]
  theme: ThemeId
}

export function parseSaved(raw: string | null): Saved | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw)
    if (!d || d.version !== VERSION || !Array.isArray(d.leads) || !Array.isArray(d.tasks)) return null
    const leadOk = (l: Lead) => l && typeof l.id === 'string' && typeof l.fullName === 'string' && typeof l.createdAt === 'string' && Array.isArray(l.activityLog)
    if (!d.leads.every(leadOk)) return null
    return { version: VERSION, leads: d.leads, tasks: d.tasks, theme: THEMES.includes(d.theme) ? d.theme : 'aurora' }
  } catch {
    return null
  }
}

export function readSaved(): Saved | null {
  try {
    return parseSaved(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function writeSaved(s: Omit<Saved, 'version'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...s }))
  } catch {
    /* storage blocked or full: the app keeps working for this session */
  }
}
