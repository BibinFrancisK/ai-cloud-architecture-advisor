export enum RequirementDimension {
  SCALE = 'SCALE',
  LATENCY = 'LATENCY',
  PERSISTENCE = 'PERSISTENCE',
  TEAM = 'TEAM',
  BUDGET = 'BUDGET',
  COMPLIANCE = 'COMPLIANCE',
}

export interface DimensionScore {
  dimension: RequirementDimension;
  score: 0 | 1 | 2;
}

export interface RequirementsAssessment {
  scores: DimensionScore[];
  totalScore: number;
  lowestDimension: RequirementDimension;
}
