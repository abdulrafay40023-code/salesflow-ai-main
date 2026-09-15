import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, LogOut, Mail, UserPlus, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

type Notif = {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: "lead" | "email" | "auto" | "approval";
  link?: string;
};

function NotifIcon({ type }: { type: Notif["icon"] }) {
  if (type === "lead")  return <UserPlus className="h-4 w-4 text-blue-500" />;
  if (type === "email") return <Mail className="h-4 w-4 text-purple-500" />;
  if (type === "approval") return <Bell className="h-4 w-4 text-amber-400" />;
  return <Zap className="h-4 w-4 text-yellow-500" />;
}

const NOTIF_STORAGE_KEY = "nexa_read_notifs";

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

function useNotifications(isAdmin = false) {
  const [notifs, setNotifs] = useState<Notif[]>([]);

  async function fetchNotifs() {
    try {
      const readSet = getStoredReadIds();
      const [{ data: leads }, { data: emails }, { data: pendingApprovals }] = await Promise.all([
        supabase
          .from("leads")
          .select("id,name,company,created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("emails_sent")
          .select("id,subject,status,sent_at,sequence_type")
          .order("sent_at", { ascending: false })
          .limit(5),
        // Admin only: fetch pending approval requests
        isAdmin
          ? supabase
              .from("emails_sent")
              .select("id,lead_email,subject,sent_at")
              .eq("sequence_type", "agent_approval_request")
              .eq("status", "pending")
              .order("sent_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] }),
      ]);

      const newNotifs: Notif[] = [];

      // Pending approval requests (admin only — shown with amber bell)
      (pendingApprovals ?? []).forEach((req: { id: string; lead_email: string; subject: string; sent_at: string }) => {
        const nid = `approval-${req.id}`;
        let reqName = req.lead_email?.split("@")[0] || "Unknown";
        try {
          const p = JSON.parse(req.subject);
          if (p.name) reqName = p.name;
        } catch {}
        newNotifs.push({
          id: nid,
          title: "New Access Request 🟡",
          body: `${reqName} is waiting for your approval`,
          time: new Date(req.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: readSet.has(nid),
          icon: "approval",
          link: "/settings",
        });
      });

      (leads ?? []).forEach((l: { id: string; name: string; company: string; created_at: string }) => {
        const nid = `lead-${l.id}`;
        newNotifs.push({
          id: nid,
          title: "New Lead Added",
          body: `${l.name} from ${l.company ?? "Unknown"}`,
          time: new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: readSet.has(nid),
          icon: "lead",
        });
      });

      (emails ?? []).forEach((e: { id: string; subject: string; status: string; sent_at: string; sequence_type?: string }) => {
        // Filter out internal system/agent logs and approval requests from general notifications
        if (e.sequence_type === "agent_presence" || e.sequence_type === "agent_login" || e.sequence_type === "agent_approval_request") return;

        const nid = `email-${e.id}`;
        newNotifs.push({
          id: nid,
          title: e.status === "opened" ? "Email Replied ✅" : e.sequence_type === "welcome" ? "Welcome Email Sent" : "Customer Email Sent",
          body: e.subject || "Automated email",
          time: new Date(e.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: readSet.has(nid),
          icon: "email",
        });
      });

      newNotifs.sort((a, b) => b.id.localeCompare(a.id));
      setNotifs(newNotifs.slice(0, 8));
    } catch (err) {
      console.error("Notif fetch error", err);
    }
  }

  function markAllRead() {
    const readSet = getStoredReadIds();
    setNotifs((prev) => {
      prev.forEach((n) => readSet.add(n.id));
      saveReadIds(readSet);
      return prev.map((n) => ({ ...n, read: true }));
    });
  }

  useEffect(() => {
    fetchNotifs();
    const sub1 = supabase
      .channel("notif-leads")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, () => fetchNotifs())
      .subscribe();
    const sub2 = supabase
      .channel("notif-emails")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "emails_sent" }, () => fetchNotifs())
      .subscribe();
    const interval = setInterval(fetchNotifs, 30000);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); clearInterval(interval); };
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;
  return { notifs, unreadCount, markAllRead, fetchNotifs };
}

export function Topbar() {
  const { user, signOut } = useCrm();
  const isAdmin = isAdminEmail(user?.email);
  const { notifs, unreadCount, markAllRead } = useNotifications(isAdmin);
  const [notifOpen, setNotifOpen] = useState(false);

  const initials = (user?.name ?? "NX")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  function handleNotifOpen(open: boolean) {
    setNotifOpen(open);
    if (open) markAllRead();
  }

  return (
    <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl sm:flex sm:justify-between md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="shrink-0" />

      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="outline" size="sm" className="relative rounded-xl h-9 px-3 gap-1.5 border-border bg-card hover:bg-accent">
          <Link to="/notifications">
            <Bell className="size-4 text-primary" />
            <span className="hidden sm:inline text-xs font-medium">Notifications</span>
            {unreadCount > 0 && (
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </Link>
        </Button>

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
                <span className="block text-xs font-semibold">{user?.name}</span>
                {isAdminEmail(user?.email) && (
                  <span className="block text-[11px] text-violet-500 font-medium">Admin</span>
                )}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Logged in as <br />
              <strong className="text-foreground font-semibold">{user?.email}</strong>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">Profile & settings</Link>
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {sub ? (
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        ) : null}
      </div>
      {rightContent ? <div className="shrink-0">{rightContent}</div> : null}
    </div>
  );
}
