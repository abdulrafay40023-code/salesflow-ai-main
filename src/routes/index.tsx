import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ShieldCheck, Loader2 } from "lucide-react";
import { useCrm } from "@/lib/crm-store";
import { signInWithGoogle } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Teals CRM | AI Sales Workspace" },
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
  const { signIn } = useCrm();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [agentEmailInput, setAgentEmailInput] = useState("");

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        // Fallback prompt if Supabase Google OAuth provider is not configured
        const email = prompt("Enter your Gmail address to sign in:", "agent@gmail.com");
        if (email) {
          const trimmed = email.trim();
          signIn(trimmed, trimmed.toLowerCase() === "garryamelia6265@gmail.com" ? "admin" : "agent");
          navigate({ to: "/dashboard" });
        }
      }
    } catch {
      const email = prompt("Enter your Gmail address to sign in:", "agent@gmail.com");
      if (email) {
        const trimmed = email.trim();
        signIn(trimmed, trimmed.toLowerCase() === "garryamelia6265@gmail.com" ? "admin" : "agent");
        navigate({ to: "/dashboard" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = agentEmailInput.trim();
    if (!email) return;
    const isMainAdmin = email.toLowerCase() === "garryamelia6265@gmail.com";
    signIn(email, isMainAdmin ? "admin" : "agent");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr] bg-[#080b11]">
      {/* Left Half: Blue Branding Section */}
      <section className="relative hidden overflow-hidden bg-primary/95 mesh-bg p-12 lg:flex lg:flex-col lg:justify-between text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary-foreground/15">
            <Sparkles className="size-4.5" />
          </span>
          <span className="font-display text-lg font-bold">Teals CRM</span>
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

      {/* Right Half: Sign-In Panel */}
      <section className="flex flex-col items-center justify-center px-5 py-12 sm:px-10 bg-[#080b11]">
        <div className="w-full max-w-md animate-fade-in space-y-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-4.5" />
            </span>
            <span className="font-display text-lg font-bold text-white">Teals CRM</span>
          </div>

          <div>
            <h2 className="font-display text-3xl font-bold text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in with your Google or Gmail account to access your CRM.
            </p>
          </div>

          <div className="rounded-2xl bg-[#0f141c]/90 border border-slate-800/80 p-8 shadow-2xl space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">Sign In</h3>
              <p className="text-xs text-slate-400">Continue with Google OAuth or enter your Gmail</p>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="w-full h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-900 font-semibold text-sm sm:text-base flex items-center justify-center gap-3 transition-all shadow-md cursor-pointer disabled:opacity-75"
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin text-slate-700" />
              ) : (
                <svg className="size-5 shrink-0" viewBox="0 0 24 24">
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
              )}
              <span>Sign in with Google</span>
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative bg-[#0f141c] px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Or Sign In With Gmail / Email
              </span>
            </div>

            <form onSubmit={handleDirectEmailLogin} className="space-y-3">
              <input
                type="email"
                required
                value={agentEmailInput}
                onChange={(e) => setAgentEmailInput(e.target.value)}
                placeholder="Enter email (e.g. adriana@gmail.com)"
                className="w-full h-11 rounded-xl border border-slate-700 bg-slate-900/90 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
              >
                Continue to CRM →
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-900/60 p-3 text-xs text-slate-400 border border-slate-800/50">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <span>Multi-Agent Sync &amp; Live Database Active</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center font-normal">
            By signing in, you agree to our terms and privacy policy.
          </p>
        </div>
      </section>
    </div>
  );
}
