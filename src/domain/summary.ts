// SPEC: "שרת API ל-Airtable (סעיף 19)": the numbers behind the KPIs, the regions screen and /api/dashboard/summary.
// Only counts, sums and averages of real fields. Pipeline numbers use only bakeries the user added to the pipeline.
import { REGIONS, REGION_LABEL } from './regions'
import type { RegionId } from './regions'
import { OPEN_STAGES, STAGES } from './types'
import type { Lead, Stage } from './types'

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export interface RegionRow {
  id: RegionId
  label: string
  bakeries: number
  rated: number
  avgRating: number | null
  medianReviews: number | null
  reviews: number
  withWebsite: number
  withPhone: number
  /** rating 4.5+ with at least the overall median of reviews */
  stars: number
  pipeline: number
  won: number
  openValue: number
  lat: number | null
  lng: number | null
}

export function pipelineLeads(leads: Lead[]) {
  return leads.filter((l) => l.place && l.inPipeline)
}

export function pipelineSummary(leads: Lead[]) {
  const p = pipelineLeads(leads)
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>
  for (const l of p) byStage[l.stage]++
  const open = p.filter((l) => OPEN_STAGES.includes(l.stage))
  const valued = open.filter((l) => l.estimatedValueILS > 0)
  const closed = byStage.won + byStage.lost
  return {
    total: p.length,
    byStage,
    open: open.length,
    won: byStage.won,
    lost: byStage.lost,
    /** won out of closed deals; null until something closed */
    conversion: closed ? byStage.won / closed : null,
    openValue: valued.reduce((s, l) => s + l.estimatedValueILS, 0),
    valued: valued.length,
  }
}

export function regionRows(leads: Lead[]): RegionRow[] {
  const places = leads.filter((l) => l.place)
  const med = median(places.map((l) => l.place!.reviews ?? 0)) ?? 0
  return REGIONS.map((id) => {
    const rs = places.filter((l) => l.place!.region === id)
    const rated = rs.filter((l) => l.place!.rating != null)
    const pipe = rs.filter((l) => l.inPipeline)
    const located = rs.filter((l) => l.place!.lat != null && l.place!.lng != null)
    return {
      id,
      label: REGION_LABEL[id],
      bakeries: rs.length,
      rated: rated.length,
      avgRating: avg(rated.map((l) => l.place!.rating!)),
      medianReviews: median(rs.map((l) => l.place!.reviews ?? 0)),
      reviews: rs.reduce((s, l) => s + (l.place!.reviews ?? 0), 0),
      withWebsite: rs.filter((l) => l.place!.website).length,
      withPhone: rs.filter((l) => l.phone).length,
      stars: rated.filter((l) => l.place!.rating! >= 4.5 && (l.place!.reviews ?? 0) >= med).length,
      pipeline: pipe.length,
      won: pipe.filter((l) => l.stage === 'won').length,
      openValue: pipe.filter((l) => OPEN_STAGES.includes(l.stage)).reduce((s, l) => s + l.estimatedValueILS, 0),
      lat: avg(located.map((l) => l.place!.lat!)),
      lng: avg(located.map((l) => l.place!.lng!)),
    }
  })
}

export function dashboardSummary(leads: Lead[]) {
  const places = leads.filter((l) => l.place)
  const rated = places.filter((l) => l.place!.rating != null)
  return {
    bakeries: places.length,
    rated: rated.length,
    avgRating: avg(rated.map((l) => l.place!.rating!)),
    reviews: places.reduce((s, l) => s + (l.place!.reviews ?? 0), 0),
    unknownRegion: places.filter((l) => !l.place!.region).length,
    regions: regionRows(leads),
    pipeline: pipelineSummary(leads),
  }
}
