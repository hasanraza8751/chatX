// Shared language constants + target resolution (presentation only).
// No API calls here; the backend owns detection and translation.
export const LANGUAGES = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
};

export const LANGUAGE_CODES = Object.keys(LANGUAGES);

export const TRANSLATION_MODES = {
  off: 'Off',
  ask: 'Ask before translating',
  auto: 'Automatically translate',
};

export function languageName(code) {
  if (!code) return '';
  const [base, form] = String(code).split('-');
  const name = LANGUAGES[base] || base;
  // Romanized input displays as e.g. "Hindi (Romanized)"; plain codes unchanged.
  if (form && form.toLowerCase() === 'latn' && LANGUAGES[base]) return `${name} (Romanized)`;
  return name;
}

// Resolve the effective translation target for a conversation:
// per-conversation override (mine) -> my translationTarget -> my preferredLanguage -> en.
export function resolveTarget(user, conv) {
  const overrides = conv?.languageOverrides || [];
  const mine = overrides.find((o) => String(o.userId || o.user_id) === String(user?._id));
  if (mine && LANGUAGES[mine.targetLanguage]) return mine.targetLanguage;
  if (user?.translationTarget && LANGUAGES[user.translationTarget]) return user.translationTarget;
  if (user?.preferredLanguage && LANGUAGES[user.preferredLanguage]) return user.preferredLanguage;
  return 'en';
}

export function translationMode(user) {
  return user?.translationMode || 'off';
}
