const fs = require('fs');

// 1. Update AiCallDialog.tsx
const dialogPath = 'src/components/crm/AiCallDialog.tsx';
let dialog = fs.readFileSync(dialogPath, 'utf8');

// Add latestListenUrlRef and nextPlayTimeRef
dialog = dialog.replace(
  /const wsMonitorRef = useRef<WebSocket \| null>\(null\);/,
  `const wsMonitorRef = useRef<WebSocket | null>(null);
  const latestListenUrlRef = useRef<string | null>(null);
  const nextPlayTimeRef = useRef<number>(0);`
);

// Update polling to save latestListenUrlRef
dialog = dialog.replace(
  /\/\/ FIX: Use ref — never stale\s*if \(res\.listenUrl && isListeningLiveRef\.current && !wsMonitorRef\.current\) \{\s*startLiveAudioStream\(res\.listenUrl\);\s*\}/,
  `// FIX: Always save latest listenUrl and connect if live monitoring enabled
        if (res.listenUrl) {
          latestListenUrlRef.current = res.listenUrl;
          if (isListeningLiveRef.current && !wsMonitorRef.current) {
            startLiveAudioStream(res.listenUrl);
          }
        }`
);

// Update startLiveAudioStream with resume and smooth audio playback
const oldAudioHelper = `  // Live Audio Streaming helper
  function startLiveAudioStream(wsUrl: string) {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const ws = new WebSocket(wsUrl);
      wsMonitorRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const pcm16 = new Int16Array(event.data);
          const float32 = new Float32Array(pcm16.length);
          for (let i = 0; i < pcm16.length; i++) {
            float32[i] = (pcm16[i] as number) / 32768;
          }
          const buffer = ctx.createBuffer(1, float32.length, 16000);
          buffer.copyToChannel(float32, 0);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start();
        }
      };

      ws.onerror = () => {
        setIsListeningLive(false);
        isListeningLiveRef.current = false;
      };
    } catch (e) {
      console.log("Audio Stream monitor error:", e);
    }
  }`;

const newAudioHelper = `  // Live Audio Streaming helper with audio context unlocking and jitter buffer
  function startLiveAudioStream(wsUrl: string) {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      let ctx = audioCtxRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioCtx({ sampleRate: 16000 });
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      if (wsMonitorRef.current) {
        try { wsMonitorRef.current.close(); } catch {}
      }

      const ws = new WebSocket(wsUrl);
      wsMonitorRef.current = ws;
      ws.binaryType = "arraybuffer";
      nextPlayTimeRef.current = ctx.currentTime;

      ws.onopen = () => {
        console.log("🎧 Live headphone audio stream connected");
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
      };

      ws.onmessage = (event) => {
        if (!ctx) return;
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }

        let rawBuffer: ArrayBuffer | null = null;
        if (event.data instanceof ArrayBuffer) {
          rawBuffer = event.data;
        } else if (typeof event.data === "string") {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.data) {
              const bin = atob(parsed.data);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              rawBuffer = bytes.buffer;
            }
          } catch {}
        }

        if (rawBuffer && rawBuffer.byteLength > 0) {
          const pcm16 = new Int16Array(rawBuffer);
          const float32 = new Float32Array(pcm16.length);
          for (let i = 0; i < pcm16.length; i++) {
            float32[i] = (pcm16[i] as number) / 32768;
          }
          const buffer = ctx.createBuffer(1, float32.length, 16000);
          buffer.copyToChannel(float32, 0);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          
          const now = ctx.currentTime;
          const playTime = Math.max(now, nextPlayTimeRef.current);
          source.start(playTime);
          nextPlayTimeRef.current = playTime + buffer.duration;
        }
      };

      ws.onerror = (err) => {
        console.log("Audio Stream monitor error:", err);
      };

      ws.onclose = () => {
        console.log("Audio stream monitor closed");
      };
    } catch (e) {
      console.log("Audio Stream monitor error:", e);
    }
  }`;

dialog = dialog.replace(oldAudioHelper, newAudioHelper);

// Update button click handler to resume audio context immediately
dialog = dialog.replace(
  /onClick=\{\(\) => \{\s*if \(!isListeningLive\) \{\s*setIsListeningLive\(true\);\s*isListeningLiveRef\.current = true;\s*toast\.success\("🎧 Headphone live monitor activated"\);\s*\} else \{\s*setIsListeningLive\(false\);\s*isListeningLiveRef\.current = false;\s*stopLiveAudioStream\(\);\s*toast\.info\("Headphone monitor muted"\);\s*\}\s*\}\}/,
  `onClick={() => {
                      if (!isListeningLive) {
                        setIsListeningLive(true);
                        isListeningLiveRef.current = true;
                        try {
                          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                          if (AudioCtx) {
                            if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
                              audioCtxRef.current = new AudioCtx({ sampleRate: 16000 });
                            }
                            if (audioCtxRef.current.state === "suspended") {
                              audioCtxRef.current.resume().catch(() => {});
                            }
                          }
                        } catch {}
                        if (latestListenUrlRef.current && !wsMonitorRef.current) {
                          startLiveAudioStream(latestListenUrlRef.current);
                        }
                        toast.success("🎧 Headphone live monitor activated");
                      } else {
                        setIsListeningLive(false);
                        isListeningLiveRef.current = false;
                        stopLiveAudioStream();
                        toast.info("Headphone monitor muted");
                      }
                    }}`
);

fs.writeFileSync(dialogPath, dialog, 'utf8');
console.log('AiCallDialog.tsx updated for crystal-clear live headphone audio stream!');