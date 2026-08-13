import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ShieldCheck, ArrowRight, X } from "lucide-react";
import { useCrm } from "@/lib/crm-store";

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
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGmail, setCustomGmail] = useState("");

  const handleGoogleBtnClick = () => {
    // Open Google Account Selector modal instantly
    setShowGoogleModal(true);
  };

  const handleSelectAccount = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const isMainAdmin = trimmed.toLowerCase() === "garryamelia6265@gmail.com";
    signIn(trimmed, isMainAdmin ? "admin" : "agent");
    setShowGoogleModal(false);
    navigate({ to: "/dashboard" });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSelectAccount(customGmail);
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
              Sign in with your Google account to access your CRM.
            </p>
          </div>

          <div className="rounded-2xl bg-[#0f141c]/90 border border-slate-800/80 p-8 shadow-2xl space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">Sign In</h3>
              <p className="text-xs text-slate-400">Continue with Google account</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleBtnClick}
              className="w-full h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-900 font-semibold text-sm sm:text-base flex items-center justify-center gap-3 transition-all shadow-md cursor-pointer"
            >
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
              <span>Sign in with Google</span>
            </button>

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

      {/* Google Account Selection Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0f141c] p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-all"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <svg className="size-7 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <div>
                <h3 className="font-display text-lg font-bold text-white">Sign in with Google</h3>
                <p className="text-xs text-slate-400">Choose an account to continue to Teals CRM</p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleSelectAccount("garryamelia6265@gmail.com")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm border border-primary/30">
                    GA
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                      Garry Amelia <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">Admin</span>
                    </div>
                    <div className="text-xs text-slate-400">garryamelia6265@gmail.com</div>
                  </div>
                </div>
                <ArrowRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => handleSelectAccount("adriana@gmail.com")}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-sm border border-slate-700">
                    AJ
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                      Adriana James <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Working Agent</span>
                    </div>
                    <div className="text-xs text-slate-400">adriana@gmail.com</div>
                  </div>
                </div>
                <ArrowRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <div className="relative my-3 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative bg-[#0f141c] px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Or Use Another Gmail Account
              </span>
            </div>

            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={customGmail}
                onChange={(e) => setCustomGmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full h-11 rounded-xl border border-slate-700 bg-slate-900/90 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Continue with Google Account</span>
                <ArrowRight className="size-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
