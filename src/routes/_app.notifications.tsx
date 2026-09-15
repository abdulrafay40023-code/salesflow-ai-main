import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  RefreshCw,
  Sparkles,
  User,
  Video,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/crm/Topbar";
import { StatCard } from "@/components/crm/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";
import { cancelMeetingBookingFn } from "@/lib/server-actions";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: "Booking Notifications — Teals CRM" },
      {
        name: "description",
        content: "View all scheduled meeting notifications categorized by Today, Tomorrow, Upcoming, and All.",
      },
    ],
  }),
  component: NotificationsPage,
});

type DbMeeting = {
  id: string;
  title: string;
  scheduled_time: string;
  completed: boolean;
  lead_id?: string;
  agent_email?: string;
};

type DbLead = {
  id: string;
  name: string;
  email: string;
  company?: string;
  assigned_agent_name?: string;
};

function formatCountdown(targetMs: number, nowMs: number) {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0 && diffMs >= -10 * 60 * 1000) {
    return "🔴 Live Right Now";
  }
  if (diffMs < -10 * 60 * 1000) {
    return "Ended";
  }

  const mins = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remHours = hours % 24;
    return `In ${days}d ${remHours}h`;
  }
  if (hours > 0) {
    const remMins = mins % 60;
    return `In ${hours}h ${remMins}m`;
  }
  return `In ${mins} minutes`;
}

type CategorizedCard = {
  id: string;
  meeting: DbMeeting;
  scheduledTimeMs: number;
  isLive: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isUpcoming: boolean;
  formattedDate: string;
  formattedTime: string;
  clientName: string;
  clientEmail: string;
  zoomLink: string;
  agentEmail: string;
  isCancelled?: boolean;
};

