import { DEMO_NOW, iso } from '../domain/clock'

/** Edits happen "now" on the demo clock, so time-based rules stay consistent. */
export const stamp = () => iso(DEMO_NOW)
