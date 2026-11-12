// SPEC: "מקור נתונים: Airtable". The connection is kept in this browser only, and only when the user asks to remember it.
import { validBaseId, validToken } from '../domain/airtable'
import type { AtConnection } from '../domain/airtable'

export const CONN_KEY = 'leadflow:airtable'

export function readConnection(): AtConnection | null {
  try {
    const raw = localStorage.getItem(CONN_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    return c && validToken(String(c.token)) && validBaseId(String(c.baseId)) ? { token: c.token, baseId: c.baseId } : null
  } catch {
    return null
  }
}

export function writeConnection(c: AtConnection) {
  try {
    localStorage.setItem(CONN_KEY, JSON.stringify({ token: c.token.trim(), baseId: c.baseId.trim() }))
  } catch {
    /* storage blocked: the connection works for this session only */
  }
}

export function clearConnection() {
  try {
    localStorage.removeItem(CONN_KEY)
  } catch {
    /* nothing to clear */
  }
}
