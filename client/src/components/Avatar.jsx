// Initials placeholder avatar (no uploads in Phase 6).
// Deterministic hue from the name so each user keeps one color.
export default function Avatar({ name, size = 40 }) {
  const label = String(name || '?').trim();
  const initials = label
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) % 360;
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.36), background: `hsl(${hash} 55% 38%)` }}
    >
      {initials}
    </span>
  );
}
