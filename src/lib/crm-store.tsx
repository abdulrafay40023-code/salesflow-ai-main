import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { createPendingSignup, getPendingSignupByEmail } from "@/lib/pending-signups";
import {
  agents,
  seedFollowUps,
  seedLeads,
  ADMIN_EMAILS,
  isAdminEmail,
  type FollowUp,
  type Lead,
  type LeadStatus,
} from "./crm-data";

export type SessionUser = {
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "agent";
  approved?: boolean;
  status?: "unsubmitted" | "pending" | "approved" | "rejected";
};

type CrmContextValue = {
  user: SessionUser | null;
  signIn: (email: string, role: "admin" | "agent") => void;
  signOut: () => void;
  submitApprovalRequest: (info: { name: string; email: string; phone: string }) => Promise<void>;
  checkUserApprovalStatus: (email: string) => Promise<boolean>;
  leads: Lead[];
  visibleLeads: Lead[];
  addLeads: (leads: Lead[]) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  addNote: (id: string, note: string) => void;
  followUps: FollowUp[];
  visibleFollowUps: FollowUp[];
  addFollowUp: (f: Omit<FollowUp, "id">) => void;
  toggleFollowUp: (id: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  isAuthLoading: boolean;
};


const CrmContext = createContext<CrmContextValue | null>(null);

const STORAGE_KEY = "teals-crm-session";
const ADMIN_EMAIL = "garryamelia6265@gmail.com";

// ── Helpers ──────────────────────────────────────────────────────────────────

function saveSession(u: SessionUser) {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch {}
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch {}
}

function loadSession(): SessionUser | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SessionUser;
  } catch {}
  return null;
}

