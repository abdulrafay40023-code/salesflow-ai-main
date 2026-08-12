import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  Mail,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
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

const primaryNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Email Automation", url: "/email", icon: Mail },
  { title: "Follow-ups", url: "/follow-ups", icon: CalendarClock },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCrm();
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
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
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
              {user?.email === "garryamelia6265@gmail.com" && (
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
