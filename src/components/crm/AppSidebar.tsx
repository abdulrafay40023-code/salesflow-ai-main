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
} from "lucide-react";
import { useEffect, useState } from "react";
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
} from "@/components/ui/sidebar";
import { useCrm } from "@/lib/crm-store";
import { useLiveChatAlert } from "@/context/LiveChatAlertContext";
import { isAdminEmail } from "@/lib/crm-data";

const primaryNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Email Automation", url: "/email", icon: Mail },
  { title: "Follow-ups", url: "/follow-ups", icon: CalendarClock },
  { title: "LiveChat AI", url: "/livechat", icon: MessageSquare },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCrm();
  const { unreadMessagesCount, hasLiveVisitor, hasPendingApproval, clearBadges } = useLiveChatAlert();
  const isViewingLiveChat = pathname.startsWith("/livechat");

  useEffect(() => {
    if (isViewingLiveChat) {
      clearBadges();
    }
  }, [isViewingLiveChat, clearBadges]);
  const [leadCount, setLeadCount] = useState<number>(0);

  useEffect(() => {
    // Dynamically import supabase only on client
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("leads").select("id", { count: "exact", head: true }).then(({ count }) => {
        if (count !== null) setLeadCount(count);
      });
    });
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
            <Sparkles className="size-4.5" />
          </div>
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
              {primaryNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} onClick={() => { if (item.url === "/livechat") clearBadges(); }} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative">
                          <item.icon />
                          {item.url === "/livechat" && !isViewingLiveChat && (
                            <>
                              {unreadMessagesCount > 0 ? (
                                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
                              ) : hasPendingApproval ? (
                                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-400 ring-2 ring-background animate-pulse" />
                              ) : hasLiveVisitor ? (
                                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
                              ) : null}
                            </>
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
                          ) : hasPendingApproval ? (
                            <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-500/50 px-1.5 py-0.5 rounded-full">
                              <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
                              <span>Alert</span>
                            </span>
                          ) : hasLiveVisitor ? (
                            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-1.5 py-0.5 rounded-full">
                              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>Live</span>
                            </span>
                          ) : null}
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
                  <Link to="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {(user?.role === "admin" || isAdminEmail(user?.email)) && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/meta-leads")}
                      tooltip="Meta Leads"
                    >
                      <Link to="/meta-leads">
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
                      <Link to="/reports">
                        <BarChart3 className="text-violet-400" />
                        <span className="font-semibold text-violet-400">Reports</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/admin")}
                      tooltip="Admin Panel"
                    >
                      <Link to="/admin">
                        <ShieldCheck className="text-violet-400" />
                        <span className="font-semibold text-violet-400">Admin Panel</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="rounded-2xl border border-border bg-accent/40 p-3">
          <p className="text-xs font-semibold text-accent-foreground">AI Assistant</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {leadCount > 0
              ? `Monitoring ${leadCount} lead${leadCount !== 1 ? "s" : ""} in your pipeline.`
              : "Waiting for leads to monitor."}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
