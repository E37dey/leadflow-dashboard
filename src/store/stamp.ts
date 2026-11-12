import { iso, nowMs } from '../domain/clock'

/** Edits happen "now" on the demo clock, so time-based rules stay consistent. */
export const stamp = () => iso(nowMs())
