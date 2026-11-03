import { DEFAULT_RANGE } from '../domain/clock'
import type { GlobalFilter, TableFilter } from '../domain/types'
import type { ThemeId } from './persist'

export type View = 'overview' | 'leads' | 'pipeline' | 'tasks' | 'insights' | 'settings'
export const VIEWS: View[] = ['overview', 'leads', 'pipeline', 'tasks', 'insights', 'settings']
export const VIEW_LABEL: Record<View, string> = {
  overview: 'סקירה כללית',
  leads: 'לידים',
  pipeline: 'צנרת מכירה',
  tasks: 'משימות',
  insights: 'תובנות',
  settings: 'הגדרות',
}
export const EMPTY_TABLE: TableFilter = { stage: 'all', priority: 'all', query: '', ids: null, idsLabel: null }
export const DEFAULT_GLOBAL: GlobalFilter = { range: DEFAULT_RANGE, source: 'all', ownerId: 'all' }
export const THEME_LABEL: Record<ThemeId, string> = {
  aurora: 'D: אינדיגו, סגול וטורקיז',
  graphite: 'A: גרפיט ומנטה',
  cloud: 'B: בהיר וסגול',
  studio: 'C: שמנת וכתום',
}
