import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck, Bot, CheckCircle2, Clock, MessageSquare,
  RefreshCw, Send, Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/crm/Topbar";
import { StatCard } from "@/components/crm/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCrm } from "@/lib/crm-store";
import { isAdminEmail } from "@/lib/crm-data";
import {
  triggerBookingFormEmailFn,
  triggerReminderEmailFn,
  checkAndSendMeetingRemindersFn,
  markLeadAsRepliedFn,
} from "@/lib/server-actions";

export const Route = createFileRoute("/_app/email")({
  head: () => ({
    meta: [
      { title: "AI Email Automation — Teals CRM" },
      { name: "description", content: "Welcome emails, reminder sequences, delivery history and AI automation timeline." },
      { property: "og:title", content: "AI Email Automation — Teals CRM" },
    ],
  }),
  component: EmailPage,
});

const stateTone: Record<string, string> = {
  sent:               "bg-primary/12 text-primary border-primary/25",
  opened:             "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  replied:            "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  meeting_confirmed:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending:            "bg-warning/15 text-warning border-warning/30",
  failed:             "bg-muted text-muted-foreground border-border",
};

type DbEmailLog = {
  id: string;
  lead_id: string;
  lead_email: string;
  subject: string;
  type: string;
  status: string;
  sent_at: string;
};

type DbLead = { id: string; name: string; company: string; email: string; status?: string };

