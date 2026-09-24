// Initials avatar. Deterministic neutral graphite tones (no purple identity),
// with subtle per-user variation; depth + rings come from CSS.
export default function Avatar({ name, size = 40 }) {
  const label = String(name || '?').trim();
  const initials = label
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) % 100;
  const light = 30 + (hash % 12); // 30–41%: calm graphite range
  const sat = 10 + (hash % 8); // 10–17%: near-neutral, faint cool tint
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34), background: `linear-gradient(135deg, hsl(222 ${sat}% ${light + 6}%), hsl(224 ${sat + 4}% ${light - 6}%))` }}
    >
      {initials}
    </span>
  );
}
