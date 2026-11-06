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
  Copy,
  Check,
  PhoneCall,
  CalendarX2,
  Lock,
  UserCheck,
  Shield,
  Globe,
  AlertCircle,
  ArrowRightLeft,
} from "lucide-react";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { PageHeader } from "@/components/crm/Topbar";
import { StatCard } from "@/components/crm/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";
import { cancelMeetingBookingFn, claimMeetingBookingFn, transferMeetingBookingFn } from "@/lib/server-actions";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications of Bookings — Teals CRM" },
      {
        name: "description",
        content: "Track upcoming demos, live Zoom meetings, and schedule adjustments in real time.",
      },
    ],
  }),
  component: NotificationsOfBookingsPage,
});

const BOOKINGS_VIEWED_KEY = "teals_bookings_last_viewed_at";

type DbMeeting = {
  id: string;
  title: string;
  scheduled_time: string;
  completed: boolean;
  lead_id?: string;
  agent_email?: string;
  created_at?: string;
};

type DbLead = {
  id: string;
  name: string;
  email: string;
  company?: string;
  assigned_agent_name?: string;
};

type CategorizedMeetingCard = {
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
  isClaimed: boolean;
  isClaimedByMe: boolean;
  isMissed?: boolean;
  websiteBadge?: string;
};

