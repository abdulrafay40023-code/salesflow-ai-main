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
  phone?: string;
  role: "admin" | "agent";
  approved?: boolean;
  status?: "pending" | "approved" | "rejected";
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
};

const CrmContext = createContext<CrmContextValue | null>(null);

const STORAGE_KEY = "teals-crm-session";

const defaultAdminUser: SessionUser = {
  name: "Garry Amelia",
  email: "garryamelia6265@gmail.com",
  role: "admin",
  approved: true,
  status: "approved",
  phone: "+1 (555) 019-2834",
};

export function CrmProvider({ children }: { children: ReactNode }) {
  // Start with defaultAdminUser - localStorage is loaded in useEffect (client-only)
  const [user, setUser] = useState<SessionUser | null>(defaultAdminUser);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [theme] = useState<"dark">("dark");

  const syncProfileToSupabase = useCallback(async (u: SessionUser) => {
    if (!u.email) return;
    try {
      const role = u.email === "garryamelia6265@gmail.com" ? "admin" : "agent";
      const name = u.name || u.email.split("@")[0];
      const isMainAdmin = u.email === "garryamelia6265@gmail.com";

      // If profile exists, read phone/approved metadata from avatar_url
      const { data: existingProf } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .eq("email", u.email)
        .single();

      let phone = u.phone || "";
      let approved = isMainAdmin ? true : u.approved ?? false;
      let status: "pending" | "approved" | "rejected" = isMainAdmin ? "approved" : u.status ?? "pending";

      if (existingProf?.avatar_url) {
        try {
          const parsed = JSON.parse(existingProf.avatar_url);
          if (parsed.phone) phone = parsed.phone;
          if (typeof parsed.approved === "boolean" && !isMainAdmin) approved = parsed.approved;
          if (parsed.status && !isMainAdmin) status = parsed.status;
        } catch {}
      }

      const meta = JSON.stringify({ phone, approved, status });

      let userId: string | null = existingProf?.id ?? null;
      if (!userId) {
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
      }

      if (userId) {
        await supabase.from("profiles").upsert(
          {
            id: userId,
            email: u.email,
            full_name: name,
            avatar_url: meta,
            role: isMainAdmin ? "admin" : "agent",
          },
          { onConflict: "email" }
        );
      }

      // Update user state with freshly synced phone and approved status
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          name: existingProf?.full_name || prev.name,
          phone,
          approved,
          status,
        };
      });
    } catch (err) {
      console.log("Profile sync notice:", err);
    }
  }, []);

  const submitApprovalRequest = useCallback(
    async ({ name, email, phone }: { name: string; email: string; phone: string }) => {
      const meta = JSON.stringify({ phone, approved: false, status: "pending" });
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      let userId = existing?.id;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.email === email) {
          userId = authData.user.id;
        }
      }
      if (!userId) {
        userId = "usr-" + Date.now();
      }
      // Try update first
      const { data: updateRes, error: updateErr } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          avatar_url: meta,
          role: "agent",
        })
        .eq("email", email)
        .select();

      if (updateErr || !updateRes || updateRes.length === 0) {
        // Fallback to insert if profile row does not exist yet
        await supabase.from("profiles").insert({
          id: userId,
          email,
          full_name: name,
          avatar_url: meta,
          role: "agent",
        });
      }

      const updatedUser: SessionUser = {
        name,
        email,
        phone,
        role: "agent",
        approved: false,
        status: "pending",
      };
      setUser(updatedUser);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      } catch {}
    },
    []
  );

  const checkUserApprovalStatus = useCallback(async (email: string) => {
    if (email === "garryamelia6265@gmail.com") return true;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, role")
        .eq("email", email)
        .single();
      if (!prof) {
        // Deleted by admin
        setUser((prev) => {
          if (!prev) return null;
          return { ...prev, approved: false, status: "pending", phone: undefined };
        });
        return false;
      }
      let phone = "";
      let approved = false;
      let status: "pending" | "approved" | "rejected" = "pending";
      if (prof.avatar_url) {
        try {
          const parsed = JSON.parse(prof.avatar_url);
          phone = parsed.phone || "";
          approved = Boolean(parsed.approved);
          status = parsed.status || (approved ? "approved" : "pending");
        } catch {}
      }
      setUser((prev) => {
        if (!prev) return null;
        const next: SessionUser = {
          ...prev,
          name: prof.full_name || prev.name,
          phone: phone || prev.phone,
          approved,
          status,
        };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      return approved;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Enforce dark mode permanently
    document.documentElement.classList.add("dark");

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SessionUser;
        setUser(parsed);
        syncProfileToSupabase(parsed);
      } else {
        syncProfileToSupabase(defaultAdminUser);
      }
    } catch {
      /* ignore */
    }

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
          const role: "admin" | "agent" = email === "garryamelia6265@gmail.com" ? "admin" : "agent";
          const isMainAdmin = email === "garryamelia6265@gmail.com";
          const googleUser: SessionUser = {
            name,
            email,
            role,
            approved: isMainAdmin ? true : false,
            status: isMainAdmin ? "approved" : "pending",
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
    document.documentElement.classList.add("dark");
  }, []);

  const signIn = useCallback((email: string, role: "admin" | "agent") => {
    const defaultName = role === "admin" ? "Garry Amelia" : email.split("@")[0] || "Sales Agent";
    const userRole = email === "garryamelia6265@gmail.com" ? "admin" : role;
    const isMainAdmin = email === "garryamelia6265@gmail.com";
    const next: SessionUser = {
      name: defaultName,
      email,
      role: userRole,
      approved: isMainAdmin ? true : false,
      status: isMainAdmin ? "approved" : "pending",
    };
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
    };
  }, [user, leads, followUps, theme, signIn, signOut, submitApprovalRequest, checkUserApprovalStatus]);

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
