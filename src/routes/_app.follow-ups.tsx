import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/crm/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import { markLeadAsRepliedFn, triggerNextFollowUpFn } from "@/lib/server-actions";

export const Route = createFileRoute("/_app/follow-ups")({
  head: () => ({
    meta: [
      { title: "Follow-ups — Teals CRM" },
      {
        name: "description",
        content:
          "Track automated email follow-up sequences (24h, 48h, 72h, 10d) for leads awaiting response.",
      },
      { property: "og:title", content: "Follow-ups — Teals CRM" },
      {
        property: "og:description",
        content: "Automated sequence tracking for un-booked and un-replied leads.",
      },
    ],
  }),
  component: FollowUpsPage,
});

type DbLead = {
  id: string;
  name: string;
  company: string;
  email: string;
  status: string;
  agent: string;
  assigned_agent_name?: string;
  created_at: string;
};

type DbEmailLog = {
  id: string;
  lead_id: string;
  lead_email: string;
  sequence_type: string;
  status: string;
  sent_at: string;
};

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
      <Icon className="h-10 w-10 opacity-30" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function FollowUpsPage() {
  const { user } = useCrm();
  const isAdmin = Boolean(user && (user.role === "admin" || user.email === "garryamelia6265@gmail.com"));

  const [mounted, setMounted] = useState(false);
  const [leads, setLeads] = useState<DbLead[]>([]);
  const [emails, setEmails] = useState<DbEmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [sendingNextId, setSendingNextId] = useState<string | null>(null);
  const [markingRepliedId, setMarkingRepliedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function fetchLive() {
    setLoading(true);
    try {
      // 1. Fetch leads that have NOT booked a meeting and NOT replied
      let query = supabase
        .from("leads")
        .select("*")
        .neq("status", "meeting")
        .neq("status", "booked")
        .neq("status", "won")
        .neq("status", "lost")
        .neq("status", "replied")
        .order("created_at", { ascending: false });

      if (!isAdmin && user?.email) {
        query = query.eq("assigned_agent_name", user.email.trim());
      }

      const { data: fetchedLeads } = await query;
      const safeLeads = (fetchedLeads || []) as DbLead[];
      setLeads(safeLeads);

      // 2. Fetch email logs to determine which follow-ups were sent
      const { data: fetchedEmails } = await supabase
        .from("emails_sent")
        .select("id, lead_id, lead_email, sequence_type, status, sent_at");

      setEmails((fetchedEmails || []) as DbEmailLog[]);
    } catch (err) {
      console.error("Fetch follow-ups error:", err);
    }
    setLastSync(new Date());
    setLoading(false);
  }

  useEffect(() => {
    fetchLive();

    const leadsSub = supabase
      .channel("fu-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLive())
      .subscribe();

    const emailsSub = supabase
      .channel("fu-emails")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails_sent" }, () => fetchLive())
      .subscribe();

    const interval = setInterval(fetchLive, 20000);

    return () => {
      leadsSub.unsubscribe();
      emailsSub.unsubscribe();
      clearInterval(interval);
    };
  }, [user?.email, user?.role]);

  // Build sent follow-up lookup set per lead ID/email
  const sentSequenceMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    (emails || []).forEach((e) => {
      if (!e) return;
      const keys = [e.lead_id, e.lead_email?.toLowerCase()].filter(Boolean) as string[];
      keys.forEach((k) => {
        if (!map[k]) map[k] = new Set();
        if (e.sequence_type) map[k].add(e.sequence_type);
      });
    });
    return map;
  }, [emails]);

  // Helper to check if a specific stage was sent to a lead
  const isStageSent = (lead: DbLead, stageKey: string) => {
    const setById = sentSequenceMap[lead.id];
    const setByEmail = sentSequenceMap[lead.email?.toLowerCase()];
    if (setById?.has(stageKey) || setByEmail?.has(stageKey)) return true;

    // Time fallback if import age >= hours required
    const now = new Date();
    const created = new Date(lead.created_at || now.toISOString());
    const hours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (stageKey === "followup_24h" && hours >= 24) return true;
    if (stageKey === "followup_48h" && hours >= 48) return true;
    if (stageKey === "followup_72h" && hours >= 72) return true;
    if (stageKey === "followup_10d" && hours >= 240) return true;

    return false;
  };

  // Determine next unsent stage for manual trigger button
  const getNextStage = (lead: DbLead): "24h" | "48h" | "72h" | "10d" | null => {
    if (!isStageSent(lead, "followup_24h")) return "24h";
    if (!isStageSent(lead, "followup_48h")) return "48h";
    if (!isStageSent(lead, "followup_72h")) return "72h";
    if (!isStageSent(lead, "followup_10d")) return "10d";
    return null;
  };

  // Manual Trigger: Send Next Follow-up Now
  async function handleSendNextFollowUp(lead: DbLead) {
    const nextStage = getNextStage(lead);
    if (!nextStage) {
      toast.info("All 4 follow-up emails have already been sent to this lead!");
      return;
    }

    setSendingNextId(lead.id);
    toast.loading(`Sending ${nextStage.toUpperCase()} Follow-up email via Gmail SMTP...`);

    const res = await triggerNextFollowUpFn({
      data: {
        leadId: lead.id,
        leadEmail: lead.email,
        leadName: lead.name,
        stage: nextStage,
      },
    });

    setSendingNextId(null);
    if (res?.success) {
      toast.success(`${nextStage.toUpperCase()} Follow-up email sent successfully!`);
      fetchLive();
    } else {
      toast.error(res?.error || "Failed to send follow-up email.");
    }
  }

  // Manual Action: Mark as Replied
  async function handleMarkAsReplied(lead: DbLead) {
    setMarkingRepliedId(lead.id);
    toast.loading(`Marking ${lead.name} as Replied...`);

    const res = await markLeadAsRepliedFn({
      data: {
        leadId: lead.id,
        leadEmail: lead.email,
      },
    });

    setMarkingRepliedId(null);
    if (res?.success) {
      toast.success(`${lead.name} marked as Replied! Moved to Replied tab.`);
      fetchLive();
    } else {
      toast.error(res?.error || "Failed to mark lead as replied.");
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        subtitle="Leads awaiting response — live automated sequence tracking (24h, 48h, 72h, 10d)."
        action={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {loading ? "Syncing..." : `Live · ${lastSync.toLocaleTimeString()}`}
            </span>
            <Button onClick={fetchLive} variant="outline" size="sm" className="rounded-xl gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Overview Stat Cards (5 Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">Awaiting Response</p>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">{leads.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">No booking or reply yet</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">24h Follow-up</p>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-amber-400">
            {leads.filter((l) => isStageSent(l, "followup_24h")).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">First check-in sent</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">48h Follow-up</p>
            <Mail className="h-4 w-4 text-purple-400" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-purple-400">
            {leads.filter((l) => isStageSent(l, "followup_48h")).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Value email sent</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">72h Follow-up</p>
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-cyan-400">
            {leads.filter((l) => isStageSent(l, "followup_72h")).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Demo invitation sent</p>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">10 Days Follow-up</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-400">
            {leads.filter((l) => isStageSent(l, "followup_10d")).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Final check-in sent</p>
        </div>
      </div>

      {/* Live Un-booked & Un-replied Leads List */}
      <div className="panel p-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div>
            <h2 className="font-display text-lg font-bold">Follow-up Sequence Pipeline</h2>
            <p className="text-sm text-muted-foreground">
              Only active leads without booking or reply are listed here. Once a lead replies or books, it moves to Replied/Booked.
            </p>
          </div>
          <Badge variant="outline" className="rounded-full font-semibold">
            {leads.length} Active Leads
          </Badge>
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={Users}
            text="No pending follow-ups! All imported leads have either replied or booked a meeting."
          />
        ) : (
          <div className="mt-5 space-y-4">
            {leads.map((lead) => {
              const sent24h = isStageSent(lead, "followup_24h");
              const sent48h = isStageSent(lead, "followup_48h");
              const sent72h = isStageSent(lead, "followup_72h");
              const sent10d = isStageSent(lead, "followup_10d");
              const nextStage = getNextStage(lead);

              return (
                <div
                  key={lead.id}
                  className="grid grid-cols-1 gap-4 rounded-2xl border border-border/70 bg-card/60 p-4 transition-all duration-200 hover:border-primary/40 lg:grid-cols-[1.2fr_1.8fr_auto] lg:items-center"
                >
                  {/* Lead Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="text-sm font-bold bg-primary/15 text-primary">
                        {lead.name?.slice(0, 2).toUpperCase() || "LD"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{lead.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
                      <p className="truncate text-[11px] text-muted-foreground/70 mt-0.5">
                        {lead.company || "Company"} · Agent: {lead.assigned_agent_name || lead.agent || "Unassigned"}
                      </p>
                    </div>
                  </div>

                  {/* 4 Follow-up Sequence Badges */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                      Follow-up Email Sequence Status
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 24 Hours */}
                      <Badge
                        variant="outline"
                        className={`rounded-xl px-3 py-1 text-xs transition-all ${
                          sent24h
                            ? "bg-emerald-600 text-white font-semibold border-emerald-500 shadow-sm"
                            : "bg-muted/30 text-muted-foreground border-border/40 opacity-70"
                        }`}
                      >
                        {sent24h ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <Clock className="mr-1.5 h-3.5 w-3.5 opacity-60" />}
                        24 Hours
                      </Badge>

                      {/* 48 Hours */}
                      <Badge
                        variant="outline"
                        className={`rounded-xl px-3 py-1 text-xs transition-all ${
                          sent48h
                            ? "bg-emerald-600 text-white font-semibold border-emerald-500 shadow-sm"
                            : "bg-muted/30 text-muted-foreground border-border/40 opacity-70"
                        }`}
                      >
                        {sent48h ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <Clock className="mr-1.5 h-3.5 w-3.5 opacity-60" />}
                        48 Hours
                      </Badge>

                      {/* 72 Hours */}
                      <Badge
                        variant="outline"
                        className={`rounded-xl px-3 py-1 text-xs transition-all ${
                          sent72h
                            ? "bg-emerald-600 text-white font-semibold border-emerald-500 shadow-sm"
                            : "bg-muted/30 text-muted-foreground border-border/40 opacity-70"
                        }`}
                      >
                        {sent72h ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <Clock className="mr-1.5 h-3.5 w-3.5 opacity-60" />}
                        72 Hours
                      </Badge>

                      {/* 10 Days */}
                      <Badge
                        variant="outline"
                        className={`rounded-xl px-3 py-1 text-xs transition-all ${
                          sent10d
                            ? "bg-emerald-600 text-white font-semibold border-emerald-500 shadow-sm"
                            : "bg-muted/30 text-muted-foreground border-border/40 opacity-70"
                        }`}
                      >
                        {sent10d ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <Clock className="mr-1.5 h-3.5 w-3.5 opacity-60" />}
                        10 Days
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {nextStage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sendingNextId === lead.id}
                        onClick={() => handleSendNextFollowUp(lead)}
                        className="rounded-xl h-8 text-xs font-semibold text-primary hover:bg-primary/10 border-primary/30"
                      >
                        {sendingNextId === lead.id ? (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5 text-primary" />
                        )}
                        Send {nextStage.toUpperCase()} Now
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="rounded-lg text-xs">
                        All 4 Sent
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={markingRepliedId === lead.id}
                      onClick={() => handleMarkAsReplied(lead)}
                      className="rounded-xl h-8 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                    >
                      {markingRepliedId === lead.id ? (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                      )}
                      Mark as Replied
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
