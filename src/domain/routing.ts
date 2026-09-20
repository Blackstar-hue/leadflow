import type { RoutingCandidate } from './types'

export function chooseRenter(candidates: RoutingCandidate[], category: string) {
  return candidates
    .filter((candidate) => candidate.available && (candidate.categories.length === 0 || candidate.categories.includes(category)))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, 'en-GB'))[0]
}
