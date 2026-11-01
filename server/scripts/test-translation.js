// Translation regression tests: detection + phrasebook + transliteration guard.
// Run: node scripts/test-translation.js [--live]
// Default is fully offline (phrasebook-pinned + pure functions).
// --live also exercises the real provider chain (needs network; MyMemory only).
const assert = require('assert');
const { detectLanguage } = require('../src/services/languageDetect');
const { normalizeRomanized } = require('../src/services/romanizedTranslation.service');
const service = require('../src/services/translation.service');

const { phrasebook, isTransliteration, translateText, exactCandidates, sanitizeProviderText, isImplausibleLength } = service;

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    pass += 1;
    console.log('PASS ' + name);
  } catch (err) {
    fail += 1;
    console.log('FAIL ' + name + ' :: ' + err.message);
  }
}

// --- 1. Romanized / native / mixed detection ---
const detectCases = [
  ['kemon achhe', 'bn'], ['kemon acho', 'bn'], ['kemon achho', 'bn'],
  ['tumi kemon acho', 'bn'], ['ki korcho', 'bn'], ['ki korchho', 'bn'],
  ['ami bhalo achi', 'bn'], ['bhalo achi', 'bn'], ['tumi kothay', 'bn'], ['ki holo', 'bn'],
  ['kaise ho', 'hi'], ['kaise ho bhai', 'hi'], ['kya kar rahe ho', 'hi'],
  ['kya kar rha hai', 'hi'], ['main theek hu', 'hi'], ['mujhe nahi pata', 'hi'],
  ['tum kya kar rahe ho bro', 'hi'], ['bro aaj college ja raha hai', 'hi'],
  ['epdi iruka', 'ta'], ['enna panra', 'ta'], ['nee epdi iruka', 'ta'],
  ['naan nalla iruken', 'ta'], ['nee enga irukka bro', 'ta'],
  ['কেমন আছো', 'bn'], ['তুমি কেমন আছো?', 'bn'], ['আজ college যাবি?', 'bn'],
  ['आप कैसे हो', 'hi'], ['तुम कैसे हो?', 'hi'], ['आज college जा रहे हो?', 'hi'],
  ['எப்படி இருக்கிறாய்', 'ta'], ['நீ எப்படி இருக்கிறாய்?', 'ta'], ['நான் college போறேன்', 'ta'],
  ['How are you?', 'en'], ['how are you', 'en'], ['what are you doing', 'en'],
  ['where are you', 'en'], ['bhai kemon acho?', 'bn'], ['yaar kya scene hai', 'hi'],
  ['tum kya kar rhe ho?', 'hi'], ['kya kar rhe ho?', 'hi'], ['tum kya kr rhe ho?', 'hi'],
  ['tumhara project kaisa chal raha hai?', 'hi'], ['tum kal aaoge?', 'hi'],
  ['ami ki korbo?', 'bn'], ['ami kal college jabo', 'bn'],
  ['naan busy ah iruken', 'ta'], ['naan college pogiren', 'ta'], ['nee enga pora?', 'ta'],
  ['what kar rahe ho?', 'hi'], ['bhai kal milte hain', 'hi'], ['bhai kal office jana hai', 'hi'],
];
detectCases.forEach(([input, want]) => {
  check(`detect "${input}" -> ${want}`, () => {
    assert.strictEqual(detectLanguage(input).code, want);
  });
});

// Romanized inputs must carry the -Latn distinction via script field.
check('romanized script tag', () => {
  assert.strictEqual(detectLanguage('kemon achhe').script, 'latn');
  assert.strictEqual(detectLanguage('তুমি কেমন আছো?').script, 'native');
});

