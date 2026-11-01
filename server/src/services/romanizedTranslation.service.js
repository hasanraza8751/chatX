// Romanized / code-mixed normalization layer (backend-only).
// Turns romanized Hinglish/Banglish/Tanglish and code-mixed chat into a
// canonical NATIVE-SCRIPT representation of the SOURCE language — never into
// the target script. The translation provider then receives meaningful
// source-language text instead of raw ambiguous romanized input.
//
// Example: "tum kya kr rhe ho?" -> "तुम क्या कर रहे हो?" (then hi->bn works).
// Names, URLs, numbers, emojis and genuine English loanwords are preserved.
//
// Returns: { normalizedText, sourceLanguage, sourceForm, confidence, coverage }
// Throws Error('UNRELIABLE_SOURCE') when too little of the message can be
// interpreted — callers must fail gracefully, never emit nonsense.

const { EN_WORDS, collapseRepeats } = require('./languageDetect');

const MIN_COVERAGE = 0.5;

// Abbreviations + spelling variants fold into canonical roman keys first
// (elongation like "kyaaa" is collapsed by collapseRepeats).
function entries(pairs) {
  const map = {};
  pairs.split(/\s+/).filter(Boolean).forEach((p) => {
    const i = p.indexOf(':');
    map[p.slice(0, i)] = p.slice(i + 1);
  });
  return map;
}

const HI_MAP = entries(`
tum:तुम tu:तू tujhe:तुझे tumhe:तुम्हें tumhara:तुम्हारा tumhari:तुम्हारी tumko:तुमको tumse:तुमसे
tera:तेरा teri:तेरी tere:तेरे aap:आप aapko:आपको main:मैं mai:मैं mera:मेरा meri:मेरी mere:मेरे
mujhe:मुझे mujhko:मुझको mujhse:मुझसे hum:हम hamara:हमारा hamari:हमारी humein:हमें
kya:क्या kyon:क्यों kyun:क्यों kyu:क्यों kaise:कैसे kaha:कहाँ kahaan:कहाँ kahan:कहाँ
kab:कब kaun:कौन kaisa:कैसा kaisi:कैसी kitna:कितना kitne:कितने hai:है hain:हैं ho:हो
hun:हूँ hoon:हूँ hn:हां haan:हां tha:था thi:थी raha:रहा rahe:रहे rahi:रही rhe:रहे
rha:रहा rhi:रही rahey:रहे kar:कर kr:कर karo:करो kro:करो karte:करते karti:करती karna:करना
krna:करना karega:करेगा karoge:करोगे hoga:होगा hogi:होगी honge:होंगे aaj:आज kal:कल
parso:परसों achha:अच्छा achhaa:अच्छा accha:अच्छा acha:अच्छा bahut:बहुत bohot:बहुत bahot:बहुत
nahi:नहीं nahin:नहीं nhi:नहीं bilkul:बिल्कुल thoda:थोड़ा zyada:ज़्यादा jyada:ज्यादा sahi:सही
galat:गलत yaar:यार bhai:भाई arre:अरे arey:अरे chal:चल chalo:चलो sun:सुन suno:सुनो dekh:देख
dekho:देखो bata:बता batao:बताओ bolo:बोलो bolna:बोलना samajh:समझ pata:पता scene:सीन masti:मस्ती
shaadi:शादी khana:खाना paani:पानी ghar:घर dost:दोस्त dosti:दोस्ती pyaar:प्यार mohabbat:मोहब्बत
baat:बात kaam:काम paisa:पैसा rupay:रुपये ladka:लड़का ladki:लड़की didi:दीदी namaste:नमस्ते
khana:खाना khaya:खाया khate:खाते tumne:तुमने
shukriya:शुक्रिया zaroor:ज़रूर kabhi:कभी hamesha:हमेशा abhi:अभी phir:फिर waha:वहाँ wahan:वहाँ
yaha:यहाँ yahan:यहाँ idhar:इधर udhar:उधर andar:अंदर bahar:बाहर upar:ऊपर neeche:नीचे saath:साथ
liye:लिए wala:वाला wali:वाली wale:वाले lekin:लेकिन kyunki:क्योंकि toh:तो bhi:भी rehna:रहना
chahiye:चाहिए sakta:सकता sakte:सकते gaya:गया gayi:गई aaya:आया aayi:आई diya:दिया liya:लिया
karke:करके hote:होते hota:होता hoti:होती hua:हुआ hue:हुए sab:सब kuch:कुछ sabko:सबको
tumko:तुमको humko:हमको apna:अपना apni:अपनी uska:उसका uski:उसकी iska:इसका woh:वह yeh:यह
milte:मिलते milna:मिलना milao:मिलाओ aaoge:आओगे aana:आना aao:आओ ja:जा jaa:जा jana:जाना
jaana:जाना jao:जाओ kaisa:कैसा chal:चल theek:ठीक thik:ठीक haal:हाल
`);

