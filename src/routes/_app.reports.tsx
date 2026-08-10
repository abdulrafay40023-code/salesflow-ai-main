import { createFileRoute } from "@tanstack/react-router";
import { Award, CalendarCheck, Percent, RefreshCw, Target, TrendingUp, Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/crm/Topbar";
import { StatCard } from "@/components/crm/StatCard";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — Nexa CRM" },
      { name: "description", content: "Lead conversion, response rate, follow-up success, agent performance." },
      { property: "og:title", content: "Reports & Analytics — Nexa CRM" },
    ],
  }),
  component: ReportsPage,
});

type DbLead = { id: string; status: string; agent: string; created_at: string };
type DbFollowUp = { id: string; completed: boolean; type: string };
type DbEmailLog = { id: string; status: string; sent_at: string };

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
  const [leads, setLeads] = useState<DbLead[]>([]);
  const [followUps, setFollowUps] = useState<DbFollowUp[]>([]);
  const [emails, setEmails] = useState<DbEmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());

  async function fetchData() {
    setLoading(true);
    try {
      const [{ data: l }, { data: f }, { data: e }] = await Promise.all([
        supabase.from("leads").select("id,status,agent,created_at"),
        supabase.from("follow_ups").select("id,completed,type"),
        supabase.from("email_logs").select("id,status,sent_at"),
      ]);
      if (l) setLeads(l as DbLead[]);
      if (f) setFollowUps(f as DbFollowUp[]);
      if (e) setEmails(e as DbEmailLog[]);
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
  }, []);

  const total = leads.length;
  const won = leads.filter((l) => l.status === "won").length;
  const convRate = total > 0 ? Math.round((won / total) * 100) : 0;

  const emailSent = emails.filter((e) => e.status === "sent" || e.status === "opened").length;
  const emailReplied = emails.filter((e) => e.status === "opened").length;
  const responseRate = emailSent > 0 ? Math.round((emailReplied / emailSent) * 100) : 0;

  const completedFU = followUps.filter((f) => f.completed).length;
  const followUpSuccess = followUps.length > 0 ? Math.round((completedFU / followUps.length) * 100) : 0;

  const meetings = followUps.filter((f) => f.type === "meeting" && f.completed).length;

  // Pipeline funnel
  const stages = ["new", "contacted", "qualified", "meeting", "won"] as const;
  const funnelMax = leads.filter((l) => l.status === "new").length || 1;
  const funnelColors = ["bg-blue-500", "bg-purple-500", "bg-yellow-500", "bg-orange-500", "bg-emerald-500"];

  // Agent performance from leads
  const agentMap: Record<string, { leads: number; won: number }> = {};
  leads.forEach((l) => {
    if (!l.agent) return;
    if (!agentMap[l.agent]) agentMap[l.agent] = { leads: 0, won: 0 };
    agentMap[l.agent]!.leads++;
    if (l.status === "won") agentMap[l.agent]!.won++;
  });
  const agentRows = Object.entries(agentMap)
    .map(([name, d]) => ({ name: name.split(" ")[0]!, ...d, rate: d.leads > 0 ? Math.round((d.won / d.leads) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  // Monthly leads: group by month from created_at
  const monthlyMap: Record<string, { leads: number; won: number }> = {};
  leads.forEach((l) => {
    const month = new Date(l.created_at).toLocaleString("default", { month: "short" });
    if (!monthlyMap[month]) monthlyMap[month] = { leads: 0, won: 0 };
    monthlyMap[month]!.leads++;
    if (l.status === "won") monthlyMap[month]!.won++;
  });
  const monthlyLeads = Object.entries(monthlyMap).map(([month, d]) => ({ month, ...d }));
  const maxMonth = Math.max(...monthlyLeads.map((m) => m.leads), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Live performance analytics across your pipeline and team."
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lead Conversion" value={`${convRate}%`} icon={Target} hint={`${won} of ${total} leads`} />
        <StatCard label="Response Rate" value={`${responseRate}%`} icon={Percent} tone="info" hint={`${emailReplied} replies`} />
        <StatCard label="Follow-up Success" value={`${followUpSuccess}%`} icon={TrendingUp} tone="success" hint={`${completedFU} completed`} />
        <StatCard label="Meetings Completed" value={meetings} icon={CalendarCheck} tone="warning" hint="all time" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <div className="panel p-5">
          <h2 className="font-display text-lg font-bold">Lead Conversion Funnel</h2>
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
                const pct = Math.round((count / funnelMax) * 100);
                return (
                  <EmptyBar key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} count={count} pct={pct} color={funnelColors[i]!} />
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly leads chart */}
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Monthly Leads</h2>
              <p className="text-sm text-muted-foreground">Volume and closed-won by month</p>
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
              <p className="text-sm">No data yet</p>
            </div>
          ) : (
            <div className="mt-8 flex h-48 items-end gap-3">
              {monthlyLeads.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center gap-2">
                  <div className="flex h-full w-full items-end justify-center gap-0.5">
                    <div className="w-1/2 rounded-t-lg bg-primary transition-all duration-700" style={{ height: `${(m.leads / maxMonth) * 100}%` }} />
                    <div className="w-1/3 rounded-t-lg bg-emerald-500/70 transition-all duration-700" style={{ height: `${(m.won / maxMonth) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent Performance */}
      <div className="panel p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Award className="size-4 text-primary" /> Agent Performance
        </h2>
        {agentRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
            <Award className="h-8 w-8 opacity-30" />
            <p className="text-sm">No agent data yet — assign leads to agents first</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {agentRows.map((a) => (
              <div key={a.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="tabular-nums text-muted-foreground">{a.won}/{a.leads} · {a.rate}%</span>
                </div>
                <Progress value={a.rate} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
