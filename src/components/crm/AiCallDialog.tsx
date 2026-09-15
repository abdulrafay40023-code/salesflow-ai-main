import { useState, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  Headphones,
  User,
  Radio,
  MessageSquare,
  Mail,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  startVapiPhoneCallFn,
  getVapiCallStatusFn,
  stopVapiCallFn,
  processVapiCallBookingFn,
} from "@/lib/server-actions";
import {
  VAPI_PUBLIC_KEY,
  VAPI_PHONE_NUMBER,
} from "@/lib/vapi-client";
import { toast } from "sonner";

type AiCallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
  } | null;
  onCallComplete?: () => void;
};

type CaptionItem = {
  role: "assistant" | "user";
  text: string;
};

export function AiCallDialog({
  open,
  onOpenChange,
  lead,
  onCallComplete,
}: AiCallDialogProps) {
  const [activeTab, setActiveTab] = useState<"phone" | "web">("phone");
  const [phoneNumber, setPhoneNumber] = useState(lead?.phone || "");
  const [isDialing, setIsDialing] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [bookingInfo, setBookingInfo] = useState<{
    booked: boolean;
    clientEmail?: string;
    bookingDate?: string;
    bookingTime?: string;
  } | null>(null);
  const [outboundCallStatus, setOutboundCallStatus] = useState<
    "idle" | "ringing" | "connected" | "ended"
  >("idle");

  // Real-Time Live Captions for Phone Call
  const [liveCaptions, setLiveCaptions] = useState<CaptionItem[]>([]);
  const captionsEndRef = useRef<HTMLDivElement | null>(null);

  // Live Audio Streaming in Headphones (WebSocket Monitor)
  // FIX: Use ref alongside state to avoid stale closure in polling interval
  const [isListeningLive, setIsListeningLive] = useState(false);
  const isListeningLiveRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wsMonitorRef = useRef<WebSocket | null>(null);
  const latestListenUrlRef = useRef<string | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Manual email send state (shown after call ends)
  const [manualEmailInput, setManualEmailInput] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Web Call State (Microphone in Browser)
  const [webCallStatus, setWebCallStatus] = useState<
    "idle" | "connecting" | "active" | "ended"
  >("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcriptLog, setTranscriptLog] = useState<CaptionItem[]>([]);

  const vapiRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  // FIX: Keep activeCallId in ref so polling closure always reads current value
  const activeCallIdRef = useRef<string | null>(null);

  // Sync phone number when lead changes
  useEffect(() => {
    if (lead?.phone) {
      setPhoneNumber(lead.phone);
    }
  }, [lead]);

  // Sync manualEmailInput with lead email
  useEffect(() => {
    if (lead?.email) {
      setManualEmailInput(lead.email);
    }
  }, [lead, open]);

  // Auto-scroll captions to bottom
  useEffect(() => {
    if (captionsEndRef.current) {
      captionsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveCaptions, transcriptLog]);

  // Stopwatch Timer for call duration
  useEffect(() => {
    if (webCallStatus === "active" || outboundCallStatus === "connected") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [webCallStatus, outboundCallStatus]);

  // Polling to auto-detect when call connects, updates live captions, or ends
  useEffect(() => {
    if (!activeCallId || outboundCallStatus === "idle" || outboundCallStatus === "ended") return;

    const pollInterval = setInterval(async () => {
      try {
        const callId = activeCallIdRef.current;
        if (!callId) return;

        const res = await getVapiCallStatusFn({ data: { callId } });
        if (!res?.success) return;

        // If status moved to in-progress
        if (res.status === "in-progress" && outboundCallStatus === "ringing") {
          setOutboundCallStatus("connected");
        }

        // Update Live Captions from real-time messages / transcript
        if (res.messages && Array.isArray(res.messages) && res.messages.length > 0) {
          const formatted: CaptionItem[] = res.messages
            .filter((m: any) => m.role === "assistant" || m.role === "user" || m.role === "bot")
            .map((m: any) => ({
              role: m.role === "user" ? ("user" as const) : ("assistant" as const),
              text: m.message || m.content || "",
            }))
            .filter((m: any) => m.text.trim().length > 0);
          if (formatted.length > 0) {
            setLiveCaptions(formatted);
          }
        } else if (res.transcript) {
          const lines = res.transcript.split("\n").filter(Boolean);
          const formatted: CaptionItem[] = lines.map((l: string) => {
            const isUser =
              l.toLowerCase().startsWith("user:") ||
              l.toLowerCase().startsWith("client:") ||
              l.toLowerCase().startsWith("prospect:");
            const text = l.replace(/^(AI|User|Client|Prospect|Assistant):\s*/i, "").trim();
            return { role: isUser ? ("user" as const) : ("assistant" as const), text };
          });
          setLiveCaptions(formatted);
        }

        // FIX: Always save latest listenUrl and connect if live monitoring enabled
        if (res.listenUrl) {
          latestListenUrlRef.current = res.listenUrl;
          if (isListeningLiveRef.current && !wsMonitorRef.current) {
            startLiveAudioStream(res.listenUrl);
          }
        }

        // Check if call ended
        if (res.status === "ended" || res.endedReason) {
          setOutboundCallStatus("ended");
          stopLiveAudioStream();
          if (res.duration) setCallDuration(Math.round(res.duration));
          clearInterval(pollInterval);

          // Trigger automated booking & confirmation email check
          try {
            const bookRes = await processVapiCallBookingFn({
              data: {
                callId,
                ...(lead?.id ? { leadId: lead.id } : {}),
                ...(lead?.email ? { leadEmail: lead.email } : {}),
              },
            });
            if (bookRes?.booked && bookRes?.clientEmail) {
              setBookingInfo(bookRes);
              setEmailSent(true);
              toast.success(
                `🎉 Demo Booked! Confirmation email sent to ${bookRes.clientEmail}`
              );
            } else {
              setBookingInfo({ booked: false });
              toast.info("Call ended (Status: Contacted).");
            }
          } catch (bErr) {
            console.error("Auto-booking check error:", bErr);
            setBookingInfo({ booked: false });
          }

          if (onCallComplete) onCallComplete();

          // 100% Fully Automated: Auto-close dialer after 2.5s and refresh dashboard/leads list
          setTimeout(() => {
            handleCloseDialog();
            if (onCallComplete) onCallComplete();
          }, 2600);
        }
      } catch (e) {
        console.error("Poll call status error:", e);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [activeCallId, outboundCallStatus, isListeningLive]);

  // Live Audio Streaming helper with audio context unlocking and jitter buffer
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
  }

  function stopLiveAudioStream() {
    if (wsMonitorRef.current) {
      try {
        wsMonitorRef.current.close();
      } catch {}
      wsMonitorRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
  }

  // Initialize Vapi Web Client for browser calls
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const vapi = new Vapi(VAPI_PUBLIC_KEY);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setWebCallStatus("active");
        setCallDuration(0);
        toast.success("Connected to AI Sales Agent! Speak into your microphone.");
      });

      vapi.on("call-end", () => {
        setWebCallStatus("ended");
        setIsSpeaking(false);
        toast.info("Browser AI call ended.");
        if (onCallComplete) onCallComplete();
      });

      vapi.on("speech-start", () => {
        setIsSpeaking(true);
      });

      vapi.on("speech-end", () => {
        setIsSpeaking(false);
      });

      vapi.on("message", (msg: any) => {
        if (msg.type === "transcript" && msg.transcriptType === "final") {
          setTranscriptLog((prev) => [
            ...prev,
            { role: msg.role === "assistant" ? "assistant" : "user", text: msg.transcript },
          ]);
        }
      });

      vapi.on("error", (err: any) => {
        console.error("Vapi Web Call Error:", err);
        setWebCallStatus("idle");
        toast.error("Call error: " + (err?.message || "Check microphone access"));
      });
    } catch (e) {
      console.error("Failed to initialize Vapi Web SDK:", e);
    }

    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, []);

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // ── Handler 1: Outbound Phone Call (PSTN) ──
  async function handleStartPhoneCall() {
    if (!phoneNumber || phoneNumber.trim().length < 7) {
      toast.error("Please enter a valid phone number (e.g. +16508801129 or +92300...)");
      return;
    }

    setIsDialing(true);
    setOutboundCallStatus("ringing");
    setCallDuration(0);
    setActiveCallId(null);
    activeCallIdRef.current = null;
    setLiveCaptions([]);
    setBookingInfo(null);
    setEmailSent(false);

    try {
      type StartCallPayload = {
        phoneNumber: string;
        leadId?: string;
        leadName?: string;
        leadEmail?: string;
        agentEmail?: string;
      };
      const callData: StartCallPayload = { phoneNumber: phoneNumber.trim() };
      if (lead?.id) callData.leadId = lead.id;
      if (lead?.name) callData.leadName = lead.name;
      if (lead?.email) callData.leadEmail = lead.email;
      if ((lead as any)?.assigned_agent_name || (lead as any)?.agent) {
        callData.agentEmail = (lead as any).assigned_agent_name || (lead as any).agent;
      }

      const res = await startVapiPhoneCallFn({
        data: callData,
      });

      if (res?.success) {
        toast.success(`📞 Outbound AI Call Triggered to ${res.phone}!`);
        if (res.callId) {
          setActiveCallId(res.callId);
          activeCallIdRef.current = res.callId;
        }
        setOutboundCallStatus("connected");
      } else {
        setOutboundCallStatus("idle");
        toast.error(res?.error || "Failed to initiate outbound call");
      }
    } catch (err: any) {
      setOutboundCallStatus("idle");
      toast.error(err?.message || "Outbound call failed");
    }
    setIsDialing(false);
  }

  // Manually Hang Up Phone Call
  async function handleHangupPhoneCall() {
    const callId = activeCallIdRef.current;
    if (callId) {
      toast.info("Disconnecting call...");
      await stopVapiCallFn({ data: { callId } });
    }
    stopLiveAudioStream();
    setIsListeningLive(false);
    isListeningLiveRef.current = false;
    setOutboundCallStatus("ended");

    // Automatically check for booking even on manual hangup
    if (callId) {
      try {
        const bookRes = await processVapiCallBookingFn({
          data: {
            callId,
            ...(lead?.id ? { leadId: lead.id } : {}),
            ...(lead?.email ? { leadEmail: lead.email } : {}),
          },
        });
        if (bookRes?.booked && bookRes?.clientEmail) {
          setBookingInfo(bookRes);
          setEmailSent(true);
          toast.success(`🎉 Demo Booked! Confirmation email sent to ${bookRes.clientEmail}`);
        } else {
          setBookingInfo({ booked: false });
        }
      } catch (e) {
        setBookingInfo({ booked: false });
      }
    } else {
      if (!bookingInfo?.booked) setBookingInfo({ booked: false });
    }
    if (onCallComplete) onCallComplete();
  }

  // Send booking confirmation email manually
  async function handleSendManualEmail() {
    const emailToSend = manualEmailInput.trim() || lead?.email || "";
    if (!emailToSend || !emailToSend.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsSendingEmail(true);
    try {
      const callId = activeCallIdRef.current || "";
      const res = await processVapiCallBookingFn({
        data: { callId, ...(lead?.id ? { leadId: lead.id } : {}), leadEmail: emailToSend },
      });
      if (res?.booked && res?.clientEmail) {
        setBookingInfo(res);
        setEmailSent(true);
        toast.success(`Booking confirmation sent to ${res.clientEmail}!`);
      } else {
        setEmailSent(true);
        setBookingInfo({ booked: true, clientEmail: emailToSend });
        toast.success(`Confirmation email sent to ${emailToSend}!`);
      }
    } catch (err: any) {
      toast.error("Failed to send email: " + (err?.message || "Unknown error"));
    }
    setIsSendingEmail(false);
  }

  // ── Handler 2: Browser Mic Call ──
  async function handleStartWebCall() {
    if (!vapiRef.current) {
      toast.error("Vapi client not ready. Please refresh.");
      return;
    }

    setWebCallStatus("connecting");
    setCallDuration(0);
    setTranscriptLog([]);

    try {
      await vapiRef.current.start(undefined, {
        assistantId: undefined,
        variableValues: {
          customerName: lead?.name || "Valued Prospect",
          customerEmail: lead?.email || "",
          customerCompany: lead?.company || "",
        },
      });
    } catch (err: any) {
      console.error("Failed to start web call:", err);
      setWebCallStatus("idle");
      toast.error("Microphone call failed. Please check browser audio permissions.");
    }
  }

  function handleEndWebCall() {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
    setWebCallStatus("ended");
    setIsSpeaking(false);
  }

  function handleToggleMute() {
    if (!vapiRef.current) return;
    const nextMute = !isMuted;
    vapiRef.current.setMuted(nextMute);
    setIsMuted(nextMute);
  }

  function handleCloseDialog() {
    stopLiveAudioStream();
    if (webCallStatus === "active") {
      handleEndWebCall();
    }
    setWebCallStatus("idle");
    setOutboundCallStatus("idle");
    setCallDuration(0);
    setLiveCaptions([]);
    setBookingInfo(null);
    setEmailSent(false);
    setManualEmailInput(lead?.email || "");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="grid size-8 place-items-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <PhoneCall className="size-4.5" />
            </span>
            <div>
              <DialogTitle className="font-display text-lg font-bold">
                AI Voice Calling Station
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Live automated sales calling dialer & real-time captions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Lead Summary Pill */}
        <div className="rounded-xl border border-border bg-accent/40 p-3 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="size-4 text-violet-400" />
            <div>
              <p className="font-semibold text-foreground">{lead?.name || "Prospect Lead"}</p>
              <p className="text-muted-foreground">{lead?.email || "No email"}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]">
            Caller ID: {VAPI_PHONE_NUMBER}
          </Badge>
        </div>

        {/* Tabs: Outbound Phone vs Web Mic Call */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="phone" className="rounded-lg gap-2 text-xs font-semibold">
              <Phone className="size-3.5" /> Outbound Phone Call
            </TabsTrigger>
            <TabsTrigger value="web" className="rounded-lg gap-2 text-xs font-semibold">
              <Headphones className="size-3.5" /> Browser Test Call
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: OUTBOUND PHONE CALL ── */}
          <TabsContent value="phone" className="space-y-4 pt-2">
            {outboundCallStatus === "idle" && (
              <div className="space-y-2">
                <Label htmlFor="call-phone">Target Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="call-phone"
                    placeholder="+1 (555) 000-0000 or +92300..."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-9 rounded-xl font-mono text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Enter full phone number with country code (e.g. +1 for USA, +92 for PK, +44 for UK).
                </p>
              </div>
            )}

            {/* ── LIVE ACTIVE DIALER SCREEN ── */}
            {outboundCallStatus === "ringing" || outboundCallStatus === "connected" ? (
              <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-950/40 to-card p-4 space-y-3">
                {/* Caller & Status Header */}
                <div className="text-center space-y-1">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                    <PhoneCall className="size-6 text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground pt-1">{lead?.name || phoneNumber}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{phoneNumber}</p>
                  <Badge
                    variant="outline"
                    className={
                      outboundCallStatus === "ringing"
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse text-[11px]"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]"
                    }
                  >
                    {outboundCallStatus === "ringing" ? "📡 Ringing Phone Line..." : "🟢 Call Connected & Live"}
                  </Badge>
                  <div className="font-mono text-xl font-extrabold text-violet-300 pt-1">
                    ⏱️ {formatTime(callDuration)}
                  </div>
                </div>

                {/* Headphone Live Listening Toggle */}
                <div className="flex items-center justify-between rounded-xl bg-accent/30 border border-border p-2 px-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Headphones className="size-4 text-violet-400" />
                    <span className="font-medium text-foreground">Listen Live in Headphones</span>
                  </div>
                  <Button
                    size="sm"
                    variant={isListeningLive ? "default" : "outline"}
                    onClick={() => {
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
                    }}
                    className="h-7 text-[11px] rounded-lg px-2.5"
                  >
                    {isListeningLive ? (
                      <span className="flex items-center gap-1 text-emerald-300">
                        <Volume2 className="size-3.5 animate-pulse" /> Live
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <VolumeX className="size-3.5" /> Monitor
                      </span>
                    )}
                  </Button>
                </div>

                {/* 💬 REAL-TIME LIVE CAPTIONS BOX */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-1">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="size-3.5 text-violet-400" /> Live Conversation Captions:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-ping"></span> Real-time
                    </span>
                  </div>
                  <div className="h-44 overflow-y-auto space-y-2 rounded-xl border border-border bg-background/80 p-3 text-xs">
                    {liveCaptions.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center space-y-1">
                        <Radio className="size-5 text-violet-400 animate-pulse" />
                        <p className="text-[11px]">Connecting audio stream...</p>
                        <p className="text-[10px] opacity-70">Spoken words by Alex & Client will appear here in real-time</p>
                      </div>
                    ) : (
                      liveCaptions.map((c, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                            c.role === "assistant"
                              ? "bg-violet-600/15 border border-violet-500/20 text-violet-100 mr-4"
                              : "bg-emerald-600/15 border border-emerald-500/20 text-emerald-100 ml-4 text-right"
                          }`}
                        >
                          <span
                            className={`font-bold text-[10px] uppercase tracking-wider block mb-0.5 ${
                              c.role === "assistant" ? "text-violet-300" : "text-emerald-300"
                            }`}
                          >
                            {c.role === "assistant" ? "🤖 Sales Agent (Alex):" : "👤 Client (Prospect):"}
                          </span>
                          {c.text}
                        </div>
                      ))
                    )}
                    <div ref={captionsEndRef} />
                  </div>
                </div>

                {/* Hangup Button */}
                <Button
                  variant="destructive"
                  onClick={handleHangupPhoneCall}
                  className="w-full h-10 rounded-xl gap-2 font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg"
                >
                  <PhoneOff className="size-4" /> 🔴 End / Hang Up Call
                </Button>
              </div>
            ) : outboundCallStatus === "ended" ? (
              <div
                className={`rounded-2xl border p-5 space-y-4 ${
                  bookingInfo?.booked && emailSent
                    ? "border-emerald-500/40 bg-emerald-950/40 shadow-lg shadow-emerald-950/30"
                    : "border-border bg-accent/40"
                }`}
              >
                {bookingInfo?.booked && emailSent ? (
                  <>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="size-6 text-emerald-400" />
                      <p className="text-base font-bold text-emerald-300">
                        🎉 Demo Booked & Confirmation Sent!
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-900/40 border border-emerald-500/40 p-3 text-xs text-emerald-200 space-y-1.5">
                      {bookingInfo.bookingDate && (
                        <p className="font-semibold text-emerald-300 text-sm">
                          📅 Meeting Time: {bookingInfo.bookingDate} at {bookingInfo.bookingTime}
                        </p>
                      )}
                      <p className="text-xs text-emerald-400 font-mono">
                        ✉️ Confirmation Email Sent to: <span className="underline font-bold">{bookingInfo.clientEmail}</span>
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Lead pipeline status updated to <span className="font-bold text-emerald-400">Booked</span>!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="size-6 text-violet-400" />
                      <p className="text-base font-bold text-foreground">
                        Call Completed & Disconnected
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Lead status updated to <span className="font-semibold text-foreground">Contacted</span>.
                    </p>

                    {!emailSent && (
                      <div className="rounded-xl border border-violet-500/30 bg-violet-950/30 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-300">
                          <Mail className="size-3.5" />
                          Send Booking Confirmation Email to Client
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Enter the email address the client gave you on the call:
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="client@example.com"
                            value={manualEmailInput}
                            onChange={(e) => setManualEmailInput(e.target.value)}
                            className="h-8 text-xs rounded-lg font-mono flex-1"
                          />
                          <Button
                            size="sm"
                            disabled={isSendingEmail || !manualEmailInput.includes("@")}
                            onClick={handleSendManualEmail}
                            className="h-8 text-[11px] rounded-lg px-3 bg-violet-600 hover:bg-violet-500 text-white gap-1.5 font-bold shrink-0"
                          >
                            {isSendingEmail ? "Sending..." : <><Send className="size-3" /> Send Now</>}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="font-mono text-xs font-bold text-muted-foreground text-center">
                  ⏱️ Call Duration: {formatTime(callDuration)}
                </div>

                <Button
                  onClick={handleCloseDialog}
                  className="w-full h-9 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white"
                >
                  ✅ Close & Return to Leads
                </Button>
              </div>
            ) : null}

            {outboundCallStatus === "idle" && (
              <Button
                onClick={handleStartPhoneCall}
                disabled={isDialing}
                className="w-full h-11 rounded-xl gap-2 font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg"
              >
                <PhoneCall className="size-4" />
                {isDialing ? "Initiating Phone Line..." : "🚀 Dial Phone Call with AI"}
              </Button>
            )}
          </TabsContent>

          {/* ── TAB 2: WEB MIC TEST CALL ── */}
          <TabsContent value="web" className="space-y-4 pt-2">
            <div className="rounded-xl border border-border bg-card p-4 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30 shadow-inner">
                {isSpeaking ? (
                  <Volume2 className="size-7 animate-pulse text-emerald-400" />
                ) : (
                  <Headphones className="size-7" />
                )}
              </div>

              <div>
                <p className="font-bold text-sm text-foreground">
                  {webCallStatus === "active"
                    ? isSpeaking
                      ? "🗣️ AI Sales Agent is speaking..."
                      : "👂 AI is listening to you..."
                    : webCallStatus === "connecting"
                    ? "Connecting to Voice Engine..."
                    : "Test AI Voice Pitch in Your Browser"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Talk directly to your AI Assistant through your microphone & headphones.
                </p>
              </div>

              {webCallStatus === "active" && (
                <div className="font-mono text-xl font-extrabold text-violet-300">
                  {formatTime(callDuration)}
                </div>
              )}
            </div>

            {/* Live Transcript Log */}
            {transcriptLog.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-2 rounded-xl border border-border bg-accent/20 p-3 text-xs">
                {transcriptLog.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs ${
                      t.role === "assistant"
                        ? "bg-violet-600/10 text-violet-200 border border-violet-500/20"
                        : "bg-white/5 text-foreground text-right"
                    }`}
                  >
                    <span className="font-bold text-[10px] uppercase tracking-wider block opacity-60 mb-0.5">
                      {t.role === "assistant" ? "🤖 AI Agent (Alex)" : "👤 You"}
                    </span>
                    {t.text}
                  </div>
                ))}
              </div>
            )}

            {/* Web Call Controls */}
            {webCallStatus === "active" ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleToggleMute}
                  className="flex-1 rounded-xl gap-2 text-xs"
                >
                  {isMuted ? <MicOff className="size-4 text-rose-400" /> : <Mic className="size-4" />}
                  {isMuted ? "Unmute Mic" : "Mute Mic"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleEndWebCall}
                  className="flex-1 rounded-xl gap-2 text-xs font-bold"
                >
                  <PhoneOff className="size-4" /> End Call
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleStartWebCall}
                disabled={webCallStatus === "connecting"}
                className="w-full h-11 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
              >
                <Mic className="size-4" />
                {webCallStatus === "connecting" ? "Connecting Microphone..." : "🎙️ Start Live Mic Test Call"}
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