const BN_MAP = entries(`
tumi:তুমি tui:তুই apni:আপনি apnara:আপনারা ami:আমি amake:আমাকে amay:আমায় tomake:তোমাকে
tomay:তোমায় tomar:তোমার tomra:তোমরা tomader:তোমাদের amar:আমার amader:আমাদের oder:ওদের
tara:তারা tader:তাদের shey:সে kemon:কেমন kemne:কেমনে kothay:কোথায় kothai:কোথায় kobe:কবে
kokhon:কখন keno:কেন kano:কেন koto:কত acho:আছো achi:আছি ache:আছে achho:আছো achhe:আছে
achhen:আছেন achis:আছিস korcho:করছো korchi:করছি korche:করছে koro:করো kore:করে korbo:করবো
korbe:করবে korlam:করলাম korecho:করেছো korechi:করেছি jabe:যাবে jabo:যাবো jaben:যাবেন
jachho:যাচ্ছো jachhi:যাচ্ছি jachchho:যাচ্ছো jabi:যাবি asbe:আসবে asbo:আসবো hobe:হবে hobi:হবি
chilo:ছিল chhilo:ছিল khub:খুব bhalo:ভালো bhalobasha:ভালোবাসা mondo:মন্দ baje:বাজে kharap:খারাপ
nei:নেই ekhono:এখনো ekhon:এখন ajke:আজকে aajke:আজকে kalke:কালকে kal:কাল ekta:একটা duto:দুটো
shob:সব shobai:সবাই onek:অনেক alpo:অল্প beshi:বেশি kom:কম thik:ঠিক bhul:ভুল niye:নিয়ে
theke:থেকে jonno:জন্য jonye:জন্যে moto:মতো moton:মতন shathe:সাথে shonge:সঙ্গে majhe:মাঝে
bhetore:ভেতরে baire:বাইরে upore:উপরে niche:নিচে nichey:নিচে pashe:পাশে kachhe:কাছে dure:দূরে
bari:বাড়ি basha:বাসা bondhu:বন্ধু dada:দাদা didi:দিদি bon:বোন baba:বাবা maa:মা chhele:ছেলে
bhai:ভাই apa:আপা
meye:মেয়ে khela:খেলা khabar:খাবার jol:জল pani:পানি bhat:ভাত mach:মাছ misti:মিষ্টি adda:আড্ডা
gaan:গান boi:বই pora:পড়া lekha:লেখা kaj:কাজ taka:টাকা poisha:পয়সা rasta:রাস্তা gari:গাড়ি
bondho:বন্ধ khola:খোলা notun:নতুন purono:পুরনো chhoto:ছোট boro:বড় shundor:সুন্দর mojar:মজার
bhoy:ভয় anondo:আনন্দ dukkho:দুঃখ rag:রাগ hashi:হাসি kanna:কান্না ghum:ঘুম shopno:স্বপ্ন
bhalobashi:ভালোবাসি chai:চাই lage:লাগে lagche:লাগছে dichhi:দিচ্ছি dichho:দিচ্ছো nichhi:নিচ্ছি
jani:জানি jano:জানো jane:জানে bol:বল bolchi:বলছি bolchho:বলছো bolen:বলেন bolo:বলো dekho:দেখো
dekhbo:দেখবো dekhchho:দেখছো shono:শোনো shuno:শুনো esho:এসো eshchho:এসছো asho:আসো ashbo:আসবো
bosho:বসো cholo:চলো chalo:চলো jao:যাও thako:থাকো thakbo:থাকবো holo:হলো hoye:হয়ে hoyechhe:হয়েছে
gechhe:গেছে eshechhe:এসেছে korechho:করেছো dekhlam:দেখলাম shunlam:শুনলাম bollam:বললাম
korlam:করলাম gelam:গেলাম elam:এলাম kothakar:কোথাকার kibhabe:কীভাবে kake:কাকে kader:কাদের
hoche:হচ্ছে hocche:হচ্ছে hochhe:হচ্ছে korchho:করছো bolchhis:বলছিস ki:কি na:না khabo:খাবো khabe:খাবে parbo:পারবো
`);

