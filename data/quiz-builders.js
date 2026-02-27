// data/quiz-builders.js — Quiz question pool builders + shuffle utility

import { PHRASES, KANJI } from './phrases.js';
import { ETIQUETTE, KANSAI_DIALECT, KANSAI_TIPS } from './etiquette.js';

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildPhraseQuestions() {
  return PHRASES.map(p => ({
    question: p.en,
    answer: `${p.jp} (${p.romaji})`,
    type: 'choice',
    pool: PHRASES.map(x => `${x.jp} (${x.romaji})`)
  }));
}

export function buildKanjiQuestions() {
  return KANJI.map(k => ({
    question: k.kanji,
    questionSub: k.reading,
    answer: k.meaning,
    type: 'kanji',
    pool: KANJI.map(x => x.meaning)
  }));
}

export function buildEtiquetteQuestions() {
  const qs = [
    {statement:"You should tip waiters about 10-15% in Japan.",correct:false,explanation:"Never tip in Japan — it's not customary and can be rude!"},
    {statement:"In Osaka, you should stand on the RIGHT side of the escalator.",correct:true,explanation:"Correct! Osaka/Kansai = stand right. Tokyo = stand left."},
    {statement:"It's perfectly fine to eat while walking down the street in Japan.",correct:false,explanation:"Eating while walking is considered bad manners. Find a spot to stop!"},
    {statement:"You should blow your nose at the dinner table rather than sniffle.",correct:false,explanation:"Blowing your nose in public is rude. Sniffling is more acceptable, or go to the restroom."},
    {statement:"You should wash your whole body BEFORE getting into an onsen bath.",correct:true,explanation:"Always wash and rinse thoroughly at the shower stations before entering the bath!"},
    {statement:"Phone calls on the train are fine if you keep your voice down.",correct:false,explanation:"Phone calls on trains are a big no-no, even quiet ones. Set to manner mode!"},
    {statement:"Sticking chopsticks upright in rice is a funeral ritual and very rude.",correct:true,explanation:"This resembles incense at funerals. Never stick chopsticks upright in food!"},
    {statement:"You should walk down the center of the path at a shrine.",correct:false,explanation:"The center path is reserved for the gods. Walk to the side!"},
    {statement:"When paying, place your money on the small tray at the register.",correct:true,explanation:"Using the cash tray is standard etiquette. Don't hand money directly."},
    {statement:"Most onsens welcome people with tattoos.",correct:false,explanation:"Many traditional onsens still ban tattoos. Always check first! Some offer private baths."},
    {statement:"Priority seats on trains are only for elderly people.",correct:false,explanation:"Priority seats are for elderly, pregnant, disabled, injured, and those with small children."},
    {statement:"It's customary to say 'itadakimasu' before eating a meal.",correct:true,explanation:"It means 'I humbly receive' and shows gratitude for the food!"},
    {statement:"You can wear shoes inside a traditional ryokan (Japanese inn).",correct:false,explanation:"Always remove shoes at the entrance (genkan). Slippers are usually provided."},
    {statement:"Public trash cans are very rare in Japan.",correct:true,explanation:"Carry a small bag for your trash! You'll find bins at convenience stores."},
    {statement:"A slight bow is a standard greeting in Japan.",correct:true,explanation:"A 15-30° bow is common. Deeper = more respectful. A head nod works casually!"},
    {statement:"It's fine to pass food to someone chopstick-to-chopstick.",correct:false,explanation:"This mimics a funeral bone-picking ritual. Place food on their plate instead."},
  ];
  return qs.map(q => ({ ...q, type: 'tf' }));
}

export function buildKansaiQuestions() {
  const dialectQs = KANSAI_DIALECT.map(d => ({
    question: d.dialect,
    questionSub: d.romaji,
    answer: d.meaning,
    type: 'choice',
    pool: KANSAI_DIALECT.map(x => x.meaning)
  }));
  const tfQs = [
    {statement:"'Ookini' (おおきに) means 'thank you' in Kansai dialect.",correct:true,type:'tf',explanation:"Ookini is the classic Kansai way to say thanks!"},
    {statement:"In Osaka, you stand on the LEFT side of escalators.",correct:false,type:'tf',explanation:"Osaka = stand RIGHT. It's the opposite of Tokyo!"},
    {statement:"Kushikatsu sauce can be double-dipped for extra flavor.",correct:false,type:'tf',explanation:"NEVER double-dip! One dip only. Use cabbage for extra sauce."},
    {statement:"The deer in Nara will bow to you if you bow to them first.",correct:true,type:'tf',explanation:"They've learned this behavior over centuries. Try it!"},
    {statement:"'Nande ya nen' is a polite way to agree with someone.",correct:false,type:'tf',explanation:"It means 'What the heck!' — it's the classic Osaka tsukkomi (comedic retort)!"},
    {statement:"Fushimi Inari Shrine is open 24 hours and free to visit.",correct:true,type:'tf',explanation:"It's always open and free! Best visited early morning or evening."},
    {statement:"'Meccha' means 'a little bit' in Kansai dialect.",correct:false,type:'tf',explanation:"Meccha means 'very' or 'super' — the opposite!"},
    {statement:"Geiko/Maiko in Gion love taking selfies with tourists.",correct:false,type:'tf',explanation:"Never chase or bother geiko/maiko. They are working professionals."},
    {statement:"Osaka is nicknamed 'The Nation's Kitchen' (tenka no daidokoro).",correct:true,type:'tf',explanation:"Osaka has been Japan's food capital for centuries. The word 'kuidaore' (eat till you drop) was coined here!"},
    {statement:"'Aho' is a much more offensive insult than 'baka' in Kansai.",correct:false,type:'tf',explanation:"In Kansai, 'aho' is actually friendlier and more playful than 'baka.' In Tokyo it's the opposite!"},
    {statement:"Kuromon Market in Osaka is best visited in the evening.",correct:false,type:'tf',explanation:"Kuromon Market is freshest in the morning! Many stalls close by early afternoon."},
    {statement:"There is a Pokemon Center store you can visit in Osaka.",correct:true,type:'tf',explanation:"Yes! The Pokemon Center Osaka is in Shinsaibashi/Daimaru. They have exclusive regional merch!"},
    {statement:"'Moukari makka' is how Osaka shopkeepers greet each other.",correct:true,type:'tf',explanation:"It literally means 'Making money?' — the reply is usually 'bochi bochi denna' (so-so). Classic Osaka!"},
  ];
  return shuffle([...dialectQs, ...tfQs]);
}
