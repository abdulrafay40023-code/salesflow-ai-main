import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/crm-data";
import { SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_app/livechat")({
  validateSearch: (search: Record<string, unknown>): { view?: string } => {
    return {
      view: typeof search.view === "string" ? search.view : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "LiveChat AI — Teals CRM" },
      {
        name: "description",
        content: "Multi-Website Live Customer Chat and AI Handoff Suite.",
      },
    ],
  }),
  component: LiveChatPage,
});

function LiveChatPage() {
  const { user } = useCrm();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [activeView, setActiveView] = React.useState<"chats" | "monitoring">(() => {
    if (typeof window !== "undefined") {
      const urlView = new URLSearchParams(window.location.search).get("view");
      if (urlView === "monitoring") return "monitoring";
    }
    return search?.view === "monitoring" ? "monitoring" : "chats";
  });

  React.useEffect(() => {
    if (search?.view === "monitoring" || search?.view === "chats") {
      setActiveView(search.view);
    }
  }, [search?.view]);

  const sessionUser = user || (() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem("teals-crm-session") || window.localStorage.getItem("teals-crm-session");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  })();

  const email = sessionUser?.email;
  const name = sessionUser?.name || "";
  const isAdm = sessionUser?.role === "admin" || (email && isAdminEmail(email));
  const role = isAdm ? "admin" : "agent";

  const [liveAssignedWebsites, setLiveAssignedWebsites] = React.useState<string[]>(() => {
    return sessionUser?.assigned_websites || [];
  });
  const [livePseudoName, setLivePseudoName] = React.useState<string>(() => {
    return sessionUser?.pseudo_name || '';
  });

  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    if (!email || isAdm) return;
    const cleanEmail = email.toLowerCase().trim();

    let extClient: any = null;
    let extChannel: any = null;
    let crmChannel: any = null;
    let profileChannel: any = null;
    let bc: any = null;

    const applyWebsites = (websites: string[]) => {
      setLiveAssignedWebsites(websites);
      try {
        const raw = window.sessionStorage.getItem("teals-crm-session") || window.localStorage.getItem("teals-crm-session");
        if (raw) {
          const u = JSON.parse(raw);
          u.assigned_websites = websites;
          window.sessionStorage.setItem("teals-crm-session", JSON.stringify(u));
          window.localStorage.setItem("teals-crm-session", JSON.stringify(u));
        }
      } catch {}

      // Send postMessage to embedded LiveChat iframe for instantaneous update
      try {
        iframeRef.current?.contentWindow?.postMessage({
          type: "TEALS_PERMISSIONS_UPDATED",
          email: cleanEmail,
          assigned_websites: websites,
        }, "*");
      } catch {}
    };

    // 1. Initial fetch from CRM Supabase profiles table
    supabase.from("profiles").select("avatar_url, role, full_name").eq("email", cleanEmail).maybeSingle().then(({ data: prof }: any) => {
      if (prof?.avatar_url) {
        try {
          const parsed = JSON.parse(prof.avatar_url);
          if (Array.isArray(parsed.assigned_websites)) {
            applyWebsites(parsed.assigned_websites);
          }
          if (parsed.pseudo_name) {
            setLivePseudoName(parsed.pseudo_name);
          }
          if (parsed.pseudo_name || parsed.role_title) {
            try {
              const raw = window.sessionStorage.getItem("teals-crm-session") || window.localStorage.getItem("teals-crm-session");
              if (raw) {
                const u = JSON.parse(raw);
                if (parsed.pseudo_name) u.pseudo_name = parsed.pseudo_name;
                if (parsed.role_title) u.role_title = parsed.role_title;
                if (parsed.designation) u.designation = parsed.designation;
                window.sessionStorage.setItem("teals-crm-session", JSON.stringify(u));
                window.localStorage.setItem("teals-crm-session", JSON.stringify(u));
              }
            } catch {}
          }
        } catch {}
      }
    });

    // 2. Realtime Postgres change listener on profiles table in CRM Supabase
    profileChannel = supabase.channel(`agent-profile-livechat-${cleanEmail}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload: any) => {
        const row = payload?.new || payload?.old;
        if (row && (row.email || "").toLowerCase().trim() === cleanEmail && row.avatar_url) {
          try {
            const parsed = JSON.parse(row.avatar_url);
            if (Array.isArray(parsed.assigned_websites)) {
              applyWebsites(parsed.assigned_websites);
            }
          } catch {}
        }
      }).subscribe();

    // 3. CRM WebSocket broadcast listener
    crmChannel = supabase.channel("teals-live-crm-stream", {
      config: { broadcast: { self: true } }
    });
    crmChannel.on("broadcast", { event: "agent_permissions_updated" }, (payload: any) => {
      const raw = payload?.payload || payload;
      const targetEmail = (raw?.email || "").toLowerCase().trim();
      if (targetEmail === cleanEmail && Array.isArray(raw?.assigned_websites)) {
        applyWebsites(raw.assigned_websites);
      }
    }).subscribe();

    // 4. External LiveChat SaaS WebSocket broadcast listener
    import("@supabase/supabase-js").then(({ createClient }) => {
      extClient = createClient(
        "https://nyoegrnemmravwqdcqnp.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2Vncm5lbW1yYXZ3cWRjcW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0MzEzMywiZXhwIjoyMTAzNDE5MTMzfQ.Q44BHkMZ_j1HfPLiPkxHNtC5wwEvS72AYOsvjaqQ49Q"
      );

      extChannel = extClient.channel("teals-live-crm-stream", {
        config: { broadcast: { self: true } }
      });
      extChannel.on("broadcast", { event: "agent_permissions_updated" }, (payload: any) => {
        const raw = payload?.payload || payload;
        const targetEmail = (raw?.email || "").toLowerCase().trim();
        if (targetEmail === cleanEmail && Array.isArray(raw?.assigned_websites)) {
          applyWebsites(raw.assigned_websites);
        }
      }).subscribe();
    });

    // 5. Cross-tab BroadcastChannel listener
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("teals-crm-sync");
        bc.onmessage = (ev: MessageEvent) => {
          if (ev.data?.type === "AGENT_PERMISSIONS_UPDATED") {
            const targetEmail = (ev.data?.email || "").toLowerCase().trim();
            if (targetEmail === cleanEmail && Array.isArray(ev.data?.assigned_websites)) {
              applyWebsites(ev.data.assigned_websites);
            }
          }
        };
      }
    } catch {}

    return () => {
      if (crmChannel) crmChannel.unsubscribe();
      if (profileChannel) profileChannel.unsubscribe();
      if (extChannel) extChannel.unsubscribe();
      if (bc) bc.close();
    };
  }, [email, isAdm]);

  React.useEffect(() => {
    if (Array.isArray(user?.assigned_websites)) {
      setLiveAssignedWebsites(user.assigned_websites);
    }
  }, [user?.assigned_websites]);

  const validAssigned = liveAssignedWebsites.filter((s) => s && s !== "__none__" && s !== "none" && s !== "all");
  const websitesParam = isAdm
    ? `&sso_websites=all`
    : validAssigned.length > 0
      ? `&sso_websites=${encodeURIComponent(validAssigned.join(','))}`
      : `&sso_websites=none`;

  const targetSubPath = activeView === "monitoring" ? "/dashboard/monitoring" : "/dashboard/chats";

  const defaultRoleTitle = (isAdm || sessionUser?.role === "admin")
    ? "Admin"
    : (sessionUser?.designation || (sessionUser?.role === "manager" ? "Manager" : "Support Specialist"));
  const roleTitle = (isAdm || sessionUser?.role === "admin")
    ? (sessionUser?.role_title && sessionUser.role_title !== "Manager" ? sessionUser.role_title : "Admin")
    : (sessionUser?.role_title || defaultRoleTitle);
  const pseudoName = sessionUser?.pseudo_name || sessionUser?.name?.split(" ")[0] || "Support Agent";
  const pseudoParam = `&sso_pseudo=${encodeURIComponent(pseudoName)}`;
  const roleTitleParam = `&sso_role_title=${encodeURIComponent(roleTitle)}`;

  const livechatBaseUrl = (typeof window !== "undefined" && window.location.hostname.includes("seven.vercel.app"))
    ? "https://teals-livechat-saas-seven.vercel.app"
    : "https://teals-livechat-saas.vercel.app";

  const iframeSrc = email
    ? `${livechatBaseUrl}${targetSubPath}?sso_email=${encodeURIComponent(email)}&sso_name=${encodeURIComponent(name)}&sso_role=${role}${pseudoParam}${roleTitleParam}${websitesParam}`
    : `${livechatBaseUrl}${targetSubPath}`;

  const handleSwitchView = (newView: "chats" | "monitoring") => {
    setActiveView(newView);
    navigate({ search: { view: newView } });
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full min-h-0 space-y-1.5 sm:space-y-2">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 px-1 py-0.5">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <SidebarTrigger className="h-8 w-8 rounded-lg border border-border/60 bg-card/80 hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 -ml-0.5" />
          <div className="min-w-0">
            <h1 className="text-xs sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5 sm:gap-2 truncate">
              <MessageSquare className="size-3.5 sm:size-4.5 text-primary shrink-0" />
              <span className="truncate sm:hidden">LiveChat Hub</span>
              <span className="hidden sm:inline truncate">LiveChat & AI Support Hub</span>
            </h1>
            <p className="hidden sm:block text-xs text-muted-foreground truncate">
              Real-time customer conversations across connected websites with dedicated inboxes.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-border/60 shrink-0">
          <button
            type="button"
            onClick={() => handleSwitchView("chats")}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
              activeView === "chats"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            💬 Active Chats
          </button>
          <button
            type="button"
            onClick={() => handleSwitchView("monitoring")}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
              activeView === "monitoring"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            🟢 Live Visitors
          </button>
        </div>
      </div>

      {/* Embedded LiveChat Console */}
      <div className="relative flex-1 w-full min-h-0 rounded-xl sm:rounded-2xl overflow-hidden border border-border/70 bg-[#070b14] shadow-2xl">
        <iframe
          ref={iframeRef}
          key={iframeSrc}
          src={iframeSrc}
          scrolling="yes"
          className="absolute inset-0 w-full h-full border-0 block"
          title="LiveChat AI Console"
          allow="microphone; camera; autoplay; clipboard-write;"
        />
      </div>
    </div>
  );
}
