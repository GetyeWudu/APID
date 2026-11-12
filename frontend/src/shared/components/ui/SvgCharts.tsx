import { useId, useState } from 'react';

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  secondaryLabel?: string;
  color?: string;
}

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

export function SvgSparkline({
  values,
  title,
  color = '#c97a00',
}: {
  values: number[];
  title: string;
  color?: string;
}) {
  const titleId = useId();
  if (values.length < 2) return null;

  const w = 84;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, idx) => {
      const x = (idx / (values.length - 1)) * (w - 4) + 2;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={titleId}>
      <title id={titleId}>{title}</title>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function SvgHorizontalBarChart({
  title,
  description,
  items,
  maxOverride,
}: {
  title: string;
  description: string;
  items: BarDatum[];
  maxOverride?: number;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const maxVal = maxOverride ?? Math.max(1, ...items.map((i) => i.value));

  return (
    <div role="region" aria-label={title}>
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {description}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {items.map((item) => {
          const pct = Math.min(100, Math.round((item.value / maxVal) * 100));
          const isFocused = focusedId === item.id;
          return (
            <div
              key={item.id}
              tabIndex={0}
              onFocus={() => setFocusedId(item.id)}
              onBlur={() => setFocusedId(null)}
              onMouseEnter={() => setFocusedId(item.id)}
              onMouseLeave={() => setFocusedId(null)}
              style={{
                padding: '0.2rem 0.25rem',
                borderRadius: 6,
                background: isFocused ? 'var(--surface-subtle)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.82rem', marginBottom: '0.28rem', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                <span className="tabular-nums" style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                  <strong>{item.value}</strong>
                  {item.secondaryLabel ? ` · ${item.secondaryLabel}` : ''}
                </span>
              </div>
              <svg width="100%" height="9" viewBox="0 0 100 9" preserveAspectRatio="none" role="img" aria-label={`${item.label}: ${item.value}`}>
                <title>{`${item.label}: ${item.value}`}</title>
                <rect x="0" y="0" width="100" height="9" rx="4.5" fill="#e2e8f0" />
                <rect x="0" y="0" width={Math.max(item.value > 0 ? 3 : 0, pct)} height="9" rx="4.5" fill={item.color ?? '#1e293b'} />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SvgDonutChart({
  title,
  centerLabel,
  centerValue,
  segments,
}: {
  title: string;
  centerLabel: string;
  centerValue: string | number;
  segments: DonutSegment[];
}) {
  const titleId = useId();
  const [activeSeg, setActiveSeg] = useState<string | null>(null);
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
      <svg width="112" height="112" viewBox="0 0 100 100" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{title}</title>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        {segments.map((seg) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const dashOffset = -cumulativeOffset;
          cumulativeOffset += dash;
          return (
            <circle
              key={seg.id}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={activeSeg === seg.id ? 14 : 12}
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
            />
          );
        })}
        <text x="50" y="48" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0f172a">
          {centerValue}
        </text>
        <text x="50" y="61" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#64748b">
          {centerLabel}
        </text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, minWidth: 165 }}>
        {segments.map((seg) => {
          const pct = Math.round((seg.value / total) * 100);
          return (
            <button
              key={seg.id}
              type="button"
              onMouseEnter={() => setActiveSeg(seg.id)}
              onMouseLeave={() => setActiveSeg(null)}
              onFocus={() => setActiveSeg(seg.id)}
              onBlur={() => setActiveSeg(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                border: '1px solid transparent',
                background: activeSeg === seg.id ? 'var(--surface-subtle)' : 'transparent',
                padding: '0.25rem 0.45rem',
                borderRadius: 6,
                cursor: 'default',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: seg.color, flexShrink: 0 }} />
                {seg.label}
              </span>
              <span className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)' }}>
                {seg.value} ({pct}%)
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

