import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/crm/AppSidebar";
import { Topbar } from "@/components/crm/Topbar";
import { useCrm } from "@/lib/crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Clock, RefreshCw, LogOut, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, signOut, submitApprovalRequest, checkUserApprovalStatus } = useCrm();
  const navigate = useNavigate();

  const isAdmin = Boolean(user && user.email === "garryamelia6265@gmail.com");
  const isApproved = isAdmin || Boolean(user?.approved);

  // Form states for first-time registration submission
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Polling approval status every 6 seconds if waiting for admin
  useEffect(() => {
    // Background reminder checker — runs check-reminders API every 15s automatically
    const checkReminders = () => {
      fetch("/api/check-reminders").catch(() => {});
    };
    checkReminders();
    const interval = setInterval(checkReminders, 15000);

    // Periodic approval check for non-admin user
    let approvalInterval: NodeJS.Timeout | null = null;
    if (user?.email && !isAdmin && !isApproved) {
      checkUserApprovalStatus(user.email);
      approvalInterval = setInterval(() => {
        checkUserApprovalStatus(user.email);
      }, 6000);
    }

    return () => {
      clearInterval(interval);
      if (approvalInterval) clearInterval(approvalInterval);
    };
  }, [user?.email, isAdmin, isApproved, checkUserApprovalStatus]);

  // Handle initial submission of agent details (Name, Email, Phone)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Please enter your name and phone number.");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitApprovalRequest({
        name: name.trim(),
        email: user?.email ?? "",
        phone: phone.trim(),
      });
      toast.success("Request submitted to Admin for approval!");
    } catch {
      toast.error("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualCheck = async () => {
    if (!user?.email) return;
    setIsChecking(true);
    const approvedNow = await checkUserApprovalStatus(user.email);
    setIsChecking(false);
    if (approvedNow) {
      toast.success("Congratulations! Your account has been approved by the Admin!");
    } else {
      toast.info("Account status is still pending Admin approval.");
    }
  };

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/" });
  };

  // If user is not logged in, redirect to login page
  if (!user) {
    if (typeof window !== "undefined") {
      navigate({ to: "/" });
    }
    return null;
  }

  // ── APPROVAL GATE FOR WORKING AGENTS ─────────────────────────────────────
  if (!isAdmin && !isApproved) {
    // Case 1: User hasn't entered Name & Phone yet -> Show Profile Registration Form
    if (!user.phone) {
      const formValid = name.trim().length > 0 && phone.trim().length >= 7;

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#080b11] px-4 py-12">
          <div className="w-full max-w-md animate-fade-in space-y-6">
            <div className="flex items-center gap-2.5 justify-center">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
              </span>
              <span className="font-display text-xl font-bold text-white">Teals CRM</span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0f141c] p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-bold text-white">Complete Agent Profile</h2>
                <p className="text-xs text-slate-400">
                  Please enter your details to send an access request to Garry Amelia (Admin).
                </p>
              </div>

              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div className="space-y-2 text-left">
                  <Label className="text-xs font-semibold text-slate-300">
                    Full Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="rounded-xl border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2 text-left">
                  <Label className="text-xs font-semibold text-slate-300">Email Address (Google OAuth)</Label>
                  <Input
                    readOnly
                    value={user.email}
                    className="rounded-xl border-slate-800 bg-slate-950 text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2 text-left">
                  <Label className="text-xs font-semibold text-slate-300">
                    Phone Number <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    className="rounded-xl border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-500"
                  />
                  {phone.trim().length > 0 && phone.trim().length < 7 && (
                    <p className="text-[11px] text-red-400 mt-1">Please enter a valid phone number.</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !formValid}
                  className="w-full rounded-xl bg-primary py-6 text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Submit for Admin Approval →"}
                </Button>

                {!formValid && (
                  <p className="text-center text-[11px] text-slate-500">
                    Fill in your full name and phone number to continue.
                  </p>
                )}
              </form>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <LogOut className="size-3.5" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Case 2: User has submitted profile -> Show Waiting for Approval Screen
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080b11] px-4 py-12">
        <div className="w-full max-w-lg animate-fade-in space-y-6">
          <div className="flex items-center gap-2.5 justify-center">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <span className="font-display text-xl font-bold text-white">Teals CRM</span>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-[#0f141c] p-8 shadow-2xl text-center space-y-6">
            <div className="relative mx-auto grid size-20 place-items-center rounded-full bg-amber-500/10 border border-amber-500/30">
              <Clock className="size-10 text-amber-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                🟡 Account Approval Pending
              </span>
              <h2 className="font-display text-2xl font-bold text-white">Access Requires Admin Approval</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Your request has been submitted. As soon as Garry Amelia (Admin) approves your request in Settings, you will automatically get access to your dashboard.
              </p>
            </div>

            {/* Submitted Info Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Applicant Name:</span>
                <span className="font-semibold text-white">{user.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Email:</span>
                <span className="font-semibold text-white">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-semibold text-white">{user.phone}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleManualCheck}
                disabled={isChecking}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs py-5"
              >
                <RefreshCw className={`mr-1.5 size-3.5 ${isChecking ? "animate-spin" : ""}`} />
                {isChecking ? "Checking..." : "Check Approval Status"}
              </Button>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="rounded-xl border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white text-xs py-5"
              >
                <LogOut className="mr-1.5 size-3.5" /> Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── NORMAL APPROVED WORKSPACE ──────────────────────────────────────────────
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