// --- 2. Phrasebook semantic expectations (spec section 7) ---
const phraseCases = [
  ['তুমি কেমন আছো?', 'en', 'How are you?'],
  ['কেমন আছো', 'en', 'How are you?'],
  ['तुम कैसे हो?', 'en', 'How are you?'],
  ['நீ எப்படி இருக்கிறாய்?', 'en', 'How are you?'],
  ['tumi kemon acho?', 'en', 'How are you?'],
  ['tum kya kar rahe ho?', 'en', 'What are you doing?'],
  ['nee enna panra?', 'en', 'What are you doing?'],
  ['tumi kemon acho bro?', 'en', 'How are you, bro?'],
  ['tum kya kar rahe ho bro?', 'bn', 'তুমি কি করছো bro?'],
  ['nee enga irukka bro?', 'en', 'Where are you, bro?'],
  ['How are you?', 'bn', 'তুমি কেমন আছো?'],
  ['How are you bro?', 'hi', 'और भाई, कैसे हो?'],
  ['আজ college যাবি?', 'en', 'Are you going to college today?'],
  ['आज college जा रहे हो?', 'en', 'Are you going to college today?'],
  ['நான் college போறேன்', 'en', "I'm going to college."],
  ['kemon achhe', 'en', 'How are you?'],
  ['kemon achhe', 'hi', 'कैसे हो?'],
  ['kaise ho bhai', 'en', 'How are you, brother?'],
  ['kaise ho bhai', 'bn', 'কেমন আছো ভাই?'],
  ['epdi iruka', 'en', 'How are you?'],
  ['কেমন আছো', 'en', 'How are you?'],
  ['आप कैसे हो', 'en', 'How are you?'],
  ['எப்படி இருக்கிறாய்', 'en', 'How are you?'],
  ['How are you?', 'hi', 'आप कैसे हैं?'],
  ['yaar kya scene hai', 'en', "What's going on?"],
  ['tumi kothay acho?', 'hi', 'तुम कहाँ हो?'],
  ['tum kya kar rhe ho?', 'bn', 'তুমি কী করছো?'],
  ['tum kya kr rhe ho?', 'bn', 'তুমি কী করছো?'],
  ['what kar rahe ho?', 'bn', 'তুমি কী করছো?'],
  ['bhai kal office jana hai', 'bn', 'ভাই, কাল অফিসে যেতে হবে।'],
  ['ami kal college jabo', 'hi', 'मैं कल कॉलेज जाऊँगा।'],
  ['naan college pogiren', 'en', "I'm going to college."],
  ['nee enga pora?', 'hi', 'तुम कहाँ जा रहे हो?'],
  ['tum kal aaoge?', 'bn', 'তুমি কি কাল আসবে?'],
  ['ami ki korbo?', 'en', 'What should I do?'],
  ['tumhara project kaisa chal raha hai?', 'en', 'How is your project going?'],
];
phraseCases.forEach(([input, target, want]) => {
  check(`phrase "${input}" ->[${target}] "${want}"`, () => {
    assert.strictEqual(phrasebook(input, target), want);
  });
});

// --- 3. Romanized normalization: meaning-preserving canonical native text ---
const normCases = [
  ['tum kya kr rhe ho?', 'तुम क्या कर रहे हो?', 'romanized'],
  ['tum kal office ja rahe ho?', 'तुम कल office जा रहे हो?', 'mixed'],
  ['what kar rahe ho?', 'what कर रहे हो?', 'mixed'],
  ['ami ki korbo?', 'আমি কি করবো?', 'romanized'],
  ['ami kal college jabo', 'আমি কাল college যাবো', 'mixed'],
  ['enna panra?', 'என்ன செய்கிறாய்?', 'romanized'],
  ['nee enga pora?', 'நீ எங்கே போகிறாய்?', 'romanized'],
  ['naan busy ah iruken', 'நான் busy ah இருக்கிறேன்', 'mixed'],
  ['kyaaa kar rhe ho???', 'क्या कर रहे हो???', 'romanized'],
  ['bhai kemon acho?', 'ভাই কেমন আছো?', 'romanized'],
  ['https://ex.com/x tum kya kar rahe ho', 'https://ex.com/x तुम क्या कर रहे हो', 'romanized'],
];
normCases.forEach(([input, wantText, wantForm]) => {
  check(`normalize "${input}"`, () => {
    const d = detectLanguage(input);
    const n = normalizeRomanized(input, d);
    assert.strictEqual(n.normalizedText, wantText);
    assert.strictEqual(n.sourceForm, wantForm);
    assert.ok(n.coverage >= 0.5, 'coverage ' + n.coverage);
    assert.ok(n.confidence > 0 && n.confidence <= 1, 'confidence ' + n.confidence);
  });
});
check('normalize preserves names/numbers/emojis', () => {
  const n = normalizeRomanized('tumi Rahul ke bolo 2ta 😊', detectLanguage('tumi Rahul ke bolo 2ta 😊'));
  assert.ok(n.normalizedText.includes('Rahul'), n.normalizedText);
  assert.ok(n.normalizedText.includes('2ta'), n.normalizedText);
  assert.ok(n.normalizedText.includes('😊'), n.normalizedText);
});
check('normalize throws UNRELIABLE_SOURCE on garbage', () => {
  assert.throws(
    () => normalizeRomanized('xyzq blorpt zzz', { code: 'bn', script: 'latn', mixed: false, confidence: 'low' }),
    (e) => e && e.code === 'UNRELIABLE_SOURCE'
  );
});

