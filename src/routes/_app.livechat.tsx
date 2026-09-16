import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useCrm } from "@/lib/crm-store";

export const Route = createFileRoute("/_app/livechat")({
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

  const iframeSrc = user?.email
    ? `https://teals-livechat-saas.vercel.app/dashboard/chats?sso_email=${encodeURIComponent(user.email)}&sso_name=${encodeURIComponent(user.name || '')}&sso_role=${encodeURIComponent(user.role || 'admin')}`
    : "https://teals-livechat-saas.vercel.app/dashboard/chats";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 sm:p-6 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            LiveChat & AI Support Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time customer conversations across 5 connected websites with dedicated inboxes.
          </p>
        </div>
      </div>

      {/* Embedded LiveChat Console */}
      <div className="flex-1 w-full rounded-2xl overflow-hidden border border-border bg-[#070b14] shadow-2xl">
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          title="LiveChat AI Console"
          allow="microphone; camera; autoplay; clipboard-write;"
        />
      </div>
    </div>
  );
}
