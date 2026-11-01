// Translation service (backend-only — credentials never reach the frontend).
// Clean abstraction: detectLanguage() + translateText(), provider chain behind it.
//
// Chain: conversational phrasebook (offline, natural phrasing for romanized /
// slang input) -> Google Cloud Translate (if GOOGLE_TRANSLATE_API_KEY is set)
// -> MyMemory free tier (no key, rate-limited) -> graceful failure.
// Set TRANSLATION_PROVIDER=phrasebook|google|mymemory to pin one provider
// (useful for tests); default 'auto' walks the chain in the order above.

const { detectLanguage, SUPPORTED } = require('./languageDetect');
const { normalizeRomanized } = require('./romanizedTranslation.service');

// sourceForm labels for response metadata (spec: native|romanized|mixed|english).
function formOf(detected) {
  if (!detected || detected.code === 'en') return 'english';
  if (detected.script === 'native' && !detected.mixed) return 'native';
  if (detected.script === 'latn' && !detected.mixed) return 'romanized';
  return 'mixed';
}

function confidenceOf(detected) {
  return { high: 0.95, medium: 0.85, low: 0.7, given: 0.9 }[detected && detected.confidence] || 0.7;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[।?!.,;:…"“”‘’'()\[\]{}—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Conversational phrase layer: natural translations for common chat phrasing
// (native + romanized + code-mixed), so slang is NOT translated word-by-word.
// Key: normalized input. Value: { en?, hi?, bn?, ta? }.
const PHRASES = {
  'তুমি কেমন আছো': { en: 'How are you?', hi: 'तुम कैसे हो?', ta: 'நீ எப்படி இருக்கிறாய்?', bn: 'তুমি কেমন আছো?' },
  'তুমি কোথায় আছো': { en: 'Where are you?', hi: 'तुम कहाँ हो?', ta: 'நீ எங்கே இருக்கிறாய்?', bn: 'তুমি কোথায় আছো?' },
  'তুমি কি করছো': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', ta: 'நீ என்ன செய்கிறாய்?', bn: 'তুমি কি করছো?' },
  'আজ college যাবি': { en: 'Are you going to college today?', hi: 'आज कॉलेज जा रहे हो?', ta: 'இன்று கல்லூரிக்கு போறியா?', bn: 'আজ college যাবি?' },
  'তুমি কেমন আছো bro': { en: 'How are you, bro?', hi: 'और भाई, कैसे हो?', ta: 'நீ எப்படி இருக்கிறாய்?', bn: 'তুমি কেমন আছো bro?' },
  'तुम कैसे हो': { en: 'How are you?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?', hi: 'तुम कैसे हो?' },
  'तुम कहाँ हो': { en: 'Where are you?', bn: 'তুমি কোথায় আছো?', ta: 'நீ எங்கே இருக்கிறாய்?', hi: 'तुम कहाँ हो?' },
  'तुम क्या कर रहे हो': { en: 'What are you doing?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?', hi: 'तुम क्या कर रहे हो?' },
  'आज college जा रहे हो': { en: 'Are you going to college today?', bn: 'আজ college যাবি?', ta: 'இன்று கல்லூரிக்கு போறியா?', hi: 'आज college जा रहे हो?' },
  'तुम क्या कर रहे हो bro': { en: 'What are you doing, bro?', bn: 'তুমি কি করছো bro?', ta: 'நீ என்ன செய்கிறாய்?', hi: 'तुम क्या कर रहे हो bro?' },
  'நீ எப்படி இருக்கிறாய்': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'நீ எங்கே இருக்கிறாய்': { en: 'Where are you?', hi: 'तुम कहाँ हो?', bn: 'তুমি কোথায় আছো?', ta: 'நீ எங்கே இருக்கிறாய்?' },
  'நான் college போறேன்': { en: "I'm going to college.", hi: 'मैं कॉलेज जा रहा हूँ।', bn: 'আমি college যাচ্ছি।', ta: 'நான் college போறேன்.' },
  'tumi kemon acho': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'tumi kothay acho': { en: 'Where are you?', hi: 'तुम कहाँ हो?', bn: 'তুমি কোথায় আছো?', ta: 'நீ எங்கே இருக்கிறாய்?' },
  'tumi ki korcho': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'tumi kemon acho bro': { en: 'How are you, bro?', hi: 'और भाई, कैसे हो?', bn: 'তুমি কেমন আছো bro?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'tumi kothay acho bro': { en: 'Where are you, bro?', hi: 'तुम कहाँ हो bro?', bn: 'তুমি কোথায় আছো bro?', ta: 'நீ எங்கே இருக்கிறாய்?' },
  'tumi ajke college jabe': { en: 'Are you going to college today?', hi: 'आज कॉलेज जा रहे हो?', bn: 'আজ college যাবি?', ta: 'இன்று கல்லூரிக்கு போறியா?' },
  'tum kya kar rahe ho': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'tum kaha ho': { en: 'Where are you?', hi: 'तुम कहाँ हो?', bn: 'তুমি কোথায় আছো?', ta: 'நீ எங்கே இருக்கிறாய்?' },
  'tum kaise ho': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'tum kya kar rahe ho bro': { en: 'What are you doing, bro?', hi: 'तुम क्या कर रहे हो bro?', bn: 'তুমি কি করছো bro?', ta: 'நீ என்ன செய்கிறாய்?' },
  'bro aaj college ja raha hai': { en: "Bro is going to college today.", hi: 'Bro आज कॉलेज जा रहा है।', bn: 'Bro আজ college যাচ্ছে।', ta: 'Bro இன்று கல்லூரிக்கு போறான்.' },
  'yaar kya scene hai': { en: "What's going on?", hi: 'यार क्या सीन है?', bn: 'কি খবর?', ta: 'என்ன நடக்குது?' },
  'nee enna panra': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'nee enga irukka': { en: 'Where are you?', hi: 'तुम कहाँ हो?', bn: 'তুমি কোথায় আছো?', ta: 'நீ எங்கே இருக்கிறாய்?' },
  'nee enga irukka bro': { en: 'Where are you, bro?', hi: 'तुम कहाँ हो bro?', bn: 'তুমি কোথায় আছো bro?', ta: 'நீ எங்கே இருக்கிறாய்?' },
  'nee eppadi irukka': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'how are you': { hi: 'आप कैसे हैं?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?', en: 'How are you?' },
  'how are you bro': { hi: 'और भाई, कैसे हो?', bn: 'তুমি কেমন আছো bro?', ta: 'நீ எப்படி இருக்கிறாய்?', en: 'How are you, bro?' },
  'where are you': { hi: 'तुम कहाँ हो?', bn: 'তুমি কোথায় আছো?', ta: 'நீ எங்கே இருக்கிறாய்?', en: 'Where are you?' },
  'what are you doing': { hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?', en: 'What are you doing?' },
  // Romanized Bengali spelling variants + short conversational forms.
  'kemon achhe': { en: 'How are you?', hi: 'कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'kemon achho': { en: 'How are you?', hi: 'कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'ki korcho': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'ki korchho': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'ami bhalo achi': { en: "I'm good.", hi: 'मैं ठीक हूँ।', bn: 'আমি ভালো আছি।', ta: 'நான் நன்றாக இருக்கிறேன்।' },
  'bhalo achi': { en: "I'm good.", hi: 'मैं ठीक हूँ।', bn: 'আমি ভালো আছি।', ta: 'நான் நன்றாக இருக்கிறேன்।' },
  'tumi kothay': { en: 'Where are you?', hi: 'तुम कहाँ हो?', bn: 'তুমি কোথায় আছো?', ta: 'நீ எங்கே இருக்கிறாய்?' },
  'ki holo': { en: 'What happened?', hi: 'क्या हुआ?', bn: 'কি হলো?', ta: 'என்ன ஆச்சு?' },
  // Romanized Hindi short forms.
  'kaise ho': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'kaise ho bhai': { en: 'How are you, brother?', hi: 'तुम कैसे हो भाई?', bn: 'কেমন আছো ভাই?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'kya kar rha hai': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'main theek hu': { en: "I'm fine.", hi: 'मैं ठीक हूँ।', bn: 'আমি ভালো আছি।', ta: 'நான் நன்றாக இருக்கிறேன்।' },
  'mujhe nahi pata': { en: "I don't know.", hi: 'मुझे नहीं पता।', bn: 'আমি জানি না।', ta: 'எனக்கு தெரியாது.' },
  // Romanized Tamil short forms.
  'epdi iruka': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'enna panra': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কি করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'nee epdi iruka': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'naan nalla iruken': { en: "I'm good.", hi: 'मैं ठीक हूँ।', bn: 'আমি ভালো আছি।', ta: 'நான் நன்றாக இருக்கிறேன்।' },
  // Bare native forms (no pronoun).
  'কেমন আছো': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'आप कैसे हो': { en: 'How are you?', hi: 'आप कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'நீ எப்படி இருக்கிறாய்?' },
  'எப்படி இருக்கிறாய்': { en: 'How are you?', hi: 'तुम कैसे हो?', bn: 'তুমি কেমন আছো?', ta: 'எப்படி இருக்கிறாய்?' },
  // Abbreviated / code-mixed high-frequency forms (optimization; arbitrary
  // sentences flow through normalization + providers instead).
  'tum kya kar rhe ho': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কী করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'tum kya kr rhe ho': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কী করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'kya kar rhe ho': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কী করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'what kar rahe ho': { en: 'What are you doing?', hi: 'तुम क्या कर रहे हो?', bn: 'তুমি কী করছো?', ta: 'நீ என்ன செய்கிறாய்?' },
  'bhai kal office jana hai': { en: 'Brother, I have to go to the office tomorrow.', hi: 'भाई, कल ऑफिस जाना है।', bn: 'ভাই, কাল অফিসে যেতে হবে।', ta: 'அண்ணா, நாளை அலுவலகம் போக வேண்டும்.' },
  'ami kal college jabo': { en: "I'm going to college tomorrow.", hi: 'मैं कल कॉलेज जाऊँगा।', bn: 'আমি কাল college যাবো।', ta: 'நான் நாளை கல்லூரிக்கு போகிறேன்.' },
  'naan college pogiren': { en: "I'm going to college.", hi: 'मैं कॉलेज जा रहा हूँ।', bn: 'আমি college যাচ্ছি।', ta: 'நான் கல்லூரிக்கு போகிறேன்।' },
  'nee enga pora': { en: 'Where are you going?', hi: 'तुम कहाँ जा रहे हो?', bn: 'তুমি কোথায় যাচ্ছো?', ta: 'நீ எங்கே போகிறாய்?' },
  'tum kal aaoge': { en: 'Will you come tomorrow?', hi: 'तुम कल आओगे?', bn: 'তুমি কি কাল আসবে?', ta: 'நீ நாளை வருவாயா?' },
  'tumhara project kaisa chal raha hai': { en: 'How is your project going?', hi: 'तुम्हारा project कैसा चल रहा है?', bn: 'তোমার project কেমন চলছে?', ta: 'உன் project எப்படி போகிறது?' },
  'bhai kal milte hain': { en: 'Brother, see you tomorrow.', hi: 'भाई, कल मिलते हैं।', bn: 'ভাই, কাল দেখা হবে।', ta: 'அண்ணா, நாளை சந்திப்போம்।' },
  'naan busy ah iruken': { en: "I'm busy right now.", hi: 'मैं अभी busy हूँ।', bn: 'আমি এখন busy আছি।', ta: 'நான் இப்போது busy ஆக இருக்கிறேன்।' },
  'ami ki korbo': { en: 'What should I do?', hi: 'मैं क्या करूँ?', bn: 'আমি কি করবো?', ta: 'நான் என்ன செய்ய வேண்டும்?' },
  'tum kal office ja rahe ho': { en: 'Are you going to the office tomorrow?', hi: 'तुम कल office जा रहे हो?', bn: 'তুমি কি কাল অফিসে যাচ্ছো?', ta: 'நீ நாளை அலுவலகம் போகிறாயா?' },
  'i am going to college': { en: 'I am going to college.', hi: 'मैं कॉलेज जा रहा हूँ।', bn: 'আমি college যাচ্ছি।', ta: 'நான் கல்லூரிக்கு போகிறேன்।' },
  'tumne khana khaya': { en: 'Did you eat?', hi: 'तुमने खाना खाया?', bn: 'তুমি কি খেয়েছো?', ta: 'நீ சாப்பிட்டாயா?' },
};

function phrasebook(text, target) {
  const entry = PHRASES[normalize(text)];
  if (entry && entry[target]) return entry[target];
  return null;
}

function providerName() {
  return String(process.env.TRANSLATION_PROVIDER || 'auto').toLowerCase();
}

function googleKey() {
  return process.env.GOOGLE_TRANSLATE_API_KEY || '';
}

async function fetchWithTimeout(url, options, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function unescapeHtml(s) {
  return String(s || '')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Google Cloud Translate v2. Explicit source helps romanized input
// (Google resolves Hinglish/Banglish/Tanglish latin text well).
// Pass source as undefined to let Google auto-detect (used as a second
// attempt for romanized input when the explicit-source result is rejected).
async function googleTranslate(text, source, target) {
  const key = googleKey();
  if (!key) return null;
  const body = { q: text, target, format: 'text' };
  if (source) body.source = source;
  const res = await fetchWithTimeout(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`google translate failed: ${res.status}`);
  const data = await res.json();
  const out = data && data.data && data.data.translations && data.data.translations[0];
  if (!out || !out.translatedText) throw new Error('google translate empty response');
  return unescapeHtml(out.translatedText).trim();
}

// MyMemory free tier (no key). Quality varies for Indic pairs —
// documented fallback when no Google key is configured.
//
// IMPORTANT: responseData.translatedText is NOT trusted blindly. MyMemory's
// translation memory contains crowdsourced entries, and the top hit can be a
// completely unrelated sentence (observed: "did you eat?" -> "मैं आज स्कूल
// नहीं आऊंगा, कल आऊंगा"). So candidates whose segment exactly matches the
// query are collected from matches[], back-translated into the source
// language, and only accepted when the round-trip overlaps the input.
// This uses the same provider (no new dependency, no new architecture).
async function myMemoryRaw(text, source, target) {
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(source)}|${encodeURIComponent(target)}`;
  const res = await fetchWithTimeout(url, { method: 'GET' });
  if (!res.ok) throw new Error(`mymemory failed: ${res.status}`);
  const data = await res.json();
  if (data.responseStatus === 429) throw new Error('mymemory rate limited');
  return data;
}

function normalizeSegment(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[।?!.,;:…"“”‘’'()\[\]{}—–\-•·>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Exact-segment candidates from the matches array, deduped (best wins).
function exactCandidates(query, data) {
  const q = normalizeSegment(query);
  if (!q) return [];
  const matches = Array.isArray(data && data.matches) ? data.matches : [];
  const byText = new Map();
  for (const m of matches) {
    if (!m || typeof m.translation !== 'string' || !m.translation.trim()) continue;
    if (normalizeSegment(m.segment) !== q) continue;
    const key = m.translation.trim();
    const quality = parseFloat(m.quality);
    const usage = parseInt(m['usage-count'], 10);
    const prev = byText.get(key);
    const cur = {
      text: key,
      quality: Number.isFinite(quality) ? quality : 0,
      usage: Number.isFinite(usage) ? usage : 0,
    };
    if (!prev || cur.quality > prev.quality || (cur.quality === prev.quality && cur.usage > prev.usage)) {
      byText.set(key, cur);
    }
  }
  return [...byText.values()];
}

function contentTokens(s) {
  return (String(s || '').toLowerCase().match(/[a-z\u0900-\u097f\u0980-\u09ff\u0b80-\u0bff]{2,}/g) || []);
}

// Round-trip overlap between an original query and a candidate's
// back-translation. Exported for unit tests (documents the signal that
// MyMemory's symmetrically polluted memory defeats, which is why selection
// uses segment-exactness + guard + length checks instead).
function overlapScore(query, backTranslated) {
  const q = contentTokens(query);
  if (q.length === 0) return 0;
  const back = new Set(contentTokens(backTranslated));
  return q.filter((t) => back.has(t)).length / q.length;
}

// Word-count plausibility: a genuine translation of a 2+ word message is
// rarely more than ~2x as long. Catches fluent-but-unrelated TM entries
// (e.g. 3-word "did you eat?" -> 7-word school sentence). No lower bound —
// good translations can be terse ("Thank you" -> "धन्यवाद").
function isImplausibleLength(input, result) {
  const inWords = String(input).trim().split(/\s+/).filter(Boolean).length;
  const outWords = String(result).trim().split(/\s+/).filter(Boolean).length;
  return inWords >= 2 && outWords > Math.max(3, 2.2 * inWords);
}

function sanitizeProviderText(s) {
  // Strip translation-memory artifacts (leading "- ", bullets) + collapse space.
  return String(s || '').replace(/^\s*[-•·–—>]+\s*/, '').replace(/\s+/g, ' ').trim();
}

async function myMemoryTranslate(text, source, target, script) {
  const data = await myMemoryRaw(text, source, target);
  // Prefer exact-segment candidates that are plausible; rank by quality,
  // then usage. Falls back to the top response only if it is plausible.
  const pool = exactCandidates(text, data);
  const top = data && data.responseData && data.responseData.translatedText;
  if (top && String(top).trim() && !pool.some((c) => c.text === String(top).trim())) {
    pool.push({ text: String(top).trim(), quality: 0, usage: 0 });
  }
  pool.sort((a, b) => b.quality - a.quality || b.usage - a.usage);
  for (const c of pool) {
    const clean = sanitizeProviderText(c.text);
    if (!clean) continue;
    if (isTransliteration(text, clean, { sourceCode: source, sourceScript: script || 'latn', target })) continue;
    if (isImplausibleLength(text, clean)) continue;
    return clean;
  }
  throw new Error('mymemory candidates failed verification');
}

// ---------------------------------------------------------------------------
// Transliteration guard: a provider result that merely converts script
// ("kemon achhe" -> "केमोन अछे") is NOT a semantic translation and must be
// rejected so the chain can try the next provider (or fail gracefully into
// the UI's "Translation unavailable" state). Wrong translation is worse than
// no translation.
// ---------------------------------------------------------------------------

// High-frequency function words per target language. A genuine multi-word
// translation almost always contains at least one of these; a phonetic
// script-conversion contains none.
const TARGET_FUNCTION_WORDS = {
  hi: new Set('है हो हैं हूँ नहीं क्या कैसे कहाँ कौन तुम मैं हम और लेकिन यह वह ये वो का की के को से में पर भी तो ही अच्छा बहुत'.split(' ')),
  bn: new Set('কি কেমন কোথায় কবে কেন তুমি তুই আমি আমরা না নেই হয় হয়েছে আছে আছো আছি করছো খুব ভালো আর এবং এই সেই কে থেকে জন্য মতো সাথে'.split(' ')),
  ta: new Set('என்ன எங்கே எப்படி எப்போது ஏன் நீ நான் நாங்கள் இல்லை இருக்கிறாய் இருக்கிறேன் மிகவும் நல்ல மற்றும் இந்த அந்த'.split(' ')),
  en: new Set('is are was were you your how what where when why who the and going doing today hello bro good very not no'.split(' ')),
};

// Loanwords legitimately retained across scripts (must not trigger the guard).
const LOANWORDS = new Set('bro college school office bus hello hey ok okay sorry thanks please mama papa didi bhai project video photo phone mobile'.split(' '));

function latinTokensOf(s) {
  return (String(s || '').toLowerCase().match(/[a-z]{2,}/g) || []);
}

function echoOf(a, b) {
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[।?!.,;:…"“”‘’'()\[\]{}—–-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return norm(a) === norm(b);
}

// Returns true when `result` looks like a script conversion of `input`
// rather than a semantic translation into `target`.
function isTransliteration(input, result, { sourceCode, sourceScript, target }) {
  if (!result || !String(result).trim()) return true;
  // Provider echoed the input (common free-tier failure): always wrong.
  if (echoOf(input, result)) return true;
  const inLatin = latinTokensOf(input);
  const outLatin = latinTokensOf(result);
  if (target === 'en') {
    // A semantic English translation shares (almost) no words with romanized
    // Indic input; a transliteration echoes most of them ("Epdi iruka").
    if (inLatin.length > 0 && outLatin.length > 0) {
      const inputSet = new Set(inLatin);
      const overlap = outLatin.filter((w) => inputSet.has(w)).length / outLatin.length;
      if (overlap >= 0.6) return true;
    }
    return false;
  }
  // Non-Latin target: a result dominated by non-loanword Latin means the
  // provider gave up (e.g. native Tamil -> Hindi returning "kya rey").
  // Genuine loanwords ("college", "bro") are exempt; threshold keeps
  // mostly-native results with one retained loanword passing.
  if (target !== 'en') {
    const outWords = String(result).trim().split(/\s+/).filter(Boolean);
    const latinOut = outWords.filter((w) => /[a-zA-Z]/.test(w) && !LOANWORDS.has(w.toLowerCase()));
    if (latinOut.length > 0 && latinOut.length / outWords.length >= 0.5) return true;
  }
  // Romanized sources only (native-script providers are generally semantic):
  // same word count, 2+ words, and zero target function words present.
  if (sourceScript === 'latn' && sourceCode !== 'en') {
    const inWords = String(input).trim().split(/\s+/).filter(Boolean);
    const outWords = String(result).trim().split(/\s+/).filter(Boolean);
    if (inWords.length >= 2 && inWords.length === outWords.length) {
      const lex = TARGET_FUNCTION_WORDS[target] || new Set();
      const hits = outWords.filter((w) => lex.has(w)).length;
      if (hits === 0) return true;
    }
  }
  return false;
}

// Debug trace (development only). Never logs keys, tokens, or credentials —
function logTrace(fields) {
  if (process.env.NODE_ENV === 'production') return;
  const short = (s) => {
    const t = String(s == null ? '' : s);
    return t.length > 120 ? t.slice(0, 120) + '…' : t;
  };
  console.log(
    '[Translation]',
    `source: "${short(fields.sourceText)}"`,
    `detected: ${fields.detected}`,
    `confidence: ${fields.confidence}`,
    `normalized: ${fields.normalized}`,
    `target: ${fields.target}`,
    `provider: ${fields.provider}`,
    `result: "${short(fields.result)}"`
  );
}

// Main entry: { translatedText, sourceLanguage, provider } or throws.
// sourceLanguage is the detected base code ('en'|'hi'|'bn'|'ta');
// callers append '-Latn' for romanized input when presenting to users.
async function translateText(text, { source, script, target }) {
  const content = String(text || '').trim();
  if (!content) throw new Error('Nothing to translate.');
  if (!SUPPORTED.includes(target)) throw new Error('Unsupported target language.');
  const detected = source && SUPPORTED.includes(source) ? { code: source, script: script === 'native' ? 'native' : 'latn', confidence: 'given' } : detectLanguage(content);
  const sourceCode = detected.code;
  const sourceScript = detected.script || 'latn';
  const sourceTag = sourceScript === 'latn' && sourceCode !== 'en' ? `${sourceCode}-Latn` : sourceCode;
  const trace = { sourceText: content, detected: sourceTag, confidence: detected.confidence || 'n/a', normalized: '', target, provider: '', result: '' };
  const sourceForm = formOf(detected);
  if (sourceCode === target) {
    trace.provider = 'none (same language)';
    trace.result = content;
    logTrace(trace);
    return { translatedText: content, sourceLanguage: sourceCode, provider: 'none', sameLanguage: true, sourceForm, confidence: confidenceOf(detected) };
  }
  // Conversational phrase layer first: natural phrasing for slang/romanized input.
  const pinned = providerName();
  const phrase = phrasebook(content, target);
  if (phrase && (pinned === 'auto' || pinned === 'phrasebook')) {
    trace.provider = 'phrasebook';
    trace.result = phrase;
    logTrace(trace);
    return { translatedText: phrase, sourceLanguage: sourceCode, provider: 'phrasebook', sourceForm, confidence: confidenceOf(detected) };
  }
  if (pinned === 'phrasebook') {
    trace.provider = 'phrasebook (miss)';
    logTrace(trace);
    throw new Error('No phrasebook entry.');
  }
  // Romanized / code-mixed normalization (second layer): convert romanized
  // input into canonical NATIVE-SCRIPT source text so providers receive a
  // meaningful representation instead of raw ambiguous romanized text.
  // Order stays: phrasebook -> normalization -> provider -> guard -> cache.
  // Low-coverage input throws UNRELIABLE_SOURCE: callers must surface a
  // friendly message, never a confidently wrong translation.
  let providerInput = content;
  let guardScript = sourceScript;
  let normForm = sourceForm;
  let normConfidence = confidenceOf(detected);
  const romanized = sourceScript === 'latn' && sourceCode !== 'en';
  const nativeMixed = sourceScript === 'native' && detected.mixed && /[a-zA-Z]/.test(content);
  if ((romanized || nativeMixed) && pinned !== 'phrasebook') {
    const norm = normalizeRomanized(content, detected);
    providerInput = norm.normalizedText;
    guardScript = 'native'; // normalized text is native-script source now
    normForm = norm.sourceForm;
    normConfidence = norm.confidence;
    trace.normalized = norm.normalizedText;
    trace.detected = `${sourceTag}/${norm.sourceForm}`;
  }
  // Provider chain. For romanized input Google is additionally tried with
  // auto-detect (no explicit source): Google often resolves romanized Indic
  // text semantically on its own. Every candidate passes the transliteration
  // guard — a rejected result continues the chain instead of being returned.
  // NOTE: providers receive providerInput (normalized native-script text when
  // normalization applied), never raw ambiguous romanized text.
  const chain = [];
  if (pinned === 'auto' || pinned === 'google') {
    chain.push(['google', (t) => googleTranslate(t, sourceCode, target)]);
    if (romanized) chain.push(['google-auto', (t) => googleTranslate(t, undefined, target)]);
  }
  if (pinned === 'auto' || pinned === 'mymemory') chain.push(['mymemory', (t) => myMemoryTranslate(t, sourceCode, target, guardScript)]);
  if (chain.length === 0) throw new Error(`Unknown TRANSLATION_PROVIDER: ${pinned}`);
  const attempt = async (name, fn) => {
    const translatedText = await fn(providerInput);
    if (!translatedText) throw new Error(`${name} empty response`);
    if (isTransliteration(providerInput, translatedText, { sourceCode, sourceScript: guardScript, target })) {
      throw new Error(`${name} returned transliteration, not translation`);
    }
    return { translatedText, sourceLanguage: sourceCode, provider: name, sourceForm: normForm, confidence: normConfidence };
  };
  let lastErr = null;
  for (const [name, fn] of chain) {
    try {
      const out = await attempt(name, fn);
      trace.provider = out.provider;
      trace.result = out.translatedText;
      logTrace(trace);
      return out;
    } catch (err) {
      lastErr = err;
    }
  }
  trace.provider = 'all failed';
  trace.result = lastErr ? lastErr.message : '';
  logTrace(trace);
  throw lastErr || new Error('Translation failed.');
}

module.exports = { translateText, detectLanguage, phrasebook, isTransliteration, SUPPORTED, exactCandidates, overlapScore, sanitizeProviderText, normalizeSegment, isImplausibleLength };