// --- 4. Guard: latin garbage + loanword-majority acceptance ---
check('guard rejects latin garbage for indic target', () => {
  assert.strictEqual(isTransliteration('நீ என்ன செய்கிறாய்?', 'kya rey', { sourceCode: 'ta', sourceScript: 'native', target: 'hi' }), true);
});
check('guard accepts retained loanword in native result', () => {
  assert.strictEqual(isTransliteration('আজ college যাবি?', 'आज college जाओगे', { sourceCode: 'bn', sourceScript: 'native', target: 'hi' }), false);
});

// --- 5. Transliteration guard (core cases) ---
check('guard rejects Devanagari transliteration', () => {
  assert.strictEqual(isTransliteration('kemon achhe', 'केमोन अछे', { sourceCode: 'bn', sourceScript: 'latn', target: 'hi' }), true);
});
check('guard accepts semantic Hindi', () => {
  assert.strictEqual(isTransliteration('kemon achhe', 'कैसे हो?', { sourceCode: 'bn', sourceScript: 'latn', target: 'hi' }), false);
});
check('guard rejects Bengali-script transliteration', () => {
  assert.strictEqual(isTransliteration('kaise ho bhai', 'কাইসে হো ভাই', { sourceCode: 'hi', sourceScript: 'latn', target: 'bn' }), true);
});
check('guard accepts semantic Bengali', () => {
  assert.strictEqual(isTransliteration('kaise ho bhai', 'কেমন আছো ভাই?', { sourceCode: 'hi', sourceScript: 'latn', target: 'bn' }), false);
});
check('guard rejects Latin echo for English target', () => {
  assert.strictEqual(isTransliteration('epdi iruka', 'Epdi iruka', { sourceCode: 'ta', sourceScript: 'latn', target: 'en' }), true);
});
check('guard accepts semantic English', () => {
  assert.strictEqual(isTransliteration('epdi iruka', 'How are you?', { sourceCode: 'ta', sourceScript: 'latn', target: 'en' }), false);
});
check('guard accepts loanword retention', () => {
  assert.strictEqual(isTransliteration('tumi kemon acho bro', 'तुम कैसे हो bro?', { sourceCode: 'bn', sourceScript: 'latn', target: 'hi' }), false);
});
check('guard accepts native semantic result', () => {
  assert.strictEqual(isTransliteration('তুমি কেমন আছো?', 'How are you?', { sourceCode: 'bn', sourceScript: 'native', target: 'en' }), false);
});