function EmailPage() {
  const { user } = useCrm();
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));
  const [mounted, setMounted] = useState(false);
  const [emails, setEmails]   = useState<DbEmailLog[]>([]);
  const [leads, setLeads]     = useState<DbLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncStr, setLastSyncStr] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      let leadsQuery = supabase.from("leads").select("id,name,company,email,status,assigned_agent_name");
      if (!isAdmin && user?.email) {
        leadsQuery = leadsQuery.eq("assigned_agent_name", user.email);
      }
      const [{ data: e }, { data: l }] = await Promise.all([
        supabase.from("emails_sent").select("id,lead_id,lead_email,subject,sequence_type,status,sent_at").order("sent_at", { ascending: false }),
        leadsQuery,
      ]);
      if (l) setLeads(l as DbLead[]);
      if (e) {
        // Filter emails: for agents, only show emails related to their leads
        const agentLeadIds = new Set((l || []).map((lead: any) => lead.id).filter(Boolean));
        const agentLeadEmails = new Set((l || []).map((lead: any) => (lead.email || "").toLowerCase()).filter(Boolean));
        const filtered = e.filter((item: any) => {
          if (!item) return false;
          if (item.sequence_type === "agent_presence" || item.sequence_type === "agent_login") return false;
          if (isAdmin) return true;
          // For agents: only show emails linked to their leads
          if (item.lead_id && agentLeadIds.has(item.lead_id)) return true;
          if (item.lead_email && agentLeadEmails.has(item.lead_email.toLowerCase())) return true;
          return false;
        });
        const mapped = filtered.map((item: any) => ({
          id: item.id || `em-${Math.random()}`,
          lead_id: item.lead_id || "",
          lead_email: item.lead_email || "",
          subject: item.subject || "",
          type: item.sequence_type || "automation",
          status: item.status || "sent",
          sent_at: item.sent_at || "",
        }));
        setEmails(mapped as DbEmailLog[]);
      }
    } catch (err) {
      console.error("Email fetch error", err);
    }
    setLastSyncStr(new Date().toLocaleTimeString());
    setLoading(false);
  }

  useEffect(() => {
    if (user?.email || user?.role === "admin") fetchData();
    const sub = supabase
      .channel("email-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails_sent" }, () => fetchData())
      .subscribe();
    const interval = setInterval(fetchData, 30000);
    return () => { sub.unsubscribe(); clearInterval(interval); };
  }, [user?.email, user?.role]);

  const leadMap = useMemo(() => {
    const map: Record<string, DbLead> = {};
    (leads || []).forEach((l) => {
      if (l && l.id) map[l.id] = l;
      if (l && l.email) map[l.email.toLowerCase()] = l;
    });
    return map;
  }, [leads]);

  // Set of lead IDs/emails that have GENUINELY replied (not bookings)
  const repliedLeadKeys = useMemo(() => {
    const keys = new Set<string>();
    // Only leads whose status is explicitly "replied" (typed a real reply)
    (leads || []).forEach((l) => {
      if (l.status === "replied") {
        if (l.id) keys.add(l.id);
        if (l.email) keys.add(l.email.toLowerCase());
      }
    });
    return keys;
  }, [leads]);

  // isReply: true only if lead genuinely replied (NOT booking/meeting_confirmed)
  const isReply = (e: DbEmailLog) => {
    // Check by lead_id or email if the lead's status is "replied"
    if (e?.lead_id && repliedLeadKeys.has(e.lead_id)) return true;
    if (e?.lead_email && repliedLeadKeys.has(e.lead_email.toLowerCase())) return true;
    return false;
  };

  const counts = useMemo(() => {
    const list = emails || [];
    return {
      welcome: list.filter((e) => e?.type === "welcome").length,
      bookingConfirmed: list.filter((e) => e?.type === "meeting_confirmed").length,
      reminders: list.filter((e) => e?.type === "reminder" || e?.type === "followup_24h" || e?.type === "followup_48h" || e?.type === "reminder_24h" || e?.type === "reminder_1h").length,
      meetingNow: list.filter((e) => e?.type === "meeting_now" || e?.type === "starting_now" || (e?.subject && e.subject.toLowerCase().includes("starting now"))).length,
    };
  }, [emails]);

  function filterEmails(tab: string) {
    const list = emails || [];
    // Welcome Sent tab = only welcome emails
    if (tab === "all") return list.filter((e) => e?.type === "welcome");
    // Booked tab = only meeting_confirmed emails
    if (tab === "booked") return list.filter((e) => e?.type === "meeting_confirmed");
    // Replied tab = only welcome emails for leads who booked/replied (no meeting_confirmed rows here)
    if (tab === "replied") return list.filter((e) => e?.type === "welcome" && isReply(e));
    return list.filter((e) => e?.type === "welcome");
  }

  async function handleSendBookingLink(leadId: string, email: string) {
    if (!email) return;
    toast.loading("Sending Booking Form Email...");
    const res = await triggerBookingFormEmailFn({ data: { email, leadId } });
    if (res?.success) {
      toast.success("Booking Form link sent successfully via Gmail SMTP!");
      fetchData();
    } else {
      toast.error(res?.error || "Failed to send booking link");
    }
  }

  async function handleSend24hReminder(leadId: string, email: string) {
    if (!email) return;
    toast.loading("Sending 24h Follow-up Reminder...");
    const res = await triggerReminderEmailFn({ data: { email, reminderNumber: 1, leadId } });
    if (res?.success) {
      toast.success("24h Reminder Email sent via Gmail SMTP!");
      fetchData();
    } else {
      toast.error(res?.error || "Failed to send reminder");
    }
  }

  async function handleRunMeetingReminderCheck() {
    toast.loading("Checking upcoming meetings & sending 1-day / 1-hour reminders...");
    const res = await checkAndSendMeetingRemindersFn({ data: {} });
    if (res?.success) {
      toast.success(`Meeting reminder check complete! (${res.processed ?? 0} reminders sent)`);
    } else {
      toast.error(res?.error || "Check failed");
    }
  }

  // Timeline: last 5 real email events
  const timelineItems = useMemo(() => {
    return (emails || []).slice(0, 5).map((e) => {
      let IconComp = Clock;
      if (e?.status === "opened") IconComp = BadgeCheck;
      else if (e?.status === "failed") IconComp = Bot;
      else if (e?.type === "welcome") IconComp = Sparkles;

      const leadObj = e?.lead_id ? leadMap[e.lead_id] : null;

      return {
        time: e?.sent_at ? new Date(e.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
        title: e?.subject || `${e?.type || "automated"} email`,
        detail: `Status: ${e?.status || "sent"} · Lead: ${leadObj?.name ?? "Lead"}`,
        icon: IconComp,
      };
    });
  }, [emails, leadMap]);

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
        title="AI Email Automation"
        subtitle="Live automated outreach — sequences, delivery and replies."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {loading ? "Syncing..." : lastSyncStr ? `Live · ${lastSyncStr}` : "Live"}
            </span>
            <Button onClick={fetchData} variant="outline" size="sm" className="rounded-xl gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={handleRunMeetingReminderCheck} variant="secondary" size="sm" className="rounded-xl gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Check Meeting Reminders
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Welcome Emails" value={counts.welcome} icon={Sparkles} tone="primary" hint="sent on import" />
        <StatCard label="Booking Confirmations" value={counts.bookingConfirmed} icon={CheckCircle2} tone="success" hint="meeting confirmed" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: "Welcome Email",    desc: "Sent instantly via garryamelia6265@gmail.com when a lead is imported.", meta: "Trigger: lead imported · Delay: 0 min", active: true },
          { title: "Reminder Emails",  desc: "Nudges leads automatically every 24 hours until they respond or book.", meta: "Trigger: 24h interval · Delay: 24 h", active: true },
        ].map((c) => (
          <div key={c.title} className="panel p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold">{c.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </div>
              <Switch defaultChecked={c.active} className="shrink-0" />
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-2/60 p-4">
              <p className="text-xs font-medium text-muted-foreground">{c.meta}</p>
              <p className="mt-2 text-sm">
                "Hi, thanks for reaching out. We would love to show you our automated sales CRM workspace."
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Email History - LIVE */}
        <div className="panel overflow-hidden lg:col-span-2">
          <div className="border-b border-border p-4 sm:p-5">
            <h2 className="font-display text-lg font-bold">Email History & Actions</h2>
            <p className="text-sm text-muted-foreground">Every automated message and outcome — live from Supabase</p>
          </div>
          <Tabs defaultValue="all" className="p-3.5 sm:p-5">
            <TabsList className="rounded-xl w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
              {(["all", "booked", "replied"] as const).map((t) => (
                <TabsTrigger key={t} value={t} className="rounded-lg capitalize text-xs sm:text-sm">
                  {t === "all" ? "Welcome Sent" : t === "booked" ? "Booked" : "Replied"}
                </TabsTrigger>
              ))}
            </TabsList>
            {(["all", "booked", "replied"] as const).map((t) => {
              const rows = filterEmails(t);
              return (
                <TabsContent key={t} value={t} className="mt-4">
                  {rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                      <Send className="h-8 w-8 opacity-30" />
                      <p className="text-sm">
                        {t === "all" ? "No welcome emails sent yet. Import leads to start." :
                         t === "booked" ? "No bookings yet." :
                         "No replies yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-surface-2/60">
                            <TableHead>Recipient</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((e) => {
                            // Resolve lead: first by id, then by email
                            const lead = e.lead_id
                              ? leadMap[e.lead_id]
                              : e.lead_email
                              ? leadMap[e.lead_email.toLowerCase()]
                              : null;
                            const displayName = lead?.name || (e.lead_email ? e.lead_email.split("@")[0] : "Lead");
                            const displayEmail = lead?.email || e.lead_email || "";
                            return (
                              <TableRow key={e.id}>
                                <TableCell className="whitespace-nowrap">
                                  <p className="font-medium">{displayName}</p>
                                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
                                </TableCell>
                                <TableCell className="max-w-48 truncate">{e.subject || "—"}</TableCell>
                                <TableCell>
                                  {(() => {
                                    const displayLabel =
                                      t === "booked" || e.type === "meeting_confirmed" ? "Booked" :
                                      t === "replied" ? "Replied" : "Sent";
                                    const toneClass =
                                      t === "booked" || e.type === "meeting_confirmed" ? stateTone.meeting_confirmed :
                                      t === "replied" ? stateTone.replied : stateTone.sent;
                                    return (
                                      <Badge variant="outline" className={`rounded-full capitalize ${toneClass}`}>
                                        {displayLabel}
                                      </Badge>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs rounded-lg text-emerald-600 hover:text-emerald-500"
                                      onClick={() => handleSendBookingLink(e.lead_id, displayEmail)}
                                      title="Send Booking Form Email"
                                    >
                                      <Clock className="h-3.5 w-3.5 mr-1" /> Booking Form
                                    </Button>
                                    {t !== "replied" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs rounded-lg text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                                        onClick={async () => {
                                          toast.loading(`Marking ${displayName} as Replied...`);
                                          const res = await markLeadAsRepliedFn({
                                            data: { leadId: e.lead_id, leadEmail: displayEmail },
                                          });
                                          if (res?.success) {
                                            toast.success("Marked as Replied!");
                                            fetchData();
                                          } else {
                                            toast.error("Failed to mark replied");
                                          }
                                        }}
                                      >
                                        <MessageSquare className="h-3.5 w-3.5 mr-1" /> Mark Replied
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        {/* AI Automation Timeline - LIVE */}
        <div className="panel p-5">
          <h2 className="font-display text-lg font-bold">AI Automation Timeline</h2>
          <p className="text-sm text-muted-foreground">Today's automated activity</p>
          {timelineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 opacity-30" />
              <p className="text-sm">No automation activity yet. Import leads to start automation.</p>
            </div>
          ) : (
            <ol className="mt-6 space-y-6">
              {timelineItems.map((t, i) => {
                const IconComponent = t.icon || Clock;
                return (
                  <li key={i} className="relative flex gap-4">
                    {i < timelineItems.length - 1 && (
                      <span className="absolute left-4 top-9 h-full w-px bg-border" />
                    )}
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <IconComponent className="size-4" />
                    </span>
                    <div className="min-w-0 pb-1">
                      <p className="text-sm font-semibold">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.detail}</p>
                      <p className="mt-1 text-xs font-medium text-primary">{t.time}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