function NotificationsPage() {
  const { user } = useCrm();
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  const [meetings, setMeetings] = useState<DbMeeting[]>([]);
  const [cancelledMeetings, setCancelledMeetings] = useState<DbMeeting[]>([]);
  const [leads, setLeads] = useState<DbLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<string>("all");

  // Keep ticker running every 2s for live countdowns
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 2000);
    return () => clearInterval(ticker);
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    try {
      let leadsQuery = supabase.from("leads").select("id, name, email, company, assigned_agent_name");
      if (!isAdmin) {
        const agentEmail = (user?.email || "").trim();
        if (agentEmail) {
          leadsQuery = leadsQuery.eq("assigned_agent_name", agentEmail);
        }
      }

      const [meetingsRes, leadsRes, cancelledRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("id, title, scheduled_time, completed, lead_id, agent_email")
          .eq("completed", false)
          .order("scheduled_time", { ascending: true }),
        leadsQuery,
        supabase
          .from("meetings")
          .select("id, title, scheduled_time, completed, lead_id, agent_email")
          .like("title", "%[CANCELLED]%")
          .order("scheduled_time", { ascending: false })
          .limit(20),
      ]);

      if (leadsRes.data) {
        setLeads(leadsRes.data as DbLead[]);
      }

      if (meetingsRes.data) {
        let fetchedMeetings = meetingsRes.data as DbMeeting[];
        // Filter out cancelled meetings
        fetchedMeetings = fetchedMeetings.filter(
          (m) => m && m.scheduled_time && !m.completed && (!m.title || !m.title.includes("[CANCELLED]"))
        );

        // Non-admin sees only their assigned meetings
        if (!isAdmin) {
          const myEmail = (user?.email || "").trim().toLowerCase();
          const myLeadIds = new Set((leadsRes.data || []).map((l) => l.id));
          fetchedMeetings = fetchedMeetings.filter((m) => {
            if (m.agent_email && m.agent_email.toLowerCase() === myEmail) return true;
            if (m.lead_id && myLeadIds.has(m.lead_id)) return true;
            return false;
          });
        }

        setMeetings(fetchedMeetings);
      }

      if (cancelledRes.data) {
        let fetchedCancelled = cancelledRes.data as DbMeeting[];
        if (!isAdmin) {
          const myEmail = (user?.email || "").trim().toLowerCase();
          const myLeadIds = new Set((leadsRes.data || []).map((l) => l.id));
          fetchedCancelled = fetchedCancelled.filter((m) => {
            if (m.agent_email && m.agent_email.toLowerCase() === myEmail) return true;
            if (m.lead_id && myLeadIds.has(m.lead_id)) return true;
            return false;
          });
        }
        setCancelledMeetings(fetchedCancelled);
      }

      setLastSync(new Date());
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => fetchNotifications())
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchNotifications())
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.email, isAdmin]);

  async function handleCancelMeeting(meetingId: string) {
    try {
      const res = await cancelMeetingBookingFn({ data: { meetingId, cancelledBy: "agent" } });
      if (res?.success) {
        toast.success("Meeting session cancelled successfully.");
        fetchNotifications();
      } else {
        toast.error("Failed to cancel meeting.");
      }
    } catch {
      toast.error("Failed to cancel meeting.");
    }
  }

  function processMeetingCard(m: DbMeeting, isCancelled = false): CategorizedCard | null {
    if (!m.scheduled_time) return null;
    const meetingStartMs = new Date(m.scheduled_time).getTime();
    if (isNaN(meetingStartMs)) return null;

    if (!isCancelled) {
      // Elapsed post start
      const elapsedPostStart = nowMs - meetingStartMs;
      // Auto-expire 10 mins post-start for active bookings
      if (elapsedPostStart > 10 * 60 * 1000) return null;
    }

    const now = new Date(nowMs);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const endOfTomorrow = endOfToday + 24 * 60 * 60 * 1000;

    const isLive = nowMs >= meetingStartMs && !isCancelled;
    const isToday = meetingStartMs >= startOfToday && meetingStartMs <= endOfToday && !isLive;
    const isTomorrow = meetingStartMs > endOfToday && meetingStartMs <= endOfTomorrow;
    const isUpcoming = meetingStartMs > endOfTomorrow;

    const mDate = new Date(m.scheduled_time);
    const formattedDate = mDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const formattedTime = mDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    let clientName = "";
    let clientEmail = "";
    if (m.lead_id && leads) {
      const match = leads.find((l) => l.id === m.lead_id);
      if (match) {
        clientName = match.name || "";
        clientEmail = match.email || "";
      }
    }

    if (!clientEmail && m.title) {
      const emailMatch = m.title.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) clientEmail = emailMatch[0].trim();
    }

    const rawTitleWithoutNow = m.title ? m.title.split("|| NOW_SENT")[0].trim() : "";
    const cleanTitle = rawTitleWithoutNow ? (rawTitleWithoutNow.split("|| ZOOM:")[0] || "").replace(/^\[CANCELLED\]\s*/i, "").trim() : "";

    if (!clientName && cleanTitle) {
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

    let zoomLink = "https://zoom.us/j/5539578967";
    if (rawTitleWithoutNow.includes("|| ZOOM:")) {
      zoomLink = rawTitleWithoutNow.split("|| ZOOM:")[1]?.trim() || zoomLink;
    }

    return {
      id: m.id,
      meeting: m,
      scheduledTimeMs: meetingStartMs,
      isLive,
      isToday,
      isTomorrow,
      isUpcoming,
      formattedDate,
      formattedTime,
      clientName: clientName || "Valued Client",
      clientEmail,
      zoomLink,
      agentEmail: m.agent_email || "garryamelia6265@gmail.com",
      isCancelled,
    };
  }

  const processedCards: CategorizedCard[] = [];
  for (const m of meetings) {
    const card = processMeetingCard(m, false);
    if (card) processedCards.push(card);
  }

  const cancelledCards: CategorizedCard[] = [];
  for (const m of cancelledMeetings) {
    const card = processMeetingCard(m, true);
    if (card) cancelledCards.push(card);
  }

  // "All" box must be sorted chronologically by soonest meeting first (ascending remaining time)
  const allCards = [...processedCards].sort((a, b) => a.scheduledTimeMs - b.scheduledTimeMs);
  const todayCards = allCards.filter((c) => c.isToday || c.isLive);
  const tomorrowCards = allCards.filter((c) => c.isTomorrow);
  const upcomingCards = allCards.filter((c) => c.isUpcoming);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Booking Notifications"
        subtitle="Real-time meeting alerts categorized by Today, Tomorrow, Upcoming schedule, and Cancellations."
        action={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {loading ? "Syncing..." : `Live · ${lastSync.toLocaleTimeString()}`}
            </span>
            <Button onClick={fetchNotifications} variant="outline" size="sm" className="rounded-xl gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/dashboard">
                <CalendarCheck className="size-4" /> View Dashboard
              </Link>
            </Button>
          </div>
        }
      />

      {/* Metric summary — 5 Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div onClick={() => setActiveTab("all")} className="cursor-pointer rounded-2xl ring-2 ring-transparent hover:ring-primary/40 transition-all">
          <StatCard label="All Notifications" value={allCards.length} icon={Bell} tone="primary" hint="total active" />
        </div>
        <div onClick={() => setActiveTab("today")} className="cursor-pointer rounded-2xl ring-2 ring-transparent hover:ring-warning/40 transition-all">
          <StatCard label="Today" value={todayCards.length} icon={Clock} tone="warning" hint="happening today" />
        </div>
        <div onClick={() => setActiveTab("tomorrow")} className="cursor-pointer rounded-2xl ring-2 ring-transparent hover:ring-info/40 transition-all">
          <StatCard label="Tomorrow" value={tomorrowCards.length} icon={Calendar} tone="info" hint="scheduled tomorrow" />
        </div>
        <div onClick={() => setActiveTab("upcoming")} className="cursor-pointer rounded-2xl ring-2 ring-transparent hover:ring-success/40 transition-all">
          <StatCard label="Upcoming" value={upcomingCards.length} icon={CalendarCheck} tone="success" hint="beyond tomorrow" />
        </div>
        <div onClick={() => setActiveTab("cancelled")} className="cursor-pointer rounded-2xl ring-2 ring-transparent hover:ring-destructive/40 transition-all">
          <StatCard label="Cancelled" value={cancelledCards.length} icon={XCircle} tone="destructive" hint="cancelled meetings" />
        </div>
      </div>


      {/* Categorized Tabs & Boxes */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="rounded-xl p-1 bg-slate-900/60 border border-border flex flex-wrap">
          <TabsTrigger value="all" className="rounded-lg gap-2">
            All Notifications
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[11px]">
              {allCards.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="today" className="rounded-lg gap-2">
            Today
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[11px]">
              {todayCards.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="tomorrow" className="rounded-lg gap-2">
            Tomorrow
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[11px]">
              {tomorrowCards.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="rounded-lg gap-2">
            Upcoming
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[11px]">
              {upcomingCards.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="rounded-lg gap-2">
            Cancelled
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[11px] text-rose-300 bg-rose-500/20 border border-rose-500/30">
              {cancelledCards.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: All Notifications (Sorted Chronologically: Soonest First) */}
        <TabsContent value="all" className="space-y-3">
          <NotificationSectionList
            title="All Booking Notifications (Soonest First)"
            cards={allCards}
            nowMs={nowMs}
            onCancel={handleCancelMeeting}
            emptyMessage="No active meeting notifications found."
          />
        </TabsContent>

        {/* Tab 2: Today */}
        <TabsContent value="today" className="space-y-3">
          <NotificationSectionList
            title="Today's Meetings"
            cards={todayCards}
            nowMs={nowMs}
            onCancel={handleCancelMeeting}
            emptyMessage="No meetings scheduled for today."
          />
        </TabsContent>

        {/* Tab 3: Tomorrow */}
        <TabsContent value="tomorrow" className="space-y-3">
          <NotificationSectionList
            title="Tomorrow's Meetings"
            cards={tomorrowCards}
            nowMs={nowMs}
            onCancel={handleCancelMeeting}
            emptyMessage="No meetings scheduled for tomorrow."
          />
        </TabsContent>

        {/* Tab 4: Upcoming (Grouped Beyond Tomorrow) */}
        <TabsContent value="upcoming" className="space-y-3">
          <NotificationSectionList
            title="Upcoming Future Meetings (Beyond Tomorrow)"
            cards={upcomingCards}
            nowMs={nowMs}
            onCancel={handleCancelMeeting}
            emptyMessage="No future meetings scheduled beyond tomorrow."
          />
        </TabsContent>

        {/* Tab 5: Cancelled Tab */}
        <TabsContent value="cancelled" className="space-y-3">
          {cancelledCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-slate-950/40 p-12 text-center text-muted-foreground">
              <XCircle className="size-8 opacity-30 text-muted-foreground" />
              <p className="text-sm">No cancelled meetings found.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {cancelledCards.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 shadow-lg backdrop-blur-md transition-all"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900/90 border border-rose-500/30 text-rose-400">
                      <XCircle className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white tracking-tight">{c.clientName}</span>
                        {c.clientEmail && <span className="text-xs text-slate-400">({c.clientEmail})</span>}
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border bg-rose-500/20 text-rose-300 border-rose-500/40">
                          🚫 Meeting Cancelled
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-400">
                          <Calendar className="size-3.5 text-rose-400" /> Was scheduled: {c.formattedDate} @ {c.formattedTime}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <User className="size-3.5 text-slate-400" /> Agent: {c.agentEmail}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Badge variant="outline" className="rounded-xl border-rose-500/40 text-rose-400 bg-rose-500/10 text-xs px-3 py-1 font-medium">
                      Cancelled
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationSectionList({
  title,
  cards,
  nowMs,
  onCancel,
  emptyMessage,
}: {
  title: string;
  cards: any[];
  nowMs: number;
  onCancel: (id: string) => void;
  emptyMessage: string;
}) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-slate-950/40 p-12 text-center text-muted-foreground">
        <Bell className="size-8 opacity-30 text-muted-foreground" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className="text-xs text-muted-foreground">{cards.length} meetings</span>
      </div>

      <div className="grid gap-3">
        {cards.map((c) => {
          const countdown = formatCountdown(c.scheduledTimeMs, nowMs);

          let borderTheme = "border-sky-500/30 bg-sky-950/20";
          let badgeTheme = "bg-sky-500/20 text-sky-300 border-sky-500/40";
          let categoryLabel = "Upcoming";

          if (c.isLive) {
            borderTheme = "border-red-500/50 bg-red-950/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]";
            badgeTheme = "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse font-bold";
            categoryLabel = "🔴 LIVE NOW";
          } else if (c.isToday) {
            borderTheme = "border-amber-500/40 bg-amber-950/20";
            badgeTheme = "bg-amber-500/20 text-amber-300 border-amber-500/40";
            categoryLabel = "Today";
          } else if (c.isTomorrow) {
            borderTheme = "border-blue-500/40 bg-blue-950/20";
            badgeTheme = "bg-blue-500/20 text-blue-300 border-blue-500/40";
            categoryLabel = "Tomorrow";
          }

          return (
            <div
              key={c.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all ${borderTheme}`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900/90 border border-white/10 text-primary">
                  <Video className="size-5" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white tracking-tight">{c.clientName}</span>
                    {c.clientEmail && <span className="text-xs text-slate-400">({c.clientEmail})</span>}
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border ${badgeTheme}`}>
                      {categoryLabel}
                    </span>
                    <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ⏱ {countdown}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Calendar className="size-3.5 text-primary" /> {c.formattedDate} @ {c.formattedTime}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <User className="size-3.5 text-slate-400" /> Agent: {c.agentEmail}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <a
                  href={c.zoomLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-95"
                >
                  <Video className="size-3.5" /> Join Zoom
                </a>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(c.id)}
                  className="rounded-xl text-xs font-semibold border-rose-500/40 text-rose-400 hover:bg-rose-500/10 gap-1"
                >
                  <XCircle className="size-3.5" /> Cancel
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
