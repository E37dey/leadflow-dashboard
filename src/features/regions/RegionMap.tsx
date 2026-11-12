// SPEC: "שרת API ל-Airtable (סעיף 19)": dot map on the real coordinates. A soft glow shows where bakeries are dense,
// a bubble per city (5+ bakeries) sized by count, and labels in a column. No borders are drawn: we do not have them.
import { fmt } from '../../components/ui/format'
import { REGION_LABEL } from '../../domain/regions'
import type { RegionId } from '../../domain/regions'
import type { Lead } from '../../domain/types'
import { REGION_COLOR } from './regionColors'

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function projection(pts: { lat: number; lng: number }[], W: number) {
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng)
  const box = { lat0: Math.min(...lats) - 0.1, lat1: Math.max(...lats) + 0.1, lng0: Math.min(...lngs) - 0.12, lng1: Math.max(...lngs) + 0.12 }
  const k = Math.cos((((box.lat0 + box.lat1) / 2) * Math.PI) / 180)
  const H = Math.round((W * (box.lat1 - box.lat0)) / ((box.lng1 - box.lng0) * k))
  return { H, box, px: (lat: number, lng: number) => [((lng - box.lng0) / (box.lng1 - box.lng0)) * W, ((box.lat1 - lat) / (box.lat1 - box.lat0)) * H] as const }
}

/** Labels in a column, pushed apart so they never overlap and stay inside [min, max]. */
function spread(ys: number[], gap: number, min: number, max: number) {
  const order = ys.map((y, i) => ({ y: Math.max(min, y), i })).sort((a, b) => a.y - b.y)
  let last = -Infinity
  for (const o of order) { o.y = Math.max(o.y, last + gap); last = o.y }
  const over = last - max
  if (over > 0) for (const o of order) o.y -= over
  const out: number[] = []
  for (const o of order) out[o.i] = o.y
  return out
}

export function RegionMap({ places, hover, setHover, onOpen }: { places: Lead[]; hover: RegionId | null; setHover: (r: RegionId | null) => void; onOpen: (r: RegionId) => void }) {
  const W = 250, LABEL_W = 150, GAP = 40
  const { H, box, px } = projection(places.map((l) => ({ lat: l.place!.lat!, lng: l.place!.lng! })), W)

  // One bubble per city with 5 or more bakeries, at the average of its real coordinates.
  const byCity = new Map<string, Lead[]>()
  for (const l of places) {
    const c = l.place!.city
    if (c) byCity.set(c, [...(byCity.get(c) ?? []), l])
  }
  const cities = [...byCity.entries()].filter(([, ls]) => ls.length >= 5).map(([name, ls]) => {
    const region = ls[0].place!.region!
    return {
      name, region, n: ls.length,
      lat: avg(ls.map((l) => l.place!.lat!))!, lng: avg(ls.map((l) => l.place!.lng!))!,
      rating: avg(ls.filter((l) => l.place!.rating != null).map((l) => l.place!.rating!)),
    }
  })
  const maxN = Math.max(1, ...cities.map((c) => c.n))
  const ly = spread(cities.map((c) => px(c.lat, c.lng)[1]), GAP, 20, H - 20)
  const latLines = [] as number[]
  for (let lat = Math.ceil(box.lat0 * 2) / 2; lat <= box.lat1; lat += 0.5) latLines.push(lat)
  const dim = (r: RegionId | null) => hover != null && r !== hover

  return (
    <svg viewBox={`-30 -6 ${W + LABEL_W + 70} ${H + 12}`} className="rgm" style={{ direction: 'ltr' }} role="img"
      aria-label={`מפה: ${cities.map((c) => `${c.name} ${c.n}`).join(', ')}`}>
      <defs>
        <filter id="rgm-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
        <radialGradient id="rgm-fade" cx="50%" cy="50%" r="60%"><stop offset="0" stopColor="var(--violet)" stopOpacity="0.07" /><stop offset="1" stopColor="var(--violet)" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x={-30} y={-6} width={W + 30} height={H + 12} rx={14} fill="url(#rgm-fade)" />
      {latLines.map((lat) => {
        const y = px(lat, box.lng0)[1]
        return (
          <g key={lat} className="rgm-lat">
            <line x1={0} x2={W} y1={y} y2={y} />
            <text x={-6} y={y + 3} textAnchor="end">{lat.toFixed(1)}°</text>
          </g>
        )
      })}

      <g filter="url(#rgm-glow)">
        {places.map((l) => {
          const [x, y] = px(l.place!.lat!, l.place!.lng!)
          return <circle key={l.id} cx={x} cy={y} r={6} fill={REGION_COLOR[l.place!.region!]} opacity={dim(l.place!.region) ? 0.03 : 0.22} />
        })}
      </g>
      {places.map((l) => {
        const [x, y] = px(l.place!.lat!, l.place!.lng!)
        return <circle key={l.id} cx={x} cy={y} r={1.6} fill={REGION_COLOR[l.place!.region!]} opacity={dim(l.place!.region) ? 0.15 : 0.95} />
      })}

      {cities.map((c, i) => {
        const [x, y] = px(c.lat, c.lng)
        const r = 7 + 15 * Math.sqrt(c.n / maxN)
        const lx = W + 26
        const col = REGION_COLOR[c.region]
        const off = dim(c.region)
        return (
          <g key={c.name} className="rgm-city" opacity={off ? 0.25 : 1} onMouseEnter={() => setHover(c.region)} onMouseLeave={() => setHover(null)}
            onClick={() => onOpen(c.region)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(c.region)}
            aria-label={`${c.name}: ${c.n} מאפיות, ${REGION_LABEL[c.region]}`}>
            <circle cx={x} cy={y} r={r} fill={col} fillOpacity={0.14} stroke={col} strokeWidth={1.5} />
            <polyline points={`${x + r},${y} ${W + 10},${ly[i]} ${lx},${ly[i]}`} fill="none" stroke={col} strokeOpacity={0.5} />
            <rect x={lx} y={ly[i] - 16} width={LABEL_W} height={32} rx={8} fill="var(--surface-2)" stroke={col} strokeOpacity={hover === c.region ? 0.9 : 0.35} />
            <rect x={lx + LABEL_W - 4} y={ly[i] - 10} width={3} height={20} rx={1.5} fill={col} />
            <text x={lx + LABEL_W - 10} y={ly[i] - 2} textAnchor="start" className="rgm-name">{c.name}</text>
            <text x={lx + LABEL_W - 10} y={ly[i] + 11} textAnchor="start" className="rgm-num">{fmt.num(c.n)} מאפיות{c.rating ? ` · ★ ${c.rating.toFixed(2)}` : ''}</text>
          </g>
        )
      })}
    </svg>
  )
}
