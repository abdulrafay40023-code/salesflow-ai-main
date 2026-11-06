import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, CheckCheck, LogOut, Mail, UserPlus, Zap, Volume2, VolumeX, Laptop, FolderKanban, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { playTestSound, playArrivalChime, ensureAudioRunning } from "@/lib/livechat-audio";
import { triggerDirectAppInstall } from "@/lib/install-helper";
import { InstallAppDialog } from "@/components/crm/InstallAppDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isAdminEmail } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import { Department, fetchAllDepartments, getUserAccessInfo, UserAccessInfo } from "@/lib/project-management-store";

type Notif = {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: "lead" | "email" | "auto" | "approval" | "project";
  link?: string;
};

function NotifIcon({ type }: { type: Notif["icon"] }) {
  if (type === "lead")  return <UserPlus className="h-4 w-4 text-blue-500" />;
  if (type === "email") return <Mail className="h-4 w-4 text-purple-500" />;
  if (type === "approval") return <Bell className="h-4 w-4 text-amber-400" />;
  if (type === "project") return <FolderKanban className="h-4 w-4 text-violet-400" />;
  return <Zap className="h-4 w-4 text-yellow-500" />;
}

const NOTIF_STORAGE_KEY = "teals_read_notifs";
const NOTIF_TIME_KEY = "teals_notifs_last_viewed_at";

function getStoredReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(NOTIF_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

function getLastViewedTime(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = window.localStorage.getItem(NOTIF_TIME_KEY);
    if (!raw) {
      const now = Date.now();
      window.localStorage.setItem(NOTIF_TIME_KEY, String(now));
      return now;
    }
    return Number(raw) || Date.now();
  } catch {
    return Date.now();
  }
}

function saveLastViewedTime() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTIF_TIME_KEY, String(Date.now()));
  } catch {}
}

