import { useMemo } from 'react'
import { insights } from '../domain/insights'
import { applyGlobal, leadsOverTime, metrics, sourceDistribution, stageDistribution } from '../domain/selectors'
import { useStore } from './store'

/** Everything the dashboard shows, from one filtered set of leads. */
export function useDerived() {
  const { leads, global, now } = useStore()
  return useMemo(() => {
    const filtered = applyGlobal(leads, global)
    return {
      filtered,
      metrics: metrics(filtered, now),
      series: leadsOverTime(filtered, global.range),
      stages: stageDistribution(filtered),
      sources: sourceDistribution(filtered),
      insights: insights(filtered, now),
    }
  }, [leads, global, now])
}
