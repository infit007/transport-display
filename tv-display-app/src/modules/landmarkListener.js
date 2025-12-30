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
    const exact = voices.find(v => (v.lang || '').toLowerCase() === langLc);
    if (exact) return exact;
    const family = voices.find(v => (v.lang || '').toLowerCase().startsWith(langLc.split('-')[0] + '-'));
    if (family) return family;
    // Fallbacks
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
    s: 'स', t: 'ट', u: 'उ', v: 'व', w: 'व', x: 'क्स', y: 'य', z: 'ज़'
  };
  const tokenDict = {
    railway: 'रेलवे', station: 'स्टेशन', bus: 'बस', stand: 'स्टैंड', stop: 'स्टॉप',
    terminal: 'टर्मिनल', airport: 'हवाई अड्डा', hospital: 'अस्पताल', college: 'कॉलेज',
    university: 'विश्वविद्यालय', market: 'बाज़ार', mall: 'मॉल', road: 'रोड',
    chowk: 'چौक', bridge: 'पुल', temple: 'मंदिर', isbt: 'आईएसबीटी',
  };
  function toHindi(input) {
    try {
      if (!input) return '';
      if (/[^\x20-\x7E]/.test(input)) return input; // already non-latin
      const parts = String(input).split(/(\s+|-|,|\.|&|\/)/);
      const out = parts.map((p) => {
        if (!p || /^(\s+|-|,|\.|&|\/)$/.test(p)) return p;
        const low = p.toLowerCase();
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

    const item = q.shift();
    const utter = new SpeechSynthesisUtterance(item.text);
    utter.lang = item.lang || 'en-IN';
    utter.rate = 1.0;
    utter.pitch = 1.0;
    const v = pickVoice(utter.lang);
    if (v) utter.voice = v;

    speaking = true;
    utter.onend = () => { speaking = false; setTimeout(pump, 50); };
    utter.onerror = () => { speaking = false; setTimeout(pump, 50); };
    // Do NOT cancel existing queue to avoid dropping repeated REACHED events
    window.speechSynthesis.speak(utter);
  } catch { speaking = false; }
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
        const { toHindi } = getTransliterator();
        const nameHi = toHindi(name);
        // Build EN and HI variants
        const textEN = stage === 'REACHED' ? `We have reached ${name}` : `We are approaching ${name}`;
        const textHI = stage === 'REACHED' ? `Hum ${nameHi} par pahunch gaye hain` : `Hum ${nameHi} ke paas pahunch rahe hain`;
        // Enqueue Hindi first, then English (to match overlay order)
        enqueue(textHI, 'hi-IN');
        enqueue(textEN, 'en-IN');
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
