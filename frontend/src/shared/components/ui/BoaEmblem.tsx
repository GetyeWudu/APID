interface BoaEmblemProps {
  size?: number;
  className?: string;
  variant?: 'solid-dark' | 'solid-gold' | 'flat-gold' | 'monochrome';
  withGlow?: boolean;
}

/**
 * Official Bank of Abyssinia Adey Abeba (Bidens macroptera) 6-Petaled Emblem
 * Authentically rendered as an obsidian square with a six-pointed diamond petal flower.
 */
export function BoaEmblem({
  size = 36,
  className = '',
  variant = 'solid-dark',
  withGlow = false,
}: BoaEmblemProps) {
  const gradientId = `boa-gold-grad-${size}`;
  const glowFilterId = `boa-gold-glow-${size}`;

  // Geometry for 6 symmetrical diamond petals at 60 degree increments
  // Center: (24, 24). R_inner = 5, R_outer = 19, Width = 6
  const petals = [0, 60, 120, 180, 240, 300].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const radMid = ((deg + 90) * Math.PI) / 180;
    const cx = 24;
    const cy = 24;
    const rIn = 4.5;
    const rOut = 19;
    const rWidth = 4.6;
    const midDist = 11.5;

    const tipX = (cx + rOut * Math.cos(rad)).toFixed(2);
    const tipY = (cy + rOut * Math.sin(rad)).toFixed(2);
    const baseX = (cx + rIn * Math.cos(rad)).toFixed(2);
    const baseY = (cy + rIn * Math.sin(rad)).toFixed(2);

    const leftX = (cx + midDist * Math.cos(rad) + rWidth * Math.cos(radMid)).toFixed(2);
    const leftY = (cy + midDist * Math.sin(rad) + rWidth * Math.sin(radMid)).toFixed(2);

    const rightX = (cx + midDist * Math.cos(rad) - rWidth * Math.cos(radMid)).toFixed(2);
    const rightY = (cy + midDist * Math.sin(rad) - rWidth * Math.sin(radMid)).toFixed(2);

    return `M ${baseX} ${baseY} L ${leftX} ${leftY} L ${tipX} ${tipY} L ${rightX} ${rightY} Z`;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`boa-emblem-svg ${className}`}
      style={{
        flexShrink: 0,
        filter: withGlow ? `drop-shadow(0 0 10px rgba(245, 183, 0, 0.45))` : undefined,
      }}
      aria-label="Bank of Abyssinia Adey Abeba Emblem"
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5B700" />
          <stop offset="50%" stopColor="#ED9F00" />
          <stop offset="100%" stopColor="#C97A00" />
        </linearGradient>
        {withGlow && (
          <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Outer Executive Shield / Rounded Obsidian Base */}
      {variant === 'solid-dark' && (
        <>
          <rect
            x="2"
            y="2"
            width="44"
            height="44"
            rx="11"
            fill="#0B0F19"
            stroke="rgba(245, 183, 0, 0.3)"
            strokeWidth="1.2"
          />
          {/* Subtle inner highlight rim */}
          <rect
            x="3.2"
            y="3.2"
            width="41.6"
            height="41.6"
            rx="9.8"
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="1"
          />
        </>
      )}

      {variant === 'solid-gold' && (
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="11"
          fill={`url(#${gradientId})`}
          stroke="#0B0F19"
          strokeWidth="1.2"
        />
      )}

      {/* The 6 Adey Abeba Petals */}
      <g
        fill={
          variant === 'solid-gold'
            ? '#0B0F19'
            : variant === 'monochrome'
            ? 'currentColor'
            : `url(#${gradientId})`
        }
      >
        {petals.map((d, idx) => (
          <path key={idx} d={d} />
        ))}
        {/* Core Center Flower Center Diamond */}
        <circle
          cx="24"
          cy="24"
          r="3"
          fill={
            variant === 'solid-gold'
              ? '#0B0F19'
              : variant === 'monochrome'
              ? 'currentColor'
              : '#FFDB58'
          }
        />
      </g>
    </svg>
  );
}

export function BoaBrandHeader({
  compact = false,
  subtitle = 'Abyssinia People Intelligence & Development',
  light = false,
}: {
  compact?: boolean;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0.55rem' : '0.85rem',
        textDecoration: 'none',
        userSelect: 'none',
      }}
    >
      <BoaEmblem size={compact ? 32 : 40} variant="solid-dark" withGlow={!light} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            lineHeight: 1.15,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: compact ? '0.98rem' : '1.15rem',
              letterSpacing: '-0.02em',
              color: light ? '#FFFFFF' : 'var(--text)',
            }}
          >
            Bank of Abyssinia
          </span>
          <span
            style={{
              fontSize: compact ? '0.68rem' : '0.74rem',
              fontWeight: 800,
              padding: '0.12rem 0.42rem',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #F5B700 0%, #C97A00 100%)',
              color: '#0B0F19',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            APID
          </span>
        </div>
        <span
          style={{
            fontSize: compact ? '0.68rem' : '0.76rem',
            color: light ? '#94A3B8' : 'var(--muted)',
            fontWeight: 500,
            letterSpacing: '0.01em',
            marginTop: '0.18rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subtitle}
        </span>
      </div>
    </div>
  );
}
