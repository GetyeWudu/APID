export type RatingBand =
  | 'GRADE_1_CRITICAL'
  | 'GRADE_2_MANDATORY'
  | 'GRADE_3_MEETS_STANDARD'
  | 'GRADE_4_EXCEEDS'
  | 'GRADE_5_EXCEPTIONAL';

export interface RatingBandMeta {
  label: string;
  shortLabel: string;
  tone: 'err' | 'warn' | 'info' | 'ok' | 'neutral';
  color: string;
  policyNote: string;
}

/**
 * Classifies performance eligibility strictly using RoundedOverallFinalRating (< 3).
 * OverallFinalRating (mean of multi-goal GoalScore rows) is rounded to 1..5 first.
 */
export function isMandatoryCoachingRounded(roundedRating: number): boolean {
  return Math.round(roundedRating) < 3;
}

export function classifyRating(roundedOrAverageRating: number): RatingBand {
  const rounded = Math.max(1, Math.min(5, Math.round(roundedOrAverageRating)));
  if (rounded === 1) return 'GRADE_1_CRITICAL';
  if (rounded === 2) return 'GRADE_2_MANDATORY';
  if (rounded === 3) return 'GRADE_3_MEETS_STANDARD';
  if (rounded === 4) return 'GRADE_4_EXCEEDS';
  return 'GRADE_5_EXCEPTIONAL';
}

export const RATING_BAND_METADATA: Record<RatingBand, RatingBandMeta> = {
  GRADE_1_CRITICAL: {
    label: 'Rounded = 1 (< 3 Mandatory)',
    shortLabel: 'Grade 1 (Mandatory)',
    tone: 'err',
    color: '#dc2626',
    policyNote: 'RoundedOverallFinalRating = 1 (< 3): Triggers mandatory coaching.',
  },
  GRADE_2_MANDATORY: {
    label: 'Rounded = 2 (< 3 Mandatory)',
    shortLabel: 'Grade 2 (Mandatory)',
    tone: 'warn',
    color: '#d97706',
    policyNote: 'RoundedOverallFinalRating = 2 (< 3): Triggers mandatory coaching.',
  },
  GRADE_3_MEETS_STANDARD: {
    label: 'Rounded = 3 (Meets Standard)',
    shortLabel: 'Grade 3 (Passing)',
    tone: 'info',
    color: '#2563eb',
    policyNote: 'RoundedOverallFinalRating = 3 (incl. avg 2.5000–3.4999); clears mandatory & qualifies for Skill-Dev.',
  },
  GRADE_4_EXCEEDS: {
    label: 'Rounded = 4 (Beyond Expectation)',
    shortLabel: 'Grade 4 (Strong)',
    tone: 'ok',
    color: '#16a34a',
    policyNote: 'RoundedOverallFinalRating = 4; satisfactory / high performer.',
  },
  GRADE_5_EXCEPTIONAL: {
    label: 'Rounded = 5 (Exceptional)',
    shortLabel: 'Grade 5 (Exceptional)',
    tone: 'ok',
    color: '#0f766e',
    policyNote: 'RoundedOverallFinalRating = 5; top organizational performer.',
  },
};
