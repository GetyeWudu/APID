import { useMemo } from 'react';
import { DataSourceBadge, StatusPill, SvgDonutChart } from '../../../shared/components/ui';
import {
  classifyRating,
  isMandatoryCoachingRounded,
  RATING_BAND_METADATA,
  type RatingBand,
} from '../utils/ratingClassification';

const ORDERED_BANDS: RatingBand[] = [
  'GRADE_1_CRITICAL',
  'GRADE_2_MANDATORY',
  'GRADE_3_MEETS_STANDARD',
  'GRADE_4_EXCEEDS',
  'GRADE_5_EXCEPTIONAL',
];

export function RatingDistributionCard({ ratingSeries }: { ratingSeries: number[] }) {
  const counts = useMemo(() => {
    const tally: Record<RatingBand, number> = {
      GRADE_1_CRITICAL: 0,
      GRADE_2_MANDATORY: 0,
      GRADE_3_MEETS_STANDARD: 0,
      GRADE_4_EXCEEDS: 0,
      GRADE_5_EXCEPTIONAL: 0,
    };
    for (const r of ratingSeries) {
      tally[classifyRating(r)] += 1;
    }
    return tally;
  }, [ratingSeries]);

  const segments = ORDERED_BANDS.map((band) => ({
    id: band,
    label: RATING_BAND_METADATA[band].shortLabel,
    value: counts[band],
    color: RATING_BAND_METADATA[band].color,
  }));

  const belowThreeCount = useMemo(
    () => ratingSeries.filter((r) => isMandatoryCoachingRounded(r)).length,
    [ratingSeries]
  );

  return (
    <div className="apid-card">
      <div className="boa-card-header">
        <div>
          <h3 className="boa-card-title">Rating Distribution &amp; Coaching Cutoff</h3>
          <p className="boa-card-subtitle">
            Multi-goal scores are averaged per employee and evaluated on{' '}
            <code>RoundedOverallFinalRating &lt; 3</code> (Grades 1–2 require coaching).
          </p>
        </div>
        <DataSourceBadge source="preview" />
      </div>

      <SvgDonutChart
        title="Rounded Overall Rating Bands (1–5)"
        centerValue={belowThreeCount}
        centerLabel="Rounded < 3"
        segments={segments}
      />

      <div className="boa-stack" style={{ marginTop: '1rem', gap: '0.45rem' }}>
        {ORDERED_BANDS.map((band) => {
          const meta = RATING_BAND_METADATA[band];
          return (
            <div
              key={band}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                fontSize: '0.8rem',
                padding: '0.4rem 0.55rem',
                borderRadius: 6,
                background: 'var(--surface-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <StatusPill label={meta.label} tone={meta.tone} />
                <span className="boa-muted">{meta.policyNote}</span>
              </div>
              <strong className="tabular-nums">{counts[band]}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