function useNotifications(access: UserAccessInfo, userEmail = "", userName = "") {
  const [notifs, setNotifs] = useState<Notif[]>([]);

  async function fetchNotifs() {
    try {
      const readSet = getStoredReadIds();
      const lastViewed = getLastViewedTime();
      const cleanEmail = userEmail.toLowerCase().trim();
      const isAdmin = access.isAdmin;
      const isSales = access.isAdmin || access.isSalesAgent || (access.isManager && (access.departmentId === "sales-department" || !access.departmentId));
      const newNotifs: Notif[] = [];

      // 1. Pending Approvals & Newly Approved Agents (Admin Only)
      if (isAdmin) {
        try {
          const { fetchPendingSignups } = await import("@/lib/pending-signups");
          const pending = await fetchPendingSignups();
          (pending ?? []).forEach((req: any) => {
            const nid = `approval-${req.id || req.email}`;
            const reqName = req.name || req.email?.split("@")[0] || "Unknown";
            const reqTime = req.created_at || req.sent_at || new Date().toISOString();
            const isRead = readSet.has(nid) || new Date(reqTime).getTime() <= lastViewed;
            const deptLabel = req.department_id === "ecommerce-department" ? "E-commerce" : req.department_id === "sales-department" ? "Sales" : "Production House";
            newNotifs.push({
              id: nid,
              title: "New Access Request 🟡",
              body: `${reqName} requested access for ${deptLabel}`,
              time: new Date(reqTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              rawTime: reqTime,
              read: isRead,
              icon: "approval",
              link: "/admin",
            });
          });
        } catch {}

        // Newly approved working agents log
        try {
          const { data: approvedLogs } = await supabase
            .from("emails_sent")
            .select("id, lead_email, subject, sent_at")
            .eq("sequence_type", "agent_approved")
            .order("sent_at", { ascending: false })
            .limit(10);

          (approvedLogs ?? []).forEach((e: any) => {
            const nid = `agent-approved-${e.id}`;
            const isRead = readSet.has(nid) || new Date(e.sent_at).getTime() <= lastViewed;
            newNotifs.push({
              id: nid,
              title: "New Working Agent Added ✅",
              body: e.subject || `${e.lead_email} joined CRM`,
              time: new Date(e.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              rawTime: e.sent_at,
              read: isRead,
              icon: "approval",
              link: "/admin",
            });
          });
        } catch {}
      }

      // 2. Project Management Updates (Strictly Filtered by Department & Mentions)
      if (cleanEmail) {
        try {
          const { fetchAllDepartments, fetchAllProjects, getUserAssignedDepartments, isUserMentionedInProject, isUserMentionedInComment } = await import("@/lib/project-management-store");
          const [depts, projs] = await Promise.all([fetchAllDepartments(), fetchAllProjects()]);
          const userAssignedDepts = getUserAssignedDepartments(cleanEmail, depts);
          const myDeptIds = userAssignedDepts.map((d) => d.id);
          const managerDept = depts.find((d) => d.manager_email && d.manager_email.toLowerCase().trim() === cleanEmail);
          const isManager = Boolean(managerDept);

          projs.forEach((p) => {
            const isCreator = (p.created_by_email || "").toLowerCase().trim() === cleanEmail;
            const isClaimedByMe = (p.claimed_by_email || "").toLowerCase().trim() === cleanEmail;
            const isMentionedInProj = isUserMentionedInProject(p, cleanEmail, userName);
            const matchesMyDept = myDeptIds.includes(p.target_department_id) || (access.departmentId && access.departmentId === p.target_department_id);
            const isDeptManager = managerDept && managerDept.id === p.target_department_id;

            if (!isAdmin && !matchesMyDept && !isCreator && !isClaimedByMe && !isMentionedInProj && !isDeptManager) {
              return;
            }

            // A. Revision / Redo Requested Notification (High priority for assigned agent, manager, and admin!)
            if (Array.isArray(p.revision_history) && p.revision_history.length > 0) {
              const latestRev = p.revision_history[p.revision_history.length - 1];
              if (latestRev) {
                const nid = `proj-redo-${p.id}-${latestRev.revision_id || latestRev.requested_at}`;
                const isRead = readSet.has(nid);
                newNotifs.push({
                  id: nid,
                  title: `Revision / Redo Requested 🔄`,
                  body: `${latestRev.requested_by_name} requested redo on "${p.title}": "${latestRev.issues_and_changes.slice(0, 50)}"`,
                  time: new Date(latestRev.requested_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  rawTime: latestRev.requested_at,
                  read: isRead,
                  icon: "project",
                  link: "/projects",
                });
              }
            }

            // B. Comments & Direct @Mentions
            const comments = Array.isArray(p.comments) ? p.comments : [];
            comments.slice(-3).forEach((c) => {
              if (!c) return;
              const authorEmail = (c.author_email || "").toLowerCase().trim();
              if (authorEmail === cleanEmail) return; // Don't notify myself about my own comments

              const isTaggingMe = isUserMentionedInComment(c, cleanEmail, userName);
              // Only notify if tagging me, or if I am assigned to the project / manager / admin
              if (isTaggingMe || isClaimedByMe || isCreator || isDeptManager || isAdmin) {
                const nid = `proj-c-${p.id}-${c.id}`;
                const isRead = readSet.has(nid);
                newNotifs.push({
                  id: nid,
                  title: isTaggingMe ? `🎯 Tagged You in ${p.title}` : `Comment on ${p.title} 💬`,
                  body: `${c.author_name}: "${c.content.slice(0, 50)}"`,
                  time: new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  rawTime: c.created_at,
                  read: isRead,
                  icon: "project",
                  link: "/projects",
                });
              }
            });

            // C. Project Completed & Delivered
            if (p.status === "done" && p.completed_at) {
              const compEmail = (p.completed_by_email || "").toLowerCase().trim();
              if (compEmail !== cleanEmail || isAdmin) {
                const nid = `proj-done-${p.id}-${p.completed_at}`;
                const isRead = readSet.has(nid);
                newNotifs.push({
                  id: nid,
                  title: `Project Completed & Delivered ✅`,
                  body: `"${p.title}" marked completed by ${p.completed_by_name || "Agent"}`,
                  time: new Date(p.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  rawTime: p.completed_at,
                  read: isRead,
                  icon: "project",
                  link: "/projects",
                });
              }
            }

            // D. Project Claimed (ONLY if project was organically claimed from queue, NOT when transferred/directly assigned!)
            const hasTransfers = Array.isArray(p.transfer_history) && p.transfer_history.length > 0;
            if (p.claimed_by_email && p.claimed_at && !hasTransfers) {
              const claimEmail = (p.claimed_by_email || "").toLowerCase().trim();
              if (claimEmail !== cleanEmail || isAdmin) {
                const nid = `proj-claim-${p.id}-${p.claimed_at}`;
                const isRead = readSet.has(nid);
                newNotifs.push({
                  id: nid,
                  title: `Project Claimed 🚀`,
                  body: `${p.claimed_by_name || "Agent"} is working on "${p.title}"`,
                  time: new Date(p.claimed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  rawTime: p.claimed_at,
                  read: isRead,
                  icon: "project",
                  link: "/projects",
                });
              }
            }

            // E. New Project Created
            if (p.created_at && !isCreator) {
              const nid = `proj-create-${p.id}`;
              const isRead = readSet.has(nid);
              newNotifs.push({
                id: nid,
                title: `New Project: ${p.title} 📂`,
                body: `Assigned to ${p.target_department_name} • ${p.priority.toUpperCase()} Priority`,
                time: new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                rawTime: p.created_at,
                read: isRead,
                icon: "project",
                link: "/projects",
              });
            }

            // F. Project Transferred & Direct Assignment Notifications
            if (Array.isArray(p.transfer_history) && p.transfer_history.length > 0) {
              p.transfer_history.forEach((t: any) => {
                if (!t) return;
                const toEmail = (t.to_agent_email || "").toLowerCase().trim();
                const fromEmail = (t.from_agent_email || "").toLowerCase().trim();
                const isToMe = toEmail && toEmail === cleanEmail;
                const isFromMe = fromEmail && fromEmail === cleanEmail;

                if (isToMe || (!isFromMe && (isDeptManager || isAdmin || isCreator || matchesMyDept))) {
                  const nid = `proj-transfer-${p.id}-${t.transferred_at || t.to_agent_email}`;
                  const isRead = readSet.has(nid);
                  newNotifs.push({
                    id: nid,
                    title: isToMe ? `Project Assigned / Transferred to You 🔄` : `Project Transferred / Assigned 🔄`,
                    body: isToMe
                      ? `"${p.title}" was transferred to you by ${t.from_agent_name}${t.reason ? `: "${t.reason}"` : ""}`
                      : `${t.from_agent_name} transferred "${p.title}" to ${t.to_agent_name}`,
                    time: new Date(t.transferred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    rawTime: t.transferred_at,
                    read: isRead,
                    icon: "project",
                    link: "/projects",
                  });
                }
              });
            }
          });
        } catch {}
      }

      // 3. Demo & Meeting Bookings (Only for Admins & Sales Department)
      if (isSales) {
        try {
          const { data: meetings } = await supabase
            .from("meetings")
            .select("id, title, scheduled_time, completed, lead_id, agent_email")
            .eq("completed", false)
            .order("scheduled_time", { ascending: false })
            .limit(10);

          (meetings ?? []).forEach((m: any) => {
            if (m.completed || (m.title && m.title.includes("[CANCELLED]"))) return;
            if (!isAdmin && m.agent_email && m.agent_email.toLowerCase().trim() !== cleanEmail) return;

            const nid = `meeting-${m.id}`;
            const mTime = m.scheduled_time || new Date().toISOString();
            const isRead = readSet.has(nid) || new Date(mTime).getTime() <= lastViewed;
            const timeFormatted = new Date(mTime).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

            newNotifs.push({
              id: nid,
              title: "Demo / Meeting Scheduled 📅",
              body: `${m.title || "Sales Demo Booking"} • ${timeFormatted}`,
              time: new Date(mTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              rawTime: mTime,
              read: isRead,
              icon: "lead",
              link: "/notifications",
            });
          });
        } catch {}
      }

      // 4. Customer Emails & Replies (Only for Admins & Sales Department)
      if (isSales) {
        try {
          const { data: emails } = await supabase
            .from("emails_sent")
            .select("id, subject, status, sent_at, sequence_type, lead_email")
            .order("sent_at", { ascending: false })
            .limit(10);

          (emails ?? []).forEach((e: any) => {
            if (e.sequence_type === "agent_presence" || e.sequence_type === "agent_login" || e.sequence_type === "agent_approval_request") return;
            
            if (e.sequence_type === "lead_assignment" || e.sequence_type === "assignment_notification") {
              if (e.lead_email?.toLowerCase().trim() === cleanEmail) {
                const nid = `email-assign-${e.id}`;
                const isRead = readSet.has(nid) || new Date(e.sent_at).getTime() <= lastViewed;
                newNotifs.push({
                  id: nid,
                  title: "New Leads Assigned 🎯",
                  body: e.subject || "New leads assigned to your pipeline",
                  time: new Date(e.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  rawTime: e.sent_at,
                  read: isRead,
                  icon: "lead",
                  link: "/leads",
                });
              }
              return;
            }

            if (e.status === "opened" || e.status === "replied") {
              const nid = `email-reply-${e.id}`;
              const isRead = readSet.has(nid) || new Date(e.sent_at).getTime() <= lastViewed;
              newNotifs.push({
                id: nid,
                title: e.status === "opened" ? "Email Opened / Read 👁️" : "Customer Replied 📩",
                body: e.subject || "Customer response",
                time: new Date(e.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                rawTime: e.sent_at,
                read: isRead,
                icon: "email",
                link: "/email",
              });
            }
          });
        } catch {}
      }

      // 5. Newly Assigned / Created Leads (Only for Sales & Admin, strictly in last 48 hours!)
      if (isSales) {
        try {
          const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          let q = supabase
            .from("leads")
            .select("id, name, company, created_at, assigned_agent_name")
            .gt("created_at", cutoff)
            .order("created_at", { ascending: false })
            .limit(6);

          if (!isAdmin && access.isSalesAgent) {
            q = q.ilike("assigned_agent_name", cleanEmail);
          }

          const { data: recentLeads } = await q;

          (recentLeads ?? []).forEach((l: any) => {
            const nid = `lead-${l.id}`;
            const isRead = readSet.has(nid) || new Date(l.created_at).getTime() <= lastViewed;
            const companyClean = (l.company || "").trim();
            const body = companyClean ? `${l.name} • ${companyClean}` : `${l.name} • Added to pipeline`;

            newNotifs.push({
              id: nid,
              title: "New Lead In Pipeline 🎯",
              body,
              time: new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              rawTime: l.created_at,
              read: isRead,
              icon: "lead",
              link: "/leads",
            });
          });
        } catch {}
      }

      // Sort all notifications by newest event first
      newNotifs.sort((a, b) => {
        const tA = a.rawTime ? new Date(a.rawTime).getTime() : 0;
        const tB = b.rawTime ? new Date(b.rawTime).getTime() : 0;
        return tB - tA;
      });

      // Deduplicate IDs and exact content keys
      const seenIds = new Set<string>();
      const seenKeys = new Set<string>();
      const deduped = newNotifs.filter((n) => {
        const contentKey = `${n.title}:::${n.body}`;
        if (seenIds.has(n.id) || seenKeys.has(contentKey)) return false;
        seenIds.add(n.id);
        seenKeys.add(contentKey);
        return true;
      });

      setNotifs(deduped.slice(0, 10));
    } catch (err) {
      console.error("Notif fetch error", err);
    }
  }

  function markAllRead() {
    const readSet = getStoredReadIds();
    saveLastViewedTime();
    setNotifs((prev) => {
      prev.forEach((n) => {
        readSet.add(n.id);
      });
      saveReadIds(readSet);
      return prev.map((n) => ({ ...n, read: true }));
    });
    if (userEmail) {
      import("@/lib/project-management-store").then(({ markAllProjectsSeen }) => {
        markAllProjectsSeen(userEmail).then(() => fetchNotifs()).catch(() => {});
      }).catch(() => {});
    }
  }

  useEffect(() => {
    fetchNotifs();

    // 1. Cross-tab BroadcastChannel
    let bc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("teals-crm-projects-sync");
        bc.onmessage = () => fetchNotifs();
      }
    } catch {}

    const sub1 = supabase
      .channel("notif-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchNotifs())
      .subscribe();
    const sub2 = supabase
      .channel("notif-emails")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails_sent" }, () => fetchNotifs())
      .subscribe();
    const sub3 = supabase
      .channel("notif-meetings")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => fetchNotifs())
      .subscribe();
    const sub4 = supabase
      .channel("notif-projects-sync")
      .on("broadcast", { event: "crm_project_created" }, () => fetchNotifs())
      .on("broadcast", { event: "crm_project_comment_added" }, () => fetchNotifs())
      .on("broadcast", { event: "crm_project_completed" }, () => fetchNotifs())
      .on("broadcast", { event: "crm_project_redo_requested" }, () => fetchNotifs())
      .on("broadcast", { event: "crm_project_transferred" }, () => fetchNotifs())
      .on("broadcast", { event: "crm_project_claimed" }, () => fetchNotifs())
      .on("broadcast", { event: "crm_project_deleted" }, () => fetchNotifs())
      .on("broadcast", { event: "crm_project_comment_deleted" }, () => fetchNotifs())
      .on("broadcast", { event: "crm_projects_marked_seen" }, () => fetchNotifs())
      .on("broadcast", { event: "projects_marked_seen" }, () => fetchNotifs())
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchNotifs())
      .subscribe();

    const interval = setInterval(fetchNotifs, 10000);
    return () => {
      if (bc) bc.close();
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
      sub4.unsubscribe();
      clearInterval(interval);
    };
  }, [userEmail, userName, access]);

  const unreadCount = notifs.filter((n) => !n.read).length;
  return { notifs, unreadCount, markAllRead, fetchNotifs };
}

export function Topbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isViewingNotifications = pathname.startsWith("/notifications");
  const { user, signOut } = useCrm();
  const userEmail = (user?.email || "").toLowerCase().trim();
  const userName = user?.name || userEmail.split("@")[0] || "Agent";
  const isAdmin = isAdminEmail(userEmail);

  const [departments, setDepartments] = useState<Department[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_departments");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    const loadDepts = async () => {
      try {
        const depts = await fetchAllDepartments();
        if (Array.isArray(depts) && depts.length > 0) {
          setDepartments(depts);
        }
      } catch {}
    };
    loadDepts();

    let bc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("teals-crm-projects-sync");
        bc.onmessage = () => loadDepts();
      }
    } catch {}

    const channel = supabase.channel(`topbar-depts-live-sync-${Date.now()}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "crm_departments_updated" }, () => loadDepts())
      .on("broadcast", { event: "crm_profiles_updated" }, () => loadDepts())
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, () => loadDepts())
      .subscribe();

    return () => {
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, []);

  const access = useMemo(() => {
    return getUserAccessInfo(user, departments);
  }, [user, departments]);

  const { notifs, unreadCount, markAllRead, fetchNotifs } = useNotifications(access, userEmail, userName);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (isViewingNotifications) {
      markAllRead();
    }
  }, [isViewingNotifications]);

  const initials = (user?.name ?? "NX")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  function handleNotifOpen(open: boolean) {
    setNotifOpen(open);
    if (open) markAllRead();
  }

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("teals_sound_enabled");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true;
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(() =>
    typeof window !== "undefined" ? (window as any).__tealsDeferredPrompt || null : null
  );
  const [installDialogOpen, setInstallDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).__tealsDeferredPrompt) {
      setDeferredPrompt((window as any).__tealsDeferredPrompt);
    }
    const handleBeforeInstall = (e: Event) => {
      (window as any).__tealsDeferredPrompt = e;
      setDeferredPrompt(e);
    };
    const handlePwaReady = (e: any) => {
      if (e?.detail) setDeferredPrompt(e.detail);
    };
    const handleOpenDialog = () => setInstallDialogOpen(true);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("teals-pwa-ready", handlePwaReady);
    window.addEventListener("teals-open-install-dialog", handleOpenDialog);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("teals-pwa-ready", handlePwaReady);
      window.removeEventListener("teals-open-install-dialog", handleOpenDialog);
    };
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("teals_sound_enabled", String(next));
      } catch {}
    }
    if (next) {
      playTestSound();
      toast.success("🔊 Beep Alerts ON", {
        description: "Audio beeps will ring for visitor arrival and messages.",
      });
    } else {
      toast.info("🔇 Beep Alerts OFF", {
        description: "All CRM alert beeps are now turned off.",
      });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-2.5 sm:px-4 py-2 sm:py-2.5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="shrink-0 -ml-0.5" />
        <Link to="/dashboard" className="flex md:hidden items-center gap-1.5 min-w-0">
          <img
            src="/icon-192.png?v=3"
            alt="Teals"
            className="size-6 rounded-lg object-cover shrink-0 border border-border"
          />
          <span className="font-display text-xs font-bold truncate hidden xs:inline">Teals</span>
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Quick Download button on mobile & desktop topbar when not on dashboard */}
        {!pathname.startsWith("/dashboard") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              triggerDirectAppInstall(
                deferredPrompt,
                () => setDeferredPrompt(null),
                () => setInstallDialogOpen(true)
              )
            }
            className="h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold cursor-pointer"
            title="Download Teals CRM App"
          >
            <Download className="size-3.5 sm:size-4" />
            <span>Download</span>
          </Button>
        )}

        {/* Test Sound Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await playTestSound();
            toast.success('🔊 Sound Alert Active!', {
              description: 'Visitor arrival & chat alerts will ring even when you are in another tab.'
            });
          }}
          className="h-8 sm:h-9 px-2 sm:px-3 gap-1.5 rounded-xl border-border bg-card hover:bg-accent text-emerald-600 dark:text-emerald-400"
          title="Test audio alert and ensure background sound is active"
        >
          <Volume2 className="size-4" />
          <span className="hidden sm:inline text-xs font-medium">Test Sound 🔊</span>
        </Button>

        {/* Beep ON / OFF Toggle Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleSound}
          className={`h-8 sm:h-9 px-2 sm:px-3 gap-1 sm:gap-1.5 rounded-xl border text-[11px] sm:text-xs font-medium transition-all ${
            soundEnabled
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              : "bg-muted border-border text-muted-foreground hover:text-foreground"
          }`}
          title={soundEnabled ? "Beep Alerts are ON - Click to turn OFF" : "Beep Alerts are OFF - Click to turn ON"}
        >
          {soundEnabled ? <Volume2 className="size-3.5 sm:size-4" /> : <VolumeX className="size-3.5 sm:size-4" />}
          <span className="hidden xs:inline">{soundEnabled ? "Beep ON" : "Beep OFF"}</span>
        </Button>

        {/* Notifications Dropdown (Project Management Notifications) */}
        <DropdownMenu open={notifOpen} onOpenChange={handleNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="relative rounded-xl h-8 sm:h-9 px-2 sm:px-3 gap-1.5 border-border bg-card hover:bg-accent cursor-pointer"
            >
              <Bell className="size-4 text-violet-400" />
              <span className="hidden sm:inline text-xs font-medium">Project Notifications</span>
              {unreadCount > 0 && (
                <span className="relative flex h-2 w-2 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-80 sm:max-w-96 sm:w-96 p-0 rounded-2xl shadow-2xl border border-white/10 bg-card/95 backdrop-blur-xl z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-violet-400" />
                <span className="text-xs font-bold">Project Management Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllRead();
                  toast.success("All notifications marked as read.");
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
              >
                <CheckCheck className="size-3.5 text-emerald-400" />
                <span>Mark all read</span>
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
              {notifs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No new notifications — you are all caught up! 🎉
                </div>
              ) : (
                notifs.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    asChild
                    className={`px-4 py-3 cursor-pointer focus:bg-white/5 transition-colors ${
                      !n.read ? "bg-violet-500/5 font-medium" : "opacity-80"
                    }`}
                  >
                    <Link
                      to={(n.link as any) || "/projects"}
                      search={!n.link || n.link === "/projects" ? { view: "notifications" } : undefined}
                      onClick={() => {
                        setNotifOpen(false);
                        markAllRead();
                      }}
                      className="flex items-start gap-3 w-full"
                    >
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0 mt-0.5">
                        <NotifIcon type={n.icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                      </div>
                      {!n.read && (
                        <span className="size-2 rounded-full bg-rose-500 shrink-0 mt-1.5 animate-pulse" />
                      )}
                    </Link>
                  </DropdownMenuItem>
                ))
              )}
            </div>

            <div className="p-2 border-t border-border/50 bg-background/50">
              <Button asChild variant="ghost" size="sm" className="w-full text-xs font-semibold text-violet-400 hover:text-violet-300 rounded-xl justify-center">
                <Link
                  to="/projects"
                  search={{ view: "notifications" }}
                  onClick={() => {
                    setNotifOpen(false);
                    markAllRead();
                  }}
                >
                  View All Project Tasks & Assignments →
                </Link>
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 transition-colors hover:bg-accent/50">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-xs font-semibold">
                  {user?.pseudo_name ? `${user.pseudo_name} (${user.name})` : user?.name}
                </span>
                {access.isAdmin ? (
                  <span className="block text-[11px] text-violet-500 font-medium">Admin</span>
                ) : access.isManager ? (
                  <span className="block text-[11px] text-purple-400 font-medium">
                    {access.managerDepartmentName
                      ? (access.managerDepartmentName.endsWith("Manager") ? access.managerDepartmentName : `${access.managerDepartmentName} Manager`)
                      : access.departmentId === "production-house"
                      ? "Production House Manager"
                      : access.departmentId === "ecommerce-department"
                      ? "E-commerce Department Manager"
                      : "Sales Department Manager"}
                  </span>
                ) : access.isProductionAgent ? (
                  <span className="block text-[11px] text-violet-300 font-medium">Production Working Agent</span>
                ) : access.isEcommerceAgent ? (
                  <span className="block text-[11px] text-emerald-300 font-medium">E-commerce Working Agent</span>
                ) : (
                  <span className="block text-[11px] text-blue-300 font-medium">Sales Working Agent</span>
                )}
                {user?.designation && (
                  <span className="block text-[10px] text-muted-foreground truncate max-w-[150px]">
                    💼 {user.designation}
                  </span>
                )}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Logged in as <br />
              <strong className="text-foreground font-semibold">{user?.email}</strong>
              {user?.pseudo_name && (
                <div className="mt-1 flex items-center gap-1.5 text-violet-400 font-medium text-[11px]">
                  <span>🎭 Persona:</span>
                  <span className="font-bold text-white">{user.pseudo_name}</span>
                </div>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                👤 Profile & Pseudo Name
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                triggerDirectAppInstall(
                  deferredPrompt,
                  () => setDeferredPrompt(null),
                  () => setInstallDialogOpen(true)
                )
              }
              className="text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
            >
              <Download className="size-4 mr-1.5 text-emerald-500" />
              <span>Download</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/" className="text-violet-500 font-medium">Switch / Login as Another Agent</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <InstallAppDialog
        open={installDialogOpen}
        onOpenChange={setInstallDialogOpen}
        deferredPrompt={deferredPrompt}
        onInstalled={() => setDeferredPrompt(null)}
      />
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  description,
  action,
  actions,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const rightContent = action || actions;
  const sub = subtitle || description;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl font-bold sm:text-3xl">{title}</h1>
        {sub ? (
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{sub}</p>
        ) : null}
      </div>
      {rightContent ? <div className="flex flex-wrap items-center gap-2 shrink-0">{rightContent}</div> : null}
    </div>
  );
}
