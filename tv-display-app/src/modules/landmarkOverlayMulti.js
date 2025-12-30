import io from 'socket.io-client';
import { BACKEND_URL } from '../config/backend-simple.js';

// Basic roman->Devanagari transliterator for place names
function toHindi(input) {
  try {
    if (!input) return '';
    if (/[^\x20-\x7E]/.test(input)) return input; // already non-latin
    const combo = [
      ['sh', 'श'], ['chh', 'छ'], ['ch', 'च'], ['th', 'थ'], ['dh', 'ध'],
      ['ph', 'फ'], ['bh', 'भ'], ['kh', 'ख'], ['gh', 'घ'], ['ng', 'ङ'],
      ['aa', 'आ'], ['ee', 'ई'], ['ii', 'ई'], ['oo', 'ऊ'], ['uu', 'ऊ'],
      ['ai', 'ऐ'], ['au', 'औ']
    ];
    const cmap = { a:'अ',b:'ब',c:'क',d:'द',e:'ए',f:'फ',g:'ग',h:'ह',i:'इ',j:'ज',k:'क',l:'ल',m:'म',n:'न',o:'ओ',p:'प',q:'क',r:'र',s:'स',t:'ट',u:'उ',v:'व',w:'व',x:'क्स',y:'य',z:'ज़' };
    const dict = { railway:'रेलवे', station:'स्टेशन', bus:'बस', stand:'स्टैंड', stop:'स्टॉप', terminal:'टर्मिनल', airport:'हवाई अड्डा', hospital:'अस्पताल', college:'कॉलेज', university:'विश्वविद्यालय', market:'बाज़ार', mall:'मॉल', road:'रोड', chowk:'चौक', bridge:'पुल', temple:'मंदिर', isbt:'आईएसबीटी' };
    const parts = String(input).split(/(\s+|-|,|\.|&|\/)/);
    const out = parts.map(p => {
      if (!p || /(\s+|-|,|\.|&|\/)/.test(p)) return p;
      const low = p.toLowerCase();
      if (dict[low]) return dict[low];
      let s = low;
      for (const [k,v] of combo) s = s.replaceAll(k, v);
      let res = '';
      for (const ch of s) res += cmap[ch] || ch;
      return res;
    });
    return out.join('');
  } catch { return input; }
}

function ensureStyles() {
  if (document.getElementById('landmark-overlay-style-multi')) return;
  const style = document.createElement('style');
  style.id = 'landmark-overlay-style-multi';
  style.textContent = `
    .landmark-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); color: #fff; display: flex; align-items: center; justify-content: center; z-index: 99999; text-align: center; padding: 24px; }
    .landmark-overlay .box { max-width: 80vw; border-radius: 12px; padding: 24px 28px; background: rgba(20,20,20,0.9); box-shadow: 0 12px 24px rgba(0,0,0,0.35); }
    .landmark-overlay .line { font-size: 44px; font-weight: 800; color: #ffffff; line-height: 1.22; }
    .landmark-overlay .hi { font-family: 'Noto Sans Devanagari', 'Mangal', 'Kohinoor Devanagari', 'Nirmala UI', 'Hind', Arial, sans-serif; margin-top: 8px; }
  `;
  document.head.appendChild(style);
}

function showOverlay(lines) {
  ensureStyles();
  const overlay = document.createElement('div');
  overlay.className = 'landmark-overlay';
  const htmlLines = lines.map(({text, cls}) => `<div class="line ${cls||''}">${text}</div>`).join('');
  overlay.innerHTML = `<div class="box">${htmlLines}</div>`;
  document.body.appendChild(overlay);
  return () => { try { overlay.remove(); } catch {} };
}

function pauseAds() {
  const video = document.querySelector('video.media-content');
  let wasPlaying = false;
  try { if (video) { wasPlaying = !video.paused; if (wasPlaying) video.pause(); } } catch {}
  const mediaPanel = document.querySelector('.media-panel');
  if (mediaPanel) { mediaPanel.dataset.prevVisibility = mediaPanel.style.visibility || ''; mediaPanel.style.visibility = 'hidden'; }
  return () => {
    try {
      if (mediaPanel) mediaPanel.style.visibility = mediaPanel.dataset.prevVisibility || '';
      if (video && wasPlaying) { const p = video.play(); if (p && p.then) p.catch(() => {}); }
    } catch {}
  };
}

let currentRemove = null;
const lastApproachShownAt = new Map(); // name -> ts

export default function initLandmarkOverlayMulti() {
  try {
    const socket = io(BACKEND_URL, { transports: ['websocket','polling'], autoConnect: true, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000, timeout: 10000 });

    socket.on('announce:landmark', (payload) => {
      try {
        if (!payload || payload.type !== 'LANDMARK') return;
        const name = (payload.name || '').trim();
        if (!name) return;
        const stage = (payload.stage || 'APPROACHING').toUpperCase();

        // Throttle APPROACHING to once/5s per name; REACHED repeats always show
        if (stage === 'APPROACHING') {
          const last = lastApproachShownAt.get(name) || 0;
          const now = Date.now();
          if (now - last < 5000) return;
          lastApproachShownAt.set(name, now);
        }

        const nameHi = toHindi(name);
        const lineHi = stage === 'REACHED' ? `हम ${nameHi} पर पहुँच गए हैं` : `हम ${nameHi} के पास पहुँच रहे हैं`;
        const lineEn = stage === 'REACHED' ? `We have reached ${name}` : `We are approaching ${name}`;

        // Replace any currently visible overlay
        try { if (currentRemove) currentRemove(); } catch {}
        const resume = pauseAds();
        const remove = showOverlay([
          { text: lineHi, cls: 'hi' },
          { text: lineEn }
        ]);
        currentRemove = () => { try { remove(); } catch {}; try { resume(); } catch {}; };

        setTimeout(() => { try { currentRemove && currentRemove(); currentRemove = null; } catch {} }, 3000);
      } catch {}
    });

    return socket;
  } catch (e) { return null; }
}

// Auto-init
initLandmarkOverlayMulti();
