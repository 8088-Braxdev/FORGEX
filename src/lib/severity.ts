// Shared severity penalty table for the analyzer's compatibility score
// and change simulation. These weights are intentionally separate from
// intelligence.ts, which uses a different 18/9/3/1 density formula.
export const SEVERITY_PENALTY = {
  critical: 22,
  high: 12,
  medium: 4,
  low: 1.5,
} as const;

export type SeverityPenalty = typeof SEVERITY_PENALTY;