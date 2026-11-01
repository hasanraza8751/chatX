// Language detection for ChatX translation (backend-only, no credentials).
// Handles: native-script Hindi/Bengali/Tamil, English, romanized Hinglish/
// Banglish/Tanglish, and code-mixed messages. Latin script is NEVER blindly
// assumed to be English — tokens are scored against romanized lexicons.
//
// Returns: { code: 'en'|'hi'|'bn'|'ta', script: 'native'|'latn',
//            mixed: boolean, confidence: 'high'|'medium'|'low' }

const SCRIPT_RANGES = [
  { code: 'bn', re: /[\u0980-\u09FF]/g }, // Bengali
  { code: 'ta', re: /[\u0B80-\u0BFF]/g }, // Tamil
  { code: 'hi', re: /[\u0900-\u097F]/g }, // Devanagari (Hindi + closely-related scripts)
];

function wordsOf(list) {
  return new Set(list.toLowerCase().split(/\s+/).filter(Boolean));
}

// Romanized Hindi/Hinglish markers (3+ chars to avoid false positives).
const HI_WORDS = wordsOf(`
tum tumhe tumhara tumhari tujhe tera teri main mai mera meri mere mujhe mujhko
hum hamara hamari humein kya kyon kyun kaise kaha kahan kab kaun kaisa kaisi
kitna kitne kitni hai hun hoon tha thi theen raha rahe rahi kar karo karte karti
karna karega karoge hoga hogi honge aaj kal parso achha accha acha bahut bohot
bahot nahi nahin bilkul thoda zyada jyada sahi galat yaar bhai arre arey chal
chalo sun suno dekh dekho bata batao bolo bolna samajh pata scene masti shaadi
khana paani ghar dost dosti pyaar mohabbat baat kaam paisa rupay ladka ladki
didi namaste shukriya zaroor kabhi hamesha abhi phir waha yaha idhar udhar
andar bahar upar neeche saath liye wala wali wale wala lekin kyunki toh bhi
rehna reh rahi rahega chahiye sakta sakte sakti gaya gayi aaya aayi diya liya
karke karke hokar hote hota hoti hui hue hua hui mujh tujh sab kuch sabko tumko
humko apna apni apne uska uski uske iska iski iske jiska jiska woh yeh ye wo
theek thik rha rahey haal
aap tu kyu hain nhi rhe kr kro krna hn milte milna milao aaoge aana jaana jana
achha achhaa accha kyu kyun khana khaana jaa raha rahi rahey batao bataoo tumne khana khaya khate
`);

// Romanized Bengali/Banglish markers.
const BN_WORDS = wordsOf(`
tumi tui apni apnara ami amake amay tomake tomay tomar tomra tomader amar amader
oder tara tader shey kemon kemne kothay kothai kobe kokhon keno kano koto kotogulo
acho achi ache achho achhen achis achish korcho korchi korche koro kore korbo korbe
korlam korecho korechi jabe jabo jaben jachho jachhi jachchho asbe asbo ashbe hobe
hobey chilo chhilo khub bhalo bhalobasha mondo baje kharap nei ekhono ekhon ajke
aajke kalke porshu porshudin ekta duto dutoi shob shobai onek alpo beshi kom thik
bhul niye theke jonno jonye moto moton shathe shonge majhe bhetore baire upore
niche nichey pashe kachhe dure bari basha bondhu dada didi bon baba maa chhele
meye khela khabar jol pani bhat mach misti adda gaan boi pora lekha kaj taka
poisha rasta gari bondho khola notun purono chhoto boro shundor mojar bhoy anondo
dukkho dukkho rag hashi kanna ghum shopno bhalobashi chai lage lagche dichhi
dichho nichhi nichho jani jano jane bol bolchi bolchho bolen bolo dekho shono
shuno esho asho bosho cholo chalo jao thako holo hoye hoyechhe gechhe eshechhe
korechho korechhi dekhlam shunlam bollam korlam gelam elam achhish kothakar
kibhabe kisher kake kaake kader tomader amader motoi shobshomoy shobshomoy
achhe achho achhen korchho hoche hocche hochhe eshchho dekhchho bolchhis
koro jabi khabo khabe dekhbo bolbo thakbo thakbe parbo parbi hobi ashbo jachhi
`);

// Romanized Tamil/Tanglish markers.
const TA_WORDS = wordsOf(`
naan nan naanga nee neenga avan aval avanga adhu idhu indha andha andha
enna ennada enga enge eppo eppadi eppdi epdi yaaru yaar aaru aara
irukka irukke irukken irukku irukanga irukiya irukella irukeenga
panra pandra panren panrom panna pannan sei seira seiren seiyuren
poren pora pogiren pogira vara varen varuva vandhuta vandhuten poiten ponen
sapda sapadu sapten sapten veedu veetla oorla oorile romba nalla nalladhu
illa illai illaya aama aamam seri sari dei machi machan mapla thangachi
anna akka amma appa thangam chellam kadhal natpu velai kaasu panam sappadu
thanni soru veedhi theru vayasu ponnu paiyan pulla pasanga ponnunga kovam
sirippu azhugai bayam santhosham thoongu kanavu pidikkum theriyum theriyadhu
puriyudhu puriyala sollu sollunga kelu paarunga vaanga ponga poidu pannu
pannunga saapdu vaada poda odane innaiku inniku naalaiku naalai aprom aana
aanaalum vandha pona vandhuruchu mutiyala mudiyum mudiyadhu venaam venum
illama irundha irundhadhu pesa pesuren pesu ketta sonna vandha pola madhiri
konjam konjom athe antha indha enga irundha sapadu aachu aayiduchu
epdi iruken irukken
`);

