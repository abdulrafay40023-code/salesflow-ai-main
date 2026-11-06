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
import { fetchDynamicAdmins, isDynamicOrStaticAdmin } from "@/lib/dynamic-admins";
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
  designation?: string;
  pseudo_name?: string;
  role_title?: string;
  role: "admin" | "agent" | "manager";
  approved?: boolean;
  status?: "unsubmitted" | "pending" | "approved" | "rejected";
  assigned_websites?: string[];
  department_id?: string;
};

type CrmContextValue = {
  user: SessionUser | null;
  signIn: (email: string, role?: "admin" | "agent" | "manager") => void;
  signOut: () => void;
  submitApprovalRequest: (info: { name: string; email: string; phone: string; pseudo_name?: string; role_title?: string; department_id?: string; designation?: string }) => Promise<void>;
  checkUserApprovalStatus: (email: string) => Promise<boolean>;
  updateUserProfile: (data: { name?: string; pseudo_name?: string; role_title?: string; phone?: string; designation?: string }) => Promise<void>;
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
        "jennifer.cisternino2027@gmail.com": "Jennifer Cisternino",
        "tzafar04@gmail.com": "Talha Zafar",
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
        let adminPhone = u.phone || "";
        let adminPseudoName = u.pseudo_name || "";
        let adminRoleTitle = u.role_title || "";
        if (existingProf?.avatar_url) {
          try {
            const parsed = JSON.parse(existingProf.avatar_url);
            if (parsed.phone && !adminPhone) adminPhone = parsed.phone;
            if (parsed.pseudo_name && !adminPseudoName) adminPseudoName = parsed.pseudo_name;
            if (parsed.role_title && !adminRoleTitle) adminRoleTitle = parsed.role_title;
          } catch {}
        }
        const meta = JSON.stringify({
          phone: adminPhone,
          pseudo_name: adminPseudoName,
          role_title: adminRoleTitle,
          approved: true,
          status: "approved",
        });
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

        setUser((prev) => {
          if (!prev || prev.email !== u.email) return prev;
          const merged: SessionUser = {
            ...prev,
            name,
            phone: adminPhone || prev.phone,
            pseudo_name: adminPseudoName || prev.pseudo_name,
            role_title: adminRoleTitle || prev.role_title,
            role: "admin",
            approved: true,
            status: "approved",
          };
          saveSession(merged);
          return merged;
        });
      } else if (existingProf) {
        // Read values from DB profile if existing
        let phone = u.phone || "";
        let designation = u.designation || "";
        let pseudo_name = u.pseudo_name || "";
        let role_title = u.role_title || "";
        let approved = false;
        let status: SessionUser["status"] = "unsubmitted";
        let assigned_websites: string[] | undefined = undefined;
        let role: SessionUser["role"] = isMainAdmin ? "admin" : ((existingProf.role as any) || "agent");
        let department_id: string | undefined = undefined;

        if (existingProf.avatar_url) {
          try {
            const parsed = JSON.parse(existingProf.avatar_url);
            if (parsed.phone) phone = parsed.phone;
            if (parsed.designation) designation = parsed.designation;
            if (parsed.pseudo_name) pseudo_name = parsed.pseudo_name;
            if (parsed.role_title) role_title = parsed.role_title;
            approved = Boolean(parsed.approved);
            status = parsed.status || (approved ? "approved" : "unsubmitted");
            if (Array.isArray(parsed.assigned_websites)) {
              assigned_websites = parsed.assigned_websites;
            }
            if (!isMainAdmin && parsed.role) {
              role = parsed.role;
            }
            if (parsed.department_id) {
              department_id = parsed.department_id;
            }
          } catch {}
        }

        setUser((prev) => {
          if (!prev || prev.email !== u.email) return prev;
          const merged: SessionUser = {
            ...prev,
            name: existingProf.full_name || prev.name,
            phone: phone || prev.phone,
            designation: designation || prev.designation,
            pseudo_name: pseudo_name || prev.pseudo_name,
            role_title: role_title || prev.role_title,
            role,
            approved,
            status,
            assigned_websites,
            department_id,
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
    async ({
      name,
      email,
      phone,
      pseudo_name,
      role_title,
      department_id,
      designation
    }: {
      name: string;
      email: string;
      phone: string;
      pseudo_name?: string;
      role_title?: string;
      department_id?: string;
      designation?: string;
    }) => {
      // First update UI immediately so agent sees the lock screen right away
      const pendingUser: SessionUser = {
        name,
        email,
        phone,
        pseudo_name: pseudo_name || "",
        role_title: role_title || designation || "",
        designation: designation || "",
        department_id: department_id || "production-house",
        role: "agent",
        approved: false,
        status: "pending",
      };
      setUser(pendingUser);
      saveSession(pendingUser);

      try {
        await createPendingSignup({ name, email, phone, pseudo_name, role_title, department_id, designation });

        // Broadcast to admins in realtime
        try {
          if (typeof BroadcastChannel !== "undefined") {
            const bc = new BroadcastChannel("teals-crm-approvals-sync");
            bc.postMessage({ type: "NEW_APPROVAL_REQUEST", email, name });
            bc.close();
          }
        } catch {}

        try {
          const ch = supabase.channel("teals-approvals-live-sync", {
            config: { broadcast: { self: true } },
          });
          await ch.subscribe();
          await ch.send({
            type: "broadcast",
            event: "crm_approval_request_created",
            payload: { email, name },
          });
        } catch {}
      } catch (err) {
        console.log("Approval submission notice:", err);
      }
    },
    []
  );

  // ── Poll for admin approval ─────────────────────────────────────────────────
  const checkUserApprovalStatus = useCallback(async (email: string): Promise<boolean> => {
    if (!email) return false;
    if (isAdminEmail(email)) return true;
    const cleanEmail = email.toLowerCase().trim();

    try {
      // 1. Check if profile exists in profiles table (created ONLY when admin approves)
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, role")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (prof) {
        let phone = "";
        let approved = false;
        let status: SessionUser["status"] = "unsubmitted";
        let assigned_websites: string[] | undefined = undefined;
        let role: SessionUser["role"] = isAdminEmail(cleanEmail) ? "admin" : ((prof.role as any) || "agent");
        let department_id: string | undefined = undefined;

        let pseudo_name = "";
        let role_title = "";
        if (prof.avatar_url) {
          try {
            const parsed = JSON.parse(prof.avatar_url);
            phone = parsed.phone || "";
            pseudo_name = parsed.pseudo_name || "";
            role_title = parsed.role_title || "";
            approved = Boolean(parsed.approved);
            status = parsed.status || (approved ? "approved" : "unsubmitted");
            if (Array.isArray(parsed.assigned_websites)) {
              assigned_websites = parsed.assigned_websites;
            }
            if (!isAdminEmail(cleanEmail) && parsed.role) {
              role = parsed.role;
            }
            if (parsed.department_id) {
              department_id = parsed.department_id;
            }
          } catch {}
        }

        if (approved || prof.role === "agent" || prof.role === "admin" || prof.role === "manager" || role === "manager") {
          setUser((prev) => {
            if (!prev || prev.email.toLowerCase().trim() !== cleanEmail) return prev;
            const newName = prof.full_name || prev.name;
            const newPhone = phone || prev.phone;
            const effectiveAssigned = assigned_websites ?? prev.assigned_websites;
            const assignedChanged = JSON.stringify(prev.assigned_websites || []) !== JSON.stringify(effectiveAssigned || []);
            if (
              !assignedChanged &&
              prev.approved === true &&
              prev.status === "approved" &&
              prev.name === newName &&
              prev.phone === newPhone &&
              prev.pseudo_name === pseudo_name &&
              prev.role_title === role_title &&
              prev.role === role &&
              prev.department_id === department_id
            ) {
              return prev;
            }
            const next: SessionUser = {
              ...prev,
              name: newName,
              phone: newPhone,
              pseudo_name: pseudo_name || prev.pseudo_name,
              role_title: role_title || prev.role_title,
              role,
              approved: true,
              status: "approved",
              assigned_websites: effectiveAssigned,
              department_id,
            };
            saveSession(next);
            return next;
          });
          return true;
        }
      }

      // 2. Check pending signups table (only if status is actively pending)
      const pendingReq = await getPendingSignupByEmail(cleanEmail);

      if (pendingReq && pendingReq.status === "pending") {
        setUser((prev) => {
          if (!prev || prev.email.toLowerCase().trim() !== cleanEmail) return prev;
          const newName = pendingReq.name || prev.name;
          const newPhone = pendingReq.phone || prev.phone;
          if (
            prev.approved === false &&
            prev.status === "pending" &&
            prev.name === newName &&
            prev.phone === newPhone &&
            prev.pseudo_name === pendingReq.pseudo_name
          ) {
            return prev;
          }
          const next: SessionUser = {
            ...prev,
            name: newName,
            phone: newPhone,
            pseudo_name: pendingReq.pseudo_name || prev.pseudo_name,
            role_title: pendingReq.role_title || prev.role_title,
            approved: false,
            status: "pending",
          };
          saveSession(next);
          return next;
        });
        return false;
      }

      // 3. Keep existing pending status if user has already submitted the profile form
      setUser((prev) => {
        if (!prev || prev.email.toLowerCase().trim() !== cleanEmail) return prev;
        if (prev.status === "pending" && prev.phone) {
          // Already submitted, retain the pending approval lock screen
          return prev;
        }
        const resetUser: SessionUser = {
          name: "",
          email: cleanEmail,
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

    // Fetch dynamic admins whitelist on startup
    fetchDynamicAdmins().catch(() => {});

    // Listen to admin additions/removals across tabs and realtime WebSocket
    let adminBc: any = null;
    let projBc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        adminBc = new BroadcastChannel("teals-crm-admins-sync");
        adminBc.onmessage = () => {
          fetchDynamicAdmins().catch(() => {});
        };

        projBc = new BroadcastChannel("teals-crm-projects-sync");
        projBc.onmessage = (e: any) => {
          if (e?.data?.event === "profiles_updated" || e?.data?.event === "departments_updated") {
            const cur = loadSession();
            if (cur?.email && !isAdminEmail(cur.email)) {
              checkUserApprovalStatus(cur.email);
            }
          }
        };
      }
    } catch {}

    const subId = Math.random().toString(36).substring(2, 9);
    const adminLiveChannel = supabase.channel(`admins-live-${subId}`, {
      config: { broadcast: { self: true } },
    });
    adminLiveChannel
      .on("broadcast", { event: "crm_admin_list_updated" }, () => {
        fetchDynamicAdmins().catch(() => {});
      })
      .subscribe();

    const projLiveChannel = supabase.channel(`crm-projects-live-${subId}`, {
      config: { broadcast: { self: true } },
    });
    projLiveChannel
      .on("broadcast", { event: "crm_profiles_updated" }, () => {
        const cur = loadSession();
        if (cur?.email && !isAdminEmail(cur.email)) {
          checkUserApprovalStatus(cur.email);
        }
      })
      .on("broadcast", { event: "crm_departments_updated" }, () => {
        const cur = loadSession();
        if (cur?.email && !isAdminEmail(cur.email)) {
          checkUserApprovalStatus(cur.email);
        }
      })
      .subscribe();

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
            (email.toLowerCase() === "jennifer.cisternino2027@gmail.com"
              ? "Jennifer Cisternino"
              : email.toLowerCase() === "ashal.raza@teals.co"
              ? "Ashal Raza"
              : email === "tzafar04@gmail.com"
              ? "T Zafar"
              : email === ADMIN_EMAIL
              ? "Garry Amelia"
              : email.split("@")[0]) ||
            "Working Agent";

          // Preserve existing session status — don't reset "pending" to "unsubmitted" on refresh
          const existing = loadSession();
          let preservedStatus: SessionUser["status"] = "unsubmitted";
          let preservedPhone: string | undefined = undefined;
          let preservedName: string = name;
          let preservedRole: SessionUser["role"] = isMainAdmin ? "admin" : (existing?.role || "agent");
          let preservedDept: string | undefined = existing?.department_id;

          if (existing && existing.email.toLowerCase().trim() === email.toLowerCase().trim()) {
            preservedStatus = existing.status ?? "unsubmitted";
            preservedPhone = existing.phone;
            if (existing.name) preservedName = existing.name;
          }

          const googleUser: SessionUser = {
            name: preservedName,
            email,
            role: preservedRole,
            approved: isMainAdmin ? true : false,
            status: isMainAdmin ? "approved" : preservedStatus,
            phone: preservedPhone,
            department_id: preservedDept,
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

    return () => {
      subscription?.unsubscribe();
      if (adminBc) adminBc.close();
      if (projBc) projBc.close();
      supabase.removeChannel(adminLiveChannel);
      supabase.removeChannel(projLiveChannel);
    };
  }, [syncProfileToSupabase, checkUserApprovalStatus]);

  // ── signIn (Supports direct email login for both Google & custom domain users) ──
  const signIn = useCallback(async (email: string, roleOverride?: "admin" | "agent" | "manager") => {
    const cleanEmail = email.toLowerCase().trim();
    const isMainAdmin = isAdminEmail(cleanEmail);
    const adminNames: Record<string, string> = {
      "garryamelia6265@gmail.com": "Garry Amelia",
      "jennifer.cisternino2027@gmail.com": "Jennifer Cisternino",
      "ashal.raza@teals.co": "Ashal Raza",
      "tzafar04@gmail.com": "T Zafar",
      "annusraees@gmail.com": "Annus Raees",
    };

    if (isMainAdmin) {
      const adminUser: SessionUser = {
        name: adminNames[cleanEmail] || cleanEmail.split("@")[0] || "Super Admin",
        email: cleanEmail,
        role: "admin",
        approved: true,
        status: "approved",
      };
      setUser(adminUser);
      saveSession(adminUser);
      syncProfileToSupabase(adminUser);
      return adminUser;
    }

    // Check profiles table for approved agents
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (prof) {
        let phone = "";
        let approved = prof.role === "agent" || prof.role === "admin" || prof.role === "manager";
        let status: SessionUser["status"] = approved ? "approved" : "unsubmitted";
        let assigned_websites: string[] | undefined = undefined;
        let role: SessionUser["role"] = (prof.role as any) || roleOverride || "agent";
        let department_id: string | undefined = undefined;

        if (prof.avatar_url) {
          try {
            const parsed = JSON.parse(prof.avatar_url);
            if (parsed.phone) phone = parsed.phone;
            if (typeof parsed.approved === "boolean") approved = parsed.approved;
            if (parsed.status) status = parsed.status;
            if (Array.isArray(parsed.assigned_websites)) assigned_websites = parsed.assigned_websites;
            if (parsed.role) role = parsed.role;
            if (parsed.department_id) department_id = parsed.department_id;
          } catch {}
        }

        const agentUser: SessionUser = {
          name: prof.full_name || cleanEmail.split("@")[0] || "Sales Agent",
          email: cleanEmail,
          phone,
          role,
          approved,
          status,
          assigned_websites,
          department_id,
        };
        setUser(agentUser);
        saveSession(agentUser);
        return agentUser;
      }

      // Check pending signups
      const pending = await getPendingSignupByEmail(cleanEmail);
      if (pending && pending.status === "pending") {
        const pendingUser: SessionUser = {
          name: pending.name || cleanEmail.split("@")[0],
          email: cleanEmail,
          phone: pending.phone || "",
          role: "agent",
          approved: false,
          status: "pending",
        };
        setUser(pendingUser);
        saveSession(pendingUser);
        return pendingUser;
      }
    } catch {}

    const defaultUser: SessionUser = {
      name: cleanEmail.split("@")[0] || "Sales Agent",
      email: cleanEmail,
      role: roleOverride || "agent",
      approved: false,
      status: "unsubmitted",
    };
    setUser(defaultUser);
    saveSession(defaultUser);
    return defaultUser;
  }, [syncProfileToSupabase]);

  // ── signOut ────────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    setUser(null);
    clearSession();
    supabase.auth.signOut().catch(() => {});
  }, []);

  // ── updateUserProfile ───────────────────────────────────────────────────
  const updateUserProfile = useCallback(
    async (data: {
      name?: string;
      pseudo_name?: string;
      role_title?: string;
      phone?: string;
      designation?: string;
    }) => {
      if (!user?.email) return;
      const cleanEmail = user.email.toLowerCase().trim();

      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", cleanEmail)
          .maybeSingle();

        let meta: any = { approved: true, status: "approved" };
        if (prof?.avatar_url) {
          try {
            meta = JSON.parse(prof.avatar_url);
          } catch {}
        }

        if (data.phone !== undefined) meta.phone = data.phone;
        if (data.pseudo_name !== undefined) meta.pseudo_name = data.pseudo_name;
        if (data.role_title !== undefined) meta.role_title = data.role_title;
        if (data.designation !== undefined) meta.designation = data.designation;

        const updatedName = data.name !== undefined ? data.name : (prof?.full_name || user.name);

        if (prof) {
          await supabase
            .from("profiles")
            .update({
              full_name: updatedName,
              avatar_url: JSON.stringify(meta),
            })
            .eq("email", cleanEmail);
        } else {
          await supabase.from("profiles").upsert(
            {
              email: cleanEmail,
              full_name: updatedName,
              role: user.role,
              avatar_url: JSON.stringify(meta),
            },
            { onConflict: "email" }
          );
        }

        // Update local session state
        setUser((prev) => {
          if (!prev) return prev;
          const updated: SessionUser = {
            ...prev,
            name: updatedName,
            phone: data.phone !== undefined ? data.phone : prev.phone,
            pseudo_name: data.pseudo_name !== undefined ? data.pseudo_name : prev.pseudo_name,
            role_title: data.role_title !== undefined ? data.role_title : prev.role_title,
            designation: data.designation !== undefined ? data.designation : prev.designation,
          };
          saveSession(updated);
          return updated;
        });

        // Sync with LiveChat SaaS agent session in localStorage
        try {
          const rawAgentSession = localStorage.getItem("teals_agent_session");
          const ag = rawAgentSession ? JSON.parse(rawAgentSession) : {};
          if (data.pseudo_name !== undefined) ag.pseudo_name = data.pseudo_name;
          if (data.role_title !== undefined) ag.role_title = data.role_title;
          if (data.name !== undefined) ag.full_name = data.name;
          localStorage.setItem("teals_agent_session", JSON.stringify(ag));
          sessionStorage.setItem("teals_agent_session", JSON.stringify(ag));
        } catch {}

        // Broadcast update across tabs
        try {
          if (typeof BroadcastChannel !== "undefined") {
            const bc = new BroadcastChannel("teals-crm-profiles-sync");
            bc.postMessage({ type: "PROFILE_UPDATED", email: cleanEmail, ...data });
            bc.close();
          }
        } catch {}

        try {
          const ch = supabase.channel(`profile-broadcast-${Date.now()}`, {
            config: { broadcast: { self: true } },
          });
          await ch.subscribe();
          await ch.send({
            type: "broadcast",
            event: "crm_profiles_updated",
            payload: { email: cleanEmail, ...data },
          });
          supabase.removeChannel(ch);
        } catch {}
      } catch (err) {
        console.error("Failed to update user profile:", err);
        throw err;
      }
    },
    [user?.email, user?.name, user?.role]
  );

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
      updateUserProfile,
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
  }, [user, isAuthLoading, leads, followUps, theme, signIn, signOut, submitApprovalRequest, checkUserApprovalStatus, updateUserProfile]);


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
