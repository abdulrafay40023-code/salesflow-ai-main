import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/crm/AppSidebar";
import { Topbar } from "@/components/crm/Topbar";
import { useCrm } from "@/lib/crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Clock, RefreshCw, LogOut, Sparkles, CheckCircle2, Loader2, X, BellRing } from "lucide-react";
import { isAdminEmail } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Department,
  fetchAllDepartments,
  getUserAccessInfo,
} from "@/lib/project-management-store";

const DEPARTMENT_DESIGNATIONS: Record<string, string[]> = {
  "production-house": [
    "Graphic Designer",
    "UI/UX Designer",
    "Frontend Developer",
    "Full-Stack Developer",
    "Backend Developer",
    "Video Editor & Animator",
    "3D Artist / Visualizer",
    "WordPress & Shopify Developer",
    "Other (Custom Designation)",
  ],
  "ecommerce-department": [
    "Shopify Store Specialist / Manager",
    "Amazon FBA Specialist",
    "Product Researcher & Hunter",
    "Product Listing & SEO Optimizer",
    "Order Fulfillment & Customer Support",
    "Store Automation Specialist",
    "E-commerce Operations Specialist",
    "Other (Custom Designation)",
  ],
  "sales-department": [
    "Senior Sales Closer",
    "Lead Generation Specialist",
    "Cold Outreach / Calling Agent",
    "Account Executive",
    "Sales Consultant",
    "Client Relationship Manager",
    "Business Development Representative",
    "Other (Custom Designation)",
  ],
};

