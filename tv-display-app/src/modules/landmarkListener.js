import io from 'socket.io-client';
import { BACKEND_URL } from '../config/backend-simple.js';

// Lightweight TTS queue with unlock/resume for reliability
let unlocked = false;
let speaking = false;
// Queue holds { text, lang }
const q = [];
// Speak both languages per event: Hindi first, then English

function ensureUnlocked() {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // Some browsers suspend TTS until a user gesture; try to resume proactively
    try { window.speechSynthesis.resume(); } catch {}
    if (unlocked) return;
    const unlock = () => {
      try {
        // Play a short silent utterance to unlock audio focus
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0.01;
        window.speechSynthesis.speak(u);
        try { window.speechSynthesis.resume(); } catch {}
        unlocked = true;
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      } catch {}
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    // Also attempt unlock when page becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        try { window.speechSynthesis.resume(); } catch {}
      }
    });
  } catch {}
}

function pickVoice(preferLang = 'en-IN') {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const langLc = (preferLang || '').toLowerCase();

    // Prefer high-quality vendors/names when available
    const prefs = {
      'hi-in': ['google', 'microsoft'],
      'en-in': ['google', 'microsoft'],
      'en-gb': ['google', 'microsoft'],
      'default': ['google', 'microsoft']
    };
    const prefList = prefs[langLc] || prefs[langLc.split('-')[0] + '-in'] || prefs['default'];

    // 1) Exact language + preferred vendor
    for (const p of prefList) {
      const v = voices.find(v => (v.lang || '').toLowerCase() === langLc && (v.name || '').toLowerCase().includes(p));
      if (v) return v;
    }
    // 2) Family match + preferred vendor
    for (const p of prefList) {
      const v = voices.find(v => (v.lang || '').toLowerCase().startsWith(langLc.split('-')[0] + '-') && (v.name || '').toLowerCase().includes(p));
      if (v) return v;
    }
    // 3) Exact language
    const exact = voices.find(v => (v.lang || '').toLowerCase() === langLc);
    if (exact) return exact;
    // 4) Language family
    const family = voices.find(v => (v.lang || '').toLowerCase().startsWith(langLc.split('-')[0] + '-'));
    if (family) return family;
    // 5) Fallbacks
    const enIN = voices.find(v => (v.lang || '').toLowerCase().startsWith('en-in'));
    if (enIN) return enIN;
    const en = voices.find(v => (v.lang || '').toLowerCase().startsWith('en-'));
    return en || null;
  } catch { return null; }
}

// Basic transliterator (same as overlay)
function getTransliterator() {
  const comboMap = [
    ['sh', 'श'], ['chh', 'छ'], ['ch', 'च'], ['th', 'थ'], ['dh', 'ध'],
    ['ph', 'फ'], ['bh', 'भ'], ['kh', 'ख'], ['gh', 'घ'], ['ng', 'ङ'],
    ['aa', 'आ'], ['ee', 'ई'], ['ii', 'ई'], ['oo', 'ऊ'], ['uu', 'ऊ'],
    ['ai', 'ऐ'], ['au', 'औ']
  ];
  const charMap = {
    a: 'अ', b: 'ब', c: 'क', d: 'द', e: 'ए', f: 'फ', g: 'ग', h: 'ह', i: 'इ',
    j: 'ज', k: 'क', l: 'ल', m: 'म', n: 'न', o: 'ओ', p: 'प', q: 'क', r: 'र',
    s: 'स', t: 'त', u: 'उ', v: 'व', w: 'व', x: 'क्स', y: 'य', z: 'ज़'
  };
  const tokenDict = {
    railway: 'रेलवे', station: 'स्टेशन', bus: 'बस', stand: 'स्टैंड', stop: 'स्टॉप',
    terminal: 'टर्मिनल', airport: 'हवाई अड्डा', hospital: 'अस्पताल', college: 'कॉलेज',
    university: 'विश्वविद्यालय', market: 'बाज़ार', mall: 'मॉल', road: 'रोड',
    chowk: 'चौक', bridge: 'पुल', temple: 'मंदिर', isbt: 'आईएसबीटी', tower: 'टावर'
  };
  const phraseDict = new Map([
    ['clock tower', 'घंटाघर'],
    ['ghantaghar', 'घंटाघर'],
    ['ghanta ghar', 'घंटाघर'],
    ['isbt dehradun', 'आईएसबीटी देहरादून'],
    ['dehradun', 'देहरादून'],
    ['rishikesh', 'ऋषिकेश'],
    ['haridwar', 'हरिद्वार'],
    ['rajpur', 'राजपुर'],
    ['raipur', 'रायपुर'],
    ['ballupur', 'बल्लूपुर'],
    ['balliwala', 'बल्लिवाला'],
  ]);
  function toHindi(input) {
    try {
      if (!input) return '';
      if (/[^\x20-\x7E]/.test(input)) return input; // already non-latin
      const raw = String(input).trim();
      const lowAll = raw.toLowerCase();
      if (phraseDict.has(lowAll)) return phraseDict.get(lowAll);
      const parts = raw.split(/(\s+|-|,|\.|&|\/)/);
      const out = parts.map((p) => {
        if (!p || /^(\s+|-|,|\.|&|\/)$/.test(p)) return p;
        const low = p.toLowerCase();
        if (phraseDict.has(low)) return phraseDict.get(low);
        if (tokenDict[low]) return tokenDict[low];
        let s = low;
        for (const [k, v] of comboMap) s = s.replaceAll(k, v);
        let res = '';
        for (const ch of s) res += charMap[ch] || ch;
        return res;
      });
      return out.join('');
    } catch { return input; }
  }
  return { toHindi };
}

