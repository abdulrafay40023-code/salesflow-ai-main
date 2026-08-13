import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  CheckCircle2,
  Mail,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  X,
  Check,
  Bell,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
      { title: "Dashboard — Teals CRM" },
      {
        name: "description",
        content:
          "Pipeline overview: total leads, new leads, follow-ups, meetings today, email status and AI automation activity.",
      },
      { property: "og:title", content: "Dashboard — Teals CRM" },
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
  assigned_agent_name?: string;
  created_at: string;
};

type DbEmailLog = {
  id: string;
  subject: string;
  status: string;
  type: string;
  sequence_type?: string;
  sent_at: string;
};

type DbMeeting = {
  id: string;
  title: string;
  scheduled_time: string;
  completed: boolean;
  lead_id?: string;
};

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
      <Icon className="h-8 w-8 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MeetingNotifications — isolated notification component
// Handles Zoom vs non-Zoom meetings with different visibility logic
// ─────────────────────────────────────────────
function MeetingNotifications({
  meetings,
  dismissedNotifs,
  dismissNotif,
}: {
  meetings: DbMeeting[];
  dismissedNotifs: Set<string>;
  dismissNotif: (id: string) => void;
}) {
  // Live ticker updates every 2 seconds so start-time state transitions happen cleanly & live
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  // Separate Zoom meetings from non-Zoom meetings
  const zoomMeetings = meetings.filter((m) => m.title && m.title.includes("|| ZOOM:"));
  const nonZoomMeetings = meetings.filter((m) => !m.title || !m.title.includes("|| ZOOM:"));

  // ── Zoom Meeting Cards ──
  // Per-meeting independent evaluation:
  // 1. Appears when booked in normal/default color (orange/blue).
  // 2. Turns RED at THAT SPECIFIC meeting's own scheduled start time (nowMs >= meetingStartMs).
  // 3. Stays RED for exactly 10 minutes after scheduled start time.
  // 4. Auto-disappears 10 minutes after scheduled start time (nowMs - meetingStartMs > 10 * 60 * 1000).
  // 5. Always has a manual "X" dismiss button at any stage.
  const zoomCards: Array<{
    id: string;
    isRed: boolean;
    meeting: DbMeeting;
    label: string;
    formattedTime: string;
  }> = [];

  for (const m of zoomMeetings) {
    if (!m.scheduled_time) continue;
    const meetingStartMs = new Date(m.scheduled_time).getTime();
    if (isNaN(meetingStartMs)) continue;

    // Elapsed time since meeting start time (ms)
    const elapsedPostStart = nowMs - meetingStartMs;

    // Requirement: Auto-disappear 10 minutes after start time
    if (elapsedPostStart > 10 * 60 * 1000) continue;

    const id = `zoom-${m.id}`;
    if (dismissedNotifs.has(id)) continue;

    // Requirement: Turn RED at THAT meeting's start time
    const isRed = nowMs >= meetingStartMs;

    let timeLabel = "";
    const cleanTitle = m.title ? (m.title.split("|| ZOOM:")[0] || "").trim() : "";
    if (cleanTitle.includes("@ ")) {
      timeLabel = cleanTitle.split("@ ")[1]?.trim() || "";
    }
    if (!timeLabel) {
      timeLabel = new Date(m.scheduled_time).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }

    const formattedTime = new Date(m.scheduled_time).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    zoomCards.push({ id, isRed, meeting: m, label: timeLabel, formattedTime });
  }

  // ── Non-Zoom Meeting Cards ──
  const nonZoomCards: Array<{
    id: string;
    type: "now" | "1h" | "24h";
    meeting: DbMeeting;
    label: string;
  }> = [];

  for (const m of nonZoomMeetings) {
    if (!m.scheduled_time) continue;
    const mt = new Date(m.scheduled_time);
    if (isNaN(mt.getTime())) continue;
    const diffMs = mt.getTime() - nowMs;

    let timeLabel = mt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const titlePart = m.title ? m.title.trim() : "";
    if (titlePart.includes("@ ")) {
      timeLabel = titlePart.split("@ ")[1]?.trim() || timeLabel;
    }

    if (diffMs <= 0 && diffMs >= -10 * 60 * 1000) {
      const id = `now-${m.id}`;
      if (!dismissedNotifs.has(id)) nonZoomCards.push({ id, type: "now", meeting: m, label: timeLabel });
    } else if (diffMs > 0 && diffMs <= 65 * 60 * 1000) {
      const id = `1h-${m.id}`;
      if (!dismissedNotifs.has(id)) nonZoomCards.push({ id, type: "1h", meeting: m, label: timeLabel });
    } else if (diffMs > 65 * 60 * 1000 && diffMs <= 25 * 60 * 60 * 1000) {
      const id = `24h-${m.id}`;
      if (!dismissedNotifs.has(id)) nonZoomCards.push({ id, type: "24h", meeting: m, label: timeLabel });
    }
  }

  if (zoomCards.length === 0 && nonZoomCards.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Zoom Meeting Notifications */}
      {zoomCards.map((n) => {
        const isRed = n.isRed;
        const borderColor = isRed
          ? "border-red-500/50 bg-red-950/40 text-red-100"
          : "border-orange-500/30 bg-orange-500/10 text-foreground";
        const iconBg = isRed ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400";
        const Icon = isRed ? AlertCircle : CalendarCheck;

        const title = isRed
          ? `🔴 Zoom Meeting Started — ${n.label}`
          : `📹 Zoom Meeting Scheduled — ${n.label}`;
        const subtitle = isRed
          ? "Meeting in progress! Join Zoom now to connect."
          : `Scheduled for ${n.formattedTime}`;

        let zoomLink = "https://zoom.us/j/5539578967";
        if (n.meeting.title && n.meeting.title.includes("|| ZOOM: ")) {
          zoomLink = n.meeting.title.split("|| ZOOM: ")[1]?.trim() || zoomLink;
        }

        return (
          <div
            key={n.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${borderColor} transition-all duration-500 shadow-md`}
          >
            <span className={`grid size-8 place-items-center rounded-lg shrink-0 ${iconBg}`}>
              <Icon className={`size-4 ${isRed ? "animate-pulse" : ""}`} />
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>

            <a
              href={zoomLink}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors text-white ${
                isRed ? "bg-red-600 hover:bg-red-500 animate-pulse" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              📹 Join Zoom
            </a>

            {/* Manual X dismiss button — available at all times */}
            <button
              onClick={() => dismissNotif(n.id)}
              className="ml-auto shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              title="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}

      {/* Non-Zoom Meeting Notifications */}
      {nonZoomCards.map((n) => {
        const isNow = n.type === "now";
        const is1h = n.type === "1h";
        const borderColor = isNow
          ? "border-red-500/30 bg-red-500/8"
          : is1h
          ? "border-yellow-500/30 bg-yellow-500/8"
          : "border-blue-500/30 bg-blue-500/8";
        const iconColor = isNow ? "text-red-400" : is1h ? "text-yellow-400" : "text-blue-400";
        const iconBg = isNow ? "bg-red-500/15" : is1h ? "bg-yellow-500/15" : "bg-blue-500/15";
        const Icon = isNow ? AlertCircle : is1h ? Clock : Bell;
        const title = isNow
          ? `🔴 Meeting Starting NOW — ${n.label}`
          : is1h
          ? `⏰ Meeting in 1 Hour — ${n.label}`
          : `📅 Meeting Tomorrow — ${n.label}`;
        const subtitle = isNow
          ? "Your meeting is happening right now!"
          : is1h
          ? "Prepare your notes — meeting starts in less than 1 hour."
          : "Meeting scheduled for tomorrow — be prepared.";

        return (
          <div
            key={n.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${borderColor} transition-all duration-300`}
          >
            <span className={`grid size-8 place-items-center rounded-lg shrink-0 ${iconBg}`}>
              <Icon className={`size-4 ${iconColor}`} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <button
              onClick={() => dismissNotif(n.id)}
              className="ml-auto shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              title="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DashboardPage() {
  const { user } = useCrm();
  const isAdmin = Boolean(user && (user.role === "admin" || user.email === "garryamelia6265@gmail.com"));

  const [dbLeads, setDbLeads] = useState<DbLead[]>([]);
  const [dbEmails, setDbEmails] = useState<DbEmailLog[]>([]);
  const [dbMeetings, setDbMeetings] = useState<DbMeeting[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("crm_dismissed_notifs");
      if (!stored) return new Set<string>();
      const parsed: Array<{id: string; time: number}> = JSON.parse(stored);
      const now = Date.now();
      // Only keep dismissals from last 24h
      const valid = parsed.filter((d) => now - d.time < 24 * 60 * 60 * 1000);
      localStorage.setItem("crm_dismissed_notifs", JSON.stringify(valid));
      return new Set(valid.map((d) => d.id));
    } catch { return new Set<string>(); }
  });

  function dismissNotif(id: string) {
    setDismissedNotifs((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        const stored = localStorage.getItem("crm_dismissed_notifs");
        const existing: Array<{id: string; time: number}> = stored ? JSON.parse(stored) : [];
        existing.push({ id, time: Date.now() });
        localStorage.setItem("crm_dismissed_notifs", JSON.stringify(existing));
      } catch {}
      return next;
    });
  }

  async function fetchLive() {
    setLoading(true);
    try {

      let leadsQuery = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // Working agent sees only their own leads — use simple eq filter (email is stored as assigned_agent_name)
      if (!isAdmin) {
        const agentEmail = (user?.email || "").trim();
        if (agentEmail) {
          leadsQuery = leadsQuery.eq("assigned_agent_name", agentEmail);
        } else {
          leadsQuery = leadsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const [leadsRes, emailsRes, meetingsRes, profilesRes] = await Promise.allSettled([
        leadsQuery,
        supabase
          .from("emails_sent")
          .select("id,subject,status,sequence_type,sent_at,lead_id,lead_email")
          .order("sent_at", { ascending: false })
          .limit(50),
        supabase
          .from("meetings")
          .select("id,title,scheduled_time,completed,lead_id,agent_email")
          .order("scheduled_time", { ascending: true })
          .limit(50),
        isAdmin
          ? supabase.from("profiles").select("*").order("created_at", { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);

      let fetchedLeads: DbLead[] = [];
      if (leadsRes.status === "fulfilled" && leadsRes.value.data) {
        fetchedLeads = leadsRes.value.data as DbLead[];

        // Client-side double-check: only show leads assigned to this agent's email
        if (!isAdmin) {
          const myEmail = (user?.email || "").trim().toLowerCase();
          fetchedLeads = fetchedLeads.filter((l) => {
            const assigned = (l.assigned_agent_name || "").trim().toLowerCase();
            return assigned === myEmail;
          });
        }

        setDbLeads(fetchedLeads);
      } else {
        setDbLeads([]);
      }

      if (emailsRes.status === "fulfilled" && Array.isArray(emailsRes.value.data)) {
        let emails = emailsRes.value.data.filter(
          (e: any) => e && e.sequence_type !== "agent_presence" && e.sequence_type !== "agent_login",
        );

        if (!isAdmin) {
          const myEmail = (user?.email || "").trim().toLowerCase();
          const leadIds = new Set(fetchedLeads.map((l) => l?.id).filter(Boolean));
          const leadEmails = new Set(fetchedLeads.map((l) => (l?.email || "").toLowerCase()).filter(Boolean));
          emails = emails.filter((e: any) => {
            if (!e) return false;
            // Always show lead_assignment notifications addressed to this agent
            if (e.sequence_type === "lead_assignment" && (e.lead_email || "").toLowerCase() === myEmail) return true;
            // Show emails matching this agent's leads
            if (e.lead_id && leadIds.has(e.lead_id)) return true;
            if (e.lead_email && leadEmails.has(e.lead_email.toLowerCase())) return true;
            return false;
          });
        }

        setDbEmails(emails as any);

      }

      if (meetingsRes.status === "fulfilled" && Array.isArray(meetingsRes.value.data)) {
        let meetings = meetingsRes.value.data as DbMeeting[];
        if (!isAdmin) {
          const agentEmail = (user?.email || "").trim().toLowerCase();
          const leadIds = new Set(fetchedLeads.map((l) => l?.id).filter(Boolean));
          const leadEmails = new Set(fetchedLeads.map((l) => (l?.email || "").toLowerCase()).filter(Boolean));
          meetings = meetings.filter((m) => {
            if (!m) return false;
            if (m.lead_id && leadIds.has(m.lead_id)) return true;
            if ((m as any).agent_email && (m as any).agent_email.toLowerCase() === agentEmail) return true;
            if (m.title) {
              const emailMatch = m.title.match(/[\w.-]+@[\w.-]+\.\w+/);
              if (emailMatch && leadEmails.has(emailMatch[0].toLowerCase())) return true;
            }
            return false;
          });
        }
        setDbMeetings(meetings);
      }

      if (isAdmin && profilesRes.status === "fulfilled" && Array.isArray((profilesRes.value as any)?.data)) {
        const allProfiles = (profilesRes.value as any).data;
        const pending = allProfiles.filter((p: any) => {
          if (!p || !p.email || p.email === "garryamelia6265@gmail.com") return false;
          if (p.role === "admin") return false;
          if (p.avatar_url) {
            try {
              const parsed = JSON.parse(p.avatar_url);
              return parsed.status === "pending" && parsed.approved !== true;
            } catch {}
          }
          return false;
        });



        setPendingProfiles(pending);
      }

    } catch (e) {
      console.error("Dashboard fetch error", e);
    }
    setLastSync(new Date());
    setLoading(false);
  }

  async function handleAcceptAssignedLeads() {
    const myEmail = (user?.email || "").trim().toLowerCase();
    await supabase
      .from("emails_sent")
      .update({ status: "read" })
      .eq("lead_email", myEmail)
      .eq("sequence_type", "lead_assignment");

    toast.success("Accepted assigned leads into your workspace!");
    fetchLive();
  }

  async function handleApproveAgent(p: any) {
    let phone = "";
    if (p.avatar_url) {
      try {
        phone = JSON.parse(p.avatar_url).phone || "";
      } catch {}
    }
    const meta = JSON.stringify({ phone, approved: true, status: "approved" });
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: meta, role: "agent" })
      .eq("id", p.id);

    if (error) {
      toast.error("Failed to approve agent: " + error.message);
    } else {
      toast.success(`Approved ${p.full_name || p.email}! Access granted.`);
      fetchLive();
    }
  }

  async function handleRejectAgent(p: any) {
    if (p.email === "garryamelia6265@gmail.com") return;
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) {
      toast.error("Failed to decline request: " + error.message);
    } else {
      toast.success(`Declined access request for ${p.full_name || p.email}.`);
      fetchLive();
    }
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meetings" }, (payload) => {
        fetchLive();
        // Show toast notification when meeting starts (completed becomes true)
        if (payload?.new?.completed === true && payload?.old?.completed === false) {
          const title = payload?.new?.title || "Your meeting";
          toast(`🔴 Meeting Started! ${title}`, {
            description: "Check your email — meeting start notification was sent.",
            duration: 12000,
          });
        }
      })
      .subscribe();

    let profileSub: any;
    if (isAdmin) {
      profileSub = supabase
        .channel("dash-profiles")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchLive())
        .subscribe();
    }

    const interval = setInterval(fetchLive, 30000);

    return () => {
      leadsSub.unsubscribe();
      emailSub.unsubscribe();
      meetingSub.unsubscribe();
      if (profileSub) profileSub.unsubscribe();
      clearInterval(interval);
    };
  }, [user?.email, user?.role, user?.name, isAdmin]);

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
  const safeLeads = (dbLeads || []).filter(Boolean);
  const safeMeetings = (dbMeetings || []).filter(Boolean);
  const safeEmails = (dbEmails || []).filter(Boolean);

  const total = safeLeads.length;
  const contacted = safeLeads.filter((l) => l.status === "contacted").length;
  const meetingsBooked = safeMeetings.length;
  const wonLeads = safeLeads.filter((l) => l.status === "won").length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const uncompletedMeetings = safeMeetings.filter((m) => !m.completed);
  const todayMeetings = uncompletedMeetings.filter((m) => {
    if (!m.scheduled_time) return false;
    const mDate = new Date(m.scheduled_time);
    return !isNaN(mDate.getTime()) && mDate >= todayStart && mDate <= todayEnd;
  });

  const meetingsToday = todayMeetings.length;

  // Email Status counts
  // Sent = only welcome emails (sequence_type === "welcome")
  const emailSent = safeEmails.filter((e) => e && e.sequence_type === "welcome").length;
  // Replied = leads/emails with replied status
  const emailReplied = Math.max(
    safeEmails.filter((e) => e && e.status === "replied").length,
    safeLeads.filter((l) => l && l.status === "replied").length
  );
  // Booked = meetings booked count (from meetings table)
  const emailBooked = safeMeetings.length;
  const emailTotal = Math.max(emailSent + emailReplied + emailBooked, 1);

  // Automated Follow-up Sequence Counts
  const fu24Count = safeEmails.filter((e) => e && (e.sequence_type === "followup_24h" || (e.subject && e.subject.toLowerCase().includes("quick follow-up")))).length;
  const fu48Count = safeEmails.filter((e) => e && (e.sequence_type === "followup_48h" || (e.subject && e.subject.toLowerCase().includes("following up")))).length;
  const fu72Count = safeEmails.filter((e) => e && (e.sequence_type === "followup_72h" || (e.subject && e.subject.toLowerCase().includes("demo")))).length;
  const fu10dCount = safeEmails.filter((e) => e && (e.sequence_type === "followup_10d" || (e.subject && e.subject.toLowerCase().includes("final check-in")))).length;

  const latestLeads = safeLeads.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good afternoon, ${user?.name?.split(" ")[0] ?? "there"}`}
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

      {/* Primary Metrics Grid (5 Clean Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Leads" value={total} icon={Users} hint="in workspace" />
        <StatCard label="Contacted" value={contacted} icon={Mail} tone="info" hint="calls & outreach" />
        <StatCard label="Meetings Booked" value={meetingsBooked} icon={CalendarCheck} tone="warning" hint="total booked" />
        <StatCard label="Meetings Today" value={meetingsToday} icon={CalendarCheck} tone="primary" hint="scheduled today" />
        <StatCard label="Won Deals" value={wonLeads} icon={CheckCircle2} tone="success" hint="closed won" />
      </div>

      {/* Pending Agent Approval Notifications Banner (Admin Only) */}
      {isAdmin && pendingProfiles.length > 0 && (
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
            {pendingProfiles.map((p) => {
              let phone = "";
              if (p.avatar_url) {
                try {
                  phone = JSON.parse(p.avatar_url).phone || "";
                } catch {}
              }
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-slate-900/90 p-3.5 shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {p.full_name || p.email.split("@")[0]}
                    </p>
                    <p className="truncate text-xs text-slate-400">{p.email}</p>
                    {phone && <p className="text-[11px] text-amber-300/90 mt-0.5 font-medium">📞 {phone}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApproveAgent(p)}
                      title="Approve Access"
                      className="flex items-center justify-center size-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      onClick={() => handleRejectAgent(p)}
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

      {/* Assigned Leads Notification Banner for Working Agent */}
      {(() => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
        const pendingAssignments = dbEmails.filter(
          (e) =>
            e.sequence_type === "lead_assignment" &&
            e.status === "unread" &&
            new Date(e.sent_at).getTime() > cutoff
        );
        if (isAdmin || pendingAssignments.length === 0) return null;

        const leadCount = pendingAssignments.reduce((sum, e) => {
          const match = (e.subject || "").match(/(\d+) new lead/);
          return sum + (match ? parseInt(match[1]) : 1);
        }, 0);

        return (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-500/40 bg-violet-950/30 p-5 shadow-xl backdrop-blur-md animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 shrink-0">
                <UserPlus className="size-5" />
              </span>
              <div>
                <p className="text-base font-bold text-violet-200">
                  📥 Admin assigned <span className="text-violet-300">{leadCount} new lead{leadCount !== 1 ? "s" : ""}</span> to you!
                </p>
                <p className="text-xs text-violet-300/70 mt-0.5">
                  Go to your Leads page to see them, or click Accept below to confirm receipt.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleAcceptAssignedLeads}
                className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 shadow-lg gap-2"
              >
                <CheckCircle2 className="size-4" /> Accept Leads →
              </Button>
              <button
                onClick={async () => {
                  const myEmail = (user?.email || "").trim().toLowerCase();
                  await supabase
                    .from("emails_sent")
                    .update({ status: "read" })
                    .eq("lead_email", myEmail)
                    .eq("sequence_type", "lead_assignment");
                  fetchLive();
                }}
                title="Dismiss notification"
                className="flex items-center justify-center size-8 rounded-lg bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 hover:text-white transition-all shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        );
      })()}


      {/* ── Notification Sections (agents only, not admin) ── */}
      {!isAdmin && <MeetingNotifications meetings={safeMeetings} dismissedNotifs={dismissedNotifs} dismissNotif={dismissNotif} />}

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
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
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
                ["Replied", emailReplied, "bg-success"],
                ["Booked", emailBooked, "bg-violet-500"],
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
              icon={Users}
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
                        {l.company} · {l.assigned_agent_name || l.agent || "Unassigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {l.status !== "contacted" && l.status !== "won" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 border-blue-500/30"
                        onClick={() => handleUpdateLeadStatus(l.id, "contacted")}
                      >
                        <Mail className="h-3 w-3 mr-1" /> Contacted
                      </Button>
                    ) : null}
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

        {/* Automated Follow-up Sequences panel */}
        <div className="panel overflow-hidden">
          <div className="mesh-bg bg-primary/90 p-5 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <h2 className="font-display text-base font-bold">Automated Follow-up Sequences</h2>
            </div>
            <p className="mt-1 text-xs text-primary-foreground/80">
              Live tracking across 4 follow-up stages
            </p>
          </div>
          <div className="space-y-4 p-5">
            {[
              ["24h Check-in Email", fu24Count, total > 0 ? Math.min(100, Math.round((fu24Count / total) * 100)) : 0],
              ["48h Value Touchpoint", fu48Count, total > 0 ? Math.min(100, Math.round((fu48Count / total) * 100)) : 0],
              ["72h Demo Invitation", fu72Count, total > 0 ? Math.min(100, Math.round((fu72Count / total) * 100)) : 0],
              ["10d Final Touchpoint", fu10dCount, total > 0 ? Math.min(100, Math.round((fu10dCount / total) * 100)) : 0],
            ].map(([label, count, pct]) => (
              <div key={label as string}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{label as string}</span>
                  <span className="text-xs text-muted-foreground tabular-nums font-semibold">
                    {count as number} sent <span className="opacity-70">({pct as number}%)</span>
                  </span>
                </div>
                <Progress value={pct as number} className="mt-2 h-1.5" />
              </div>
            ))}
            {total === 0 && (
              <p className="text-center text-xs text-muted-foreground pt-2">
                Import leads to activate automated follow-up tracking
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
