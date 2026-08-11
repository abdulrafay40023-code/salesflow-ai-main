import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  agents,
  seedFollowUps,
  seedLeads,
  type FollowUp,
  type Lead,
  type LeadStatus,
} from "./crm-data";
import { supabase } from "./supabase";

export type SessionUser = {
  name: string;
  email: string;
  role: "admin" | "agent";
};

type CrmContextValue = {
  user: SessionUser | null;
  signIn: (email: string, role: "admin" | "agent") => void;
  signOut: () => void;
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
};

const CrmContext = createContext<CrmContextValue | null>(null);

const STORAGE_KEY = "teals-crm-session";

const defaultAdminUser: SessionUser = {
  name: "Garry Amelia",
  email: "garryamelia6265@gmail.com",
  role: "admin",
};

export function CrmProvider({ children }: { children: ReactNode }) {
  // Start with defaultAdminUser - localStorage is loaded in useEffect (client-only)
  const [user, setUser] = useState<SessionUser>(defaultAdminUser);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const syncProfileToSupabase = useCallback(async (u: SessionUser) => {
    if (!u.email) return;
    try {
      const role = u.email === "garryamelia6265@gmail.com" ? "admin" : "agent";
      const name = u.name || u.email.split("@")[0];

      // Attempt to register/update in profiles table if auth user exists
      let userId: string | null = null;
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.email === u.email) {
        userId = authData.user.id;
      } else {
        const { data: signUpData } = await supabase.auth.signUp({
          email: u.email,
          password: "TealsAgentPassword123!",
        });
        userId = signUpData?.user?.id ?? null;
      }

      if (userId) {
        await supabase.from("profiles").upsert(
          {
            id: userId,
            email: u.email,
            full_name: name,
            role,
          },
          { onConflict: "email" }
        );
      }
    } catch (err) {
      console.log("Profile sync notice:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SessionUser;
        setUser(parsed);
        syncProfileToSupabase(parsed);
      } else {
        syncProfileToSupabase(defaultAdminUser);
      }
      const t = window.localStorage.getItem("teals-crm-theme");
      if (t === "dark" || t === "light") setTheme(t);
    } catch {
      /* ignore */
    }

    // Note: Database is managed manually via Supabase dashboard or SQL editor

    // Listen for Real Google Auth Callback via Supabase
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const email = session.user.email ?? "";
          const name =
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            email.split("@")[0] ||
            "Working Agent";
          // Only garryamelia6265@gmail.com is admin, everyone else is agent
          const role: "admin" | "agent" = email === "garryamelia6265@gmail.com" ? "admin" : "agent";
          const googleUser: SessionUser = {
            name,
            email,
            role,
          };
          setUser(googleUser);
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(googleUser));
          } catch {
            /* ignore */
          }
          syncProfileToSupabase(googleUser);
        }
      });
      subscription = authListener.subscription;
    } catch (e) {
      console.log("Auth listener initialized safely");
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [syncProfileToSupabase]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem("teals-crm-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const signIn = useCallback((email: string, role: "admin" | "agent") => {
    const defaultName = role === "admin" ? "Garry Amelia" : email.split("@")[0] || "Sales Agent";
    const userRole = email === "garryamelia6265@gmail.com" ? "admin" : role;
    const next: SessionUser = { name: defaultName, email, role: userRole };
    setUser(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    syncProfileToSupabase(next);
  }, [syncProfileToSupabase]);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<CrmContextValue>(() => {
    const scoped = <T extends { agent: string }>(items: T[]) =>
      user?.role === "agent" ? items.filter((i) => i.agent === user.name) : items;

    return {
      user,
      signIn,
      signOut,
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
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    };
  }, [user, leads, followUps, theme, signIn, signOut]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

export const statusTone: Record<LeadStatus, string> = {
  new: "bg-info/12 text-info border-info/25",
  contacted: "bg-primary/12 text-primary border-primary/25",
  qualified: "bg-chart-5/12 text-chart-5 border-chart-5/25",
  meeting: "bg-warning/15 text-warning border-warning/30",
  won: "bg-success/12 text-success border-success/25",
  lost: "bg-destructive/10 text-destructive border-destructive/25",
};