// Common English markers (loanwords like college/bro/school intentionally live
// here so mixed detection works: indic hits + english hits => mixed).
const EN_WORDS = wordsOf(`
the and you your yours are is was were how what where when why who which
this that with from have has had will would can could should there their
about going doing done today tomorrow yesterday hello hey bro dude man yeah
yes very really just like love hate work school college office home food
water time day night morning evening good bad nice great happy sad sorry
thanks thank please welcome okay fine well also then than they them going
gonna wanna come here come going let me my me my we us our going to for
of in on at to be been being do does did will would busy project
`);

// Collapse elongated chat spelling ("kyaaa" -> "kya", "achhaaa" -> "achha")
// before tokenizing so slang variations still score. Runs of 1-2 kept as-is.
function collapseRepeats(s) {
  return String(s || '').replace(/(.)\1{2,}/g, '$1');
}

function tokenizeLatin(text) {
  return (collapseRepeats(String(text || '').toLowerCase()).match(/[a-z]{3,}/g) || []);
}

function score(tokens, lexicon) {
  let hits = 0;
  for (const t of tokens) if (lexicon.has(t)) hits += 1;
  return hits;
}

function detectLanguage(text) {
  const input = String(text || '');
  if (!input.trim()) return { code: 'en', script: 'latn', mixed: false, confidence: 'low' };

  // 1. Native-script pass: count characters per Indic script.
  const scriptCounts = SCRIPT_RANGES.map(({ code, re }) => {
    const m = input.match(re);
    return { code, count: m ? m.length : 0 };
  });
  const dominant = scriptCounts.reduce((a, b) => (b.count > a.count ? b : a));
  const latinTokens = tokenizeLatin(input);

  if (dominant.count >= 2) {
    const hi = score(latinTokens, HI_WORDS);
    const bn = score(latinTokens, BN_WORDS);
    const ta = score(latinTokens, TA_WORDS);
    const en = score(latinTokens, EN_WORDS);
    const mixed = latinTokens.length > 0 && (hi + bn + ta + en) > 0;
    return {
      code: dominant.code,
      script: 'native',
      mixed,
      confidence: dominant.count >= 4 ? 'high' : 'medium',
    };
  }

  // 2. Latin-script pass: score romanized lexicons. Never assume English.
  const hi = score(latinTokens, HI_WORDS);
  const bn = score(latinTokens, BN_WORDS);
  const ta = score(latinTokens, TA_WORDS);
  const en = score(latinTokens, EN_WORDS);
  const indic = [
    { code: 'hi', score: hi },
    { code: 'bn', score: bn },
    { code: 'ta', score: ta },
  ].sort((a, b) => b.score - a.score);
  const top = indic[0];

  if (top.score >= 2) {
    return {
      code: top.code,
      script: 'latn',
      mixed: en >= 1,
      confidence: top.score >= 4 ? 'high' : 'medium',
    };
  }
  // Single strong hit: one distinctive 4+ letter token with no competing
  // indic or english signal (e.g. "kaise ho", "ki holo", "ki korcho").
  // Short 2-letter particles alone are never decisive.
  if (top.score === 1 && indic[1].score === 0 && en === 0) {
    const lexicon = top.code === 'hi' ? HI_WORDS : top.code === 'bn' ? BN_WORDS : TA_WORDS;
    const strong = latinTokens.some((t) => t.length >= 4 && lexicon.has(t));
    if (strong) {
      return { code: top.code, script: 'latn', mixed: false, confidence: 'low' };
    }
  }
  // Single but long distinctive romanized token (e.g. "irukka", "kemon").
  const longHit = latinTokens.find(
    (t) => t.length >= 6 && (HI_WORDS.has(t) || BN_WORDS.has(t) || TA_WORDS.has(t))
  );
  if (longHit) {
    const code = HI_WORDS.has(longHit) ? 'hi' : BN_WORDS.has(longHit) ? 'bn' : 'ta';
    return { code, script: 'latn', mixed: en >= 1, confidence: 'low' };
  }
  return { code: 'en', script: 'latn', mixed: false, confidence: en > 0 ? 'medium' : 'low' };
}

module.exports = { detectLanguage, SUPPORTED: ['en', 'hi', 'bn', 'ta'], HI_WORDS, BN_WORDS, TA_WORDS, EN_WORDS, collapseRepeats };