function enqueue(text, lang = 'en-IN') {
  if (!text) return;
  q.push({ text, lang });
  pump();
}

function pump() {
  try {
    if (speaking) return;
    if (!q.length) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { q.length = 0; return; }
    ensureUnlocked();
    try { window.speechSynthesis.resume(); } catch {}

    // Ensure voices are loaded; if not, wait for voiceschanged and retry
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) {
      const once = () => { try { window.speechSynthesis.onvoiceschanged = null; } catch {}; setTimeout(pump, 0); };
      try { window.speechSynthesis.onvoiceschanged = once; } catch { setTimeout(pump, 150); }
      return;
    }

    const item = q.shift();
    const utter = new SpeechSynthesisUtterance(item.text);
    utter.lang = item.lang || 'en-IN';
    // Per-language tuning for more natural cadence
    const ll = (utter.lang || '').toLowerCase();
    if (ll.startsWith('hi')) {
      utter.rate = 0.95;
      utter.pitch = 1.05;
    } else if (ll.startsWith('en-in')) {
      utter.rate = 1.0;
      utter.pitch = 1.0;
    } else {
      utter.rate = 1.0;
      utter.pitch = 1.0;
    }
    utter.volume = 1.0;
    const v = pickVoice(utter.lang);
    if (v) utter.voice = v;

    speaking = true;
    utter.onend = () => { speaking = false; setTimeout(pump, 50); };
    utter.onerror = () => { speaking = false; setTimeout(pump, 50); };
    // Do NOT cancel existing queue to avoid dropping repeated REACHED events
    window.speechSynthesis.speak(utter);
  } catch { speaking = false; }
}

// Build 4-language TTS texts from a name/stage
function buildTexts(name, stage) {
  const { toHindi } = getTransliterator();
  const nameHi = toHindi(name);
  const textGhw = stage === 'REACHED'
    ? `हम ${nameHi} मा पौंछिगे`
    : `हम ${nameHi} पोचण वाळ छ`;
  const textHI = stage === 'REACHED'
    ? `Hum ${nameHi} pahunch gaye hain`
    : `Hum ${nameHi} ke paas pahunch rahe hain`;
  const textEN = stage === 'REACHED'
    ? `We have reached ${name}`
    : `We are approaching ${name}`;
  return [
    { text: textGhw, lang: 'hi-IN' },
    { text: textHI, lang: 'hi-IN' },
    { text: textEN, lang: 'en-IN' },
  ];
}

// 30s booster after refresh: keep audio alive by re-enqueuing last payload
const bootUntil = Date.now() + 30000;
let boosterInterval = null;
let lastTexts = null;
let lastSpokenAt = 0;

function ensureBooster() {
  if (boosterInterval) return;
  boosterInterval = setInterval(() => {
    try {
      if (Date.now() > bootUntil) {
        clearInterval(boosterInterval);
        boosterInterval = null;
        return;
      }
      if (!lastTexts || !lastTexts.length) return;
      // Re-enqueue set roughly every 3s
      if ((Date.now() - lastSpokenAt) >= 2800) {
        for (const item of lastTexts) enqueue(item.text, item.lang);
        lastSpokenAt = Date.now();
      }
      try { window.speechSynthesis.resume(); } catch {}
    } catch {}
  }, 600);
}

export function initLandmarkAnnouncements() {
  try {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on('announce:landmark', (payload) => {
      try {
        if (!payload || payload.type !== 'LANDMARK') return;
        const name = (payload.name || '').trim();
        if (!name) return;
        const stage = (payload.stage || 'APPROACHING').toUpperCase();
        const texts = buildTexts(name, stage);
        for (const item of texts) enqueue(item.text, item.lang);
        lastTexts = texts;
        lastSpokenAt = Date.now();
        ensureBooster();
      } catch {}
    });

    // No further side effects; this module only listens
    return socket;
  } catch (e) {
    // Silent fail to avoid impacting existing UI/logic
    return null;
  }
}

// Auto-initialize on import so callers can just import the module once
initLandmarkAnnouncements();
