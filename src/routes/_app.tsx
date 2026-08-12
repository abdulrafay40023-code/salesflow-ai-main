import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/crm/AppSidebar";
import { Topbar } from "@/components/crm/Topbar";
import { useCrm } from "@/lib/crm-store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  useEffect(() => {
    // Background reminder checker — runs check-reminders API every 15s automatically
    const checkReminders = () => {
      fetch("/api/check-reminders").catch(() => {});
    };
    checkReminders();
    const interval = setInterval(checkReminders, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-transparent">
          <Topbar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 animate-fade-in px-4 py-6 md:px-6 lg:py-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
