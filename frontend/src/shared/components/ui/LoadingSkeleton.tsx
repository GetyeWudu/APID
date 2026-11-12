export function LoadingSkeleton({
  rows = 4,
  height = 18,
}: {
  rows?: number;
  height?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }} aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="boa-skeleton"
          style={{
            height,
            width: i === rows - 1 ? '68%' : '100%',
          }}
        />
      ))}
    </div>
  );
}

