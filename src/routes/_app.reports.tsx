import { createFileRoute } from "@tanstack/react-router";
import { Award, CalendarCheck, Mail, Percent, RefreshCw, Target, TrendingUp, Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/crm/Topbar";
import { StatCard } from "@/components/crm/StatCard";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useCrm } from "@/lib/crm-store";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — Teals CRM" },
      { name: "description", content: "Lead conversion, response rate, follow-up sequences, email delivery and agent performance." },
      { property: "og:title", content: "Reports & Analytics — Teals CRM" },
    ],
  }),
  component: ReportsPage,
});

type DbLead = {
  id: string;
  status: string;
  agent: string;
  assigned_agent_name?: string;
  created_at: string;
  email: string;
};

type DbEmailLog = {
  id: string;
  status: string;
  sequence_type: string;
  sent_at: string;
  lead_id: string;
};

type DbMeeting = {
  id: string;
  completed: boolean;
  scheduled_time: string;
};

function EmptyBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count} · {pct}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ReportsPage() {
  const { user } = useCrm();
  const isAdmin = Boolean(user && (user.role === "admin" || user.email === "garryamelia6265@gmail.com"));

  const [leads, setLeads] = useState<DbLead[]>([]);
  const [emails, setEmails] = useState<DbEmailLog[]>([]);
  const [meetings, setMeetings] = useState<DbMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());

  async function fetchData() {
    setLoading(true);
    try {
      let leadsQuery = supabase.from("leads").select("id,status,agent,assigned_agent_name,created_at,email");
      if (!isAdmin && user?.email) {
        leadsQuery = leadsQuery.eq("assigned_agent_name", user.email.trim());
      }

      const [leadsRes, emailsRes, meetingsRes] = await Promise.allSettled([
        leadsQuery,
        supabase.from("emails_sent").select("id,status,sequence_type,sent_at,lead_id"),
        supabase.from("meetings").select("id,completed,scheduled_time"),
      ]);

      if (leadsRes.status === "fulfilled" && leadsRes.value.data) {
        setLeads(leadsRes.value.data as DbLead[]);
      } else {
        setLeads([]);
      }

      if (emailsRes.status === "fulfilled" && emailsRes.value.data) {
        setEmails(emailsRes.value.data as DbEmailLog[]);
      } else {
        setEmails([]);
      }

      if (meetingsRes.status === "fulfilled" && meetingsRes.value.data) {
        setMeetings(meetingsRes.value.data as DbMeeting[]);
      } else {
        setMeetings([]);
      }
    } catch (err) {
      console.error("Reports fetch error", err);
    }
    setLastSync(new Date());
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user?.email, user?.role]);

  const total = leads.length;
  const won = leads.filter((l) => l.status === "won").length;
  const replied = leads.filter((l) => l.status === "replied").length;
  const convRate = total > 0 ? Math.round((won / total) * 100) : 0;

  // Email stats from emails_sent table
  const welcomeSent = emails.filter((e) => e && e.sequence_type === "welcome").length;
  const emailReplied = emails.filter((e) => e && e.status === "replied").length;
  const responseRate = welcomeSent > 0 ? Math.round(((emailReplied + replied) / Math.max(welcomeSent, 1)) * 100) : 0;

  // Follow-up sequence stats
  const fu24 = emails.filter((e) => e && e.sequence_type === "followup_24h").length;
  const fu48 = emails.filter((e) => e && e.sequence_type === "followup_48h").length;
  const fu72 = emails.filter((e) => e && e.sequence_type === "followup_72h").length;
  const fu10d = emails.filter((e) => e && e.sequence_type === "followup_10d").length;

  const completedMeetings = meetings.filter((m) => m.completed).length;
  const totalMeetings = meetings.length;

  // Pipeline funnel
  const stages = ["new", "contacted", "qualified", "meeting", "replied", "won"] as const;
  const funnelMax = Math.max(total, 1);
  const funnelColors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-yellow-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-emerald-500",
  ];

  // Agent performance from leads
  const agentMap: Record<string, { leads: number; won: number; replied: number }> = {};
  leads.forEach((l) => {
    const agentKey = l.assigned_agent_name || l.agent;
    if (!agentKey) return;
    if (!agentMap[agentKey]) agentMap[agentKey] = { leads: 0, won: 0, replied: 0 };
    agentMap[agentKey]!.leads++;
    if (l.status === "won") agentMap[agentKey]!.won++;
    if (l.status === "replied") agentMap[agentKey]!.replied++;
  });
  const agentRows = Object.entries(agentMap)
    .map(([name, d]) => ({
      name: name.includes("@") ? name.split("@")[0] : name.split(" ")[0],
      ...d,
      rate: d.leads > 0 ? Math.round((d.won / d.leads) * 100) : 0,
    }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  // Monthly leads: group by month from created_at
  const monthlyMap: Record<string, { leads: number; won: number }> = {};
  leads.forEach((l) => {
    if (!l.created_at) return;
    const d = new Date(l.created_at);
    if (isNaN(d.getTime())) return;
    const month = d.toLocaleString("default", { month: "short" });
    if (!monthlyMap[month]) monthlyMap[month] = { leads: 0, won: 0 };
    monthlyMap[month]!.leads++;
    if (l.status === "won") monthlyMap[month]!.won++;
  });
  const monthlyLeads = Object.entries(monthlyMap).map(([month, d]) => ({ month, ...d }));
  const maxMonth = Math.max(...monthlyLeads.map((m) => m.leads), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Live performance analytics across your pipeline, emails and team."
        action={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {loading ? "Syncing..." : `Live · ${lastSync.toLocaleTimeString()}`}
            </span>
            <Button onClick={fetchData} variant="outline" size="sm" className="rounded-xl gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Top KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lead Conversion" value={`${convRate}%`} icon={Target} hint={`${won} of ${total} leads won`} />
        <StatCard label="Reply Rate" value={`${responseRate}%`} icon={Percent} tone="info" hint={`${emailReplied + replied} replies`} />
        <StatCard label="Meetings Completed" value={completedMeetings} icon={CalendarCheck} tone="warning" hint={`of ${totalMeetings} booked`} />
        <StatCard label="Total Emails Sent" value={emails.length} icon={Mail} tone="success" hint="all sequences" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pipeline Funnel */}
        <div className="panel p-5">
          <h2 className="font-display text-lg font-bold">Lead Pipeline Funnel</h2>
          <p className="text-sm text-muted-foreground">From new lead to closed won</p>
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <Users2 className="h-8 w-8 opacity-30" />
              <p className="text-sm">No leads yet — import leads to see funnel</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {stages.map((s, i) => {
                const count = leads.filter((l) => l.status === s).length;
                const pct = total > 0 ? Math.round((count / funnelMax) * 100) : 0;
                return (
                  <EmptyBar
                    key={s}
                    label={s.charAt(0).toUpperCase() + s.slice(1)}
                    count={count}
                    pct={pct}
                    color={funnelColors[i] ?? "bg-primary"}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly Leads Chart */}
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Monthly Lead Volume</h2>
              <p className="text-sm text-muted-foreground">Imported vs Won by month</p>
            </div>
            {total > 0 && (
              <Badge variant="secondary" className="rounded-full">
                <Users2 className="size-3.5" /> {total} total
              </Badge>
            )}
          </div>
          {monthlyLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 opacity-30" />
              <p className="text-sm">No data yet — import leads to see monthly trends</p>
            </div>
          ) : (
            <div className="mt-8 flex h-48 items-end gap-3">
              {monthlyLeads.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center gap-2">
                  <div className="flex h-full w-full items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 rounded-t-lg bg-primary transition-all duration-700"
                      style={{ height: `${(m.leads / maxMonth) * 100}%` }}
                    />
                    <div
                      className="w-1/3 rounded-t-lg bg-emerald-500/70 transition-all duration-700"
                      style={{ height: `${(m.won / maxMonth) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Email Follow-up Sequence Breakdown */}
      <div className="panel p-5">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Mail className="size-4 text-primary" /> Follow-up Email Sequence Breakdown
        </h2>
        <p className="text-sm text-muted-foreground mb-5">Total emails sent per automated sequence stage</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "24h Check-in", count: fu24, color: "bg-amber-500", textColor: "text-amber-400" },
            { label: "48h Value Email", count: fu48, color: "bg-purple-500", textColor: "text-purple-400" },
            { label: "72h Demo Invite", count: fu72, color: "bg-cyan-500", textColor: "text-cyan-400" },
            { label: "10d Final Email", count: fu10d, color: "bg-emerald-500", textColor: "text-emerald-400" },
          ].map(({ label, count, color, textColor }) => {
            const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
            return (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  <span className={`text-sm font-bold tabular-nums ${textColor}`}>{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{pct}% of total leads</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Performance */}
      <div className="panel p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Award className="size-4 text-primary" /> Agent Performance
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Lead ownership and win rate per agent</p>
        {agentRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
            <Award className="h-8 w-8 opacity-30" />
            <p className="text-sm">No agent data yet — assign leads to agents first</p>
          </div>
        ) : (
          <div className="mt-2 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {agentRows.map((a) => (
              <div key={a.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{a.name}</span>
                  <span className="tabular-nums text-muted-foreground text-xs">{a.won}/{a.leads} · {a.rate}%</span>
                </div>
                <Progress value={a.rate} className="mt-2 h-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">{a.leads} leads · {a.replied} replied</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