function clearSession() {
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch {}
  try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function CrmProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [theme] = useState<"dark">("dark");


  // ── Sync user profile to Supabase DB ───────────────────────────────────────
  // Only syncs DB if user is admin OR profile already exists (approved)
  const syncProfileToSupabase = useCallback(async (u: SessionUser) => {
    if (!u.email) return;
    try {
      const isMainAdmin = isAdminEmail(u.email);
      const adminNames: Record<string, string> = {
        "garryamelia6265@gmail.com": "Garry Amelia",
        "tzafar04@gmail.com": "T Zafar",
        "annusraees@gmail.com": "Annus Raees",
      };
      const name = u.name || adminNames[u.email.toLowerCase()] || u.email.split("@")[0];

      const { data: existingProf } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .eq("email", u.email)
        .maybeSingle();

      // Only admin or already-approved users get profile updates/inserts
      if (isMainAdmin) {
        const meta = JSON.stringify({ phone: u.phone || "", approved: true, status: "approved" });
        if (existingProf) {
          await supabase
            .from("profiles")
            .update({ full_name: name, avatar_url: meta, role: "admin" })
            .eq("email", u.email);
        } else {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user?.id) {
            await supabase.from("profiles").upsert({
              id: authData.user.id,
              email: u.email,
              full_name: name,
              avatar_url: meta,
              role: "admin",
            });
          }
        }
      } else if (existingProf) {
        // Read values from DB profile if existing
        let phone = u.phone || "";
        let approved = false;
        let status: SessionUser["status"] = "unsubmitted";

        if (existingProf.avatar_url) {
          try {
            const parsed = JSON.parse(existingProf.avatar_url);
            if (parsed.phone) phone = parsed.phone;
            approved = Boolean(parsed.approved);
            status = parsed.status || (approved ? "approved" : "unsubmitted");
          } catch {}
        }

        setUser((prev) => {
          if (!prev || prev.email !== u.email) return prev;
          const merged: SessionUser = {
            ...prev,
            name: existingProf.full_name || prev.name,
            phone: phone || prev.phone,
            approved,
            status,
          };
          saveSession(merged);
          return merged;
        });
      }
    } catch (err) {
      console.log("Profile sync notice:", err);
    }
  }, []);

  // ── Submit approval request (agent form) ───────────────────────────────────
  // Creates record ONLY in pending_signups table, NOT in profiles table!
  const submitApprovalRequest = useCallback(
    async ({ name, email, phone }: { name: string; email: string; phone: string }) => {
      // First update UI immediately so agent sees the lock screen right away
      const pendingUser: SessionUser = {
        name,
        email,
        phone,
        role: "agent",
        approved: false,
        status: "pending",
      };
      setUser(pendingUser);
      saveSession(pendingUser);

      try {
        await createPendingSignup({ name, email, phone });
      } catch (err) {
        console.log("Approval submission notice:", err);
      }
    },
    []
  );

  // ── Poll for admin approval ─────────────────────────────────────────────────
  const checkUserApprovalStatus = useCallback(async (email: string): Promise<boolean> => {
    if (isAdminEmail(email)) return true;
    try {
      // 1. Check if profile exists in profiles table (created ONLY when admin approves)
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, role")
        .eq("email", email)
        .maybeSingle();

      if (prof) {
        let phone = "";
        let approved = false;
        let status: SessionUser["status"] = "unsubmitted";

        if (prof.avatar_url) {
          try {
            const parsed = JSON.parse(prof.avatar_url);
            phone = parsed.phone || "";
            approved = Boolean(parsed.approved);
            status = parsed.status || (approved ? "approved" : "unsubmitted");
          } catch {}
        }

        if (approved) {
          setUser((prev) => {
            if (!prev || prev.email !== email) return prev;
            const next: SessionUser = {
              ...prev,
              name: prof.full_name || prev.name,
              phone: phone || prev.phone,
              approved: true,
              status: "approved",
            };
            saveSession(next);
            return next;
          });
          return true;
        }
      }

      // 2. Check pending signups table (only if status is actively pending)
      const pendingReq = await getPendingSignupByEmail(email);

      if (pendingReq && pendingReq.status === "pending") {
        setUser((prev) => {
          if (!prev || prev.email !== email) return prev;
          const next: SessionUser = {
            ...prev,
            name: pendingReq.name || prev.name,
            phone: pendingReq.phone || prev.phone,
            approved: false,
            status: "pending",
          };
          saveSession(next);
          return next;
        });
        return false;
      }

      // 3. No approved profile and no pending request in DB (e.g. user was removed/rejected by admin)
      setUser((prev) => {
        if (!prev || prev.email !== email) return prev;
        const resetUser: SessionUser = {
          name: "",
          email,
          phone: "",
          role: "agent",
          approved: false,
          status: "unsubmitted",
        };
        saveSession(resetUser);
        return resetUser;
      });
      return false;
    } catch {
      return false;
    }
  }, []);


  // ── Bootstrap on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.add("dark");

    // Step 1: Restore from session/localStorage immediately
    const stored = loadSession();
    if (stored) {
      // Non-admin user MUST NOT be treated as approved until live DB verification!
      if (!isAdminEmail(stored.email)) {
        stored.approved = false;
      }
      setUser(stored);
      setIsAuthLoading(false);
      if (stored.email && !isAdminEmail(stored.email)) {
        checkUserApprovalStatus(stored.email);
      }
    }

    // Step 2: Check Supabase session to complete OAuth callback processing
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !stored) {
        setIsAuthLoading(false);
      }
    }).catch(() => {
      setIsAuthLoading(false);
    });

    // Step 3: Listen to Supabase auth state changes (Google OAuth callback etc.)
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const email = session.user.email ?? "";
          const isMainAdmin = isAdminEmail(email);
          const name =
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            (email === "tzafar04@gmail.com" ? "T Zafar" : email === ADMIN_EMAIL ? "Garry Amelia" : email.split("@")[0]) ||
            "Working Agent";

          // Preserve existing session status — don't reset "pending" to "unsubmitted" on refresh
          const existing = loadSession();
          let preservedStatus: SessionUser["status"] = "unsubmitted";
          let preservedPhone: string | undefined = undefined;
          let preservedName: string = name;

          if (existing && existing.email === email) {
            preservedStatus = existing.status ?? "unsubmitted";
            preservedPhone = existing.phone;
            if (existing.name) preservedName = existing.name;
          }

          const googleUser: SessionUser = {
            name: preservedName,
            email,
            role: isMainAdmin ? "admin" : "agent",
            approved: isMainAdmin ? true : false,
            status: isMainAdmin ? "approved" : preservedStatus,
            phone: preservedPhone,
          };

          setUser(googleUser);
          saveSession(googleUser);

          // Sync to DB & verify approval status
          if (isMainAdmin) {
            syncProfileToSupabase(googleUser);
          } else {
            checkUserApprovalStatus(email).then((approved) => {
              if (!approved) {
                // Instantly remove unapproved Google OAuth user from Supabase auth.users & sign out
                fetch("/api/clean-unapproved-auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, id: session.user.id }),
                }).catch(() => {});

                supabase.auth.signOut().catch(() => {});
              }
            });
          }
        }
        setIsAuthLoading(false);
      });
      subscription = authListener.subscription;
    } catch {
      console.log("Auth listener initialized safely");
      setIsAuthLoading(false);
    }


    return () => { subscription?.unsubscribe(); };
  }, [syncProfileToSupabase]);

  // ── signIn (kept for fallback, not exposed on login page anymore) ──────────
  const signIn = useCallback((email: string, role: "admin" | "agent") => {
    const isMainAdmin = isAdminEmail(email);
    const next: SessionUser = {
      name: isMainAdmin ? (email === "tzafar04@gmail.com" ? "T Zafar" : "Garry Amelia") : email.split("@")[0] || "Sales Agent",
      email,
      role: isMainAdmin ? "admin" : role,
      approved: isMainAdmin ? true : false,
      status: isMainAdmin ? "approved" : "unsubmitted",
    };
    setUser(next);
    saveSession(next);
    syncProfileToSupabase(next);
  }, [syncProfileToSupabase]);

  // ── signOut ────────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    setUser(null);
    clearSession();
    supabase.auth.signOut().catch(() => {});
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = useMemo<CrmContextValue>(() => {
    const scoped = <T extends { agent: string }>(items: T[]) =>
      user?.role === "agent" ? items.filter((i) => i.agent === user.name) : items;

    return {
      user,
      signIn,
      signOut,
      submitApprovalRequest,
      checkUserApprovalStatus,
      leads,
      visibleLeads: scoped(leads),
      addLeads: (incoming) => setLeads((prev) => [...incoming, ...prev]),
      updateLead: (id, patch) =>
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))),
      addNote: (id, note) =>
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, notes: [note, ...l.notes] } : l)),
        ),
      followUps,
      visibleFollowUps: scoped(followUps),
      addFollowUp: (f) =>
        setFollowUps((prev) => [...prev, { ...f, id: `FU-${Date.now()}` }]),
      toggleFollowUp: (id) =>
        setFollowUps((prev) =>
          prev.map((f) => (f.id === id ? { ...f, completed: !f.completed } : f)),
        ),
      theme,
      toggleTheme: () => {},
      isAuthLoading,
    };
  }, [user, isAuthLoading, leads, followUps, theme, signIn, signOut, submitApprovalRequest, checkUserApprovalStatus]);


  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

export const statusTone: Record<LeadStatus, string> = {
  new: "bg-blue-500/12 text-blue-400 border-blue-500/25",
  no_answer: "bg-slate-500/12 text-slate-400 border-slate-500/25",
  contacted: "bg-purple-500/12 text-purple-400 border-purple-500/25",
  replied: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  booked: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  booking_cancelled: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  won: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
};
