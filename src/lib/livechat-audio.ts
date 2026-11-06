'use client';

import { ARRIVAL_WAV, MESSAGE_WAV, HANDOFF_WAV } from './sound-data';

let sharedAudioCtx: AudioContext | null = null;
let cachedArrivalBuffer: AudioBuffer | null = null;
let cachedHandoffBuffer: AudioBuffer | null = null;
let isDecodingBuffers = false;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        sharedAudioCtx = new AC();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

async function decodeWavToBuffer(ctx: AudioContext, base64Wav: string): Promise<AudioBuffer | null> {
  try {
    const base64 = base64Wav.includes(',') ? base64Wav.split(',')[1] : base64Wav;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return await ctx.decodeAudioData(bytes.buffer.slice(0));
  } catch {
    return null;
  }
}

async function primeAudioBuffers() {
  if (isDecodingBuffers || typeof window === 'undefined') return;
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;
  isDecodingBuffers = true;
  try {
    if (!cachedArrivalBuffer) {
      cachedArrivalBuffer = await decodeWavToBuffer(ctx, ARRIVAL_WAV);
    }
    if (!cachedHandoffBuffer) {
      cachedHandoffBuffer = await decodeWavToBuffer(ctx, HANDOFF_WAV);
    }
  } catch {} finally {
    isDecodingBuffers = false;
  }
}

export function isSoundMutedGlobally(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('teals_sound_enabled') === 'false';
  } catch {
    return false;
  }
}

// Original Rich Bell Chime (Crisp, pleasant dual-harmonic chime matching original tone)
function playOriginalChime(freq = 880, duration = 0.35) {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    const play = () => {
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);
        osc1.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, now);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
      } catch {}
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch {}
}

let activeAudio: HTMLAudioElement | null = null;
let lastChimeTimestamp = 0;

export function playCleanSound(type: 'arrival' | 'message' | 'handoff' = 'arrival', force = false) {
  if (typeof window === 'undefined') return;
  if (!force && isSoundMutedGlobally()) return;
  if (!force && (window.self !== window.top || window.location.search.includes('sso_email'))) return;

  const now = Date.now();
  if (!force && now - lastChimeTimestamp < 2500) return; // Strict 2.5s global anti-duplicate lock
  lastChimeTimestamp = now;

  const wav = type === 'handoff' ? HANDOFF_WAV : type === 'message' ? (MESSAGE_WAV || ARRIVAL_WAV) : ARRIVAL_WAV;

  try {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    activeAudio = new Audio(wav);
    activeAudio.volume = 1.0;
    const playPromise = activeAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        playOriginalChime(type === 'handoff' ? 660 : 880, 0.35);
      });
    }
  } catch {
    playOriginalChime(type === 'handoff' ? 660 : 880, 0.35);
  }
}

let lastArrivalSoundTime = 0;
let lastMessageSoundTime = 0;
let lastHandoffSoundTime = 0;

// 1. Visitor Arrival Sound (Guaranteed strictly 1 single clean chime per visitor arrival across all tabs)
export const playArrivalSound = (force = false) => {
  const now = Date.now();
  if (!force) {
    try {
      const lastSound = localStorage.getItem('teals_sound_played_arrival');
      if (lastSound && now - Number(lastSound) < 2500) {
        return; // Already played in another tab within 2.5 seconds
      }
      localStorage.setItem('teals_sound_played_arrival', String(now));
    } catch {}
  }
  if (!force && now - lastArrivalSoundTime < 2500) return;
  lastArrivalSoundTime = now;
  playCleanSound('arrival', force);
};
export const playArrivalChime = playArrivalSound;

// 2. Incoming Message Sound (Guaranteed strictly 1 single clean chime)
export const playMessageSound = (force = false) => {
  const now = Date.now();
  if (!force && now - lastMessageSoundTime < 2000) return;
  lastMessageSoundTime = now;
  playCleanSound('message', force);
};
export const playMessageChime = playMessageSound;

// 3. Human Handoff Sound
export const playHandoffSound = (force = false) => {
  const now = Date.now();
  if (!force && now - lastHandoffSoundTime < 2500) return;
  lastHandoffSoundTime = now;
  playCleanSound('handoff', force);
};
export const playApprovalChime = playHandoffSound;

// Topbar "Test Sound" button helper (ALWAYS rings on deliberate click)
export async function playTestSound(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    await unlockAudioContext();
    playCleanSound('arrival', true); // force = true
    return true;
  } catch {
    return false;
  }
}

// Compatibility deduplication helper
export function tryPlayDeduplicatedChime(_eventId: string, type: 'arrival' | 'message' | 'handoff' | 'approval') {
  if (isSoundMutedGlobally()) return false;
  if (type === 'arrival') playArrivalSound();
  else if (type === 'message') playMessageSound();
  else playHandoffSound();
  return true;
}

// Continuous repeating ringer for "chat locked / waiting for human agent"
let stopHandoffWorker: (() => void) | null = null;
let activeHandoffConvId: string | null = null;
let lastHandoffRingTimestamp = 0;

