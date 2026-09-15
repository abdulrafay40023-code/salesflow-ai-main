import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { 
  Sparkles, 
  ShieldCheck, 
  PhoneCall, 
  Mail, 
  Calendar, 
  Globe, 
  Headphones, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  TrendingUp, 
  Clock, 
  Bot, 
  Lock, 
  Users, 
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrm } from "@/lib/crm-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Teals CRM — AI-Powered Autonomous Sales Workspace" },
      {
        name: "description",
        content:
          "Teals CRM is the autonomous sales workspace with 1-click AI outbound calling, automated email sequences, live geolocation tracking, and calendar booking.",
      },
      { property: "og:title", content: "Teals CRM — AI-Powered Autonomous Sales Workspace" },
      {
        property: "og:description",
        content: "1-Click AI calling, automated follow-ups, and instant demo bookings for high-velocity sales teams.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { user } = useCrm();

  const handleGetStarted = () => {
    if (user && user.email) {
      navigate({ to: "/leads" });
    } else {
      navigate({ to: "/login" });
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 selection:bg-violet-600 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Glow Ambient Highlights */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-violet-600/20 via-indigo-600/10 to-transparent blur-[140px] rounded-full"></div>
        <div className="absolute top-[45%] -left-40 w-[600px] h-[400px] bg-blue-600/10 blur-[130px] rounded-full"></div>
        <div className="absolute top-[65%] -right-40 w-[600px] h-[400px] bg-emerald-600/10 blur-[130px] rounded-full"></div>
      </div>

      {/* ── STICKY TOP NAVBAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07090e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-violet-600/30 group-hover:scale-105 transition-transform">
              <Sparkles className="size-5 text-white" />
            </span>
            <div>
              <span className="font-display text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Teals CRM
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase tracking-widest">
                  AI Suite
                </span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">AI-Powered Sales Workspace</p>
            </div>
          </div>

          {/* Center Navigation Links (Hidden on small screens) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#calling" className="hover:text-white transition-colors">1-Click AI Dialer</a>
            <a href="#automation" className="hover:text-white transition-colors">Automations</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/login" })}
              className="text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl px-4"
            >
              Sign In
            </Button>
            <Button
              size="sm"
              onClick={handleGetStarted}
              className="text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl px-5 shadow-lg shadow-violet-600/25 active:scale-95 transition-all gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-16 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Innovation Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs font-semibold backdrop-blur-md mb-8 animate-fade-in">
          <Sparkles className="size-3.5 text-violet-400" />
          <span>Next-Generation Autonomous AI Sales Engine</span>
        </div>

        {/* Hero Title */}
        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1] sm:leading-[1.1]">
          The AI workspace where pipeline <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-blue-400 bg-clip-text text-transparent">actually moves.</span>
        </h1>

        {/* Hero Description */}
        <p className="mt-6 sm:mt-8 text-base sm:text-xl text-slate-300/90 max-w-3xl mx-auto leading-relaxed font-normal">
          Empower your sales team with <strong>1-click autonomous outbound voice calling</strong>, automated multi-stage email sequences, instant calendar booking, and accurate geolocation intelligence.
        </p>

        {/* Hero CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Button
            size="lg"
            onClick={handleGetStarted}
            className="w-full sm:w-auto h-13 px-8 text-base font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl shadow-xl shadow-violet-600/30 active:scale-95 transition-all gap-2"
          >
            <span>Launch Your Workspace</span>
            <ArrowRight className="size-4.5" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate({ to: "/login" })}
            className="w-full sm:w-auto h-13 px-7 text-base font-semibold border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-slate-200 rounded-2xl backdrop-blur-sm"
          >
            Access CRM Dashboard
          </Button>
        </div>

        {/* Key Metrics Stats Grid */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { metric: "42%", label: "Faster Lead Response", desc: "Instant automated outreach" },
            { metric: "3.1x", label: "More Demo Bookings", desc: "Autonomous phone negotiation" },
            { metric: "18h", label: "Saved Weekly / Rep", desc: "Zero manual data entry" },
            { metric: "100%", label: "Accurate Geolocation", desc: "Real ISP device detection" },
          ].map((item, idx) => (
            <div 
              key={idx}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:border-violet-500/30 transition-all text-left"
            >
              <div className="font-display text-3xl sm:text-4xl font-extrabold text-white">{item.metric}</div>
              <div className="mt-1 text-sm font-bold text-slate-200">{item.label}</div>
              <div className="mt-0.5 text-xs text-slate-400">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE HIGHLIGHTS GRID ──────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-20 bg-white/[0.01] border-t border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-display text-xs sm:text-sm font-bold uppercase tracking-widest text-violet-400">
              Complete Sales Suite
            </h2>
            <p className="mt-3 font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Everything high-performing sales teams need.
            </p>
            <p className="mt-4 text-base text-slate-400">
              Built from the ground up to eliminate repetitive follow-ups and book qualified meetings automatically.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1: 1-Click AI Power Calling */}
            <div id="calling" className="p-7 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-violet-500/40 transition-all hover:shadow-2xl hover:shadow-violet-950/30 space-y-4 group">
              <div className="size-12 rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30 grid place-items-center group-hover:scale-110 transition-transform">
                <PhoneCall className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-white">1-Click AI Power Calling</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Click "Call" on any lead and our AI Voice Executive autonomously dials the prospect, pitches your solution, spell-verifies client emails letter-by-letter, and confirms meeting slots without blocking your screen.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Live second-by-second call timer</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> 15-second ringing cutoff with No Answer tagging</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Multi-call parallel dialing capability</li>
              </ul>
            </div>

            {/* Feature 2: Automated Email Sequences */}
            <div id="automation" className="p-7 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-indigo-500/40 transition-all hover:shadow-2xl hover:shadow-indigo-950/30 space-y-4 group">
              <div className="size-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 grid place-items-center group-hover:scale-110 transition-transform">
                <Mail className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Automated Email Sequences</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Send beautiful welcome emails with 1-click booking cards, followed by automated 24-hour, 48-hour, and 72-hour intelligent follow-ups that stop automatically when a reply is received.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Instant welcome emails upon lead import</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> IMAP reply detection & live status updating</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Automated calendar invite delivery</li>
              </ul>
            </div>

            {/* Feature 3: Real Device Geolocation */}
            <div className="p-7 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-blue-500/40 transition-all hover:shadow-2xl hover:shadow-blue-950/30 space-y-4 group">
              <div className="size-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 grid place-items-center group-hover:scale-110 transition-transform">
                <Globe className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Device Geolocation Intelligence</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Filter out datacenter bots and image prefetch servers. Teals CRM locks down the client’s real ISP IP address and auto-resolves their exact Country and Flag right in your pipeline.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Bot & GoogleImageProxy filtering</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Auto country & phone flag assignment</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Live IP Address column sync</li>
              </ul>
            </div>

            {/* Feature 4: Calendar & Zoom Reminders */}
            <div className="p-7 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/40 transition-all hover:shadow-2xl hover:shadow-emerald-950/30 space-y-4 group">
              <div className="size-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 grid place-items-center group-hover:scale-110 transition-transform">
                <Calendar className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Zoom Demos & Reminders</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Never lose a meeting to no-shows. Automatically generate Zoom links, timezone-adjusted calendar invites, and dispatch 24h, 1h, and 5-minute countdown reminders to prospects and assigned agents.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Client & Agent local time coordination</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Automated 24h / 1h / 5m reminder schedule</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Instant 1-click meeting join links</li>
              </ul>
            </div>

            {/* Feature 5: Audio Recordings & Transcripts */}
            <div className="p-7 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-amber-500/40 transition-all hover:shadow-2xl hover:shadow-amber-950/30 space-y-4 group">
              <div className="size-12 rounded-2xl bg-amber-600/20 text-amber-400 border border-amber-500/30 grid place-items-center group-hover:scale-110 transition-transform">
                <Headphones className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Call Recordings & Transcripts</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Every AI outbound phone call is recorded with high-fidelity audio and full transcript analysis. Review call logs, listen back to prospect objections, and inspect structured booking data.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Centralized "All Call Recordings" station</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Spoken email & date extraction</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Full transcript review per lead</li>
              </ul>
            </div>

            {/* Feature 6: Multi-Agent & Security */}
            <div id="security" className="p-7 rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-violet-500/40 transition-all hover:shadow-2xl hover:shadow-violet-950/30 space-y-4 group">
              <div className="size-12 rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30 grid place-items-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Enterprise Security & Team Sync</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Assign leads to specific agent pools, track rep performance, enforce admin approval gating for new signups, and keep your customer database securely synchronized in real-time.
              </p>
              <ul className="space-y-2 text-xs text-slate-400 pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Google OAuth SSO integration</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> Admin approval gating for new agents</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" /> SOC 2 Type II & GDPR ready architecture</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS STEPS ───────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-display text-xs sm:text-sm font-bold uppercase tracking-widest text-violet-400">
            Workflow Architecture
          </h2>
          <p className="mt-3 font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            How Teals CRM closes deals on autopilot.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] relative">
            <span className="font-mono text-5xl font-extrabold text-white/10 absolute top-6 right-6">01</span>
            <div className="size-10 rounded-xl bg-violet-600/20 text-violet-400 grid place-items-center font-bold mb-5">
              1
            </div>
            <h3 className="text-xl font-bold text-white">Import & Organize Leads</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Upload spreadsheets (Excel/CSV) or sync Meta ad leads. Leads are instantly assigned with country codes and assigned agents.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] relative">
            <span className="font-mono text-5xl font-extrabold text-white/10 absolute top-6 right-6">02</span>
            <div className="size-10 rounded-xl bg-indigo-600/20 text-indigo-400 grid place-items-center font-bold mb-5">
              2
            </div>
            <h3 className="text-xl font-bold text-white">Launch AI Calls & Sequences</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Click 1-click Call to let the AI voice executive dial the prospect, or let automated email follow-up drip sequences run automatically.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] relative">
            <span className="font-mono text-5xl font-extrabold text-white/10 absolute top-6 right-6">03</span>
            <div className="size-10 rounded-xl bg-emerald-600/20 text-emerald-400 grid place-items-center font-bold mb-5">
              3
            </div>
            <h3 className="text-xl font-bold text-white">Demos Booked & Pipeline Moves</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              When a demo slot is agreed upon, meeting invites and Zoom links are dispatched, and the lead status automatically updates to Booked!
            </p>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA BANNER ────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-b from-violet-900/40 to-indigo-950/40 border border-violet-500/30 p-10 sm:p-14 text-center shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 size-64 bg-violet-600/30 blur-3xl rounded-full"></div>
          <div className="absolute -bottom-24 -left-24 size-64 bg-indigo-600/30 blur-3xl rounded-full"></div>

          <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight relative z-10">
            Ready to accelerate your sales pipeline?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto relative z-10">
            Join modern sales teams that leverage autonomous AI agents to book more meetings and close more deals.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="w-full sm:w-auto h-13 px-8 text-base font-bold bg-white text-slate-950 hover:bg-slate-100 rounded-2xl shadow-xl active:scale-95 transition-all gap-2"
            >
              <span>Get Started Now</span>
              <ArrowRight className="size-4.5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate({ to: "/login" })}
              className="w-full sm:w-auto h-13 px-7 text-base font-semibold border-white/20 bg-white/5 hover:bg-white/10 text-white rounded-2xl"
            >
              Sign In to Account
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-violet-600/20 text-violet-400">
              <Sparkles className="size-3.5" />
            </span>
            <span className="font-bold text-slate-300 text-sm">Teals CRM</span>
            <span>&bull; &copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#calling" className="hover:text-white transition-colors">AI Calling</a>
            <a href="#automation" className="hover:text-white transition-colors">Automations</a>
            <span 
              onClick={() => navigate({ to: "/login" })}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Sign In
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
