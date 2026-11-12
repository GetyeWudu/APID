const AVATAR_TONES = [
  { bg: '#fef3c7', fg: '#92400e' },
  { bg: '#e0e7ff', fg: '#3730a3' },
  { bg: '#dcfce7', fg: '#166534' },
  { bg: '#f1f5f9', fg: '#334155' },
  { bg: '#fce7f3', fg: '#9d174d' },
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AvatarBadge({
  name,
  size = 34,
}: {
  name: string;
  size?: number;
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const palette = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];

  return (
    <span
      className="boa-avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: palette.bg,
        color: palette.fg,
        fontSize: `${Math.max(11, Math.round(size * 0.36))}px`,
      }}
    >
      {getInitials(name)}
    </span>
  );
}

