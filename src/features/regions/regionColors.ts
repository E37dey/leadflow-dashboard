import type { RegionId } from '../../domain/regions'

/** One color per region, used on every screen so a region always looks the same. */
export const REGION_COLOR: Record<RegionId, string> = {
  haifa: '#39D8E8', center: '#9270FF', jerusalem: '#F4B752', sharon: '#44DEB7', north: '#6EA8FF', south: '#F27AB0',
}
export const UNKNOWN_COLOR = 'color-mix(in oklab, var(--text) 45%, transparent)'
