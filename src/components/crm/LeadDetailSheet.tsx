import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Building2, Mail, Phone, StickyNote, UserRound, PhoneCall, Headphones, Play, RefreshCw, Volume2, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { agents, ALL_STATUSES, statusLabels, type Lead, type LeadStatus } from "@/lib/crm-data";
import { statusTone, useCrm } from "@/lib/crm-store";
import { cancelMeetingBookingFn, getVapiCallLogsFn } from "@/lib/server-actions";
import { AiCallDialog } from "./AiCallDialog";

export function LeadDetailSheet({
  lead,
  onOpenChange,
}: {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateLead, addNote } = useCrm();
  const [note, setNote] = useState("");
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  useEffect(() => {
    if (!lead) return;
    fetchLeadCalls();
  }, [lead?.id, lead?.phone]);

  async function fetchLeadCalls() {
    setLoadingCalls(true);
    try {
      const res = await getVapiCallLogsFn();
      if (res?.success && Array.isArray(res.calls)) {
        const leadPhoneClean = (lead?.phone || "").replace(/[^\d]/g, "");
        const leadEmailClean = (lead?.email || "").trim().toLowerCase();

        const matched = res.calls.filter((c: any) => {
          if (!c || c.endedReason === "call-deleted" || c.status === "deleted") return false;
          const customerNum = (c?.customer?.number || "").replace(/[^\d]/g, "");
          // 1. Strict Phone Match
          if (leadPhoneClean && customerNum) {
            if (
              customerNum.endsWith(leadPhoneClean) ||
              leadPhoneClean.endsWith(customerNum) ||
              customerNum.includes(leadPhoneClean) ||
              leadPhoneClean.includes(customerNum)
            ) {
              return true;
            }
          }
          // 2. Strict Email Match in Transcript / Structured Data
          const transcript = (c?.transcript || "").toLowerCase();
          const summary = (c?.analysis?.summary || "").toLowerCase();
          const emailExtracted = (c?.analysis?.structuredData?.clientEmail || "").toLowerCase();
          if (leadEmailClean && leadEmailClean.length > 4 && leadEmailClean !== "—") {
            if (
              emailExtracted.includes(leadEmailClean) ||
              transcript.includes(leadEmailClean) ||
              summary.includes(leadEmailClean)
            ) {
              return true;
            }
          }
          return false;
        });
        setCallLogs(matched);
      }
    } catch (err) {
      console.error("Failed to load call recordings:", err);
    }
    setLoadingCalls(false);
  }

  if (!lead) return null;

  return (
    <Sheet open={!!lead} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="font-display text-xl">{lead.name}</SheetTitle>
              <SheetDescription>
                {lead.company} · Deal value ${lead.value.toLocaleString()}
              </SheetDescription>
            </div>
            {lead.phone && lead.phone.trim().length > 3 && lead.phone !== "—" ? (
              <Button
                size="sm"
                onClick={() => setIsCallOpen(true)}
                className="rounded-xl gap-1.5 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-md transition-all active:scale-95"
              >
                <PhoneCall className="size-3.5" />
                <span>AI Call</span>
              </Button>
            ) : null}
          </div>
          <Badge variant="outline" className={`mt-1 w-fit rounded-full ${statusTone[lead.status]}`}>
            {statusLabels[lead.status]}
          </Badge>
        </SheetHeader>

        <Tabs defaultValue="details" className="px-4 pb-8">
          <TabsList className="grid w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="details" className="rounded-lg text-xs">
              Details
            </TabsTrigger>
            <TabsTrigger value="edit" className="rounded-lg text-xs">
              Edit
            </TabsTrigger>
            <TabsTrigger value="calls" className="rounded-lg text-xs gap-1">
              <Headphones className="size-3" /> Calls
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-lg text-xs">
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-5 space-y-4">
            {[
              [Mail, "Email", lead.email],
              [Phone, "Phone", lead.phone],
              [Building2, "Company", lead.company],
              [UserRound, "Assigned agent", lead.agent],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Mail;
              return (
                <div key={label as string} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
                    <I className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label as string}</p>
                    <p className="truncate text-sm font-medium">{value as string}</p>
                  </div>
                </div>
              );
            })}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Last contact</p>
                <p className="text-sm font-medium">
                  {new Date(lead.lastContact).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Next follow-up</p>
                <p className="text-sm font-medium">
                  {new Date(lead.nextFollowUp).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={lead.status}
                onValueChange={async (v) => {
                  updateLead(lead.id, { status: v as LeadStatus });
                  try {
                    const nowIso = new Date().toISOString();
                    type LeadStatusUpdate = {
                      status: LeadStatus;
                      contacted_at?: string;
                      booked_at?: string;
                      won_at?: string;
                    };
                    const payload: LeadStatusUpdate = { status: v as LeadStatus };
                    if (v === "contacted" || v === "replied") {
                      payload.contacted_at = nowIso;
                    } else if (v === "booked") {
                      payload.contacted_at = nowIso;
                      payload.booked_at = nowIso;
                    } else if (v === "won") {
                      payload.contacted_at = nowIso;
                      payload.won_at = nowIso;
                    }

                    if (v === "booking_cancelled" && lead.email) {
                      cancelMeetingBookingFn({
                        data: {
                          leadEmail: lead.email,
                          cancelledBy: "agent",
                        },
                      }).catch(console.error);
                    }

                    await supabase.from("leads").update(payload).eq("id", lead.id);
                    toast.success(`Lead status updated to ${statusLabels[v as LeadStatus] ?? v}`);
                  } catch (e) {
                    console.error("Supabase lead status update error:", e);
                  }
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned agent</Label>
              <Select
                value={lead.agent}
                onValueChange={(v) => {
                  updateLead(lead.id, { agent: v });
                  toast.success("Lead reassigned");
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                className="rounded-xl"
                defaultValue={lead.email}
                onBlur={(e) => updateLead(lead.id, { email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                className="rounded-xl"
                defaultValue={lead.phone}
                onBlur={(e) => updateLead(lead.id, { phone: e.target.value })}
              />
            </div>
            <Button className="w-full rounded-xl" onClick={() => toast.success("Lead saved")}>
              Save changes
            </Button>
          </TabsContent>

          {/* ── CALLS & AUDIO RECORDINGS TAB ── */}
          <TabsContent value="calls" className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">AI Voice Call Recordings</p>
                <p className="text-[11px] text-muted-foreground">Listen to conversations and read full transcripts</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLeadCalls}
                disabled={loadingCalls}
                className="h-7 px-2 rounded-lg text-xs gap-1"
              >
                <RefreshCw className={`size-3.5 ${loadingCalls ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
            </div>

            {loadingCalls ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <RefreshCw className="size-5 animate-spin mx-auto mb-2 opacity-50" />
                Loading call recordings from voice server...
              </div>
            ) : callLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
                <Headphones className="size-8 mx-auto opacity-30 text-violet-400" />
                <p className="text-xs text-muted-foreground font-medium">No call recordings found for this lead yet.</p>
                {lead.phone && lead.phone !== "—" && (
                  <Button
                    size="sm"
                    onClick={() => setIsCallOpen(true)}
                    className="rounded-xl text-xs gap-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold"
                  >
                    <PhoneCall className="size-3.5" /> Start First AI Call
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {callLogs.map((c: any) => {
                  const startedAt = c.startedAt ? new Date(c.startedAt).toLocaleString() : "Recent Call";
                  const durationSecs = c.duration ? Math.round(c.duration) : 0;
                  const durationStr = `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`;
                  const recording =
                    c.recordingUrl ||
                    c.artifact?.recordingUrl ||
                    c.stereoRecordingUrl ||
                    c.artifact?.stereoRecordingUrl;
                  const transcript =
                    c.transcript ||
                    c.artifact?.transcript ||
                    (c.messages || [])
                      .filter((m: any) => m.role === "assistant" || m.role === "user")
                      .map((m: any) => `${m.role === "assistant" ? "🤖 AI (Alex)" : "👤 Prospect"}: ${m.message}`)
                      .join("\n\n");
                  const summary = c.summary || c.analysis?.summary;

                  return (
                    <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="grid size-7 place-items-center rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
                            <PhoneCall className="size-3.5" />
                          </span>
                          <div>
                            <span className="text-xs font-bold text-foreground block">{startedAt}</span>
                            <span className="text-[10px] text-muted-foreground">Lead: {c.customer?.name || lead.name} ({c.customer?.number || lead.phone})</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[11px] bg-white/5 font-mono">
                            ⏱️ {durationStr}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 capitalize">
                            {c.status || "Ended"}
                          </Badge>
                        </div>
                      </div>

                      {/* Live Audio Player */}
                      {recording ? (
                        <div className="rounded-xl bg-violet-950/20 p-3 border border-violet-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                              <Volume2 className="size-4 text-violet-400 animate-pulse" /> Listen to Audio Recording:
                            </span>
                            <a
                              href={recording}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 underline"
                            >
                              📥 Download
                            </a>
                          </div>
                          <audio controls src={recording} preload="auto" className="w-full h-9 rounded-lg" />
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-accent/30 text-center text-xs text-muted-foreground">
                          ⏳ Audio is processing, click Refresh in 10 seconds...
                        </div>
                      )}

                      {/* AI Summary */}
                      {summary && (
                        <div className="rounded-lg bg-surface-2 border border-border p-2.5 text-xs text-foreground leading-relaxed">
                          <span className="font-bold flex items-center gap-1 text-[11px] text-violet-400 mb-1">
                            <Sparkles className="size-3.5" /> AI Call Summary:
                          </span>
                          {summary}
                        </div>
                      )}

                      {/* Full Transcript */}
                      {transcript ? (
                        <details className="text-xs text-muted-foreground group" open>
                          <summary className="cursor-pointer font-bold text-violet-400 hover:text-violet-300 select-none text-[11px] flex items-center gap-1">
                            📜 Word-by-Word Call Transcript (Click to Toggle)
                          </summary>
                          <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-border text-xs leading-relaxed max-h-56 overflow-y-auto space-y-2">
                            {transcript.split("\n\n").map((chunk: string, i: number) => {
                              const isAi = chunk.startsWith("🤖") || chunk.startsWith("AI:");
                              return (
                                <div
                                  key={i}
                                  className={`p-2 rounded-lg ${
                                    isAi
                                      ? "bg-violet-900/30 text-violet-200 border border-violet-500/20"
                                      : "bg-slate-800/60 text-slate-200"
                                  }`}
                                >
                                  {chunk}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-5 space-y-4">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this lead…"
              className="min-h-24 rounded-xl"
            />
            <Button
              className="rounded-xl"
              disabled={!note.trim()}
              onClick={() => {
                addNote(lead.id, note.trim());
                setNote("");
                toast.success("Note added");
              }}
            >
              <StickyNote className="size-4" /> Add note
            </Button>
            <div className="space-y-2">
              {lead.notes.map((n, i) => (
                <p key={i} className="rounded-xl border border-border bg-surface-2/60 p-3 text-sm">
                  {n}
                </p>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>

      <AiCallDialog
        open={isCallOpen}
        onOpenChange={setIsCallOpen}
        lead={lead}
      />
    </Sheet>
  );
}
