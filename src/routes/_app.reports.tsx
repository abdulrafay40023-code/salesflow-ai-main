import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  UserCheck,
  PhoneCall,
  MessageSquare,
  CalendarDays,
  Trophy,
  ArrowDownToLine,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCrm } from "@/lib/crm-store";
import { isAdminEmail } from "@/lib/crm-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Teals CRM" },
      {
        name: "description",
        content: "Company-wide monthly and daily sales performance reports across all agents.",
      },
    ],
  }),
  component: ReportsPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportLead = {
  id: string;
  assigned_agent_name: string | null;
  imported_by: string | null;
  assigned_at: string | null;
  contacted_at: string | null;
  booked_at: string | null;
  won_at: string | null;
  status: string;
  last_contact: string | null;
  created_at: string;
};

type AgentProfile = {
  email: string;
  name: string;
};

type DayRow = {
  day: number;
  dateLabel: string;
  assigned: number;
  imported: number;
  contacted: number;
  replied: number;
  booked: number;
  won: number;
};

type AgentSummary = {
  email: string;
  name: string;
  assigned: number;
  imported: number;
  contacted: number;
  replied: number;
  booked: number;
  won: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isInMonth(iso: string | null, year: number, month: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

function isOnDay(iso: string | null, year: number, month: number, day: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    !isNaN(d.getTime()) &&
    d.getFullYear() === year &&
    d.getMonth() + 1 === month &&
    d.getDate() === day
  );
}

function getContactedDate(l: ReportLead): string | null {
  if ((l.status || "").toLowerCase() === "contacted") {
    return l.contacted_at || l.last_contact || l.created_at || null;
  }
  return null;
}

function getRepliedDate(l: ReportLead): string | null {
  if ((l.status || "").toLowerCase() === "replied") {
    return l.contacted_at || l.last_contact || l.created_at || null;
  }
  return null;
}

function getBookedDate(l: ReportLead): string | null {
  if ((l.status || "").toLowerCase() === "booked") {
    return l.booked_at || l.contacted_at || l.last_contact || l.created_at || null;
  }
  return null;
}

function getWonDate(l: ReportLead): string | null {
  if ((l.status || "").toLowerCase() === "won") {
    return l.won_at || l.booked_at || l.contacted_at || l.last_contact || l.created_at || null;
  }
  return null;
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${color} p-5 shadow-lg`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">{label}</p>
          <p className="mt-1 text-4xl font-extrabold text-white">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner">
          {icon}
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ReportsPage() {
  const { user } = useCrm();
  const navigate = useNavigate();
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  // Month state — default to current month
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based

  // Data
  const [leads, setLeads] = useState<ReportLead[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Agent filter for daily breakdown
  const [selectedAgentEmail, setSelectedAgentEmail] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function fetchData() {
    setLoading(true);
    try {
      const [{ data: leadsData }, { data: profileData }] = await Promise.all([
        supabase.from("leads").select("*"),
        supabase.from("profiles").select("*"),
      ]);

      if (leadsData) setLeads(leadsData as ReportLead[]);

      if (profileData) {
        const approved: AgentProfile[] = [];
        profileData.forEach((p: any) => {
          if (isAdminEmail(p.email)) return;
          let isApproved = false;
          if (p.avatar_url) {
            try { isApproved = Boolean(JSON.parse(p.avatar_url).approved); } catch {}
          }
          if (isApproved) {
            approved.push({ email: p.email, name: p.full_name || p.email.split("@")[0] });
          }
        });
        setAgents(approved);
      }
    } catch (err) {
      console.error("Reports fetch error:", err);
    }
    setLastUpdated(new Date());
    setLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();

    // Realtime subscription — identical pattern to admin panel
    const sub = supabase
      .channel("reports-leads-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe();

    const interval = setInterval(fetchData, 30000);

    return () => {
      sub.unsubscribe();
      clearInterval(interval);
    };
  }, [isAdmin]);

  // ── Month navigation ───────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  // ── Company-wide monthly totals ────────────────────────────────────────────
  const companyTotals = useMemo(() => {
    // Assigned: admin assigned (assigned_at in month) and NOT imported by the same agent
    const assigned = leads.filter((l) =>
      isInMonth(l.assigned_at, year, month) &&
      (l.imported_by || "").toLowerCase() !== (l.assigned_agent_name || "").toLowerCase()
    ).length;

    // Agent Imported: imported_by is set AND created_at is in month
    const imported = leads.filter(
      (l) => l.imported_by && isInMonth(l.created_at, year, month)
    ).length;

    const contacted = leads.filter((l) => isInMonth(getContactedDate(l), year, month)).length;
    const replied = leads.filter((l) => isInMonth(getRepliedDate(l), year, month)).length;
    const booked = leads.filter((l) => isInMonth(getBookedDate(l), year, month)).length;
    const won = leads.filter((l) => isInMonth(getWonDate(l), year, month)).length;

    return { assigned, imported, contacted, replied, booked, won };
  }, [leads, year, month]);

  // ── Per-agent monthly summaries ────────────────────────────────────────────
  const agentSummaries = useMemo<AgentSummary[]>(() => {
    return agents.map((ag) => {
      const agEmail = ag.email.toLowerCase();
      const agLeads = leads.filter(
        (l) => (l.assigned_agent_name || "").toLowerCase() === agEmail
      );

      const assigned = agLeads.filter(
        (l) =>
          isInMonth(l.assigned_at, year, month) &&
          (l.imported_by || "").toLowerCase() !== agEmail
      ).length;

      const imported = agLeads.filter(
        (l) =>
          (l.imported_by || "").toLowerCase() === agEmail &&
          isInMonth(l.created_at, year, month)
      ).length;

      const contacted = agLeads.filter((l) => isInMonth(getContactedDate(l), year, month)).length;
      const replied = agLeads.filter((l) => isInMonth(getRepliedDate(l), year, month)).length;
      const booked = agLeads.filter((l) => isInMonth(getBookedDate(l), year, month)).length;
      const won = agLeads.filter((l) => isInMonth(getWonDate(l), year, month)).length;

      return { email: ag.email, name: ag.name, assigned, imported, contacted, replied, booked, won };
    });
  }, [leads, agents, year, month]);

  // ── Daily breakdown ────────────────────────────────────────────────────────
  // Scoped to selectedAgentEmail if set, otherwise company-wide
  const dailyRows = useMemo<DayRow[]>(() => {
    const totalDays = daysInMonth(year, month);
    const monthShort = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });

    const filteredLeads = selectedAgentEmail
      ? leads.filter(
          (l) =>
            (l.assigned_agent_name || "").toLowerCase() === selectedAgentEmail.toLowerCase()
        )
      : leads;

    const agEmail = (selectedAgentEmail || "").toLowerCase();

    return Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;

      const assigned = filteredLeads.filter(
        (l) =>
          isOnDay(l.assigned_at, year, month, day) &&
          (l.imported_by || "").toLowerCase() !== (agEmail || (l.assigned_agent_name || "").toLowerCase())
      ).length;

      const imported = filteredLeads.filter((l) => {
        if (!l.imported_by) return false;
        if (agEmail) {
          return (l.imported_by || "").toLowerCase() === agEmail && isOnDay(l.created_at, year, month, day);
        }
        return isOnDay(l.created_at, year, month, day);
      }).length;

      const contacted = filteredLeads.filter((l) => isOnDay(getContactedDate(l), year, month, day)).length;
      const replied = filteredLeads.filter((l) => isOnDay(getRepliedDate(l), year, month, day)).length;
      const booked = filteredLeads.filter((l) => isOnDay(getBookedDate(l), year, month, day)).length;
      const won = filteredLeads.filter((l) => isOnDay(getWonDate(l), year, month, day)).length;

      return {
        day,
        dateLabel: `${monthShort} ${day}`,
        assigned,
        imported,
        contacted,
        replied,
        booked,
        won,
      };
    });
  }, [leads, year, month, selectedAgentEmail]);

  if (!isAdmin) return null;

  const selectedAgentName =
    selectedAgentEmail
      ? agents.find((a) => a.email === selectedAgentEmail)?.name ?? selectedAgentEmail
      : null;

  const activeDays = dailyRows.filter(
    (r) => r.assigned + r.imported + r.contacted + r.replied + r.booked + r.won > 0
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen space-y-8 pb-12">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-violet-400" />
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Reports</h1>
            <span className="ml-2 rounded-full bg-violet-500/20 px-3 py-0.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/30">
              LIVE REALTIME
            </span>
          </div>
          <p className="mt-1 text-sm text-white/40">
            Company-wide performance · Auto sync active ·{" "}
            <span className="text-white/60">{lastUpdated.toLocaleTimeString()}</span>
          </p>
        </div>
        <Button
          onClick={fetchData}
          disabled={loading}
          className="gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center size-9 rounded-xl bg-white/10 text-white hover:bg-violet-600/40 transition-colors"
          title="Previous Month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-2xl font-extrabold text-white">{monthLabel(year, month)}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {activeDays > 0
              ? `${activeDays} day${activeDays !== 1 ? "s" : ""} with activity`
              : "No activity recorded yet for this month"}
          </p>
        </div>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center size-9 rounded-xl bg-white/10 text-white hover:bg-violet-600/40 transition-colors"
          title="Next Month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Company Overview */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-400" />
          <h2 className="text-lg font-bold text-white">Company Overview</h2>
          <span className="text-xs text-white/40">— all agents · {monthLabel(year, month)}</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-white/40">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading report data...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              icon={<UserCheck className="h-6 w-6" />}
              label="Assigned Leads"
              value={companyTotals.assigned}
              color="from-violet-900 via-violet-800 to-violet-700"
            />
            <MetricCard
              icon={<ArrowDownToLine className="h-6 w-6" />}
              label="Agent Imported"
              value={companyTotals.imported}
              color="from-blue-900 via-blue-800 to-blue-700"
            />
            <MetricCard
              icon={<PhoneCall className="h-6 w-6" />}
              label="Contacted"
              value={companyTotals.contacted}
              color="from-fuchsia-900 via-fuchsia-800 to-fuchsia-700"
            />
            <MetricCard
              icon={<MessageSquare className="h-6 w-6" />}
              label="Replied"
              value={companyTotals.replied}
              color="from-cyan-900 via-cyan-800 to-cyan-700"
            />
            <MetricCard
              icon={<CalendarDays className="h-6 w-6" />}
              label="Booked"
              value={companyTotals.booked}
              color="from-amber-900 via-amber-800 to-amber-700"
            />
            <MetricCard
              icon={<Trophy className="h-6 w-6" />}
              label="Won"
              value={companyTotals.won}
              color="from-emerald-900 via-emerald-800 to-emerald-700"
            />
          </div>
        )}
      </div>

      {/* Agent Performance Cards */}
      {!loading && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-violet-400" />
              <h2 className="text-lg font-bold text-white">Agent Performance</h2>
              <span className="text-xs text-white/40">— {monthLabel(year, month)}</span>
            </div>
            {selectedAgentEmail && (
              <button
                onClick={() => setSelectedAgentEmail(null)}
                className="text-xs text-violet-400 hover:text-violet-300 font-medium underline underline-offset-2 transition-colors"
              >
                ← All Agents
              </button>
            )}
          </div>

          {agents.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 py-12 text-center">
              <Users className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">
                No approved Working Agents found. Once agents are approved, their performance will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agentSummaries.map((ag) => {
                const isSelected = selectedAgentEmail === ag.email;
                const total = ag.assigned + ag.imported;
                const winRate = total > 0 ? Math.round((ag.won / total) * 100) : 0;

                return (
                  <div
                    key={ag.email}
                    onClick={() => setSelectedAgentEmail(isSelected ? null : ag.email)}
                    className={`group cursor-pointer rounded-xl border p-5 shadow-inner transition-all ${
                      isSelected
                        ? "border-violet-500/60 bg-violet-600/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-violet-600 text-white font-bold text-sm">
                          {ag.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                            {ag.name}
                          </p>
                          {isSelected && (
                            <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-violet-500/30">
                              Viewing
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 truncate">{ag.email}</p>
                      </div>
                    </div>

                    {/* 6 metrics */}
                    <div className="grid grid-cols-6 gap-1 text-center mb-3">
                      <div className="rounded-lg bg-white/5 p-1.5">
                        <p className="text-[8px] text-white/40 leading-tight">Assigned</p>
                        <p className="text-sm font-bold text-white">{ag.assigned}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-1.5">
                        <p className="text-[8px] text-white/40 leading-tight">Imported</p>
                        <p className="text-sm font-bold text-blue-300">{ag.imported}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-1.5">
                        <p className="text-[8px] text-white/40 leading-tight">Contacted</p>
                        <p className="text-sm font-bold text-fuchsia-300">{ag.contacted}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-1.5">
                        <p className="text-[8px] text-white/40 leading-tight">Replied</p>
                        <p className="text-sm font-bold text-cyan-300">{ag.replied}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-1.5">
                        <p className="text-[8px] text-white/40 leading-tight">Booked</p>
                        <p className="text-sm font-bold text-amber-300">{ag.booked}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-1.5">
                        <p className="text-[8px] text-white/40 leading-tight">Won</p>
                        <p className="text-sm font-bold text-emerald-400">{ag.won}</p>
                      </div>
                    </div>

                    {/* Win rate bar */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-white/60">
                        <span>Win Rate</span>
                        <span className="font-bold text-emerald-400">{winRate}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${winRate}%` }}
                        />
                      </div>
                    </div>

                    <p className="mt-3 text-[11px] text-violet-400/80 group-hover:text-violet-300 font-medium flex items-center justify-end gap-1">
                      {isSelected ? "Viewing daily breakdown ↓" : "Click for daily breakdown →"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Daily Activity Table */}
      {!loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur overflow-hidden">
          {/* Table Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-violet-400" />
              <h2 className="font-bold text-white text-lg">
                {selectedAgentEmail
                  ? `${selectedAgentName}'s Daily Breakdown`
                  : "Daily Company Activity"}
              </h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-white/40">{monthLabel(year, month)}</span>
              {selectedAgentEmail && (
                <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/30">
                  {selectedAgentName}
                </span>
              )}
              {selectedAgentEmail && (
                <button
                  onClick={() => setSelectedAgentEmail(null)}
                  className="text-xs text-white/40 hover:text-white transition-colors"
                >
                  Show All →
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-widest text-white/40">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-center">Assigned</th>
                  <th className="px-5 py-3 text-center">Agent Imported</th>
                  <th className="px-5 py-3 text-center">Contacted</th>
                  <th className="px-5 py-3 text-center">Replied</th>
                  <th className="px-5 py-3 text-center">Booked</th>
                  <th className="px-5 py-3 text-center">Won</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => {
                  const hasActivity =
                    row.assigned + row.imported + row.contacted + row.replied + row.booked + row.won > 0;
                  return (
                    <tr
                      key={row.day}
                      className={`border-b border-white/5 transition-colors ${
                        hasActivity ? "hover:bg-violet-500/5" : "opacity-35"
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-white/80 whitespace-nowrap">
                        {row.dateLabel}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`font-bold ${
                            row.assigned > 0 ? "text-violet-300" : "text-white/20"
                          }`}
                        >
                          {row.assigned}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`font-bold ${
                            row.imported > 0 ? "text-blue-300" : "text-white/20"
                          }`}
                        >
                          {row.imported}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`font-bold ${
                            row.contacted > 0 ? "text-fuchsia-300" : "text-white/20"
                          }`}
                        >
                          {row.contacted}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`font-bold ${
                            row.replied > 0 ? "text-cyan-300" : "text-white/20"
                          }`}
                        >
                          {row.replied}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`font-bold ${
                            row.booked > 0 ? "text-amber-300" : "text-white/20"
                          }`}
                        >
                          {row.booked}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`font-bold ${
                            row.won > 0 ? "text-emerald-400" : "text-white/20"
                          }`}
                        >
                          {row.won}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer row */}
              <tfoot>
                <tr className="border-t-2 border-violet-500/30 bg-violet-500/5">
                  <td className="px-5 py-3 font-bold text-violet-300 text-xs uppercase tracking-widest">
                    Month Total
                  </td>
                  <td className="px-5 py-3 text-center font-extrabold text-violet-300">
                    {dailyRows.reduce((s, r) => s + r.assigned, 0)}
                  </td>
                  <td className="px-5 py-3 text-center font-extrabold text-blue-300">
                    {dailyRows.reduce((s, r) => s + r.imported, 0)}
                  </td>
                  <td className="px-5 py-3 text-center font-extrabold text-fuchsia-300">
                    {dailyRows.reduce((s, r) => s + r.contacted, 0)}
                  </td>
                  <td className="px-5 py-3 text-center font-extrabold text-cyan-300">
                    {dailyRows.reduce((s, r) => s + r.replied, 0)}
                  </td>
                  <td className="px-5 py-3 text-center font-extrabold text-amber-300">
                    {dailyRows.reduce((s, r) => s + r.booked, 0)}
                  </td>
                  <td className="px-5 py-3 text-center font-extrabold text-emerald-400">
                    {dailyRows.reduce((s, r) => s + r.won, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-white/30">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live — auto refreshes every 30 seconds · Supabase Realtime active
      </div>
    </div>
  );
}

