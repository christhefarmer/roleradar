// The Radar mark — Lucide `hat-glasses` (the incognito/scout glyph), used
// verbatim per DESIGN.md. Inlined so the path renders identically everywhere;
// interchangeable with `<HatGlasses />` from lucide-react.
export function HatGlasses({
  size = 24,
  stroke = '#1E8A4F',
  strokeWidth = 2,
}: {
  size?: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: '0 0 auto' }}
    >
      <path d="M14 18a2 2 0 0 0-4 0m9-7l-2.11-6.657a2 2 0 0 0-2.752-1.148l-1.276.61A2 2 0 0 1 12 4H8.5a2 2 0 0 0-1.925 1.456L5 11m-3 0h20" />
      <circle cx="17" cy="18" r="3" />
      <circle cx="7" cy="18" r="3" />
    </svg>
  );
}

/** Radar avatar — the green-filled square with the white hat-glasses mark. */
export function RadarAvatar({ size = 32, iconSize }: { size?: number; iconSize?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'var(--rr-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
      }}
    >
      <HatGlasses size={iconSize ?? Math.round(size * 0.56)} stroke="#fff" />
    </span>
  );
}
