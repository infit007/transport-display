import io from 'socket.io-client';
import { BACKEND_URL } from '../config/backend-simple.js';

function speak(text) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-IN';
    utter.rate = 1.0;
    utter.pitch = 1.0;
    try { window.speechSynthesis.cancel(); } catch {}
    window.speechSynthesis.speak(utter);
  } catch {}
}

function ensureStyles() {
  if (document.getElementById('landmark-overlay-style')) return;
  const style = document.createElement('style');
  style.id = 'landmark-overlay-style';
  style.textContent = `
    .landmark-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: Inter, Roboto, Arial, sans-serif;
      text-align: center;
      padding: 24px;
    }
    .landmark-overlay .box {
      max-width: 80vw;
      border-radius: 12px;
      padding: 24px 28px;
      background: rgba(20,20,20,0.9);
      box-shadow: 0 12px 24px rgba(0,0,0,0.35);
    }
    .landmark-overlay .title {
      font-size: 44px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .landmark-overlay .subtitle {
      font-size: 22px;
      color: #ccc;
    }
  `;
  document.head.appendChild(style);
}

function showOverlay(message, sub) {
  ensureStyles();
  const overlay = document.createElement('div');
  overlay.className = 'landmark-overlay';
  overlay.innerHTML = `
    <div class="box">
      <div class="title">${message}</div>
      ${sub ? `<div class="subtitle">${sub}</div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  return () => { try { overlay.remove(); } catch {} };
}

function pauseAds() {
  const video = document.querySelector('video.media-content');
  let wasPlaying = false;
  try {
    if (video) {
      wasPlaying = !video.paused;
      if (wasPlaying) video.pause();
    }
  } catch {}
  // Optionally hide media panel (not strictly required since overlay is full screen)
  const mediaPanel = document.querySelector('.media-panel');
  if (mediaPanel) {
    mediaPanel.dataset.prevVisibility = mediaPanel.style.visibility || '';
    mediaPanel.style.visibility = 'hidden';
  }
  return () => {
    try {
      if (mediaPanel) mediaPanel.style.visibility = mediaPanel.dataset.prevVisibility || '';
      if (video && wasPlaying) {
        const p = video.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      }
    } catch {}
  };
}

const shownSet = new Set(); // key: name|stage per session

export function initLandmarkOverlay() {
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
        const key = `${name}|${stage}`;
        if (shownSet.has(key)) return;
        shownSet.add(key);

        const message = stage === 'REACHED' ? `We have reached ${name}` : `We are approaching ${name}`;

        const resume = pauseAds();
        const remove = showOverlay(message, '');
        speak(message);

        setTimeout(() => {
          remove();
          resume();
        }, 5000);
      } catch {}
    });

    return socket;
  } catch (e) {
    return null;
  }
}

// Auto-init on import
initLandmarkOverlay();
