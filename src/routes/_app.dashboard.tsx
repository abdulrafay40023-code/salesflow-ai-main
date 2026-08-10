import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Inbox,
  Mail,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/crm/StatCard";
import { PageHeader } from "@/components/crm/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { statusLabels } from "@/lib/crm-data";
import { statusTone, useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexa CRM" },
      {
        name: "description",
        content:
          "Pipeline overview: total leads, new leads, follow-ups, meetings today, email status and AI automation activity.",
      },
      { property: "og:title", content: "Dashboard — Nexa CRM" },
      {
        property: "og:description",
        content: "Live pipeline overview for your sales team, powered by AI automation.",
      },
    ],
  }),
  component: DashboardPage,
});



type DbLead = {
  id: string;
  name: string;
  company: string;
  email: string;
  status: string;
  agent: string;
  created_at: string;
};

type DbEmailLog = {
  id: string;
  subject: string;
  status: string;
  type: string;
  sent_at: string;
};

type DbMeeting = {
  id: string;
  title: string;
  scheduled_time: string;
  completed: boolean;
};

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
      <Icon className="h-8 w-8 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function DashboardPage() {
  const { user, visibleFollowUps } = useCrm();

  const [dbLeads, setDbLeads] = useState<DbLead[]>([]);
  const [dbEmails, setDbEmails] = useState<DbEmailLog[]>([]);
  const [dbMeetings, setDbMeetings] = useState<DbMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  async function fetchLive() {
    setLoading(true);
    try {
      const [leadsRes, emailsRes, meetingsRes] = await Promise.allSettled([
        supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("emails_sent")
          .select("id,subject,status,sequence_type,sent_at")
          .order("sent_at", { ascending: false })
          .limit(50),
        supabase
          .from("meetings")
          .select("id,title,scheduled_time,completed")
          .order("scheduled_time", { ascending: false })
          .limit(20),
      ]);

      if (leadsRes.status === "fulfilled" && leadsRes.value.data) {
        setDbLeads(leadsRes.value.data as DbLead[]);
      }
      if (emailsRes.status === "fulfilled" && emailsRes.value.data) {
        const emails = emailsRes.value.data.filter(
          (e: { sequence_type: string }) =>
            e.sequence_type !== "agent_presence" && e.sequence_type !== "agent_login",
        );
        setDbEmails(emails as DbEmailLog[]);
      }
      if (meetingsRes.status === "fulfilled" && meetingsRes.value.data) {
        setDbMeetings(meetingsRes.value.data as DbMeeting[]);
      }
    } catch (e) {
      console.error("Dashboard fetch error", e);
    }
    setLastSync(new Date());
    setLoading(false);
  }

  useEffect(() => {
    fetchLive();

    const leadsSub = supabase
      .channel("dash-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLive())
      .subscribe();

    const emailSub = supabase
      .channel("dash-emails")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails_sent" }, () =>
        fetchLive(),
      )
      .subscribe();

    const meetingSub = supabase
      .channel("dash-meetings")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () =>
        fetchLive(),
      )
      .subscribe();

    const interval = setInterval(fetchLive, 30000);

    return () => {
      leadsSub.unsubscribe();
      emailSub.unsubscribe();
      meetingSub.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  async function handleUpdateLeadStatus(leadId: string, newStatus: string) {
    try {
      await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
      fetchLive();
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  }

  async function handleToggleMeetingDone(meetingId: string, currentCompleted: boolean) {
    try {
      await supabase.from("meetings").update({ completed: !currentCompleted }).eq("id", meetingId);
      fetchLive();
    } catch (e) {
      console.error("Failed to update meeting:", e);
    }
  }

  // Stats from Supabase (live)
  const total = dbLeads.length;
  const contacted = dbLeads.filter((l) => l.status === "contacted").length;
  const meetingsBooked = dbLeads.filter((l) => l.status === "meeting").length;
  const wonLeads = dbLeads.filter((l) => l.status === "won").length;

  // Active uncompleted meetings from DB
  const uncompletedMeetings = dbMeetings.filter((m) => !m.completed);
  const meetingsToday = uncompletedMeetings.length || (meetingsBooked > 0 ? 1 : 0);

  // Email stats from Supabase
  const emailSent = dbEmails.filter((e) => e.status === "sent" || e.status === "opened").length;
  const emailReplied = dbEmails.filter((e) => e.status === "opened" || e.type === "meeting_confirmed").length;
  const emailPending = dbEmails.filter((e) => e.status === "pending").length;
  const emailNoResp = dbEmails.filter((e) => e.status === "failed").length;
  const emailTotal = dbEmails.length || 1;

  // Latest 5 leads from Supabase
  const latestLeads = dbLeads.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good afternoon, ${user?.name.split(" ")[0] ?? "there"}`}
        subtitle={
          user?.role === "agent"
            ? "Here is everything assigned to you today."
            : "Here is how your team's pipeline is performing today."
        }
        action={
          <div className="flex items-center gap-3">
            {/* Live indicator */}
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
            <Button asChild className="rounded-xl">
              <Link to="/leads">
                <UserPlus className="size-4" /> Import Leads
              </Link>
            </Button>
          </div>
        }
      />

      {/* Row 1 Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Leads" value={total} icon={Users} hint="in database" />
        <StatCard label="Contacted" value={contacted} icon={Mail} tone="info" hint="welcome email sent" />
        <StatCard label="Meetings Booked" value={meetingsBooked} icon={CalendarCheck} tone="warning" hint="responses" />
        <StatCard label="Won Deals" value={wonLeads} icon={CheckCircle2} tone="success" hint="closed" />
      </div>

      {/* Row 2 Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Meetings Today" value={meetingsToday} icon={CalendarCheck} tone="primary" hint={meetingsToday > 0 ? "active scheduled" : "completed"} />
        <StatCard
          label="Follow-ups Open"
          value={0}
          icon={Clock}
          tone="warning"
          hint="scheduled"
        />
        <StatCard label="Emails Sent" value={emailSent} icon={ActivityIcon} tone="info" hint="via automation" />
        <StatCard label="Reminders Due" value={0} icon={BellRing} tone="destructive" hint="next 7 days" />
      </div>

      {/* Active Meetings Banner — Mark Done */}
      {uncompletedMeetings.length > 0 && (
        <div className="space-y-2">
          {uncompletedMeetings.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/25 bg-orange-500/8 px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-orange-500/15">
                  <CalendarCheck className="size-4 text-orange-400" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(m.scheduled_time).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5"
                onClick={() => handleToggleMeetingDone(m.id, m.completed)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Meeting Done
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pipeline Breakdown */}
        <div className="panel p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Pipeline Breakdown</h2>
              <p className="text-sm text-muted-foreground">Live lead distribution by stage</p>
            </div>
            {total > 0 && (
              <Badge variant="secondary" className="rounded-full">
                <TrendingUp className="size-3.5" /> {total} total
              </Badge>
            )}
          </div>

          {total === 0 ? (
            <EmptyState icon={Users} text="No leads yet. Import leads to see your pipeline." />
          ) : (
            <div className="mt-6 space-y-3">
              {(["new", "contacted", "qualified", "meeting", "won", "lost"] as const).map((s) => {
                const count = dbLeads.filter((l) => l.status === s).length;
                const pct = Math.round((count / total) * 100);
                const colors: Record<string, string> = {
                  new: "bg-blue-500",
                  contacted: "bg-purple-500",
                  qualified: "bg-yellow-500",
                  meeting: "bg-orange-500",
                  won: "bg-emerald-500",
                  lost: "bg-red-500",
                };
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs capitalize text-muted-foreground">
                      {s}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted h-2">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${colors[s]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Email Status */}
        <div className="panel p-5">
          <h2 className="font-display text-lg font-bold">Email Status</h2>
          <p className="text-sm text-muted-foreground">Automated outreach — live</p>

          {dbEmails.length === 0 ? (
            <EmptyState icon={Mail} text="No emails sent yet. Email automation will appear here." />
          ) : (
            <div className="mt-5 space-y-4">
              {[
                ["Sent", emailSent, "bg-primary"],
                ["Opened/Replied", emailReplied, "bg-success"],
                ["Pending", emailPending, "bg-warning"],
                ["Failed", emailNoResp, "bg-destructive"],
              ].map(([label, count, color]) => (
                <div key={label as string}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label as string}</span>
                    <span className="font-semibold tabular-nums">{count as number}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${color as string} transition-all duration-700`}
                      style={{ width: `${((count as number) / emailTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button asChild variant="outline" className="mt-6 w-full rounded-xl">
            <Link to="/email">Open Email Automation</Link>
          </Button>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Latest Leads */}
        <div className="panel p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Latest Leads</h2>
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link to="/leads">View all</Link>
            </Button>
          </div>

          {latestLeads.length === 0 ? (
            <EmptyState
              icon={Inbox}
              text="No leads in database yet. Click 'Import Leads' to add your first lead."
            />
          ) : (
            <div className="mt-4 space-y-2">
              {latestLeads.map((l) => (
                <div
                  key={l.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs font-bold">
                        {l.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.company} · {l.agent || "Unassigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.status !== "won" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                        onClick={() => handleUpdateLeadStatus(l.id, "won")}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Won
                      </Button>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={`shrink-0 rounded-full capitalize ${statusTone[l.status as keyof typeof statusTone] ?? ""}`}
                    >
                      {statusLabels[l.status as keyof typeof statusLabels] ?? l.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Automation panel */}
        <div className="panel overflow-hidden">
          <div className="mesh-bg bg-primary/90 p-5 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <h2 className="font-display text-base font-bold">AI Automation</h2>
            </div>
            <p className="mt-1 text-xs text-primary-foreground/80">
              {total > 0
                ? `Monitoring ${total} leads · last sync ${lastSync.toLocaleTimeString()}`
                : "Waiting for leads to monitor"}
            </p>
          </div>
          <div className="space-y-4 p-5">
            {[
              ["Welcome sequence", total > 0 ? Math.min(100, Math.round((emailSent / Math.max(total, 1)) * 100)) : 0],
              ["Reminder emails", emailPending > 0 ? Math.round(((emailSent - emailPending) / Math.max(emailSent, 1)) * 100) : 0],
              ["Lead scoring", total > 0 ? 100 : 0],
              ["Meeting suggestions", total > 0 ? Math.round((wonLeads / Math.max(total, 1)) * 100) : 0],
            ].map(([label, pct]) => (
              <div key={label as string}>
                <div className="flex items-center justify-between text-sm">
                  <span>{label as string}</span>
                  <span className="text-muted-foreground tabular-nums">{pct as number}%</span>
                </div>
                <Progress value={pct as number} className="mt-2 h-1.5" />
              </div>
            ))}
            {total === 0 && (
              <p className="text-center text-xs text-muted-foreground pt-2">
                Import leads to activate AI automation
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