// --- 6. translateText end-to-end (phrasebook-pinned, offline) ---
async function offlineTests() {
  process.env.TRANSLATION_PROVIDER = 'phrasebook';
  const offlineCases = [
    ['kemon achhe', 'hi', 'कैसे हो?'],
    ['kemon achhe', 'en', 'How are you?'],
    ['kaise ho bhai', 'bn', 'কেমন আছো ভাই?'],
    ['epdi iruka', 'en', 'How are you?'],
    ['How are you?', 'hi', 'आप कैसे हैं?'],
  ];
  for (const [input, target, want] of offlineCases) {
    try {
      const out = await translateText(input, { target });
      assert.strictEqual(out.translatedText, want);
      assert.ok(out.sourceForm, 'missing sourceForm');
      assert.ok(typeof out.confidence === 'number', 'missing confidence');
      pass += 1;
      console.log(`PASS translate "${input}" ->[${target}]`);
    } catch (err) {
      fail += 1;
      console.log(`FAIL translate "${input}" ->[${target}] :: ${err.message}`);
    }
  }
}

// --- 7. Live provider check (opt-in): unknown romanized phrase must return
// semantic text or throw cleanly — never a transliteration.
async function liveTests() {
  delete process.env.TRANSLATION_PROVIDER;
  const input = 'tumi kothay jachho';
  try {
    const out = await translateText(input, { target: 'hi' });
    const bad = isTransliteration(input, out.translatedText, { sourceCode: 'bn', sourceScript: 'latn', target: 'hi' });
    if (bad) {
      fail += 1;
      console.log(`FAIL live guard bypassed: "${out.translatedText}"`);
    } else {
      pass += 1;
      console.log(`PASS live semantic-or-clean ("${out.translatedText}" via ${out.provider})`);
    }
  } catch (err) {
    pass += 1; // graceful failure is the specified fallback
    console.log(`PASS live graceful failure (${err.message})`);
  }
}

// --- 8. MyMemory candidate selection (offline, recorded real payload).
// Regression test for: "did you eat?" -> hi served a polluted TM entry
// ("मैं आज स्कूल नहीं आऊंगा, कल आऊंगा"). Selection must prefer the
// plausible exact-segment candidate, never the unrelated memory.
const DID_YOU_EAT_PAYLOAD = {
  responseData: { translatedText: 'मैं आज स्कूल नहीं आऊंगा, कल आऊंगा', match: 0.96 },
  responseStatus: 200,
  matches: [
    { segment: 'Did you eat', translation: 'मैं आज स्कूल नहीं आऊंगा, कल आऊंगा', quality: 74, 'usage-count': 2 },
    { segment: 'Did you eat?', translation: 'kaha se aaye ho', quality: 74, 'usage-count': 5 },
    { segment: '- Did you eat?', translation: '- क्या तुम खाया?', quality: 0, 'usage-count': 2 },
  ],
};
check('selector extracts exact-segment candidates', () => {
  const cands = exactCandidates('did you eat?', DID_YOU_EAT_PAYLOAD);
  assert.strictEqual(cands.length, 3);
});
check('length filter rejects unrelated memory', () => {
  assert.strictEqual(isImplausibleLength('did you eat?', 'मैं आज स्कूल नहीं आऊंगा, कल आऊंगा'), true);
  assert.strictEqual(isImplausibleLength('did you eat?', 'क्या तुम खाया?'), false);
  assert.strictEqual(isImplausibleLength('Thank you', 'धन्यवाद'), false);
});
check('sanitizer strips TM artifacts', () => {
  assert.strictEqual(sanitizeProviderText('- क्या तुम खाया?'), 'क्या तुम खाया?');
});

async function liveDidYouEat() {
  delete process.env.TRANSLATION_PROVIDER;
  try {
    const out = await translateText('did you eat?', { target: 'hi' });
    assert.notStrictEqual(out.translatedText, 'मैं आज स्कूल नहीं आऊंगा, कल आऊंगा');
    assert.ok(/खा/.test(out.translatedText), 'expected eating-related Hindi, got: ' + out.translatedText);
    pass += 1;
    console.log(`PASS live did-you-eat ("${out.translatedText}" via ${out.provider})`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL live did-you-eat :: ${err.message}`);
  }
}

(async () => {
  await offlineTests();
  if (process.argv.includes('--live')) {
    await liveTests();
    await liveDidYouEat();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
