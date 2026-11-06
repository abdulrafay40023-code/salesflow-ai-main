import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CalendarClock,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Share2,
  FolderKanban,
  PhoneCall,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCrm } from "@/lib/crm-store";
import { useLiveChatAlert } from "@/context/LiveChatAlertContext";
import { isAdminEmail } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import {
  Department,
  fetchAllDepartments,
  getUserAccessInfo,
} from "@/lib/project-management-store";

const primaryNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Notifications of Bookings", url: "/notifications", icon: Bell },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Email Automation", url: "/email", icon: Mail },
  { title: "Follow-ups", url: "/follow-ups", icon: CalendarClock },
  { title: "LiveChat AI", url: "/livechat", icon: MessageSquare },
  { title: "Project Management", url: "/projects", icon: FolderKanban },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCrm();
  const { setOpenMobile } = useSidebar();
  const { unreadMessagesCount, hasLiveVisitor, clearBadges } = useLiveChatAlert();
  const isViewingLiveChat = pathname.startsWith("/livechat");
  const isViewingProjects = pathname.startsWith("/projects");
  const isViewingNotifications = pathname.startsWith("/notifications");

  useEffect(() => {
    if (isViewingLiveChat) {
      clearBadges();
    }
  }, [isViewingLiveChat, clearBadges]);

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
        setDepartments(depts);
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

    const channel = supabase.channel("teals-sidebar-depts-live-sync", {
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

  const isAdmin = access.isAdmin;
  const isManager = access.isManager;

  const visiblePrimaryNav = useMemo(() => {
    if (access.isProductionAgent) {
      return primaryNav.filter((item) => item.url === "/projects");
    }
    if (access.isEcommerceAgent) {
      return primaryNav.filter((item) => item.url === "/livechat" || item.url === "/projects");
    }
    return primaryNav;
  }, [access]);

  const [leadCount, setLeadCount] = useState<number>(0);
  const [unreadProjectsCount, setUnreadProjectsCount] = useState<number>(0);
  const [unreadBookingsCount, setUnreadBookingsCount] = useState<number>(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  // Monitor pending agent approval requests for Admins
  useEffect(() => {
    if (!isAdmin) return;

    const checkPendingApprovals = async () => {
      try {
        const { fetchPendingSignups } = await import("@/lib/pending-signups");
        const pending = await fetchPendingSignups();
        setPendingApprovalsCount(pending.length);
      } catch {}
    };

    checkPendingApprovals();

    // 1. Cross-tab BroadcastChannel
    let bc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("teals-crm-approvals-sync");
        bc.onmessage = () => checkPendingApprovals();
      }
    } catch {}

    // 2. Supabase Realtime live channel
    const channel = supabase.channel("teals-approvals-live-sync", {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "crm_approval_request_created" }, () => checkPendingApprovals())
      .on("broadcast", { event: "crm_approval_resolved" }, () => checkPendingApprovals())
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_signups" }, () => checkPendingApprovals())
      .on("postgres_changes", { event: "*", schema: "public", table: "emails_sent" }, () => checkPendingApprovals())
      .subscribe();

    const interval = setInterval(() => {
      checkPendingApprovals();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!user?.email) return;
    const userEmail = user.email.toLowerCase().trim();
    const isSuperAdmin = Boolean(user.role === "admin" || isAdminEmail(userEmail));

    if (isViewingProjects) {
      setUnreadProjectsCount(0);
      return;
    }

    const checkUnreadProjects = async () => {
      try {
        const {
          fetchAllDepartments,
          fetchAllProjects,
          getUserAssignedDepartments,
          isUserMentionedInProject,
        } = await import("@/lib/project-management-store");
        const [depts, projs] = await Promise.all([fetchAllDepartments(), fetchAllProjects()]);
        const userAssignedDepts = getUserAssignedDepartments(userEmail, depts);
        const myDeptIds = userAssignedDepts.map((d) => d.id);

        const unread = projs.filter((p) => {
          if (!isSuperAdmin) {
            const matchesMyDept = myDeptIds.includes(p.target_department_id);
            const isCreator = (p.created_by_email || "").toLowerCase().trim() === userEmail;
            const isClaimedByMe = (p.claimed_by_email || "").toLowerCase().trim() === userEmail;
            const isMentioned = isUserMentionedInProject(p, userEmail, user?.name);
            if (!matchesMyDept && !isCreator && !isClaimedByMe && !isMentioned) return false;
          }
          const seen = (p.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
          return !seen.includes(userEmail);
        });
        setUnreadProjectsCount(unread.length);
      } catch {}
    };

    checkUnreadProjects();

    // 1. Cross-tab BroadcastChannel
    let bc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("teals-crm-projects-sync");
        bc.onmessage = () => checkUnreadProjects();
      }
    } catch {}

    // 2. Supabase Realtime multi-user live channel
    const channel = supabase.channel("teals-sidebar-projects-sync", {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "crm_project_created" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_project_comment_added" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_project_claimed" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_project_transferred" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_project_completed" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_project_redo_requested" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_project_deleted" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_project_comment_deleted" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_departments_updated" }, () => checkUnreadProjects())
      .on("broadcast", { event: "crm_projects_marked_seen" }, () => checkUnreadProjects())
      .on("broadcast", { event: "projects_marked_seen" }, () => checkUnreadProjects())
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => checkUnreadProjects())
      .subscribe();

    // 3. Periodic fallback polling
    const interval = setInterval(() => {
      checkUnreadProjects();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [user?.email, user?.role, user?.name, isViewingProjects]);

  useEffect(() => {
    let q = supabase.from("leads").select("id", { count: "exact", head: true });
    if (!isAdmin && user?.email) {
      q = q.ilike("assigned_agent_name", user.email.trim());
    }
    q.then(({ count }) => {
      if (count !== null) setLeadCount(count);
    });
  }, [isAdmin, user?.email]);

  // Monitor unread booking notifications
  useEffect(() => {
    if (isViewingNotifications) {
      setUnreadBookingsCount(0);
      try {
        localStorage.setItem("teals_bookings_last_viewed_at", String(Date.now()));
      } catch {}
      return;
    }

    const checkUnreadBookings = async () => {
      try {
        if (isAdmin) {
          // Meeting claim notifications are strictly for working agents, NOT for admins!
          setUnreadBookingsCount(0);
          return;
        }

        const lastViewed = Number(localStorage.getItem("teals_bookings_last_viewed_at") || "0");
        const query = supabase
          .from("meetings")
          .select("id, scheduled_time, created_at, completed, agent_email, title")
          .eq("completed", false);

        const { data: meetings } = await query;
        if (!meetings) return;

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

        // Non-sales members do NOT receive sales claim notifications
        if (!isSalesDept) {
          setUnreadBookingsCount(0);
          return;
        }

        const myAssignedWebsites = (user?.assigned_websites || []).map((w: string) => w.toLowerCase().trim());
        const userEmail = (user?.email || "").trim().toLowerCase();

        const unread = meetings.filter((m: any) => {
          if (!m || m.completed) return false;
          const time = new Date(m.created_at || m.scheduled_time || 0).getTime();
          if (time <= lastViewed) return false;

          const mAgent = (m.agent_email || "").trim().toLowerCase();
          // Claimed by me
          if (mAgent && mAgent === userEmail) return true;

          // Unclaimed booking matching my assigned websites
          const isUnclaimed = !mAgent || mAgent === "agent@teals.co" || mAgent === "unassigned";
          if (isUnclaimed) {
            // Sales leaders see all unclaimed bookings
            if (isSalesLeader) return true;

            if (myAssignedWebsites.length === 0) return true;
            if (m.title) {
              const titleLower = m.title.toLowerCase();
              return myAssignedWebsites.some((siteSlug: string) => {
                const cleanSlug = siteSlug.replace(/[^a-z0-9]/g, "");
                const cleanTitle = titleLower.replace(/[^a-z0-9]/g, "");
                return cleanTitle.includes(cleanSlug);
              });
            }
          }
          return false;
        });

        setUnreadBookingsCount(unread.length);
      } catch {}
    };

    checkUnreadBookings();

    let bc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("teals-crm-bookings-sync");
        bc.onmessage = () => checkUnreadBookings();
      }
    } catch {}

    const channel = supabase.channel("teals-sidebar-bookings-sync", {
      config: { broadcast: { self: true } },
    });

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => checkUnreadBookings())
      .subscribe();

    const interval = setInterval(checkUnreadBookings, 10000);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, [isViewingNotifications, isAdmin, user?.email]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/icon-192.png?v=3"
            alt="Teals CRM Logo"
            className="size-9 shrink-0 rounded-xl object-cover shadow-[var(--shadow-card)] border border-sidebar-border"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-display text-sm font-bold">Teals CRM</p>
            <p className="truncate text-xs text-muted-foreground">AI Sales Suite</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visiblePrimaryNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <Link
                      to={item.url}
                      onClick={() => {
                        setOpenMobile(false);
                        if (item.url === "/livechat") clearBadges();
                      }}
                      className="flex items-center justify-between w-full"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative">
                          <item.icon />
                          {item.url === "/livechat" && !isViewingLiveChat && (
                            <>
                              {unreadMessagesCount > 0 ? (
                                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
                              ) : hasLiveVisitor ? (
                                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
                              ) : null}
                            </>
                          )}
                          {item.url === "/notifications" && !isViewingNotifications && unreadBookingsCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
                          )}
                          {item.url === "/projects" && !isViewingProjects && unreadProjectsCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-violet-500 ring-2 ring-background animate-pulse" />
                          )}
                        </div>
                        <span className="truncate">{item.title}</span>
                      </div>

                      {item.url === "/livechat" && !isViewingLiveChat && (
                        <div className="flex items-center ml-auto pl-1.5">
                          {unreadMessagesCount > 0 ? (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                              {unreadMessagesCount}
                            </span>
                          ) : hasLiveVisitor ? (
                            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-1.5 py-0.5 rounded-full">
                              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>Live</span>
                            </span>
                          ) : null}
                        </div>
                      )}

                      {item.url === "/notifications" && !isViewingNotifications && unreadBookingsCount > 0 && (
                        <div className="flex items-center ml-auto pl-1.5">
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                            {unreadBookingsCount}
                          </span>
                        </div>
                      )}

                      {item.url === "/projects" && !isViewingProjects && unreadProjectsCount > 0 && (
                        <div className="flex items-center ml-auto pl-1.5">
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                            {unreadProjectsCount}
                          </span>
                        </div>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/settings")}
                  tooltip="Settings"
                >
                  <Link to="/settings" onClick={() => setOpenMobile(false)}>
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {(isAdmin || isManager) && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/meta-leads")}
                      tooltip="Meta Leads"
                    >
                      <Link to="/meta-leads" onClick={() => setOpenMobile(false)}>
                        <Share2 className="text-blue-400" />
                        <span className="font-semibold text-blue-400">Meta Leads</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/reports")}
                      tooltip="Reports"
                    >
                      <Link to="/reports" onClick={() => setOpenMobile(false)}>
                        <BarChart3 className="text-violet-400" />
                        <span className="font-semibold text-violet-400">Reports</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}

              {(isAdmin || isManager) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Admin Panel"
                  >
                    <Link to="/admin" onClick={() => setOpenMobile(false)} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative">
                          <ShieldCheck className="text-violet-400" />
                          {pendingApprovalsCount > 0 && !pathname.startsWith("/admin") && (
                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-400 ring-2 ring-background animate-pulse" />
                          )}
                        </div>
                        <span className="font-semibold text-violet-400 truncate">Admin Panel</span>
                      </div>

                      {pendingApprovalsCount > 0 && !pathname.startsWith("/admin") && (
                        <div className="flex items-center ml-auto pl-1.5">
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-black shadow-sm animate-pulse">
                            {pendingApprovalsCount}
                          </span>
                        </div>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="rounded-2xl border border-border bg-accent/40 p-3">
          <p className="text-xs font-semibold text-accent-foreground">AI Assistant</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {access.isProductionAgent
              ? "Tracking active production tasks & deliverables."
              : access.isEcommerceAgent
              ? "Monitoring store projects & live customer chat."
              : leadCount > 0
              ? `Monitoring ${leadCount} lead${leadCount !== 1 ? "s" : ""} in your pipeline.`
              : "Waiting for leads to monitor."}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