const TA_MAP = entries(`
naan:நான் nan:நான் naanga:நாங்கள் nee:நீ neenga:நீங்கள் avan:அவன் aval:அவள் avanga:அவர்கள்
adhu:அது idhu:இது indha:இந்த andha:அந்த enna:என்ன ennada:என்னடா enga:எங்கே enge:எங்கே
eppo:எப்போது eppadi:எப்படி eppdi:எப்படி epdi:எப்படி yaaru:யார் yaar:யார் irukka:இருக்கிறாய்
irukke:இருக்கிறாய் irukken:இருக்கிறேன் iruken:இருக்கிறேன் irukku:இருக்கிறது irukanga:இருக்கிறார்கள்
irukiya:இருக்கிறாயா panra:செய்கிறாய் pandra:செய்கிறாய் panren:செய்கிறேன் panrom:செய்கிறோம்
panna:செய்ய sei:செய் seira:செய்கிறாய் seiren:செய்கிறேன் poren:போகிறேன் pora:போகிறாய்
pogiren:போகிறேன் pogira:போகிறாய் vara:வருகிறாய் varen:வருகிறேன் varuva:வருவாய் ponen:போனேன்
sapda:சாப்பிடு sapadu:சாப்பாடு sapten:சாப்பிட்டேன் veedu:வீடு veetla:வீட்டில் oorla:ஊரில்
romba:மிகவும் nalla:நல்ல illa:இல்லை illai:இல்லை aama:ஆமாம் seri:சரி dei:டேய் da:டா di:டி
machi:மச்சி machan:மச்சான் anna:அண்ணா akka:அக்கா amma:அம்மா appa:அப்பா kadhal:காதல் natpu:நட்பு
velai:வேலை kaasu:காசு panam:பணம் thanni:தண்ணீர் soru:சோறு veedhi:வீதி theru:தெரு vayasu:வயது
ponnu:பெண் paiyan:பையன் kovam:கோபம் sirippu:சிரிப்பு bayam:பயம் santhosham:சந்தோஷம்
thoongu:தூங்கு kanavu:கனவு pidikkum:பிடிக்கும் theriyum:தெரியும் puriyudhu:புரிகிறது
sollu:சொல் kelu:கேள் vaanga:வாங்க ponga:போங்க pannu:செய் poda:போடா odane:உடனே innaiku:இன்று
inniku:இன்று naalaiku:நாளை aprom:அப்புறம் aana:ஆனால் vandha:வந்த pona:போன mudiyum:முடியும்
venaam:வேண்டாம் venum:வேண்டும் pesa:பேச ketta:கெட்ட pola:போல madhiri:மாதிரி konjam:கொஞ்சம்
`);

const MAPS = { hi: HI_MAP, bn: BN_MAP, ta: TA_MAP };
const NATIVE_RE = /[\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF]/;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
const URL_RE = /^https?:\/\/\S+$/i;
const NUM_RE = /^[0-9][0-9.,:+\-%]*$/;
const AFFIX_RE = /^([^A-Za-z0-9\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF]*)([A-Za-z0-9\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF'’]+)([^A-Za-z0-9\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF]*)$/;

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Normalize romanized/code-mixed text into canonical native-script SOURCE text.
// detected: { code, script, mixed, confidence } from languageDetect.
function normalizeRomanized(text, detected) {
  const input = String(text || '');
  const code = detected && detected.code;
  if (!MAPS[code]) {
    return { normalizedText: input, sourceLanguage: code || 'en', sourceForm: 'english', confidence: 1, coverage: 1 };
  }
  const map = MAPS[code];
  const chunks = input.match(/https?:\/\/[^\s]+|\S+/g) || [];
  let mapped = 0;
  let kept = 0;
  let unknown = 0;
  const out = chunks.map((chunk) => {
    if (URL_RE.test(chunk) || NUM_RE.test(chunk) || EMOJI_RE.test(chunk)) {
      kept += 1;
      return chunk; // URLs, numbers, emojis preserved untouched
    }
    const m = chunk.match(AFFIX_RE);
    if (!m) {
      kept += 1;
      return chunk; // pure punctuation etc.
    }
    const [, pre, core, post] = m;
    if (NATIVE_RE.test(core)) {
      kept += 1;
      return chunk; // native-script token preserved
    }
    const key = collapseRepeats(core.toLowerCase());
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      mapped += 1;
      return pre + map[key] + post;
    }
    if (EN_WORDS.has(key)) {
      kept += 1; // genuine English in code-mixed text stays Latin
      return chunk;
    }
    unknown += 1; // names / unseen words: preserved, counted against coverage
    return chunk;
  });
  const total = mapped + kept + unknown;
  const coverage = total === 0 ? 0 : round2((mapped + kept) / total);
  const base = { high: 0.95, medium: 0.85, low: 0.7, given: 0.9 }[detected.confidence] || 0.7;
  const confidence = round2(base * (0.6 + 0.4 * coverage));
  const hasLatin = /[a-zA-Z]/.test(out.join(' '));
  const sourceForm = detected.mixed || (detected.script === 'native' && hasLatin) ? 'mixed' : 'romanized';
  if (coverage < MIN_COVERAGE) {
    const err = new Error("Couldn't determine the source language.");
    err.code = 'UNRELIABLE_SOURCE';
    throw err;
  }
  return {
    normalizedText: out.join(' '),
    sourceLanguage: code,
    sourceForm,
    confidence,
    coverage,
  };
}

module.exports = { normalizeRomanized, MIN_COVERAGE, HI_MAP, BN_MAP, TA_MAP };
