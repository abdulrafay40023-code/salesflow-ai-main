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
  PhoneCall,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StatCard } from "@/components/crm/StatCard";
import { PageHeader } from "@/components/crm/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_STATUSES, isAdminEmail, statusLabels } from "@/lib/crm-data";
import { statusTone, useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import {
  fetchPendingSignups,
  approvePendingSignup,
  removePendingOrApprovedSignup,
  type PendingSignup,
} from "@/lib/pending-signups";
import { cancelMeetingBookingFn } from "@/lib/server-actions";
import { AiCallDialog } from "@/components/crm/AiCallDialog";

function formatRequestedDate(d?: string) {
  if (!d) return "Recently";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "Recently";
    return date.toLocaleString();
  } catch {
    return "Recently";
  }
}

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
// ─────────────────────────────────────────────
// MeetingNotifications — isolated notification component
// Handles Zoom vs non-Zoom meetings with consistent 10-min post-start retention logic
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// MeetingNotifications — Unified Meeting Notification Banner for Working Agents
// Exact Color States:
// 🔴 RED: Meeting is LIVE right now (nowMs >= meetingStartMs and up to 10 mins post-start)
// 🟧 ORANGE: Meeting scheduled for TODAY (before start time)
// 🟦 BLUE: Meeting scheduled for TOMORROW / Future
// ─────────────────────────────────────────────
function MeetingNotifications({
  meetings,
  leads,
  dismissedNotifs,
  dismissNotif,
}: {
  meetings: DbMeeting[];
  leads: DbLead[];
  dismissedNotifs: Set<string>;
  dismissNotif: (id: string, type: "today" | "future") => void;
}) {
  // Live ticker updates every 2 seconds for real-time state changes and auto-dismissal
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  // Filter out cancelled or completed meetings
  const activeMeetings = (meetings || []).filter(
    (m) => m && m.scheduled_time && !m.completed && (!m.title || !m.title.includes("[CANCELLED]"))
  );

  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const endOfTomorrow = endOfToday + 24 * 60 * 60 * 1000;

  const cards: Array<{
    id: string;
    isLive: boolean;
    isToday: boolean;
    isTomorrow: boolean;
    isFuture: boolean;
    meeting: DbMeeting;
    label: string;
    formattedTime: string;
    clientName: string;
    clientEmail: string;
    zoomLink: string;
  }> = [];

  for (const m of activeMeetings) {
    if (!m.scheduled_time) continue;
    const meetingStartMs = new Date(m.scheduled_time).getTime();
    if (isNaN(meetingStartMs)) continue;

    // Elapsed time since meeting start (in ms)
    const elapsedPostStart = nowMs - meetingStartMs;

    // Auto-disappear 10 minutes AFTER scheduled start time
    if (elapsedPostStart > 10 * 60 * 1000) continue;

    // Extract time label (e.g., "10:30 AM")
    let timeLabel = "";
    const rawTitleWithoutNow = m.title ? m.title.split("|| NOW_SENT")[0].trim() : "";
    const cleanTitle = rawTitleWithoutNow ? (rawTitleWithoutNow.split("|| ZOOM:")[0] || "").trim() : "";
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

    // Extract client name & email cleanly
    let clientName = "";
    let clientEmail = "";
    let linkedLead: DbLead | undefined = undefined;

    if (m.lead_id && leads) {
      linkedLead = leads.find((l) => l.id === m.lead_id);
      if (linkedLead) {
        clientName = linkedLead.name || "";
        clientEmail = linkedLead.email || "";
      }
    }

    if (!clientEmail && m.title) {
      const emailMatch = m.title.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) clientEmail = emailMatch[0].trim();
    }

    if (!clientName && cleanTitle) {
      // Clean title format: "Sales Meeting with [Name] ([Email]) on YYYY-MM-DD @ HH:MM AM/PM"
      const withMatch = cleanTitle.match(/Sales Meeting with ([^(]+?)(?:\s*\([^)]*\))?\s+on\s+/i);
      if (withMatch && withMatch[1]) {
        clientName = withMatch[1].trim();
      } else if (cleanTitle.includes("Sales Meeting with ")) {
        const afterWith = cleanTitle.split("Sales Meeting with ")[1]?.split(" on ")[0]?.trim() || "";
        clientName = afterWith.replace(/\([^)]*\)/g, "").trim();
      } else if (clientEmail) {
        clientName = clientEmail.split("@")[0];
      }
    }

    clientName = (clientName || "").replace(/\(\s*\)/g, "").trim();
    if (!clientName && clientEmail) {
      clientName = clientEmail.split("@")[0];
    }

    if (!linkedLead && leads) {
      linkedLead = leads.find(
        (l) =>
          (clientEmail && l.email && l.email.toLowerCase() === clientEmail.toLowerCase()) ||
          (clientName && l.name && l.name.trim().toLowerCase() === clientName.toLowerCase()) ||
          (l.email && m.title && m.title.toLowerCase().includes(l.email.toLowerCase()))
      );
    }

    // If meeting has started (red/live state) AND the linked lead has been marked contacted, won, or replied → hide immediately!
    if (elapsedPostStart >= 0 && linkedLead) {
      if (linkedLead.status === "contacted" || linkedLead.status === "won" || linkedLead.status === "replied") {
        continue;
      }
    }

    const isLive = nowMs >= meetingStartMs;
    const isToday = meetingStartMs >= startOfToday && meetingStartMs <= endOfToday && !isLive;
    const isTomorrow = meetingStartMs > endOfToday && meetingStartMs <= endOfTomorrow;
    const isFuture = meetingStartMs > endOfToday;

    const id = `meeting-notif-${m.id}`;

    // Dismissal Resurfacing Logic (Req 4):
    // If meeting is Today or Live, only hide if dismissed today. If it was previously dismissed
    // when it was in the future, it automatically resurfaces on the meeting day!
    if (isLive || isToday) {
      if (dismissedNotifs.has(`${id}_today`)) continue;
    } else {
      if (dismissedNotifs.has(`${id}_future`)) continue;
    }

    // Format clean YYYY-MM-DD date string (e.g. 2026-08-18)
    const mDateObj = new Date(m.scheduled_time);
    const yStr = mDateObj.getFullYear();
    const monStr = String(mDateObj.getMonth() + 1).padStart(2, "0");
    const dStr = String(mDateObj.getDate()).padStart(2, "0");
    const meetingDateStr = `${yStr}-${monStr}-${dStr}`;

    // Extract Zoom Link
    let zoomLink = "https://zoom.us/j/5539578967";
    if (rawTitleWithoutNow.includes("|| ZOOM:")) {
      zoomLink = rawTitleWithoutNow.split("|| ZOOM:")[1]?.trim() || zoomLink;
    }

    cards.push({
      id,
      isLive,
      isToday,
      isTomorrow,
      isFuture,
      meeting: m,
      label: timeLabel,
      formattedTime,
      meetingDateStr,
      clientName,
      clientEmail,
      zoomLink,
    });
  }

  if (cards.length === 0) return null;

  // Stacking in order: Live meetings first, followed by today's meetings, then tomorrow/future meetings
  cards.sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    const timeA = new Date(a.meeting.scheduled_time).getTime();
    const timeB = new Date(b.meeting.scheduled_time).getTime();
    return timeA - timeB;
  });

  return (
    <div className="space-y-3">
      {cards.map((n) => {
        let borderColor = "border-orange-500/40 bg-orange-950/40 text-orange-100";
        let iconBg = "bg-orange-500/20 text-orange-400";
        let btnColor = "bg-orange-600 hover:bg-orange-500 text-white";
        let Icon = CalendarCheck;
        let title = `🟧 Meeting Scheduled Today — ${n.label}`;
        let subtitle = `Your sales meeting is scheduled for Today at ${n.label}.`;

        if (n.isLive) {
          // 🔴 RED: Meeting is happening right now (active for 10 mins post-start)
          borderColor = "border-red-500/60 bg-red-950/70 text-red-100 ring-2 ring-red-500/30";
          iconBg = "bg-red-500/25 text-red-400";
          btnColor = "bg-red-600 hover:bg-red-500 animate-pulse text-white shadow-lg shadow-red-900/50";
          Icon = AlertCircle;
          title = `🔴 Meeting in Progress (Started ${n.label})`;
          subtitle = "Meeting is live right now! Click Join Zoom to enter the call.";
        } else if (n.isFuture) {
          // 🟦 BLUE: Tomorrow or Future meeting
          borderColor = "border-blue-500/40 bg-blue-950/40 text-blue-100";
          iconBg = "bg-blue-500/20 text-blue-400";
          btnColor = "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/50";
          Icon = CalendarCheck;
          title = n.isTomorrow ? `🟦 Meeting Scheduled Tomorrow — ${n.label}` : `🟦 Meeting Scheduled (${n.meetingDateStr}) — ${n.label}`;
          subtitle = n.isTomorrow
            ? `Your sales meeting is scheduled for Tomorrow at ${n.label}.`
            : `Your sales meeting is scheduled for ${n.meetingDateStr} at ${n.label}.`;
        }

        return (
          <div
            key={n.id}
            className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${borderColor} transition-all duration-500 shadow-xl backdrop-blur-md animate-fade-in`}
          >
            <span className={`grid size-10 place-items-center rounded-xl shrink-0 ${iconBg} border border-current/20`}>
              <Icon className={`size-5 ${n.isLive ? "animate-pulse" : ""}`} />
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold tracking-tight">{title}</p>
                {n.isLive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-500/40 animate-pulse">
                    LIVE NOW
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs opacity-90">
                <span>{subtitle}</span>
                {(n.clientName || n.clientEmail) && (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                    👤 Client: {n.clientName || "Lead"} {n.clientEmail && n.clientEmail !== n.clientName ? `(${n.clientEmail})` : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={n.zoomLink}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-md transition-all active:scale-95 ${btnColor}`}
              >
                📹 Join Zoom
              </a>

              <button
                onClick={() => dismissNotif(n.id, n.isToday || n.isLive ? "today" : "future")}
                className="shrink-0 flex items-center justify-center size-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all active:scale-95 border border-white/10"
                title="Dismiss notification"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardPage() {
  const { user } = useCrm();
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  const [dbLeads, setDbLeads] = useState<DbLead[]>([]);
  const [dbEmails, setDbEmails] = useState<DbEmailLog[]>([]);
  const [dbMeetings, setDbMeetings] = useState<DbMeeting[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [callingLead, setCallingLead] = useState<any>(null);
  const [isCallOpen, setIsCallOpen] = useState(false);
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

  function dismissNotif(id: string, type: "today" | "future" = "today") {
    const taggedId = `${id}_${type}`;
    setDismissedNotifs((prev) => {
      const next = new Set(prev);
      next.add(taggedId);
      try {
        const stored = localStorage.getItem("crm_dismissed_notifs");
        const existing: Array<{id: string; time: number}> = stored ? JSON.parse(stored) : [];
        existing.push({ id: taggedId, time: Date.now() });
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

      // Working agent sees only their own leads
      if (!isAdmin) {
        const agentEmail = (user?.email || "").trim();
        if (agentEmail) {
          leadsQuery = leadsQuery.ilike("assigned_agent_name", agentEmail);
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
          .limit(200),
        supabase
          .from("meetings")
          .select("id,title,scheduled_time,completed,lead_id,agent_email,reminder_5m_sent,reminder_1h_sent,reminder_24h_sent")
          .gte("scheduled_time", new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Only upcoming + last 15 mins
          .order("scheduled_time", { ascending: true })
          .limit(100),
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

        // Auto-check 24h age: if a lead is "new" and > 24 hours old without booking/reply, mark "no_answer"
        fetchedLeads = fetchedLeads.map((l) => {
          const createdAtTime = new Date(l.created_at || 0).getTime();
          const isOlderThan24h = createdAtTime > 0 && (Date.now() - createdAtTime) >= 24 * 60 * 60 * 1000;
          if (l.status === "new" && isOlderThan24h) {
            supabase.from("leads").update({ status: "no_answer" }).eq("id", l.id).then(() => {});
            return { ...l, status: "no_answer" };
          }
          return l;
        });

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

      if (isAdmin) {
        const pending = await fetchPendingSignups();
        setPendingProfiles(pending as any);
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

  async function handleApproveAgent(req: any) {
    try {
      await approvePendingSignup(req);
      toast.success(`✅ Approved ${req.name || req.email}! Access granted.`);
      fetchLive();
    } catch (err: any) {
      toast.error("Failed to approve agent: " + err.message);
    }
  }

  async function handleRejectAgent(req: any) {
    try {
      await removePendingOrApprovedSignup(req.email);
      toast.success(`❌ Declined request from ${req.name || req.email}.`);
      fetchLive();
    } catch (err: any) {
      toast.error("Failed to decline request: " + err.message);
    }
  }

  useEffect(() => {
    fetchLive();

    const subId = Math.random().toString(36).substring(2, 9);

    const leadsSub = supabase
      .channel(`dash-leads-${subId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLive())
      .subscribe();

    const emailSub = supabase
      .channel(`dash-emails-${subId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "emails_sent" }, () =>
        fetchLive(),
      )
      .subscribe();

    const meetingSub = supabase
      .channel(`dash-meetings-${subId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, (payload) => {
        fetchLive();
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
        .channel(`dash-profiles-${subId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchLive())
        .subscribe();
    }

    // Auto-refresh when tab comes into focus
    const onVisibilityOrFocus = () => {
      fetchLive();
    };
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    // Poll reminders every 60 seconds
    const reminderInterval = setInterval(() => {
      fetch("/api/check-reminders", { method: "POST" }).catch(() => {});
      fetchLive();
    }, 60000);

    // Fast sync every 5 seconds so both admin and agent dashboards are always 100% matched
    const interval = setInterval(fetchLive, 5000);

    return () => {
      leadsSub.unsubscribe();
      emailSub.unsubscribe();
      meetingSub.unsubscribe();
      if (profileSub) profileSub.unsubscribe();
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      clearInterval(interval);
      clearInterval(reminderInterval);
    };
  }, [user?.email, user?.role, user?.name, isAdmin]);

  async function handleUpdateLeadStatus(leadId: string, newStatus: string) {
    const updatedLead = dbLeads.find((l) => l.id === leadId);
    const leadEmail = updatedLead?.email?.toLowerCase();
    const leadName = updatedLead?.name?.toLowerCase();

    // Instantly update local state so notification and status disappear immediately
    setDbLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));

    if (newStatus === "contacted" || newStatus === "won" || newStatus === "replied" || newStatus === "booking_cancelled") {
      setDbMeetings((prev) =>
        prev.map((m) => {
          const isMatch =
            m.lead_id === leadId ||
            (leadEmail && m.title && m.title.toLowerCase().includes(leadEmail)) ||
            (leadName && m.title && m.title.toLowerCase().includes(leadName));
          return isMatch ? { ...m, completed: true } : m;
        })
      );
    }

    if (newStatus === "booking_cancelled" && updatedLead?.email) {
      cancelMeetingBookingFn({
        data: {
          leadEmail: updatedLead.email,
          cancelledBy: "agent",
        },
      }).catch(console.error);
    }

    try {
      const nowIso = new Date().toISOString();
      type DashboardLeadUpdate = {
        status: string;
        contacted_at?: string;
        booked_at?: string;
        won_at?: string;
      };
      const payload: DashboardLeadUpdate = { status: newStatus };
      if (newStatus === "contacted" || newStatus === "replied") {
        payload.contacted_at = nowIso;
      } else if (newStatus === "booked") {
        payload.contacted_at = nowIso;
        payload.booked_at = nowIso;
      } else if (newStatus === "won") {
        payload.contacted_at = nowIso;
        payload.won_at = nowIso;
      }

      await supabase.from("leads").update(payload).eq("id", leadId);
      fetchLive(); // then re-sync from DB
    } catch (e) {
      console.error("Failed to update status:", e);
      fetchLive(); // re-sync even on error
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
  // Exclude completed/cancelled meetings from active booked count
  const safeMeetings = (dbMeetings || []).filter(
    (m) => m && !m.completed && (!m.title || !m.title.includes("[CANCELLED]"))
  );
  const safeEmails = (dbEmails || []).filter(Boolean);

  const total = safeLeads.length;
  const contacted = safeLeads.filter((l) => l.status === "contacted").length;
  const meetingsBooked = safeMeetings.length;
  const wonLeads = safeLeads.filter((l) => l.status === "won").length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);

  const todayMeetings = safeMeetings.filter((m) => {
    if (!m.scheduled_time) return false;
    const mDate = new Date(m.scheduled_time);
    return !isNaN(mDate.getTime()) && mDate >= todayStart && mDate <= todayEnd;
  });

  const tomorrowMeetings = safeMeetings.filter((m) => {
    if (!m.scheduled_time) return false;
    const mDate = new Date(m.scheduled_time);
    return !isNaN(mDate.getTime()) && mDate >= tomorrowStart && mDate <= tomorrowEnd;
  });

  const meetingsToday = todayMeetings.length;
  const meetingsTomorrow = tomorrowMeetings.length;

  // Email Status counts
  // Sent = only welcome emails (sequence_type === "welcome")
  const emailSent = safeEmails.filter((e) => e && e.sequence_type === "welcome").length;
  // Replied = ONLY leads whose status is explicitly "replied" (not double-counted with email rows)
  const emailReplied = safeLeads.filter((l) => l && l.status === "replied").length;
  // Booked = active meetings booked count
  const emailBooked = safeMeetings.length;
  const emailTotal = Math.max(emailSent + emailReplied + emailBooked, 1);

  // Automated Follow-up Sequence Counts (3 stages: 24h, 48h, 72h)
  const fu24Count = safeEmails.filter((e) => e && (e.sequence_type === "followup_24h" || (e.subject && e.subject.toLowerCase().includes("quick follow-up")))).length;
  const fu48Count = safeEmails.filter((e) => e && (e.sequence_type === "followup_48h" || (e.subject && e.subject.toLowerCase().includes("following up")))).length;
  const fu72Count = safeEmails.filter((e) => e && (e.sequence_type === "followup_72h" || (e.subject && e.subject.toLowerCase().includes("demo")))).length;

  const latestLeads = [...safeLeads]
    .sort((a, b) => {
      const statusWeight: Record<string, number> = {
        new: 1,
        no_answer: 2,
        contacted: 3,
        replied: 4,
        booked: 5,
        won: 6,
      };
      const wA = statusWeight[a.status] || 1;
      const wB = statusWeight[b.status] || 1;
      if (wA !== wB) return wA - wB;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .slice(0, 5);

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

      {/* Primary Metrics Grid (6 Clean Cards) — FIRST directly below Header */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Leads" value={total} icon={Users} hint="in workspace" />
        <StatCard label="Contacted" value={contacted} icon={Mail} tone="info" hint="calls & outreach" />
        <StatCard label="Meetings Booked" value={meetingsBooked} icon={CalendarCheck} tone="warning" hint="total booked" />
        <StatCard label="Meetings Today" value={meetingsToday} icon={CalendarCheck} tone="primary" hint="scheduled today" />
        <StatCard label="Meetings Tomorrow" value={meetingsTomorrow} icon={CalendarCheck} tone="info" hint="scheduled tomorrow" />
        <StatCard label="Won Deals" value={wonLeads} icon={CheckCircle2} tone="success" hint="closed won" />
      </div>

      {/* ── Notification Sections (Stacked BELOW the 5 Primary Metric Cards) ── */}
      {!isAdmin && (
        <MeetingNotifications
          meetings={dbMeetings}
          leads={safeLeads}
          dismissedNotifs={dismissedNotifs}
          dismissNotif={dismissNotif}
        />
      )}

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
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-slate-900/90 p-3.5 shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {p.name || p.full_name || p.email.split("@")[0]}
                    </p>
                    <p className="truncate text-xs text-slate-400">{p.email}</p>
                    {p.phone && <p className="text-[11px] text-amber-300/90 mt-0.5 font-medium">📞 {p.phone}</p>}
                    <p className="text-[10px] text-slate-500 mt-0.5">Requested: {formatRequestedDate(p.created_at || p.sent_at)}</p>
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
              {(["new", "no_answer", "contacted", "replied", "booked", "booking_cancelled", "won"] as const).map((s) => {
                const count = dbLeads.filter((l) => l.status === s).length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const colors: Record<string, string> = {
                  new: "bg-blue-500",
                  no_answer: "bg-slate-500",
                  contacted: "bg-purple-500",
                  replied: "bg-teal-500",
                  booked: "bg-amber-500",
                  booking_cancelled: "bg-rose-500",
                  won: "bg-emerald-500",
                };
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs capitalize text-muted-foreground">
                      {statusLabels[s] ?? s.replace(/_/g, " ")}
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
                    {l.phone && l.phone.trim().length > 3 && l.phone !== "—" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-lg text-violet-400 hover:text-white hover:bg-violet-600 border-violet-500/30 font-semibold gap-1 transition-all active:scale-95"
                        onClick={() => {
                          setCallingLead(l);
                          setIsCallOpen(true);
                        }}
                      >
                        <PhoneCall className="h-3 w-3" /> Call
                      </Button>
                    ) : null}

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

                    {/* Inline Status Dropdown (Change status right from dashboard) */}
                    <Select
                      value={l.status}
                      onValueChange={(v) => handleUpdateLeadStatus(l.id, v as any)}
                    >
                      <SelectTrigger
                        className={`h-7 w-auto min-w-[110px] rounded-full border text-xs font-semibold px-2.5 py-0.5 gap-1 ${statusTone[l.status as keyof typeof statusTone] ?? "bg-slate-500/12 text-slate-400"}`}
                        style={{ boxShadow: "none" }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {statusLabels[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              Live tracking across 3 follow-up stages
            </p>
          </div>
          <div className="space-y-4 p-5">
            {[
              ["24h Check-in Email", fu24Count, total > 0 ? Math.min(100, Math.round((fu24Count / total) * 100)) : 0],
              ["48h Value Touchpoint", fu48Count, total > 0 ? Math.min(100, Math.round((fu48Count / total) * 100)) : 0],
              ["72h Demo Invitation", fu72Count, total > 0 ? Math.min(100, Math.round((fu72Count / total) * 100)) : 0],
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

      <AiCallDialog
        open={isCallOpen}
        onOpenChange={setIsCallOpen}
        lead={callingLead}
        onCallComplete={() => fetchLive()}
      />
    </div>
  );
}