const DEFAULT_DESIGNATIONS = [
  "Department Specialist",
  "Team Lead",
  "Operations Associate",
  "Project Coordinator",
  "Other (Custom Designation)",
];

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, signOut, submitApprovalRequest, checkUserApprovalStatus, isAuthLoading } = useCrm();
  const navigate = useNavigate();
  const location = useLocation();
  const isLiveChatRoute = location.pathname.startsWith("/livechat");

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

    const channel = supabase.channel("teals-applayout-depts-sync", {
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
  const isApproved = isAdmin || Boolean(user?.approved);

  // ── ROUTE ACCESS GUARD ───────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading || !user || !isApproved) return;

    const path = location.pathname;

    if (access.isProductionAgent) {
      // Production House working agent: ONLY /projects and /settings
      if (!path.startsWith("/projects") && !path.startsWith("/settings")) {
        navigate({ to: "/projects" });
      }
    } else if (access.isEcommerceAgent) {
      // E-commerce working agent: ONLY /projects, /livechat, and /settings
      if (!path.startsWith("/projects") && !path.startsWith("/livechat") && !path.startsWith("/settings")) {
        navigate({ to: "/projects" });
      }
    } else if (access.isSalesAgent) {
      // Sales agent: Disallowed from /admin, /reports, /meta-leads
      if (path.startsWith("/admin") || path.startsWith("/reports") || path.startsWith("/meta-leads")) {
        navigate({ to: "/dashboard" });
      }
    } else if (access.isManager && !access.isAdmin) {
      // Managers: Disallowed strictly from /admin
      if (path.startsWith("/admin")) {
        navigate({ to: "/dashboard" });
      }
    }
  }, [isAuthLoading, user, isApproved, access, location.pathname, navigate]);

  // Form states for first-time registration submission — ALWAYS EMPTY initially as requested!
  const [name, setName] = useState("");
  const [pseudoName, setPseudoName] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("production-house");
  const [selectedDesignation, setSelectedDesignation] = useState("Graphic Designer");
  const [customDesignation, setCustomDesignation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Sync designation options when department changes
  useEffect(() => {
    const list = DEPARTMENT_DESIGNATIONS[departmentId] || DEFAULT_DESIGNATIONS;
    setSelectedDesignation(list[0]);
    setCustomDesignation("");
  }, [departmentId]);

  // Lead Assignment Popup state for working agents (stays 5 minutes or until closed with X)
  const [assignmentPopup, setAssignmentPopup] = useState<{
    id: string;
    subject: string;
    sentAt: string;
  } | null>(null);

  // Check unread lead assignment notifications for working agents
  useEffect(() => {
    if (!user?.email || isAdmin) return;

    let dismissTimeout: NodeJS.Timeout | null = null;

    const checkAssignmentNotif = async () => {
      try {
        const { data } = await supabase
          .from("emails_sent")
          .select("id, subject, sent_at, status")
          .eq("lead_email", user.email)
          .in("sequence_type", ["lead_assignment", "assignment_notification"])
          .eq("status", "unread")
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          setAssignmentPopup({
            id: data.id,
            subject: data.subject,
            sentAt: data.sent_at,
          });

          // Auto dismiss after 5 minutes (300,000 ms)
          if (dismissTimeout) clearTimeout(dismissTimeout);
          dismissTimeout = setTimeout(() => {
            dismissAssignmentPopup(data.id);
          }, 300000);
        }
      } catch (err) {
        console.error("Assignment notification check error:", err);
      }
    };

    checkAssignmentNotif();
    const pollInterval = setInterval(checkAssignmentNotif, 15000);

    return () => {
      if (dismissTimeout) clearTimeout(dismissTimeout);
      clearInterval(pollInterval);
    };
  }, [user?.email, isAdmin]);

  const dismissAssignmentPopup = async (notifId?: string) => {
    const id = notifId || assignmentPopup?.id;
    setAssignmentPopup(null);
    if (id) {
      try {
        await supabase.from("emails_sent").update({ status: "read" }).eq("id", id);
      } catch {}
    }
  };

  // Redirect unauthenticated users — MUST be before any early returns (Rules of Hooks)
  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate({ to: "/" });
    }
  }, [isAuthLoading, user, navigate]);

  // Polling approval status every 6 seconds if waiting for admin
  useEffect(() => {
    // Background reminder checker — runs check-reminders API every 15s automatically
    const checkReminders = () => {
      fetch("/api/check-reminders").catch(() => {});
    };
    checkReminders();
    const interval = setInterval(checkReminders, 15000);

    // Continuous live approval & eviction check for non-admin working agents
    let approvalInterval: NodeJS.Timeout | null = null;
    let realtimeChannel: any = null;

    if (user?.email && !isAdmin) {
      checkUserApprovalStatus(user.email);
      approvalInterval = setInterval(() => {
        checkUserApprovalStatus(user.email);
      }, 2500);

      realtimeChannel = supabase
        .channel(`crm-guard-${user.email}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => {
            checkUserApprovalStatus(user.email);
          }
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      if (approvalInterval) clearInterval(approvalInterval);
      if (realtimeChannel) realtimeChannel.unsubscribe();
    };
  }, [user?.email, isAdmin, checkUserApprovalStatus]);

  // Handle initial submission of agent details (Name, Pseudo Name, Email, Phone, Department, Designation)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPseudoName = pseudoName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = (user?.email || "").trim();
    const effectiveDesignation =
      selectedDesignation === "Other (Custom Designation)"
        ? customDesignation.trim()
        : selectedDesignation.trim();

    if (!trimmedName || !trimmedPseudoName || !trimmedPhone || !trimmedEmail || !effectiveDesignation) {
      toast.error("Please enter your real name, pseudo name, phone number, and designation.");
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Submit approval request locally & save in persistent session
      await submitApprovalRequest({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        pseudo_name: trimmedPseudoName,
        role_title: effectiveDesignation,
        department_id: departmentId,
        designation: effectiveDesignation,
      });

      // 2. Submit to API to insert in pending_signups and email queues in Supabase
      try {
        await fetch("/api/submit-pending-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            pseudo_name: trimmedPseudoName,
            role_title: effectiveDesignation,
            department_id: departmentId,
            designation: effectiveDesignation,
          }),
        });
      } catch (apiErr) {
        console.log("API submit notice:", apiErr);
      }

      toast.success("Registration submitted to Admin for approval!");
    } catch (err: any) {
      toast.error(err?.message || "Submission failed. Please try again.");
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

  // If auth is still resolving OAuth callback or session, show loading spinner
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080b11]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs text-slate-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // If user is not logged in after auth resolves, return null while redirecting
  if (!user) {
    return null;
  }

  // ── APPROVAL GATE FOR WORKING AGENTS ─────────────────────────────────────
  if (!isAdmin && !isApproved) {
    // Case 1: User hasn't submitted approval request yet or phone missing -> Show Profile Registration Form
    if (user.status !== "pending" || !user.phone) {
      const isCustom = selectedDesignation === "Other (Custom Designation)";
      const formValid =
        name.trim().length > 0 &&
        phone.trim().length >= 7 &&
        (!isCustom || customDesignation.trim().length > 0);

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#080b11] px-4 py-12">
          <div className="w-full max-w-md animate-fade-in space-y-6">
            <div className="flex items-center gap-2.5 justify-center">
              <img
                src="/icon-192.png?v=3"
                alt="Teals CRM Logo"
                className="size-10 rounded-xl object-cover shadow-md border border-white/15"
              />
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
                    Real Name (Full Name) <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your real full name"
                    className="rounded-xl border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-500"
                  />
                  <p className="text-[10px] text-slate-500">Only visible to Admins internally.</p>
                </div>

                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-violet-300">
                      Pseudo Name (Display Name) <span className="text-red-400">*</span>
                    </Label>
                    <span className="text-[10px] text-violet-400 font-medium">Shown to Clients</span>
                  </div>
                  <Input
                    required
                    value={pseudoName}
                    onChange={(e) => setPseudoName(e.target.value)}
                    placeholder="e.g. Jack, Alex, Mike"
                    className="rounded-xl border-violet-500/40 bg-violet-950/20 text-white placeholder:text-slate-500 focus:border-violet-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Website visitors will see this Display Name in live chat to protect your real identity.
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <Label className="text-xs font-semibold text-slate-300">Email Address</Label>
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

                <div className="space-y-2 text-left">
                  <Label className="text-xs font-semibold text-slate-300">
                    Assign to Department <span className="text-red-400">*</span>
                  </Label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="production-house">🎨 Production House (Designers & Developers)</option>
                    <option value="ecommerce-department">🛒 E-commerce Department (Amazon & Shopify)</option>
                    <option value="sales-department">📞 Sales Department (Cold Calling & Closers)</option>
                    {departments
                      .filter((d) => !["production-house", "ecommerce-department", "sales-department"].includes(d.id))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          🏢 {d.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2 text-left">
                  <Label className="text-xs font-semibold text-slate-300">
                    Designation / Role in Department <span className="text-red-400">*</span>
                  </Label>
                  <select
                    value={selectedDesignation}
                    onChange={(e) => setSelectedDesignation(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {(DEPARTMENT_DESIGNATIONS[departmentId] || DEFAULT_DESIGNATIONS).map((desig) => (
                      <option key={desig} value={desig}>
                        {desig}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDesignation === "Other (Custom Designation)" && (
                  <div className="space-y-2 text-left animate-fade-in">
                    <Label className="text-xs font-semibold text-violet-300">
                      Enter Custom Designation <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      required
                      value={customDesignation}
                      onChange={(e) => setCustomDesignation(e.target.value)}
                      placeholder="e.g. Creative Director, WordPress Dev, Media Buyer..."
                      className="rounded-xl border-violet-500/50 bg-slate-900/90 text-white placeholder:text-slate-500 focus:border-violet-500"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !formValid}
                  className="w-full rounded-xl bg-primary py-6 text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Submit for Admin Approval →"}
                </Button>

                {!formValid && (
                  <p className="text-center text-[11px] text-slate-500">
                    Fill in all required fields to continue.
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
            <img
              src="/icon-192.png?v=3"
              alt="Teals CRM Logo"
              className="size-10 rounded-xl object-cover shadow-md border border-white/15"
            />
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
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-semibold text-white">{user.phone}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Department:</span>
                <span className="font-semibold text-violet-300">
                  {user.department_id === "production-house"
                    ? "Production House"
                    : user.department_id === "ecommerce-department"
                    ? "E-commerce Department"
                    : user.department_id === "sales-department"
                    ? "Sales Department"
                    : departments.find((d) => d.id === user.department_id)?.name || "Assigned Department"}
                </span>
              </div>
              {user.designation && (
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Designation:</span>
                  <span className="font-semibold text-emerald-400">💼 {user.designation}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                onClick={handleManualCheck}
                disabled={isChecking}
                className="w-full rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 py-5 transition-all shadow-lg"
              >
                {isChecking ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="size-4 animate-spin" /> Checking Approval...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="size-4" /> Check Approval Status
                  </span>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full text-xs text-slate-400 hover:text-white"
              >
                <LogOut className="size-3.5 mr-1.5" /> Sign Out
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
      <div className="flex min-h-[100dvh] w-full bg-background">
        <AppSidebar />
        <SidebarInset
          className={
            isLiveChatRoute
              ? "min-w-0 bg-transparent flex flex-col h-[100dvh] overflow-hidden"
              : "min-w-0 bg-transparent flex flex-col min-h-[100dvh]"
          }
        >
          {!isLiveChatRoute && <Topbar />}
          {isLiveChatRoute ? (
            <main className="w-full flex-1 h-full min-h-0 p-1 sm:p-2 flex flex-col overflow-hidden">
              <Outlet />
            </main>
          ) : (
            <main className="mx-auto w-full max-w-[1600px] 2xl:max-w-[1800px] flex-1 animate-fade-in px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
              <Outlet />
            </main>
          )}
        </SidebarInset>

      {/* Working Agent 5-Minute Lead Assignment Popup Alert */}
      {assignmentPopup && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-violet-500/40 bg-[#0f141c]/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-400">
                  <Sparkles className="size-4 animate-pulse" />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    New Leads Assigned!
                  </h4>
                  <p className="text-[11px] text-slate-400">5-minute active notification</p>
                </div>
              </div>
              <button
                onClick={() => dismissAssignmentPopup()}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close notification"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
              <p className="font-medium leading-relaxed">{assignmentPopup.subject}</p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] text-slate-500">
                Auto-closes in 5 mins
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-slate-400 hover:text-white"
                  onClick={() => dismissAssignmentPopup()}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  className="h-7 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs"
                  onClick={() => {
                    dismissAssignmentPopup();
                    navigate({ to: "/leads" });
                  }}
                >
                  View Leads
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </SidebarProvider>
  );
}
