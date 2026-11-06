import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, Loader2, ArrowLeft, Mail, ArrowRight, Lock, Eye, EyeOff } from "lucide-react";
import { signInWithGoogle } from "@/lib/supabase";
import { useCrm } from "@/lib/crm-store";
import { isAdminEmail } from "@/lib/crm-data";
import { getUserAccessInfo } from "@/lib/project-management-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Teals CRM | AI Sales Workspace" },
      {
        name: "description",
        content:
          "Sign in to Teals CRM, the AI-powered sales workspace for lead management, follow-ups and automated outreach.",
      },
      { property: "og:title", content: "Sign in — Teals CRM" },
      {
        property: "og:description",
        content: "AI-powered CRM for modern sales teams: leads, follow-ups, and automated email.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { user, signIn } = useCrm();
  const navigate = useNavigate();

  const getDestinationPath = (u: any) => {
    if (!u) return "/dashboard";
    try {
      const cached = localStorage.getItem("teals_crm_departments");
      const depts = cached ? JSON.parse(cached) : [];
      const access = getUserAccessInfo(u, depts);
      if (access.isProductionAgent || access.isEcommerceAgent) {
        return "/projects";
      }
    } catch {}
    return "/dashboard";
  };

  // If user is already logged in, redirect to destination
  useEffect(() => {
    if (user && user.email) {
      navigate({ to: getDestinationPath(user) });
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { data, error } = await signInWithGoogle();
      if (data?.url) {
        // Direct browser navigation to official Google OAuth screen
        window.location.href = data.url;
      } else if (error) {
        console.error("Google auth error:", error);
        toast.error("Google login failed: " + error.message);
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      toast.error("Google sign in failed");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPassword = passwordInput.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!cleanPassword) {
      toast.error("Please enter your company password.");
      return;
    }

    // Company password enforcement: @Teals@123@
    if (cleanPassword !== "@Teals@123@") {
      toast.error("Incorrect password. Access denied.");
      return;
    }

    // Allowed domains / whitelist check: Must be @teals.co or a registered Super Admin
    const isTealsDomain = cleanEmail.endsWith("@teals.co");
    const isAuthorizedAdmin = isAdminEmail(cleanEmail);

    if (!isTealsDomain && !isAuthorizedAdmin) {
      toast.error("Access restricted. Only @teals.co company emails and authorized admins are permitted.");
      return;
    }

    setIsEmailLoading(true);
    try {
      await signIn(cleanEmail);
      toast.success("Welcome back to Teals CRM!");
    } catch (err: any) {
      toast.error("Sign in notice: " + (err.message || "Failed to sign in"));
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr] bg-[#080b11]">
      {/* Left Half: Blue Branding Section */}
      <section className="relative hidden overflow-hidden bg-primary/95 mesh-bg p-12 lg:flex lg:flex-col lg:justify-between text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon-192.png?v=3"
              alt="Teals CRM Logo"
              className="size-9 rounded-xl object-cover shadow-md border border-white/15"
            />
            <span className="font-display text-lg font-bold">Teals CRM</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/" })}
            className="text-primary-foreground/80 hover:text-white hover:bg-white/10 text-xs gap-1.5 font-medium rounded-xl"
          >
            <ArrowLeft className="size-3.5" /> Back to Home
          </Button>
        </div>

        <div className="max-w-lg">
          <h1 className="font-display text-4xl font-bold leading-tight xl:text-5xl">
            The AI workspace where pipeline actually moves.
          </h1>
          <p className="mt-5 text-base text-primary-foreground/75">
            Import leads, automate outreach, and never miss a follow-up. Built for sales teams
            that live in their CRM.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-4">
            {[
              ["42%", "Faster response"],
              ["3.1x", "More meetings"],
              ["18h", "Saved / week"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur-sm">
                <dt className="font-display text-2xl font-bold">{v}</dt>
                <dd className="mt-1 text-xs text-primary-foreground/70">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="flex items-center gap-2 text-xs text-primary-foreground/70">
          <ShieldCheck className="size-4" /> SOC 2 Type II · GDPR ready · SSO supported
        </p>
      </section>

      {/* Right Half: Sign-In Panel (Google + Email) */}
      <section className="flex flex-col items-center justify-center px-5 py-12 sm:px-10 bg-[#080b11]">
        <div className="w-full max-w-md animate-fade-in space-y-7">
          <div className="flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <img
                src="/icon-192.png?v=3"
                alt="Teals CRM Logo"
                className="size-9 rounded-xl object-cover shadow-md border border-white/15"
              />
              <span className="font-display text-lg font-bold text-white">Teals CRM</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/" })}
              className="text-slate-400 hover:text-white text-xs gap-1.5"
            >
              <ArrowLeft className="size-3.5" /> Home
            </Button>
          </div>

          <div>
            <h2 className="font-display text-3xl font-bold text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in with your Google account or work email to access your CRM.
            </p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-7 backdrop-blur-md shadow-2xl space-y-6">
            {/* 1. Google OAuth Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isEmailLoading}
                className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-100 hover:shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-slate-900" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="size-4.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. Or Divider */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <span className="relative bg-[#0d111a] px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 rounded-full border border-white/5">
                or sign in with email
              </span>
            </div>

            {/* 3. Direct Email & Password Sign-In Form */}
            <form onSubmit={handleEmailSignIn} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Work Email</span>
                  <span className="text-[10px] text-slate-400 font-mono">@teals.co</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@teals.co"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Company Password</span>
                  <span className="text-[10px] text-slate-500">Master Access Key</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter company password"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isEmailLoading || isGoogleLoading || !emailInput || !passwordInput}
                className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-95 hover:shadow-violet-500/30 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isEmailLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-white" />
                    <span>Verifying Access...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to CRM</span>
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-xs text-emerald-400">
              <span className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                Multi-Agent Sync & Live Whitelist Active
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500">
            By signing in, you agree to our terms and privacy policy.
          </p>
        </div>
      </section>
    </div>
  );
}