export function startWaitingForHumanBeep(conversationId?: string) {
  if (typeof window === 'undefined') return;
  if (isSoundMutedGlobally()) {
    stopWaitingForHumanBeep();
    return;
  }

  const targetId = conversationId || 'global';
  if (stopHandoffWorker && activeHandoffConvId === targetId) return;

  const now = Date.now();
  if (stopHandoffWorker) {
    stopHandoffWorker();
    stopHandoffWorker = null;
  }
  activeHandoffConvId = targetId;

  // Single clean beep on start with 2.2-second debounce guard (prevents double acoustic beep)
  if (now - lastHandoffRingTimestamp > 2200) {
    lastHandoffRingTimestamp = now;
    playHandoffSound();
  }

  // Repeat every 3 seconds continuously until claimed or stopped
  stopHandoffWorker = createWorkerInterval(() => {
    if (isSoundMutedGlobally()) {
      stopWaitingForHumanBeep();
      return;
    }
    lastHandoffRingTimestamp = Date.now();
    playHandoffSound();
  }, 3000);
}
export const startHandoffRinger = startWaitingForHumanBeep;

export function stopWaitingForHumanBeep(conversationId?: string) {
  if (conversationId && activeHandoffConvId && activeHandoffConvId !== conversationId) return;
  if (stopHandoffWorker) {
    stopHandoffWorker();
    stopHandoffWorker = null;
  }
  activeHandoffConvId = null;
}
export const stopHandoffRinger = stopWaitingForHumanBeep;

export function createWorkerInterval(callback: () => void, intervalMs: number): () => void {
  if (typeof window === 'undefined') return () => {};
  try {
    const workerScript = `
      var timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() { postMessage('tick'); }, ${intervalMs});
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => callback();
    worker.postMessage('start');
    return () => {
      try {
        worker.postMessage('stop');
        worker.terminate();
      } catch {}
    };
  } catch {
    const timer = setInterval(callback, intervalMs);
    return () => clearInterval(timer);
  }
}

// Desktop Background Notification (Silent Windows Popup - ZERO OS Sound)
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const p = await Notification.requestPermission();
      return p === 'granted';
    }
    return false;
  } catch {
    return false;
  }
}

let lastGlobalNotificationTimestamp = 0;

export function showBackgroundNotification(
  title: string,
  body: string,
  icon = '/icon-192.png?v=3',
  eventKey?: string,
  soundAlertsEnabled?: boolean,
  targetUrl = '/livechat'
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    requestNotificationPermission().catch(() => {});
    return;
  }

  const now = Date.now();
  // Absolute Rate-Limiter: No 2 Windows notifications can ever pop up within 2.5 seconds of each other
  if (now - lastGlobalNotificationTimestamp < 2500) {
    return;
  }

  // Cross-tab lock: ensure this exact notification only shows ONCE across all open tabs within 3 seconds
  const lockKey = eventKey || `notif_${title}_${(body || '').slice(0, 30)}`;
  try {
    const storageKey = `teals_notif_fired_${lockKey}`;
    const lastFired = localStorage.getItem(storageKey);
    if (lastFired && now - Number(lastFired) < 3000) {
      return; // Already notified recently in this or another tab
    }
    localStorage.setItem(storageKey, String(now));
  } catch {}

  lastGlobalNotificationTimestamp = now;

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const shouldPlayOsSound = Boolean(soundAlertsEnabled) || (isMobile && document.hidden);

  const notifOptions = {
    body,
    icon: icon && icon !== '/favicon.ico' ? icon : '/icon-192.png?v=3',
    badge: '/icon-192.png?v=3',
    silent: !shouldPlayOsSound && !isSoundMutedGlobally() ? true : false,
    tag: eventKey || `teals_crm_notif_${now}`,
    renotify: true,
    vibrate: [250, 100, 250],
    data: { url: targetUrl },
  };

  if ('serviceWorker' in navigator && isMobile) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, notifOptions as any).catch(() => {});
    }).catch(() => {});
    return;
  }

  try {
    const notif = new Notification(title, notifOptions as any);

    notif.onclick = (e) => {
      try { e.preventDefault(); } catch {}
      window.focus();
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== targetUrl) {
        window.location.href = targetUrl;
      }
      notif.close();
    };

    setTimeout(() => {
      try { notif.close(); } catch {}
    }, 7000);
  } catch (err) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, notifOptions as any).catch(() => {});
      }).catch(() => {});
    }
  }
}

// Tab Title Flashing
let titleFlashTimer: ReturnType<typeof setInterval> | null = null;
let baseTitle = typeof document !== 'undefined' ? document.title : 'Teals CRM';

export function flashTabTitle(alertTitle: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!document.hidden) return;

  if (titleFlashTimer) clearInterval(titleFlashTimer);
  if (!baseTitle || baseTitle.includes('!') || baseTitle.includes('(')) {
    baseTitle = 'Teals CRM — AI Sales Workspace';
  }

  let toggle = false;
  titleFlashTimer = setInterval(() => {
    if (!document.hidden) {
      stopTabTitleFlash();
      return;
    }
    document.title = toggle ? alertTitle : baseTitle;
    toggle = !toggle;
  }, 1000);
}

export function stopTabTitleFlash() {
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer);
    titleFlashTimer = null;
  }
  if (typeof document !== 'undefined' && baseTitle) {
    document.title = baseTitle;
  }
}

// User Interaction Unlocker
export async function unlockAudioContext(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }
  primeAudioBuffers().catch(() => {});
  return true;
}

export const ensureAudioRunning = unlockAudioContext;
export const unlockAudioEngine = unlockAudioContext;

// Global interaction listeners to unlock audio on first click or keypress
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudioContext().catch(() => {});
  };
  ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown'].forEach((ev) => {
    window.addEventListener(ev, unlock, { passive: true, once: false });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      stopTabTitleFlash();
      unlockAudioContext().catch(() => {});
    }
  });
  window.addEventListener('focus', () => {
    stopTabTitleFlash();
    unlockAudioContext().catch(() => {});
  });
}


