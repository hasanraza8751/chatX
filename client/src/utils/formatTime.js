// Tiny time helpers for the messenger UI (no new dependency).
export function formatClock(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatPreview(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (dayDiff <= 0) return formatClock(iso);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) {
    try {
      return d.toLocaleDateString([], { weekday: 'short' });
    } catch {
      return formatClock(iso);
    }
  }
  try {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return formatClock(iso);
  }
}

// Coarse last-seen text (deliberately imprecise, per privacy requirements).
export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Last seen recently';
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (Number.isNaN(diff) || diff < 60000) return 'Last seen recently';
  const d = new Date(lastSeen);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (dayDiff <= 0) return `Last seen ${formatClock(lastSeen)}`;
  if (dayDiff === 1) return 'Last seen yesterday';
  try {
    return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  } catch {
    return 'Last seen recently';
  }
}
