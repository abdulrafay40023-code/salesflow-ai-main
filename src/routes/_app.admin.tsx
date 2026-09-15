import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Mail,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  Activity,
  UserCheck,
  ArrowUpRight,
  Zap,
  UserCheck2,
  CalendarCheck,
  Check,
  X,
} from "lucide-react";
import { isAdminEmail, ADMIN_EMAILS } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import {
  fetchPendingSignups,
  approvePendingSignup,
  removePendingOrApprovedSignup,
  type PendingSignup,
} from "@/lib/pending-signups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Teals CRM" },
      {
        name: "description",
        content: "Live admin dashboard — agent activity, leads, emails, pipeline analytics.",
      },
    ],
  }),
  component: AdminPage,
});

const ADMIN_EMAIL = "garryamelia6265@gmail.com";

type SupabaseLead = {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  created_at: string;
  assigned_agent_name?: string;
  agent?: string;
};

type SupabaseEmailLog = {
  id: string;
  lead_id: string;
  type: string;
  status: string;
  sent_at: string;
  subject: string;
};

type SupabaseProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
};

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${color} p-5 shadow-lg`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">{label}</p>
          <p className="mt-1 text-4xl font-extrabold text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-white/50">{sub}</p>}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner">
          {icon}
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    new: "bg-blue-500/20 text-blue-300",
    no_answer: "bg-slate-500/20 text-slate-300",
    contacted: "bg-purple-500/20 text-purple-300",
    replied: "bg-teal-500/20 text-teal-300",
    booked: "bg-amber-500/20 text-amber-300",
    booking_cancelled: "bg-rose-500/20 text-rose-300",
    meeting: "bg-orange-500/20 text-orange-300",
    won: "bg-emerald-500/20 text-emerald-300",
    lost: "bg-red-500/20 text-red-300",
    sent: "bg-blue-500/20 text-blue-300",
    opened: "bg-green-500/20 text-green-300",
    failed: "bg-red-500/20 text-red-300",
  };
  return map[status] ?? "bg-gray-500/20 text-gray-300";
}

function AdminPage() {
  const { user } = useCrm();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<SupabaseLead[]>([]);
  const [emailLogs, setEmailLogs] = useState<SupabaseEmailLog[]>([]);
  const [profiles, setProfiles] = useState<SupabaseProfile[]>([]);
  const [pendingApprovalRequests, setPendingApprovalRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tab, setTab] = useState<"agents" | "leads" | "emails">("agents");
  const [selectedAgent, setSelectedAgent] = useState<{ name: string; email: string } | null>(null);

  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  async function fetchData() {
    setLoading(true);
    try {
      const [{ data: leadsData }, { data: emailData }, { data: profileData }] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("emails_sent").select("*").order("sent_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      ]);
      if (leadsData) setLeads(leadsData as SupabaseLead[]);
      if (emailData) setEmailLogs(emailData as SupabaseEmailLog[]);
      if (profileData) setProfiles(profileData as SupabaseProfile[]);

      // Fetch from pending_signups table (with fallback to emails_sent queue)
      const pendingList = await fetchPendingSignups();
      setPendingApprovalRequests(pendingList);
    } catch (e) {
      console.error("Admin fetch error", e);
    }
    setLastUpdated(new Date());
    setLoading(false);
  }

  async function handleApproveAgent(req: any) {
    try {
      // req may be a PendingSignup from the new module or a raw emails_sent row
      const signup: PendingSignup = {
        id: req.id,
        name: req.name || req.lead_email?.split("@")[0] || "Unknown",
        email: req.email || req.lead_email,
        phone: req.phone || "",
        avatar_initials: req.avatar_initials || (req.name || req.lead_email || "AG").slice(0, 2).toUpperCase(),
        status: "pending",
        created_at: req.created_at || req.sent_at,
      };

      await approvePendingSignup(signup);
      toast.success(`✅ Approved ${signup.name}! CRM access granted.`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to approve agent: " + err.message);
    }
  }

  async function handleRejectAgent(req: any) {
    try {
      const email = req.email || req.lead_email;
      await removePendingOrApprovedSignup(email);
      toast.success(`❌ Removed pending request from ${req.name || email}.`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to reject request: " + err.message);
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      navigate({ to: "/dashboard" });
      return;
    }
    fetchData();

    // Real-time subscriptions
    const leadsSub = supabase
      .channel("admin-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe();

    const emailSub = supabase
      .channel("admin-emails")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails_sent" }, () => fetchData())
      .subscribe();

    const profileSub = supabase
      .channel("admin-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData())
      .subscribe();

    const interval = setInterval(fetchData, 30000);

    return () => {
      leadsSub.unsubscribe();
      emailSub.unsubscribe();
      profileSub.unsubscribe();
      clearInterval(interval);
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-16 w-16 text-red-400" />
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-white/50">Only the admin can access this panel.</p>
      </div>
    );
  }

  // Pending approval requests come from emails_sent queue (NOT profiles table)
  const pendingProfiles = pendingApprovalRequests;

  // Filter out internal system logs from customer email logs
  const customerEmailLogs = emailLogs.filter(
    (e: any) => e.sequence_type !== "agent_login" && e.type !== "agent_login" && e.sequence_type !== "agent_presence" && e.sequence_type !== "agent_approval_request"
  );

  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.status === "won").length;
  const newLeads = leads.filter((l) => l.status === "new").length;

  // Outreach = unique leads contacted (welcome emails / sequence sent)
  const outreachLeadEmails = new Set<string>();
  leads.forEach((l) => {
    if (l.email) outreachLeadEmails.add(l.email.toLowerCase());
  });
  customerEmailLogs.forEach((e: any) => {
    if (e.lead_email) outreachLeadEmails.add(e.lead_email.toLowerCase());
  });

  const outreachCount = Math.max(outreachLeadEmails.size, leads.length);

  // Replies = unique leads who replied or booked a meeting (normalized by lead email)
  const repliedLeadEmails = new Set<string>();
  leads.forEach((l) => {
    if ((l.status === "meeting" || l.status === "won") && l.email) {
      repliedLeadEmails.add(l.email.toLowerCase());
    }
  });
  customerEmailLogs.forEach((e: any) => {
    if (e.sequence_type === "meeting_confirmed" || e.status === "replied" || e.status === "opened") {
      if (e.lead_email) repliedLeadEmails.add(e.lead_email.toLowerCase());
    }
  });

  const emailSent = outreachCount;
  const emailReplied = repliedLeadEmails.size;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  // Group stats by Agent — combine profiles, agent_presence logs, and leads!
  const agentStatsMap: Record<
    string,
    { name: string; email: string; role: string; totalLeads: number; newLeads: number; contacted: number; won: number; emailsSent: number; replies: number }
  > = {};

  // 0. Pre-populate all 3 registered Admins so they ALWAYS appear at the top
  const defaultAdminNames: Record<string, string> = {
    "garryamelia6265@gmail.com": "Garry Amelia",
    "tzafar04@gmail.com": "T Zafar",
    "annusraees@gmail.com": "Annus Raees",
  };
  ADMIN_EMAILS.forEach((email) => {
    const key = email.toLowerCase();
    const existingProf = profiles.find((p) => p.email.toLowerCase() === key);
    agentStatsMap[key] = {
      name: existingProf?.full_name || defaultAdminNames[key] || key.split("@")[0] || "Admin",
      email: email,
      role: "admin",
      totalLeads: 0,
      newLeads: 0,
      contacted: 0,
      won: 0,
      emailsSent: 0,
      replies: 0,
    };
  });

  // 1. Populate registered profiles from Supabase profiles table (ONLY APPROVED AGENTS AND ADMIN)
  profiles.forEach((p) => {
    if (!p.email) return;
    const isMainAdmin = isAdminEmail(p.email);
    let isApproved = isMainAdmin;
    if ((p as any).avatar_url) {
      try {
        const parsed = JSON.parse((p as any).avatar_url);
        if (typeof parsed.approved === "boolean" && !isMainAdmin) {
          isApproved = parsed.approved;
        }
      } catch {}
    }
    // Hide pending agents from team cards until admin approves them!
    if (!isApproved) return;

    const key = p.email.toLowerCase();
    const role = isMainAdmin ? "admin" : "agent";
    if (!agentStatsMap[key]) {
      agentStatsMap[key] = {
        name: p.full_name || p.email.split("@")[0] || "Working Agent",
        email: p.email,
        role,
        totalLeads: 0,
        newLeads: 0,
        contacted: 0,
        won: 0,
        emailsSent: 0,
        replies: 0,
      };
    } else if (p.full_name) {
      agentStatsMap[key].name = p.full_name;
    }
  });

  // 2. Populate active logged-in agents from emails_sent agent_presence records
  emailLogs.forEach((e: any) => {
    if (e.sequence_type === "agent_presence" && e.lead_email) {
      const email = e.lead_email.toLowerCase();
      // Do not add pending agents to agent stats cards
      const isPending = pendingProfiles.some((p) => p.email.toLowerCase() === email);
      if (isPending) return;

      if (!agentStatsMap[email]) {
        const name = e.subject || email.split("@")[0];
        agentStatsMap[email] = {
          name: name,
          email: e.lead_email,
          role: isAdminEmail(e.lead_email) ? "admin" : "agent",
          totalLeads: 0,
          newLeads: 0,
          contacted: 0,
          won: 0,
          emailsSent: 0,
          replies: 0,
        };
      }
    }
  });

  // 3. Aggregate stats from leads table
  leads.forEach((l) => {
    const agentIdentifier = (l.assigned_agent_name || l.agent || "Unassigned").toLowerCase();
    const matchingKey = Object.keys(agentStatsMap).find(
      (k) => k === agentIdentifier || agentStatsMap[k]?.name.toLowerCase() === agentIdentifier || agentStatsMap[k]?.email.toLowerCase() === agentIdentifier
    ) || agentIdentifier;

    if (!agentStatsMap[matchingKey]) {
      const displayName = l.assigned_agent_name || l.agent || "Unassigned";
      agentStatsMap[matchingKey] = {
        name: displayName,
        email: displayName.includes("@") ? displayName : "—",
        role: isAdminEmail(displayName) ? "admin" : "agent",
        totalLeads: 0,
        newLeads: 0,
        contacted: 0,
        won: 0,
        emailsSent: 0,
        replies: 0,
      };
    }
    const stat = agentStatsMap[matchingKey]!;
    stat.totalLeads++;
    if (l.status === "new") stat.newLeads++;
    if (l.status !== "new" || customerEmailLogs.some((e: any) => e.lead_id === l.id || e.lead_email === l.email)) {
      stat.contacted++;
    }
    if (l.status === "won") stat.won++;
  });

  // Admins always appear first (Garry Amelia, T Zafar, Annus Raees), then Working Agents
  const adminOrder = ["garryamelia6265@gmail.com", "tzafar04@gmail.com", "annusraees@gmail.com"];
  const agentRows = Object.values(agentStatsMap).sort((a, b) => {
    const aIsAdmin = a.role === "admin" || isAdminEmail(a.email);
    const bIsAdmin = b.role === "admin" || isAdminEmail(b.email);
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    if (aIsAdmin && bIsAdmin) {
      const aIdx = adminOrder.indexOf(a.email.toLowerCase());
      const bIdx = adminOrder.indexOf(b.email.toLowerCase());
      return (aIdx !== -1 ? aIdx : 99) - (bIdx !== -1 ? bIdx : 99);
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-violet-400" />
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Admin Control Center</h1>
            <span className="ml-2 rounded-full bg-violet-500/20 px-3 py-0.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/30">
              LIVE REALTIME
            </span>
          </div>
          <p className="mt-1 text-sm text-white/40">
            Admin: <span className="font-medium text-violet-400">{user?.email}</span> · Auto sync active ·{" "}
            <span className="text-white/60">{lastUpdated.toLocaleTimeString()}</span>
          </p>
        </div>
        <Button
          onClick={fetchData}
          disabled={loading}
          className="gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh Live Data"}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={<Users className="h-6 w-6" />}
          label="Total Leads"
          value={totalLeads}
          sub="Across all agents"
          color="from-violet-900 via-violet-800 to-violet-700"
        />
        <StatCard
          icon={<Mail className="h-6 w-6" />}
          label="Outreach Sent"
          value={emailSent}
          sub="Leads contacted"
          color="from-fuchsia-900 via-fuchsia-800 to-fuchsia-700"
        />
        <StatCard
          icon={<CheckCircle2 className="h-6 w-6" />}
          label="Replies & Booked"
          value={emailReplied}
          sub="Meeting responses"
          color="from-emerald-900 via-emerald-800 to-emerald-700"
        />
        <StatCard
          icon={<UserCheck className="h-6 w-6" />}
          label="Won Deals"
          value={wonLeads}
          sub={`${conversionRate}% conversion`}
          color="from-blue-900 via-blue-800 to-blue-700"
        />
        <StatCard
          icon={<Zap className="h-6 w-6" />}
          label="New Leads"
          value={newLeads}
          sub="Pending outreach"
          color="from-slate-900 via-slate-800 to-slate-700"
        />
      </div>

      {/* Pending Agent Approval Notifications Banner */}
      {pendingProfiles.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5 shadow-xl backdrop-blur-md animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex size-3 rounded-full bg-amber-500"></span>
              </span>
              <h2 className="text-base font-bold text-amber-200">
                Pending Approval Requests ({pendingProfiles.length})
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
              New Agent Waiting
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingProfiles.map((req: any) => {
              // fetchPendingSignups() returns PendingSignup objects with direct fields
              const reqName = req.name || req.email?.split("@")[0] || "Unknown";
              const reqEmail = req.email || req.lead_email || "";
              const reqPhone = req.phone || "";
              const reqDate = req.created_at || req.sent_at || "";
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-slate-900/90 p-3.5 shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {reqName}
                    </p>
                    <p className="truncate text-xs text-slate-400">{reqEmail}</p>
                    {reqPhone && <p className="text-[11px] text-amber-300/90 mt-0.5 font-medium">📞 {reqPhone}</p>}
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Requested: {reqDate ? (() => { try { const d = new Date(reqDate); return isNaN(d.getTime()) ? "Recently" : d.toLocaleString(); } catch { return "Recently"; } })() : "Recently"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApproveAgent(req)}
                      title="Approve Access"
                      className="flex items-center justify-center size-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      onClick={() => handleRejectAgent(req)}
                      title="Decline / Reject Request"
                      className="flex items-center justify-center size-8 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition-all shadow-md active:scale-95"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Pipeline Bar */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-400" />
            <h2 className="font-bold text-white">Live Pipeline Breakdown</h2>
          </div>
          <span className="text-xs text-white/40">{totalLeads} total leads</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {["new", "no_answer", "contacted", "replied", "booked", "won"].map((s) => {
            const count = leads.filter((l) => l.status === s).length;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <div key={s} className="flex flex-1 flex-col gap-1.5 min-w-[90px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize font-medium text-white/60">{s.replace(/_/g, " ")}</span>
                  <span className="text-white font-bold">{count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      s === "won"
                        ? "bg-emerald-500"
                        : s === "replied"
                          ? "bg-teal-500"
                          : s === "booked"
                            ? "bg-amber-500"
                            : s === "new"
                              ? "bg-blue-500"
                              : s === "contacted"
                                ? "bg-purple-500"
                                : "bg-slate-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-white/30">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex flex-wrap border-b border-white/10">
          <button
            onClick={() => setTab("agents")}
            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold transition-colors ${
              tab === "agents"
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <UserCheck2 className="h-4 w-4" /> Agent Performance & Activity
          </button>
          <button
            onClick={() => setTab("leads")}
            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold transition-colors ${
              tab === "leads"
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Users className="h-4 w-4" /> All Leads ({totalLeads})
          </button>
          <button
            onClick={() => setTab("emails")}
            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold transition-colors ${
              tab === "emails"
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Mail className="h-4 w-4" /> Email Logs ({customerEmailLogs.length})
          </button>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-white/40">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Fetching live database metrics...
          </div>
        )}

        {/* ── TAB 1: AGENT PERFORMANCE & ACTIVITY ── */}
        {!loading && tab === "agents" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-lg">Sales Team Activity & Performance</h3>
                <p className="text-xs text-white/40">Click any agent card to inspect their assigned leads & real-time activity</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60 font-semibold">
                {agentRows.length} Registered Agent{agentRows.length !== 1 ? "s" : ""}
              </span>
            </div>

            {agentRows.length === 0 ? (
              <div className="py-12 text-center text-white/30">
                No agent activity logged yet. Registered agents will appear here.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agentRows.map((a) => {
                  const winRate = a.totalLeads > 0 ? Math.round((a.won / a.totalLeads) * 100) : 0;
                  return (
                    <div
                      key={a.name}
                      onClick={() => setSelectedAgent({ name: a.name, email: a.email })}
                      className="group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-5 shadow-inner hover:bg-white/10 hover:border-violet-500/50 transition-all"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-violet-600 text-white font-bold text-sm">
                            {a.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-bold text-white truncate group-hover:text-violet-300 transition-colors">{a.name}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.role === "admin" ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30" : "bg-blue-500/20 text-blue-300"}`}>
                              {a.role === "admin" ? "Admin" : "Working Agent"}
                            </span>
                          </div>
                          <p className="text-xs text-white/40 truncate">{a.email !== "—" ? a.email : "Active Team Member"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center my-4">
                        <div className="rounded-lg bg-white/5 p-2">
                          <p className="text-xs text-white/40">Assigned</p>
                          <p className="text-lg font-bold text-white">{a.totalLeads}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2">
                          <p className="text-xs text-white/40">Approached</p>
                          <p className="text-lg font-bold text-violet-300">{a.contacted}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2">
                          <p className="text-xs text-white/40">Won Deals</p>
                          <p className="text-lg font-bold text-emerald-400">{a.won}</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-white/60">
                          <span>Deal Win Rate</span>
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
                        Inspect Leads & Workspace →
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: LEADS TABLE ── */}
        {!loading && tab === "leads" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-widest text-white/40">
                  <th className="px-5 py-3 text-left">Lead</th>
                  <th className="px-5 py-3 text-left">Company</th>
                  <th className="px-5 py-3 text-left">Agent</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-white/30">
                      No leads in database yet. Import leads to see them here.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-violet-600/30 text-xs font-bold text-violet-300">
                              {lead.name?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-white">{lead.name}</p>
                            <p className="text-xs text-white/40">{lead.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-white/60">{lead.company || "—"}</td>
                      <td className="px-5 py-3.5 text-white/60">{lead.assigned_agent_name || lead.agent || "Unassigned"}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(lead.status)}`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-white/40">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TAB 3: EMAIL LOGS TABLE ── */}
        {!loading && tab === "emails" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-widest text-white/40">
                  <th className="px-5 py-3 text-left">Subject</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {customerEmailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-white/30">
                      No customer email logs yet. Automated emails sent to leads will appear here.
                    </td>
                  </tr>
                ) : (
                  customerEmailLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="px-5 py-3.5 text-white/80">{log.subject || "—"}</td>
                      <td className="px-5 py-3.5 text-white/50 capitalize">{(log as any).sequence_type || log.type || "automation"}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(log.status)}`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-white/40">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── AGENT INSPECTOR MODAL ── */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-violet-400" />
                  Agent Workspace: <span className="text-violet-300">{selectedAgent.name}</span>
                </h3>
                <p className="text-xs text-white/40">
                  {selectedAgent.email !== "—" ? selectedAgent.email : "Active Team Member"} · Inspecting assigned leads and real-time activity
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAgent(null)}
                className="text-white/60 hover:text-white"
              >
                ✕ Close
              </Button>
            </div>

            {(() => {
              const emailLower = (selectedAgent.email || "").toLowerCase();
              const nameLower = (selectedAgent.name || "").toLowerCase();
              const usernameLower = emailLower.includes("@") ? emailLower.split("@")[0]! : "";

              // All leads that belong to this agent (by assigned_agent_name or legacy agent field)
              const agentLeads = leads.filter((l) => {
                const assigned = (l.assigned_agent_name || l.agent || "").toLowerCase();
                if (!assigned) return false;
                return (
                  (emailLower && (assigned === emailLower || assigned.includes(emailLower))) ||
                  (nameLower && (assigned === nameLower || assigned.includes(nameLower))) ||
                  (usernameLower && assigned.includes(usernameLower))
                );
              });

              // Metric 1 — Assigned Leads: leads where Admin assigned to this agent
              // (assigned_at is set AND imported_by is NOT the agent's own email)
              const assignedLeads = agentLeads.filter((l: any) =>
                l.assigned_at && (l.imported_by || "").toLowerCase() !== emailLower
              );

              // Metric 2 — Agent Imported: leads the agent personally imported
              const agentImportedLeads = agentLeads.filter((l: any) =>
                l.imported_by && l.imported_by.toLowerCase() === emailLower
              );

              // Metric 3 — Contacted: leads currently in contacted status
              const contactedLeads = agentLeads.filter((l: any) => (l.status || "").toLowerCase() === "contacted");

              // Metric 4 — Replied: leads currently in replied status
              const repliedLeads = agentLeads.filter((l: any) => (l.status || "").toLowerCase() === "replied");

              // Metric 5 — Booked: leads currently in booked status
              const bookedLeads = agentLeads.filter((l: any) => (l.status || "").toLowerCase() === "booked");

              // Metric 6 — Won: leads currently in won status
              const wonLeads = agentLeads.filter((l: any) => (l.status || "").toLowerCase() === "won");

              return (
                <div className="space-y-4">
                  {/* 6-Metric Reporting Grid */}
                  <div className="grid grid-cols-6 gap-2 text-center">
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Assigned<br/>Leads</p>
                      <p className="text-xl font-bold text-white">{assignedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Agent<br/>Imported</p>
                      <p className="text-xl font-bold text-blue-300">{agentImportedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Contacted</p>
                      <p className="text-xl font-bold text-fuchsia-300">{contactedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Replied</p>
                      <p className="text-xl font-bold text-cyan-300">{repliedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Booked</p>
                      <p className="text-xl font-bold text-amber-300">{bookedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Won</p>
                      <p className="text-xl font-bold text-emerald-400">{wonLeads.length}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Assigned Leads List ({agentLeads.length})</h4>
                    {agentLeads.length === 0 ? (
                      <p className="text-xs text-white/40 py-6 text-center rounded-xl bg-white/5">
                        No leads assigned to this agent yet. Leads imported by or assigned to this agent will appear here.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {agentLeads.map((l) => (
                          <div key={l.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-xs">
                            <div>
                              <p className="font-semibold text-white">{l.name}</p>
                              <p className="text-white/40">{l.email} · {l.company || "—"}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusBadge(l.status)}`}>
                              {l.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