function formatCountdown(targetMs: number, nowMs: number, isMissed = false) {
  if (isMissed) {
    const elapsedMins = Math.floor((nowMs - targetMs) / (60 * 1000));
    if (elapsedMins >= 60) {
      const hours = Math.floor(elapsedMins / 60);
      return `Ended ${hours}h ago`;
    }
    return `Ended ${Math.max(elapsedMins, 20)}m ago`;
  }

  const diffMs = targetMs - nowMs;
  if (diffMs <= 0 && diffMs >= -20 * 60 * 1000) {
    return "🔴 Live Right Now";
  }
  if (diffMs < -20 * 60 * 1000) {
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

function NotificationsOfBookingsPage() {
  const { user } = useCrm();
  const userEmail = (user?.email || "").trim().toLowerCase();
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));
  const userDept = (user?.department_id || (user as any)?.department || "").toLowerCase().trim();
  const isSalesDept = userDept === "sales-department" || userDept === "sales" || userDept.includes("sales");
  const userRole = (user?.role || "").toLowerCase().trim();
  const userRoleTitle = ((user as any)?.role_title || (user as any)?.designation || "").toLowerCase().trim();
  const isSalesLeader = 
    userRole === "manager" || 
    userRole === "team_lead" || 
    userRole === "team_leader" || 
    Boolean((user as any)?.is_department_manager) ||
    userRoleTitle.includes("manager") ||
    userRoleTitle.includes("lead") ||
    userRoleTitle.includes("head");
  const canAccessSalesBookings = isAdmin || isSalesDept;

  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [meetingCards, setMeetingCards] = useState<CategorizedMeetingCard[]>([]);
  const [missedCards, setMissedCards] = useState<CategorizedMeetingCard[]>([]);
  const [cancelledCards, setCancelledCards] = useState<CategorizedMeetingCard[]>([]);

  // Transfer Meeting Modal State
  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    card: CategorizedMeetingCard | null;
    selectedAgentEmail: string;
    selectedAgentName: string;
    submitting: boolean;
  }>({
    open: false,
    card: null,
    selectedAgentEmail: "",
    selectedAgentName: "",
    submitting: false,
  });
  const [salesTeam, setSalesTeam] = useState<Array<{ email: string; name: string; designation?: string }>>([]);

  const fetchSalesAgents = useCallback(async () => {
    try {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const agents: Array<{ email: string; name: string; designation?: string }> = [];
      (profiles || []).forEach((p: any) => {
        let isApproved = true;
        let deptId = p.department_id || "";
        let desig = "";
        if (p.avatar_url) {
          try {
            const meta = JSON.parse(p.avatar_url);
            if (typeof meta.approved === "boolean") isApproved = meta.approved;
            if (meta.department_id) deptId = meta.department_id;
            if (meta.designation) desig = meta.designation;
          } catch {}
        }
        const isSales = deptId === "sales-department" || deptId === "sales" || deptId.includes("sales") || !deptId;
        if (isApproved && isSales && p.email) {
          agents.push({
            email: p.email,
            name: p.full_name || p.email.split("@")[0],
            designation: desig || "Sales Specialist",
          });
        }
      });
      const knownSales = [
        { email: "abdulrafay40023@gmail.com", name: "Abdul Rafay", designation: "Sales Agent" },
        { email: "annusraees@gmail.com", name: "Annus Raees", designation: "Sales Agent" },
        { email: "tzafar04@gmail.com", name: "Talha Zafar", designation: "Sales Lead" },
        { email: "garryamelia6265@gmail.com", name: "Garry Amelia", designation: "Sales Manager / Admin" },
      ];
      knownSales.forEach(k => {
        if (!agents.some(a => a.email.toLowerCase() === k.email.toLowerCase())) {
          agents.push(k);
        }
      });
      setSalesTeam(agents);
    } catch {}
  }, []);

  const handleExecuteTransfer = async () => {
    if (!transferModal.card || !transferModal.selectedAgentEmail) {
      toast.error("Please select a sales agent to transfer to.");
      return;
    }
    setTransferModal(prev => ({ ...prev, submitting: true }));
    try {
      await transferMeetingBookingFn({
        data: {
          meetingId: transferModal.card.id,
          targetAgentEmail: transferModal.selectedAgentEmail,
          targetAgentName: transferModal.selectedAgentName || transferModal.selectedAgentEmail.split("@")[0],
          transferredByEmail: userEmail || "admin@teals.co",
          transferredByName: user?.name || user?.full_name || userEmail.split("@")[0],
        }
      });

      toast.success(`🎉 Meeting successfully transferred to ${transferModal.selectedAgentName}! Confirmation emails sent.`);
      setTransferModal({ open: false, card: null, selectedAgentEmail: "", selectedAgentName: "", submitting: false });
      fetchBookings();

      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("teals-crm-bookings-sync");
        bc.postMessage({ type: "meeting_transferred", meetingId: transferModal.card.id });
        bc.close();
      }
    } catch (err: any) {
      toast.error(`Transfer failed: ${err.message || "Unknown error"}`);
      setTransferModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // Mark bookings as seen on visit
  useEffect(() => {
    try {
      localStorage.setItem(BOOKINGS_VIEWED_KEY, String(Date.now()));
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("teals-crm-bookings-sync");
        bc.postMessage({ type: "bookings_seen", timestamp: Date.now() });
        bc.close();
      }
    } catch {}
  }, []);

  // Live countdown ticker
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 2500);
    return () => clearInterval(ticker);
  }, []);

  const processMeeting = useCallback(
    (m: DbMeeting, leadsMap: Map<string, DbLead>, isCancelled = false): CategorizedMeetingCard | null => {
      if (!m.scheduled_time) return null;
      const meetingStartMs = new Date(m.scheduled_time).getTime();
      if (isNaN(meetingStartMs)) return null;

      const now = new Date(nowMs);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      const endOfTomorrow = endOfToday + 24 * 60 * 60 * 1000;

      const elapsedPostStart = nowMs - meetingStartMs;

      // Missed meeting: if scheduled time has passed by > 20 mins, OR title has [MISSED], OR meeting was completed in the past
      const isMissed = !isCancelled && (
        (m.title && m.title.includes("[MISSED]")) ||
        (m.completed && elapsedPostStart > 0) ||
        (elapsedPostStart > 20 * 60 * 1000)
      );

      const isLive = !isCancelled && !isMissed && nowMs >= meetingStartMs && elapsedPostStart <= 20 * 60 * 1000;
      const isToday = !isCancelled && !isMissed && !isLive && meetingStartMs >= startOfToday && meetingStartMs <= endOfToday;
      const isTomorrow = !isCancelled && !isMissed && meetingStartMs > endOfTomorrow && meetingStartMs <= endOfTomorrow + 24 * 60 * 60 * 1000;
      const isUpcoming = !isCancelled && !isMissed && meetingStartMs > endOfTomorrow;

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
      if (m.lead_id && leadsMap.has(m.lead_id)) {
        const l = leadsMap.get(m.lead_id)!;
        clientName = l.name || "";
        clientEmail = l.email || "";
      }

      if (!clientEmail && m.title) {
        const emailMatch = m.title.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) clientEmail = emailMatch[0].trim();
      }

      const rawTitleWithoutNow = m.title ? m.title.split("|| NOW_SENT")[0].trim() : "";
      const cleanTitle = rawTitleWithoutNow
        ? (rawTitleWithoutNow.split("|| ZOOM:")[0] || "").replace(/^\[CANCELLED\]\s*/i, "").replace(/^\[MISSED\]\s*/i, "").trim()
        : "";

      if (!clientName && cleanTitle) {
        const withMatch = cleanTitle.match(/(?:Sales Meeting with|1-on-1 Strategy Session with|Strategy Session with)\s+([^(]+?)(?:\s*\([^)]*\))?(?:\s+on\s+|\s+-\s+|$)/i);
        if (withMatch && withMatch[1]) {
          clientName = withMatch[1].trim();
        } else if (cleanTitle.toLowerCase().includes("with ")) {
          const afterWith = cleanTitle.split(/with /i)[1]?.split(" on ")[0]?.split(" - ")[0]?.trim() || "";
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

      const cleanAgent = (m.agent_email || "").trim().toLowerCase();
      const isClaimed = Boolean(
        cleanAgent &&
        cleanAgent !== "agent@teals.co" &&
        cleanAgent !== "unassigned" &&
        !cleanAgent.includes("unclaimed")
      );
      const isClaimedByMe = isClaimed && cleanAgent === userEmail;

      let websiteBadge = "";
      if (m.title && m.title.includes("[")) {
        const match = m.title.match(/\[(.*?)\]/);
        if (match && match[1]) {
          websiteBadge = match[1].split("||")[0]?.trim() || match[1].trim();
        }
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
        agentEmail: isClaimed ? (m.agent_email || "") : "Unclaimed",
        isCancelled,
        isClaimed,
        isClaimedByMe,
        isMissed,
        websiteBadge,
      };
    },
    [nowMs, userEmail]
  );

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const [meetingsRes, leadsRes, cancelledRes, completedRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("id, title, scheduled_time, completed, lead_id, agent_email, created_at")
          .eq("completed", false)
          .order("scheduled_time", { ascending: true }),
        supabase.from("leads").select("id, name, email, company, assigned_agent_name"),
        supabase
          .from("meetings")
          .select("id, title, scheduled_time, completed, lead_id, agent_email, created_at")
          .like("title", "%[CANCELLED]%")
          .order("scheduled_time", { ascending: false })
          .limit(30),
        supabase
          .from("meetings")
          .select("id, title, scheduled_time, completed, lead_id, agent_email, created_at")
          .eq("completed", true)
          .not("title", "like", "%[CANCELLED]%")
          .order("scheduled_time", { ascending: false })
          .limit(60),
      ]);

      const leadsMap = new Map<string, DbLead>();
      (leadsRes.data || []).forEach((l: any) => leadsMap.set(l.id, l));

      const myAssignedWebsites = (user?.assigned_websites || []).map((w: string) => w.toLowerCase().trim());

      const isAllowed = (m: any) => {
        if (!m || !m.scheduled_time || (m.title && m.title.includes("[CANCELLED]"))) return false;

        // Strict: Non-sales staff and non-admins CANNOT view sales bookings
        if (!canAccessSalesBookings) return false;

        // Admins, Sales Managers, and Sales Team Leaders can view ALL bookings across all websites
        if (isAdmin || isSalesLeader) return true;

        const mAgent = ((m as any).agent_email || "").trim().toLowerCase();
        // 1. Claimed by current working agent
        if (mAgent && mAgent === userEmail) return true;

        // 2. Hide if claimed by another working agent
        const isClaimedByOther = Boolean(
          mAgent &&
          mAgent !== userEmail &&
          mAgent !== "garryamelia6265@gmail.com" &&
          mAgent !== "agent@teals.co" &&
          mAgent !== "unassigned"
        );
        if (isClaimedByOther) return false;

        // 3. Unclaimed / locked booking: check website permissions
        if (myAssignedWebsites.length === 0) return true;
        if (m.title) {
          const titleLower = m.title.toLowerCase();
          return myAssignedWebsites.some((siteSlug: string) => {
            const cleanSlug = siteSlug.replace(/[^a-z0-9]/g, "");
            const cleanTitle = titleLower.replace(/[^a-z0-9]/g, "");
            return cleanTitle.includes(cleanSlug);
          });
        }

        return false;
      };

      const parsedActive: CategorizedMeetingCard[] = [];
      const parsedMissed: CategorizedMeetingCard[] = [];

      (meetingsRes.data || []).forEach((m: any) => {
        if (!isAllowed(m)) return;
        const item = processMeeting(m, leadsMap, false);
        if (item) {
          if (item.isMissed) {
            parsedMissed.push(item);
          } else {
            parsedActive.push(item);
          }
        }
      });

      (completedRes.data || []).forEach((m: any) => {
        if (!isAllowed(m)) return;
        const item = processMeeting(m, leadsMap, false);
        if (item && item.isMissed) {
          parsedMissed.push(item);
        }
      });

      const parsedCancelled: CategorizedMeetingCard[] = [];
      (cancelledRes.data || []).forEach((m: any) => {
        const item = processMeeting(m, leadsMap, true);
        if (item) parsedCancelled.push(item);
      });

      setMeetingCards(parsedActive);
      setMissedCards(parsedMissed);
      setCancelledCards(parsedCancelled);
      setLastSync(new Date());
    } catch (err) {
      console.error("Bookings load error:", err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userEmail, user?.assigned_websites, processMeeting]);

  useEffect(() => {
    fetchBookings();

    const channel = supabase
      .channel(`bookings-page-sync-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => fetchBookings())
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchBookings())
      .subscribe();

    let bc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("teals-crm-bookings-sync");
        bc.onmessage = () => fetchBookings();
      }
    } catch {}

    return () => {
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [fetchBookings]);

  // Claim Meeting Action
  const handleClaimMeeting = async (card: CategorizedMeetingCard) => {
    const claimingEmail = userEmail || "garryamelia6265@gmail.com";
    const claimingName = user?.name || user?.full_name || claimingEmail.split("@")[0];

    setClaimingId(card.id);
    try {
      await claimMeetingBookingFn({
        data: {
          meetingId: card.id,
          claimingEmail,
          claimingName,
        }
      });

      toast.success(`🎉 Booking claimed! Confirmation emails sent to client & ${claimingName}.`);
      fetchBookings();

      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("teals-crm-bookings-sync");
        bc.postMessage({ type: "meeting_claimed", meetingId: card.id, agentEmail: claimingEmail });
        bc.close();
      }
    } catch (e: any) {
      toast.error(`Failed to claim booking: ${e.message || "Unknown error"}`);
    } finally {
      setClaimingId(null);
    }
  };

  // Release / Unclaim Meeting Action
  const handleUnclaimMeeting = async (card: CategorizedMeetingCard) => {
    if (!window.confirm(`Release claim on meeting with "${card.clientName}"? It will become unlocked for other agents.`)) return;

    setClaimingId(card.id);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({ agent_email: null })
        .eq("id", card.id);

      if (error) throw error;

      if (card.meeting.lead_id) {
        await supabase
          .from("leads")
          .update({ assigned_agent_name: null })
          .eq("id", card.meeting.lead_id);
      }

      toast.success("Meeting released back to locked / unclaimed state.");
      fetchBookings();

      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("teals-crm-bookings-sync");
        bc.postMessage({ type: "meeting_unclaimed", meetingId: card.id });
        bc.close();
      }
    } catch (e: any) {
      toast.error(`Failed to release claim: ${e.message || "Unknown error"}`);
    } finally {
      setClaimingId(null);
    }
  };

  // Cancel Meeting Action
  const handleCancelMeeting = async (card: CategorizedMeetingCard) => {
    if (!window.confirm(`Are you sure you want to cancel the meeting with "${card.clientName}"?`)) return;

    setCancellingId(card.id);
    try {
      const res = await cancelMeetingBookingFn({ data: { meetingId: card.id, cancelledBy: "agent" } });
      if (res?.success) {
        toast.success(`Meeting with ${card.clientName} was cancelled successfully.`);
        fetchBookings();
      } else {
        toast.error("Failed to cancel meeting.");
      }
    } catch {
      toast.error("An error occurred while cancelling.");
    } finally {
      setCancellingId(null);
    }
  };

  const copyZoom = (cardId: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(cardId);
    toast.success("Zoom link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter cards by category
  const lockedCards = useMemo(() => meetingCards.filter((c) => !c.isClaimed && !c.isMissed), [meetingCards]);
  const claimedCards = useMemo(() => meetingCards.filter((c) => c.isClaimed && !c.isMissed), [meetingCards]);
  const todayCards = useMemo(() => meetingCards.filter((c) => (c.isLive || c.isToday) && !c.isMissed), [meetingCards]);
  const tomorrowCards = useMemo(() => meetingCards.filter((c) => c.isTomorrow && !c.isMissed), [meetingCards]);
  const upcomingCards = useMemo(() => meetingCards.filter((c) => c.isUpcoming && !c.isMissed), [meetingCards]);

  const displayedCards = useMemo(() => {
    if (activeTab === "locked") return lockedCards;
    if (activeTab === "claimed") return claimedCards;
    if (activeTab === "missed") return missedCards;
    if (activeTab === "today") return todayCards;
    if (activeTab === "tomorrow") return tomorrowCards;
    if (activeTab === "upcoming") return upcomingCards;
    if (activeTab === "cancelled") return cancelledCards;
    return meetingCards;
  }, [activeTab, meetingCards, lockedCards, claimedCards, missedCards, todayCards, tomorrowCards, upcomingCards, cancelledCards]);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Notifications of Bookings"
        subtitle="Track upcoming demos, live Zoom meetings, and schedule adjustments in real time."
        action={
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/40 px-3 py-1.5 rounded-xl border border-border font-mono">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {loading ? "Syncing..." : `Live · ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </span>

            <Button
              onClick={fetchBookings}
              variant="outline"
              size="sm"
              disabled={loading}
              className="rounded-xl gap-1.5 border-border bg-card hover:bg-accent text-foreground text-xs h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* ── METRIC STAT CARDS (All / Locked / Claimed / Missed / Today / Tomorrow / Cancelled) ── */}
      <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 overflow-x-auto no-scrollbar scrollbar-none pb-1">
        <div
          onClick={() => setActiveTab("all")}
          className={`shrink-0 min-w-[130px] sm:min-w-0 cursor-pointer rounded-2xl transition-all ${
            activeTab === "all" ? "ring-2 ring-primary shadow-md" : "hover:ring-1 hover:ring-border"
          }`}
        >
          <StatCard
            label="All Bookings"
            value={meetingCards.length}
            icon={Bell}
            tone="primary"
            hint="total active"
          />
        </div>

        <div
          onClick={() => setActiveTab("locked")}
          className={`shrink-0 min-w-[130px] sm:min-w-0 cursor-pointer rounded-2xl transition-all ${
            activeTab === "locked" ? "ring-2 ring-amber-500 shadow-md" : "hover:ring-1 hover:ring-border"
          }`}
        >
          <StatCard
            label="Locked (Unclaimed)"
            value={lockedCards.length}
            icon={Lock}
            tone="warning"
            hint="available to claim"
          />
        </div>

        <div
          onClick={() => setActiveTab("claimed")}
          className={`shrink-0 min-w-[130px] sm:min-w-0 cursor-pointer rounded-2xl transition-all ${
            activeTab === "claimed" ? "ring-2 ring-emerald-500 shadow-md" : "hover:ring-1 hover:ring-border"
          }`}
        >
          <StatCard
            label="Claimed Bookings"
            value={claimedCards.length}
            icon={UserCheck}
            tone="success"
            hint="assigned to agents"
          />
        </div>

        <div
          onClick={() => setActiveTab("missed")}
          className={`shrink-0 min-w-[130px] sm:min-w-0 cursor-pointer rounded-2xl transition-all ${
            activeTab === "missed" ? "ring-2 ring-rose-500 shadow-md" : "hover:ring-1 hover:ring-border"
          }`}
        >
          <StatCard
            label="Missed Meetings"
            value={missedCards.length}
            icon={AlertCircle}
            tone="destructive"
            hint="unattended >20m past"
          />
        </div>

        <div
          onClick={() => setActiveTab("today")}
          className={`shrink-0 min-w-[130px] sm:min-w-0 cursor-pointer rounded-2xl transition-all ${
            activeTab === "today" ? "ring-2 ring-amber-500 shadow-md" : "hover:ring-1 hover:ring-border"
          }`}
        >
          <StatCard
            label="Today"
            value={todayCards.length}
            icon={Clock}
            tone="warning"
            hint="scheduled today"
          />
        </div>

        <div
          onClick={() => setActiveTab("tomorrow")}
          className={`shrink-0 min-w-[130px] sm:min-w-0 cursor-pointer rounded-2xl transition-all ${
            activeTab === "tomorrow" ? "ring-2 ring-blue-500 shadow-md" : "hover:ring-1 hover:ring-border"
          }`}
        >
          <StatCard
            label="Tomorrow"
            value={tomorrowCards.length}
            icon={Calendar}
            tone="info"
            hint="scheduled tomorrow"
          />
        </div>

        <div
          onClick={() => setActiveTab("cancelled")}
          className={`shrink-0 min-w-[130px] sm:min-w-0 cursor-pointer rounded-2xl transition-all ${
            activeTab === "cancelled" ? "ring-2 ring-destructive shadow-md" : "hover:ring-1 hover:ring-border"
          }`}
        >
          <StatCard
            label="Cancelled"
            value={cancelledCards.length}
            icon={XCircle}
            tone="destructive"
            hint="cancelled bookings"
          />
        </div>
      </div>

      {/* ── TABS NAVIGATION ──────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto rounded-2xl p-1 bg-card border border-border flex items-center justify-start gap-1 overflow-x-auto no-scrollbar scrollbar-none w-full max-w-full">
          <TabsTrigger
            value="all"
            className="shrink-0 whitespace-nowrap rounded-xl gap-1.5 text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-1.5 px-3"
          >
            <Bell className="size-3.5" />
            <span>All Bookings</span>
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] bg-background/50">
              {meetingCards.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="locked"
            className="shrink-0 whitespace-nowrap rounded-xl gap-1.5 text-xs font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white py-1.5 px-3"
          >
            <Lock className="size-3.5 text-amber-400" />
            <span>Locked (Unclaimed)</span>
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] bg-background/50 font-bold">
              {lockedCards.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="claimed"
            className="shrink-0 whitespace-nowrap rounded-xl gap-1.5 text-xs font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white py-1.5 px-3"
          >
            <UserCheck className="size-3.5 text-emerald-400" />
            <span>Claimed Bookings</span>
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] bg-background/50">
              {claimedCards.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="missed"
            className="shrink-0 whitespace-nowrap rounded-xl gap-1.5 text-xs font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white py-1.5 px-3"
          >
            <AlertCircle className="size-3.5 text-rose-300" />
            <span>Missed Meetings</span>
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] bg-background/50 font-bold text-rose-300">
              {missedCards.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="today"
            className="shrink-0 whitespace-nowrap rounded-xl gap-1.5 text-xs font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white py-1.5 px-3"
          >
            <Clock className="size-3.5 text-amber-400" />
            <span>Today</span>
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] bg-background/50">
              {todayCards.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="tomorrow"
            className="shrink-0 whitespace-nowrap rounded-xl gap-1.5 text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white py-1.5 px-3"
          >
            <Calendar className="size-3.5 text-blue-400" />
            <span>Tomorrow</span>
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] bg-background/50">
              {tomorrowCards.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="upcoming"
            className="shrink-0 whitespace-nowrap rounded-xl gap-1.5 text-xs font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white py-1.5 px-3"
          >
            <Sparkles className="size-3.5 text-emerald-400" />
            <span>Upcoming</span>
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] bg-background/50">
              {upcomingCards.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="cancelled"
            className="shrink-0 whitespace-nowrap rounded-xl gap-1.5 text-xs font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white py-1.5 px-3"
          >
            <CalendarX2 className="size-3.5 text-rose-300" />
            <span>Cancelled</span>
            <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px] bg-background/50">
              {cancelledCards.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── CARDS LIST ───────────────────────────────────────────────────── */}
        <TabsContent value={activeTab} className="space-y-3 pt-1">
          {displayedCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-border bg-card/40 space-y-3 max-w-md mx-auto my-8">
              <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center text-primary">
                <CalendarCheck className="size-8" />
              </div>
              <h3 className="text-base font-bold text-foreground">No Meetings in this category</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                {activeTab === "locked"
                  ? "No locked / unclaimed bookings at the moment. All bookings are claimed!"
                  : activeTab === "claimed"
                  ? "No claimed bookings found."
                  : activeTab === "missed"
                  ? "No missed meetings! All scheduled meetings were attended or are upcoming."
                  : activeTab === "cancelled"
                  ? "No cancelled demo bookings found."
                  : activeTab === "today"
                  ? "No demo meetings scheduled for today."
                  : activeTab === "tomorrow"
                  ? "No demo meetings scheduled for tomorrow."
                  : "Any new demo or meeting bookings will appear here automatically with live Zoom access."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {displayedCards.map((card) => {
                const countdown = formatCountdown(card.scheduledTimeMs, nowMs, card.isMissed);
                const isLive = countdown.includes("Live");
                const isCancelled = card.isCancelled;

                return (
                  <div
                    key={card.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3.5 ${
                      isCancelled
                        ? "bg-rose-950/10 border-rose-500/20 opacity-80"
                        : card.isMissed
                        ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70 shadow-sm"
                        : isLive
                        ? "bg-red-950/30 border-red-500/60 shadow-lg shadow-red-950/40 ring-1 ring-red-500/50"
                        : !card.isClaimed
                        ? "bg-card border-amber-500/30 hover:border-amber-500/60 shadow-sm"
                        : "bg-card border-border hover:border-primary/40 hover:shadow-md"
                    }`}
                  >
                    {/* Top Row: Countdown Badge & Meeting Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <XCircle className="size-3" /> Cancelled
                          </span>
                        ) : card.isMissed ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/25 text-rose-300 border border-rose-500/50">
                            <AlertCircle className="size-3.5 text-rose-400" />
                            <span>Missed Meeting</span>
                            <span className="text-[10px] font-normal opacity-80 font-mono">({countdown})</span>
                          </span>
                        ) : isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-500/30 text-red-300 border border-red-500/50 animate-pulse">
                            <span className="size-2 rounded-full bg-red-400 animate-ping" />
                            {countdown}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Clock className="size-3" /> {countdown}
                          </span>
                        )}

                        {!isCancelled && (
                          card.isClaimed ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              card.isMissed
                                ? "bg-zinc-800/60 text-zinc-400 border border-zinc-700/40"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}>
                              <CheckCircle2 className="size-3" /> Claimed
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              card.isMissed
                                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                            }`}>
                              <Lock className="size-3" /> {card.isMissed ? "Unclaimed (Missed)" : "Locked (Unclaimed)"}
                            </span>
                          )
                        )}

                        {card.websiteBadge && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <Globe className="size-3" /> {card.websiteBadge}
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-foreground font-mono">{card.formattedTime}</p>
                        <p className="text-[11px] text-muted-foreground">{card.formattedDate}</p>
                      </div>
                    </div>

                    {/* Client & Booking Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center text-primary font-bold text-xs shrink-0">
                          {card.clientName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-foreground truncate">{card.clientName}</h4>
                          <p className="text-xs text-muted-foreground truncate">{card.clientEmail || "Email not specified"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1.5 border-t border-border/40">
                        <div className="flex items-center gap-1.5 truncate">
                          <span>Host Agent:</span>
                          <strong className={card.isClaimed ? "text-emerald-400" : "text-amber-400"}>
                            {card.agentEmail}
                          </strong>
                        </div>

                        {card.isClaimed && (isAdmin || card.isClaimedByMe) && !isCancelled && (
                          <button
                            onClick={() => handleUnclaimMeeting(card)}
                            disabled={claimingId === card.id}
                            className="text-[11px] text-muted-foreground hover:text-amber-400 underline transition-colors"
                          >
                            Release Claim
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons: Claim, Join Zoom, Copy Link, Cancel */}
                    {!isCancelled && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border/40 w-full flex-wrap sm:flex-nowrap">
                        {!card.isClaimed && (
                          <Button
                            size="sm"
                            disabled={claimingId === card.id}
                            onClick={() => handleClaimMeeting(card)}
                            className="w-full sm:w-auto rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow-md shadow-amber-950/40"
                          >
                            {claimingId === card.id ? (
                              <RefreshCw className="size-3.5 animate-spin" />
                            ) : (
                              <Lock className="size-3.5" />
                            )}
                            <span>Claim Booking</span>
                          </Button>
                        )}

                        {(isAdmin || isSalesLeader) && !isCancelled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              fetchSalesAgents();
                              setTransferModal({
                                open: true,
                                card,
                                selectedAgentEmail: "",
                                selectedAgentName: "",
                                submitting: false,
                              });
                            }}
                            className="rounded-xl border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-bold h-9 px-3 gap-1.5 shrink-0"
                            title="Transfer meeting to any agent in Sales Department"
                          >
                            <ArrowRightLeft className="size-3.5" />
                            <span>Transfer</span>
                          </Button>
                        )}

                        <Button
                          asChild
                          size="sm"
                          className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold h-9 gap-1.5"
                        >
                          <a href={card.zoomLink} target="_blank" rel="noopener noreferrer">
                            <Video className="size-3.5" />
                            <span className="truncate">Join Zoom Meeting</span>
                            <ExternalLink className="size-3 opacity-70 shrink-0" />
                          </a>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyZoom(card.id, card.zoomLink)}
                          className="rounded-xl border-border bg-background hover:bg-accent text-xs h-9 px-2.5 sm:px-3 gap-1 shrink-0"
                          title="Copy Zoom link"
                        >
                          {copiedId === card.id ? (
                            <>
                              <Check className="size-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3.5" />
                              <span className="hidden sm:inline">Copy Link</span>
                            </>
                          )}
                        </Button>

                        {(isAdmin || card.isClaimedByMe) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={cancellingId === card.id}
                            onClick={() => handleCancelMeeting(card)}
                            className="rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-9 px-2.5 shrink-0"
                            title="Cancel meeting booking"
                          >
                            {cancellingId === card.id ? (
                              <RefreshCw className="size-3.5 animate-spin" />
                            ) : (
                              <XCircle className="size-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Transfer Meeting Booking Dialog */}
      <Dialog
        open={transferModal.open}
        onOpenChange={(open) => !open && setTransferModal((prev) => ({ ...prev, open: false }))}
      >
        <DialogContent className="sm:max-w-[460px] bg-[#0f172a] border border-slate-800 text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
              <span>Transfer Consultation Meeting</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Reassign this consultation to an agent in the Sales Department. Updated emails with the Zoom link and scheduled countdown will be dispatched to both client & the new agent.
            </DialogDescription>
          </DialogHeader>

          {transferModal.card && (
            <div className="space-y-3 my-2">
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Client:</span>
                  <span className="font-semibold text-white">{transferModal.card.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Client Email:</span>
                  <span className="text-slate-300 font-mono">{transferModal.card.clientEmail || "Not specified"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Scheduled Time:</span>
                  <span className="text-indigo-400 font-semibold">
                    {transferModal.card.formattedDate} at {transferModal.card.formattedTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Assignee:</span>
                  <span className="text-amber-400 font-medium">{transferModal.card.agentEmail}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Sales Agent to Assign <span className="text-rose-400">*</span>
                </label>
                <select
                  value={transferModal.selectedAgentEmail}
                  onChange={(e) => {
                    const email = e.target.value;
                    const agent = salesTeam.find((a) => a.email.toLowerCase() === email.toLowerCase());
                    setTransferModal((prev) => ({
                      ...prev,
                      selectedAgentEmail: email,
                      selectedAgentName: agent?.name || email.split("@")[0],
                    }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Sales Agent --</option>
                  {salesTeam.map((a) => (
                    <option key={a.email} value={a.email} className="bg-slate-900 text-white">
                      {a.name} ({a.email}) {a.designation ? `— ${a.designation}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Sales department agents can receive transfers regardless of their assigned website.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTransferModal((prev) => ({ ...prev, open: false }))}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!transferModal.selectedAgentEmail || transferModal.submitting}
              onClick={handleExecuteTransfer}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md"
            >
              {transferModal.submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Transferring...</span>
                </>
              ) : (
                <span>Confirm Transfer</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
