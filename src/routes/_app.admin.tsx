import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Users,
  Mail,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  Activity,
  UserCheck,
  ArrowUpRight,
  Zap,
  UserCheck2,
  CalendarCheck,
  Check,
  X,
  Globe,
  UserPlus,
  KeyRound,
  Crown,
  Sparkles,
  Trash2,
  Shield,
  FolderKanban,
  Briefcase,
  Star,
} from "lucide-react";
import { isAdminEmail, ADMIN_EMAILS } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import {
  fetchPendingSignups,
  approvePendingSignup,
  removePendingOrApprovedSignup,
  type PendingSignup,
} from "@/lib/pending-signups";
import {
  fetchDynamicAdmins,
  grantAdminAccess,
  revokeAdminAccess,
  type AdminMember,
} from "@/lib/dynamic-admins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  loadProjectDepartments,
  assignDepartmentManagerSync,
  demoteManagerToAgentSync,
  updateUserRoleAndTitleSync,
  type ProjectDepartment,
} from "@/lib/project-management-store";

export const DEPARTMENT_DESIGNATIONS: Record<string, string[]> = {
  "production-house": [
    "Graphic Designer",
    "UI/UX Designer",
    "Frontend Developer",
    "Full-Stack Developer",
    "Backend Developer",
    "Video Editor & Animator",
    "3D Artist / Visualizer",
    "WordPress & Shopify Developer",
  ],
  "ecommerce-department": [
    "Shopify Store Specialist / Manager",
    "Amazon FBA Specialist",
    "Product Researcher & Hunter",
    "Product Listing & SEO Optimizer",
    "Order Fulfillment & Customer Support",
    "Store Automation Specialist",
    "E-commerce Operations Specialist",
  ],
  "sales-department": [
    "Senior Sales Closer",
    "Lead Generation Specialist",
    "Cold Outreach / Calling Agent",
    "Account Executive",
    "Sales Consultant",
    "Client Relationship Manager",
    "Business Development Representative",
  ],
};

export const DEFAULT_DESIGNATIONS = [
  "Sales Representative",
  "Account Executive",
  "Operations Specialist",
  "Project Coordinator",
  "Technical Lead",
];

export const CONNECTED_WEBSITES = [
  { slug: "amz-solutions-hub", name: "AMZ Solutions Hub", domain: "amzsolutionshub.com", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { slug: "amz-innovators", name: "AMZ Innovators", domain: "amzinnovators.com", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { slug: "authors-breeze", name: "Authors Breeze", domain: "authorsbreeze.com", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { slug: "pro-book-publishing", name: "Pro Book Publishing", domain: "probookpublishing.com", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { slug: "amz-writers-hub", name: "AMZ Writers Hub", domain: "amzwritershub.com", badge: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  { slug: "patch-and-promos", name: "Patch and Promos", domain: "patchandpromos.com", badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
];

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Teals CRM" },
      {
        name: "description",
        content: "Live admin dashboard — agent activity, leads, emails, pipeline analytics.",
      },
    ],
  }),
  component: AdminPage,
});

const ADMIN_EMAIL = "garryamelia6265@gmail.com";

type SupabaseLead = {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  created_at: string;
  assigned_agent_name?: string;
  agent?: string;
};

type SupabaseEmailLog = {
  id: string;
  lead_id: string;
  type: string;
  status: string;
  sent_at: string;
  subject: string;
};

type SupabaseProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
};

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${color} p-3.5 sm:p-5 shadow-lg`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-white/60 truncate">{label}</p>
          <p className="mt-1 text-2xl sm:text-4xl font-extrabold text-white">{value}</p>
          {sub && <p className="mt-1 text-[11px] sm:text-xs text-white/50 truncate">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner">
          {icon}
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5" />
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    new: "bg-blue-500/20 text-blue-300",
    no_answer: "bg-slate-500/20 text-slate-300",
    contacted: "bg-purple-500/20 text-purple-300",
    replied: "bg-teal-500/20 text-teal-300",
    booked: "bg-amber-500/20 text-amber-300",
    booking_cancelled: "bg-rose-500/20 text-rose-300",
    meeting: "bg-orange-500/20 text-orange-300",
    won: "bg-emerald-500/20 text-emerald-300",
    lost: "bg-red-500/20 text-red-300",
    sent: "bg-blue-500/20 text-blue-300",
    opened: "bg-green-500/20 text-green-300",
    failed: "bg-red-500/20 text-red-300",
  };
  return map[status] ?? "bg-gray-500/20 text-gray-300";
}

function AdminPage() {
  const { user } = useCrm();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<SupabaseLead[]>([]);
  const [emailLogs, setEmailLogs] = useState<SupabaseEmailLog[]>([]);
  const [profiles, setProfiles] = useState<SupabaseProfile[]>([]);
  const [departments, setDepartments] = useState<ProjectDepartment[]>([]);
  const [pendingApprovalRequests, setPendingApprovalRequests] = useState<any[]>([]);
  const [dynamicAdmins, setDynamicAdmins] = useState<AdminMember[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [isRevokingEmail, setIsRevokingEmail] = useState<string | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tab, setTab] = useState<"agents" | "admins" | "leads" | "emails">("agents");
  const [selectedAgent, setSelectedAgent] = useState<{
    name: string;
    email: string;
    pseudoName?: string;
    role?: "admin" | "manager" | "team_leader" | "agent" | "custom" | string;
    roleTitle?: string;
    departmentId?: string;
    departmentName?: string;
    designation?: string;
  } | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState<"agent" | "team_leader" | "manager" | "custom">("agent");
  const [customRoleTitleInput, setCustomRoleTitleInput] = useState("");
  const [selectedRoleDeptId, setSelectedRoleDeptId] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [editingDesignationValue, setEditingDesignationValue] = useState("");
  const [customDesignationInput, setCustomDesignationInput] = useState("");
  const [savingDesignation, setSavingDesignation] = useState(false);
  const [editingPseudoName, setEditingPseudoName] = useState("");
  const [savingPseudoName, setSavingPseudoName] = useState(false);
  const [agentAssignedWebsitesMap, setAgentAssignedWebsitesMap] = useState<Record<string, string[]>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [availableWebsites, setAvailableWebsites] = useState(CONNECTED_WEBSITES);

  function openAgentModal(agent: {
    name: string;
    email: string;
    pseudoName?: string;
    role?: "admin" | "manager" | "team_leader" | "agent" | "custom" | string;
    roleTitle?: string;
    departmentId?: string;
    departmentName?: string;
    designation?: string;
  }) {
    setSelectedAgent(agent);
    let r: "agent" | "team_leader" | "manager" | "custom" = "agent";
    let title = agent.roleTitle || "";
    if (agent.role === "manager") r = "manager";
    else if (agent.role === "team_leader" || (agent.roleTitle && agent.roleTitle.toLowerCase().includes("team leader"))) r = "team_leader";
    else if (agent.role === "custom" || (agent.roleTitle && !["agent", "working agent", "manager", "support specialist"].includes(agent.roleTitle.toLowerCase()))) r = "custom";
    setEditingRoleValue(r);
    setCustomRoleTitleInput(title);
    setSelectedRoleDeptId(agent.departmentId || departments[0]?.id || "production-house");

    setEditingPseudoName(agent.pseudoName || "");

    const desig = agent.designation || "";
    const list = DEPARTMENT_DESIGNATIONS[agent.departmentId || "production-house"] || DEFAULT_DESIGNATIONS;
    if (list.includes(desig)) {
      setEditingDesignationValue(desig);
      setCustomDesignationInput("");
    } else if (desig) {
      setEditingDesignationValue("other");
      setCustomDesignationInput(desig);
    } else {
      setEditingDesignationValue("");
      setCustomDesignationInput("");
    }
  }

  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));
  const isManager = Boolean(user?.role === "manager");
  const isManagerOrAdmin = isAdmin || isManager;

  async function fetchData() {
    setLoading(true);
    try {
      const [{ data: leadsData }, { data: emailData }, { data: profileData }, adminsList, pendingList, deptsList] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("emails_sent").select("*").order("sent_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: true }),
        fetchDynamicAdmins().catch(() => [] as AdminMember[]),
        fetchPendingSignups().catch(() => []),
        loadProjectDepartments().catch(() => [] as ProjectDepartment[]),
      ]);
      if (leadsData) setLeads(leadsData as SupabaseLead[]);
      if (emailData) setEmailLogs(emailData as SupabaseEmailLog[]);
      if (adminsList) setDynamicAdmins(adminsList);
      if (deptsList) setDepartments(deptsList);
      if (profileData) {
        setProfiles(profileData as SupabaseProfile[]);
        const map: Record<string, string[]> = {};
        (profileData as any[]).forEach((p) => {
          if (p.email && p.avatar_url) {
            try {
              const parsed = JSON.parse(p.avatar_url);
              if (Array.isArray(parsed.assigned_websites)) {
                map[p.email.toLowerCase()] = parsed.assigned_websites;
              }
            } catch {}
          }
        });
        setAgentAssignedWebsitesMap((prev) => ({ ...prev, ...map }));
      }

      // Fetch from pending_signups table (with fallback to emails_sent queue)
      setPendingApprovalRequests(pendingList || []);

      // Dynamically sync all connected websites (including newly added custom websites) from LiveChat SaaS
      fetch("https://teals-livechat-saas.vercel.app/api/sync?property=all")
        .then((r) => (r.ok ? r.json() : null))
        .then((syncData) => {
          if (!syncData) return;
          const removedSet = new Set(
            Array.isArray(syncData.removedWebsites)
              ? syncData.removedWebsites.map((s: string) => String(s).toLowerCase().trim())
              : []
          );
          const mergedMap = new Map<string, { slug: string; name: string; domain: string; badge: string }>();
          CONNECTED_WEBSITES.forEach((w) => {
            if (!removedSet.has(w.slug)) {
              mergedMap.set(w.slug, w);
            }
          });
          if (Array.isArray(syncData.customWebsites)) {
            syncData.customWebsites.forEach((cw: any) => {
              const slug = String(cw?.slug || "").toLowerCase().trim();
              if (slug && !removedSet.has(slug) && !mergedMap.has(slug)) {
                mergedMap.set(slug, {
                  slug,
                  name: cw.name || slug,
                  domain: cw.domain || `${slug}.com`,
                  badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
                });
              }
            });
          }
          if (mergedMap.size > 0) {
            setAvailableWebsites(Array.from(mergedMap.values()));
          }
        })
        .catch(() => {});
    } catch (e) {
      console.error("Admin fetch error", e);
    }
    setLastUpdated(new Date());
    setLoading(false);
  }

  async function handleAddSuperAdmin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = newAdminEmail.toLowerCase().trim();
    if (!clean || !clean.includes("@")) {
      toast.error("Please enter a valid admin email address.");
      return;
    }
    setIsSubmittingAdmin(true);
    try {
      const added = await grantAdminAccess({
        email: clean,
        name: newAdminName.trim() || undefined,
        addedBy: user?.email || "Admin",
      });
      toast.success(`🎉 Super Admin access granted to ${added.email}! They can now log in anytime without approval.`);
      setNewAdminEmail("");
      setNewAdminName("");
      setShowAddAdminModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to grant admin access");
    } finally {
      setIsSubmittingAdmin(false);
    }
  }

  async function handleRevokeSuperAdmin(admin: AdminMember) {
    if (admin.is_default) {
      toast.error("Cannot revoke primary system default admin.");
      return;
    }
    if (!window.confirm(`Are you sure you want to revoke Super Admin access for ${admin.email}?`)) {
      return;
    }
    setIsRevokingEmail(admin.email);
    try {
      await revokeAdminAccess(admin.email);
      toast.success(`Super Admin access revoked for ${admin.email}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke admin access");
    } finally {
      setIsRevokingEmail(null);
    }
  }

  async function handleSaveAgentWebsites(agentEmail: string, websitesList: string[]) {
    if (!agentEmail || agentEmail === "—") return;
    setSavingPermissions(true);
    try {
      const cleanEmail = agentEmail.toLowerCase().trim();
      const { data: prof } = await supabase.from("profiles").select("*").eq("email", cleanEmail).maybeSingle();

      let existingMeta: any = { approved: true, status: "approved" };
      if (prof?.avatar_url) {
        try {
          existingMeta = JSON.parse(prof.avatar_url);
        } catch {}
      }
      existingMeta.assigned_websites = websitesList;

      if (prof) {
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: JSON.stringify(existingMeta) })
          .eq("email", cleanEmail);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .upsert({
            email: cleanEmail,
            full_name: selectedAgent?.name || cleanEmail.split("@")[0],
            role: "agent",
            avatar_url: JSON.stringify(existingMeta),
          }, { onConflict: "email" });
        if (error) throw error;
      }

      setAgentAssignedWebsitesMap((prev) => ({
        ...prev,
        [cleanEmail]: websitesList,
      }));

      // Update current agent session in storage if admin is configuring themselves or same tab
      try {
        const raw = window.sessionStorage.getItem("teals-crm-session") || window.localStorage.getItem("teals-crm-session");
        if (raw) {
          const u = JSON.parse(raw);
          if ((u?.email || "").toLowerCase().trim() === cleanEmail) {
            u.assigned_websites = websitesList;
            window.sessionStorage.setItem("teals-crm-session", JSON.stringify(u));
            window.localStorage.setItem("teals-crm-session", JSON.stringify(u));
          }
        }
      } catch {}

      // Cross-tab broadcast for same browser origin
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("teals-crm-sync");
          bc.postMessage({
            type: "AGENT_PERMISSIONS_UPDATED",
            email: cleanEmail,
            assigned_websites: websitesList,
          });
          bc.close();
        }
      } catch {}

      // 0. CRM Supabase WebSocket Broadcast
      try {
        const crmCh = supabase.channel("teals-live-crm-stream", {
          config: { broadcast: { self: true } }
        });
        await crmCh.subscribe();
        await crmCh.send({
          type: "broadcast",
          event: "agent_permissions_updated",
          payload: {
            email: cleanEmail,
            assigned_websites: websitesList,
          },
        });
      } catch {}

      // 1. External LiveChat SaaS Supabase WebSocket Broadcast
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(
          "https://nyoegrnemmravwqdcqnp.supabase.co",
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2Vncm5lbW1yYXZ3cWRjcW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0MzEzMywiZXhwIjoyMTAzNDE5MTMzfQ.Q44BHkMZ_j1HfPLiPkxHNtC5wwEvS72AYOsvjaqQ49Q"
        );
        const ch = client.channel("teals-live-crm-stream", {
          config: { broadcast: { self: true } }
        });
        await ch.subscribe();
        await ch.send({
          type: "broadcast",
          event: "agent_permissions_updated",
          payload: {
            email: cleanEmail,
            assigned_websites: websitesList,
          },
        });
      } catch {}

      // 2. Supabase HTTP REST Broadcast Fallback (Guarantees zero packet loss)
      try {
        await fetch("https://nyoegrnemmravwqdcqnp.supabase.co/realtime/v1/api/broadcast", {
          method: "POST",
          headers: {
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2Vncm5lbW1yYXZ3cWRjcW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0MzEzMywiZXhwIjoyMTAzNDE5MTMzfQ.Q44BHkMZ_j1HfPLiPkxHNtC5wwEvS72AYOsvjaqQ49Q",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2Vncm5lbW1yYXZ3cWRjcW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0MzEzMywiZXhwIjoyMTAzNDE5MTMzfQ.Q44BHkMZ_j1HfPLiPkxHNtC5wwEvS72AYOsvjaqQ49Q",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                topic: "realtime:teals-live-crm-stream",
                event: "agent_permissions_updated",
                payload: { email: cleanEmail, assigned_websites: websitesList },
              },
              {
                topic: "teals-live-crm-stream",
                event: "agent_permissions_updated",
                payload: { email: cleanEmail, assigned_websites: websitesList },
              },
            ],
          }),
        });
      } catch {}

      toast.success(`✅ LiveChat AI website access saved for ${cleanEmail}!`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to save website permissions: " + err.message);
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleReassignAgentDepartment(agentEmail: string, newDeptId: string) {
    if (!agentEmail || agentEmail === "—") return;
    const cleanEmail = agentEmail.toLowerCase().trim();
    const newDept = departments.find((d) => d.id === newDeptId);
    if (!newDept) return;

    try {
      const updatedDepts = departments.map((d) => {
        const existingMembers = Array.isArray(d.member_emails)
          ? d.member_emails.map((m) => m.toLowerCase().trim())
          : [];
        if (d.id === newDeptId) {
          return {
            ...d,
            member_emails: Array.from(new Set([...existingMembers, cleanEmail])),
          };
        } else {
          return {
            ...d,
            member_emails: existingMembers.filter((m) => m !== cleanEmail),
          };
        }
      });

      const { saveAllDepartments } = await import("@/lib/project-management-store");
      await saveAllDepartments(updatedDepts);
      setDepartments(updatedDepts);

      const { data: prof } = await supabase.from("profiles").select("*").eq("email", cleanEmail).maybeSingle();
      let meta: any = {};
      if (prof?.avatar_url) {
        try { meta = JSON.parse(prof.avatar_url); } catch {}
      }
      meta.department_id = newDeptId;
      meta.department_name = newDept.name;

      if (prof) {
        await supabase.from("profiles").update({ avatar_url: JSON.stringify(meta) }).eq("email", cleanEmail);
      }

      if (selectedAgent && selectedAgent.email.toLowerCase().trim() === cleanEmail) {
        setSelectedAgent((prev) => prev ? { ...prev, departmentId: newDeptId, departmentName: newDept.name } : null);
      }

      toast.success(`✅ Reassigned ${cleanEmail} to ${newDept.name}!`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to reassign department: " + err.message);
    }
  }

  async function handleSaveAgentDesignation(agentEmail: string, newDesignation: string) {
    if (!agentEmail || agentEmail === "—") return;
    setSavingDesignation(true);
    try {
      const cleanEmail = agentEmail.toLowerCase().trim();
      const { data: prof } = await supabase.from("profiles").select("*").eq("email", cleanEmail).maybeSingle();

      let existingMeta: any = { approved: true, status: "approved" };
      if (prof?.avatar_url) {
        try {
          existingMeta = JSON.parse(prof.avatar_url);
        } catch {}
      }
      existingMeta.designation = newDesignation;

      if (prof) {
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: JSON.stringify(existingMeta) })
          .eq("email", cleanEmail);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .upsert({
            email: cleanEmail,
            full_name: selectedAgent?.name || cleanEmail.split("@")[0],
            role: selectedAgent?.role === "manager" ? "manager" : "agent",
            avatar_url: JSON.stringify(existingMeta),
          }, { onConflict: "email" });
        if (error) throw error;
      }

      setSelectedAgent((prev) => prev ? { ...prev, designation: newDesignation } : null);

      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("teals-crm-profiles-sync");
          bc.postMessage({ type: "PROFILE_UPDATED", email: cleanEmail, designation: newDesignation });
          bc.close();
        }
      } catch {}

      toast.success(`💼 Designation "${newDesignation || "None"}" saved for ${selectedAgent?.name || agentEmail}!`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to save designation: " + err.message);
    } finally {
      setSavingDesignation(false);
    }
  }

  async function handleSaveAgentPseudoName(agentEmail: string, newPseudo: string) {
    if (!agentEmail || agentEmail === "—") return;
    setSavingPseudoName(true);
    try {
      const cleanEmail = agentEmail.toLowerCase().trim();
      const cleanPseudo = newPseudo.trim();
      const { data: prof } = await supabase.from("profiles").select("*").eq("email", cleanEmail).maybeSingle();

      let existingMeta: any = { approved: true, status: "approved" };
      if (prof?.avatar_url) {
        try {
          existingMeta = JSON.parse(prof.avatar_url);
        } catch {}
      }
      existingMeta.pseudo_name = cleanPseudo;

      if (prof) {
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: JSON.stringify(existingMeta) })
          .eq("email", cleanEmail);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .upsert({
            email: cleanEmail,
            full_name: selectedAgent?.name || cleanEmail.split("@")[0],
            role: selectedAgent?.role === "manager" ? "manager" : "agent",
            avatar_url: JSON.stringify(existingMeta),
          }, { onConflict: "email" });
        if (error) throw error;
      }

      setSelectedAgent((prev) => prev ? { ...prev, pseudoName: cleanPseudo } : null);

      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("teals-crm-sync");
          bc.postMessage({ type: "AGENT_PSEUDO_UPDATED", email: cleanEmail, pseudo_name: cleanPseudo });
          bc.close();
        }
      } catch {}

      toast.success(cleanPseudo ? `🎭 Live Chat Persona "${cleanPseudo}" saved!` : "🎭 Display persona cleared!");
      fetchData();
    } catch (err: any) {
      toast.error("Failed to save display persona: " + err.message);
    } finally {
      setSavingPseudoName(false);
    }
  }

  async function handleSaveAgentRole() {
    if (!selectedAgent) return;
    const cleanEmail = selectedAgent.email.toLowerCase().trim();
    if (isAdminEmail(cleanEmail)) {
      toast.error("Admin role is permanent and cannot be modified.");
      return;
    }

    setSavingRole(true);
    try {
      const targetDept = departments.find((d) => d.id === selectedRoleDeptId);
      let finalRoleTitle = "";
      if (editingRoleValue === "manager") {
        if (!selectedRoleDeptId) {
          toast.error("Please select a department for the manager.");
          setSavingRole(false);
          return;
        }
        await assignDepartmentManagerSync({
          deptId: selectedRoleDeptId,
          managerEmail: cleanEmail,
          managerName: selectedAgent.name,
          departments,
        });
        finalRoleTitle = targetDept ? `${targetDept.name} Manager` : "Department Manager";
      } else if (editingRoleValue === "team_leader") {
        finalRoleTitle = targetDept ? `${targetDept.name} Team Leader` : "Team Leader";
        await updateUserRoleAndTitleSync({
          email: cleanEmail,
          role: "team_leader",
          roleTitle: finalRoleTitle,
          departmentId: selectedRoleDeptId,
          departmentName: targetDept?.name || null,
        });
      } else if (editingRoleValue === "custom") {
        finalRoleTitle = customRoleTitleInput.trim() || "Specialist";
        await updateUserRoleAndTitleSync({
          email: cleanEmail,
          role: "custom",
          roleTitle: finalRoleTitle,
          departmentId: selectedRoleDeptId,
          departmentName: targetDept?.name || null,
        });
      } else {
        // agent
        if (selectedAgent.role === "manager") {
          await demoteManagerToAgentSync({ managerEmail: cleanEmail, departments });
        }
        finalRoleTitle = "Support Specialist";
        await updateUserRoleAndTitleSync({
          email: cleanEmail,
          role: "agent",
          roleTitle: finalRoleTitle,
          departmentId: selectedRoleDeptId,
          departmentName: targetDept?.name || null,
        });
      }

      toast.success(`Role updated for ${selectedAgent.name}: ${finalRoleTitle || editingRoleValue}!`);
      setSelectedAgent((prev) => prev ? {
        ...prev,
        role: editingRoleValue,
        roleTitle: finalRoleTitle,
        departmentId: selectedRoleDeptId,
        departmentName: targetDept?.name || prev.departmentName,
      } : null);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to update role: " + err.message);
    } finally {
      setSavingRole(false);
    }
  }

  async function handleApproveAgent(req: any, deptIdOverride?: string) {
    try {
      const targetDeptId = deptIdOverride || req.department_id || "production-house";
      const signup: PendingSignup = {
        id: req.id,
        name: req.name || req.lead_email?.split("@")[0] || "Unknown",
        email: req.email || req.lead_email,
        phone: req.phone || "",
        department_id: targetDeptId,
        avatar_initials: req.avatar_initials || (req.name || req.lead_email || "AG").slice(0, 2).toUpperCase(),
        status: "pending",
        created_at: req.created_at || req.sent_at,
      };

      await approvePendingSignup(signup, targetDeptId);

      // Log agent approval in emails_sent for Activity & Notifications feed
      try {
        const deptName = targetDeptId === "ecommerce-department" ? "E-commerce Department" : targetDeptId === "sales-department" ? "Sales Department" : "Production House";
        await supabase.from("emails_sent").insert({
          lead_email: signup.email,
          sequence_type: "agent_approved",
          subject: `${signup.name} joined ${deptName} as Working Agent`,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } catch {}

      // Broadcast resolution to update all admin sidebar badges
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("teals-crm-approvals-sync");
          bc.postMessage({ type: "APPROVAL_RESOLVED", email: signup.email });
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
          event: "crm_approval_resolved",
          payload: { email: signup.email },
        });
      } catch {}

      toast.success(`✅ Approved ${signup.name} for ${targetDeptId === "ecommerce-department" ? "E-commerce" : targetDeptId === "sales-department" ? "Sales" : "Production House"}!`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to approve agent: " + err.message);
    }
  }

  async function handleRejectAgent(req: any) {
    try {
      const email = req.email || req.lead_email;
      await removePendingOrApprovedSignup(email);

      // Broadcast resolution to update all admin sidebar badges
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("teals-crm-approvals-sync");
          bc.postMessage({ type: "APPROVAL_RESOLVED", email });
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
          event: "crm_approval_resolved",
          payload: { email },
        });
      } catch {}

      toast.success(`❌ Removed pending request from ${req.name || email}.`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to reject request: " + err.message);
    }
  }

  useEffect(() => {
    if (!isManagerOrAdmin) {
      navigate({ to: "/dashboard" });
      return;
    }
    fetchData();

    // 1. Cross-tab BroadcastChannels for dynamic admins and project departments
    let adminBc: any = null;
    let deptBc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        adminBc = new BroadcastChannel("teals-crm-admins-sync");
        adminBc.onmessage = () => fetchData();

        deptBc = new BroadcastChannel("teals-crm-projects-sync");
        deptBc.onmessage = () => {
          loadProjectDepartments().then(setDepartments).catch(() => {});
        };
      }
    } catch {}

    // 2. Real-time Supabase subscriptions
    const adminSyncSub = supabase
      .channel("admin-mgmt-live-sync", { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "crm_admin_list_updated" }, () => fetchData())
      .subscribe();

    const deptSub = supabase
      .channel(`admin-depts-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "crm_project_departments_updated" }, (payload: any) => {
        if (payload?.payload?.departments) {
          setDepartments(payload.payload.departments);
        } else {
          loadProjectDepartments().then(setDepartments).catch(() => {});
        }
      })
      .subscribe();

    const leadsSub = supabase
      .channel("admin-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe();

    const emailSub = supabase
      .channel("admin-emails")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails_sent" }, () => fetchData())
      .subscribe();

    const profileSub = supabase
      .channel("admin-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData())
      .subscribe();

    const interval = setInterval(fetchData, 30000);

    return () => {
      leadsSub.unsubscribe();
      emailSub.unsubscribe();
      profileSub.unsubscribe();
      adminSyncSub.unsubscribe();
      deptSub.unsubscribe();
      if (adminBc) adminBc.close();
      if (deptBc) deptBc.close();
      clearInterval(interval);
    };
  }, [isManagerOrAdmin]);

  if (!isManagerOrAdmin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-16 w-16 text-red-400" />
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-white/50">Only administrators and department managers can access this panel.</p>
      </div>
    );
  }

  // Pending approval requests come from emails_sent queue (NOT profiles table)
  const pendingProfiles = pendingApprovalRequests;

  // Filter out internal system logs from customer email logs
  const customerEmailLogs = emailLogs.filter(
    (e: any) => e.sequence_type !== "agent_login" && e.type !== "agent_login" && e.sequence_type !== "agent_presence" && e.sequence_type !== "agent_approval_request"
  );

  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.status === "won").length;
  const newLeads = leads.filter((l) => l.status === "new").length;

  // Outreach = unique leads contacted (welcome emails / sequence sent)
  const outreachLeadEmails = new Set<string>();
  leads.forEach((l) => {
    if (l.email) outreachLeadEmails.add(l.email.toLowerCase());
  });
  customerEmailLogs.forEach((e: any) => {
    if (e.lead_email) outreachLeadEmails.add(e.lead_email.toLowerCase());
  });

  const outreachCount = Math.max(outreachLeadEmails.size, leads.length);

  // Replies = unique leads who replied or booked a meeting (normalized by lead email)
  const repliedLeadEmails = new Set<string>();
  leads.forEach((l) => {
    if ((l.status === "meeting" || l.status === "won") && l.email) {
      repliedLeadEmails.add(l.email.toLowerCase());
    }
  });
  customerEmailLogs.forEach((e: any) => {
    if (e.sequence_type === "meeting_confirmed" || e.status === "replied" || e.status === "opened") {
      if (e.lead_email) repliedLeadEmails.add(e.lead_email.toLowerCase());
    }
  });

  const emailSent = outreachCount;
  const emailReplied = repliedLeadEmails.size;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  // Helper to resolve role and department details for any user
  function getRoleAndDepartment(email: string, prof?: SupabaseProfile | any) {
    const cleanEmail = email.toLowerCase().trim();
    const isMainAdmin = isAdminEmail(cleanEmail) || allAdminsSet.has(cleanEmail);

    let metaRole = prof?.role;
    let metaRoleTitle = "";
    let metaDeptId = "";
    let metaDeptName = "";
    let metaDesignation = "";
    let metaPseudoName = "";
    if (prof?.avatar_url) {
      try {
        const parsed = JSON.parse(prof.avatar_url);
        if (parsed.role) metaRole = parsed.role;
        if (parsed.role_title) metaRoleTitle = parsed.role_title;
        if (parsed.department_id) metaDeptId = parsed.department_id;
        if (parsed.department_name) metaDeptName = parsed.department_name;
        if (parsed.designation) metaDesignation = parsed.designation;
        if (parsed.pseudo_name) metaPseudoName = parsed.pseudo_name;
      } catch {}
    }

    if (!metaDesignation) {
      const pendingMatch = pendingProfiles.find((p: any) => (p.email || p.lead_email || "").toLowerCase().trim() === cleanEmail);
      if (pendingMatch?.designation) {
        metaDesignation = pendingMatch.designation;
      }
    }
    if (!metaPseudoName) {
      const pendingMatch = pendingProfiles.find((p: any) => (p.email || p.lead_email || "").toLowerCase().trim() === cleanEmail);
      if (pendingMatch?.pseudo_name) {
        metaPseudoName = pendingMatch.pseudo_name;
      }
    }

    if (isMainAdmin) {
      return {
        role: "admin" as const,
        roleTitle: metaRoleTitle || "Super Admin",
        departmentId: "executive-admin",
        departmentName: "Executive Administration",
        designation: metaDesignation || metaRoleTitle || "Super Admin",
        pseudoName: metaPseudoName || "",
      };
    }

    // 1. Check departments state
    const matchedDept = departments.find(
      (d) =>
        (d.manager_email && d.manager_email.toLowerCase().trim() === cleanEmail) ||
        (prof?.id && d.manager_id === prof.id)
    );

    if (matchedDept) {
      return {
        role: "manager" as const,
        roleTitle: metaRoleTitle || `${matchedDept.name} Manager`,
        departmentId: matchedDept.id,
        departmentName: matchedDept.name,
        designation: metaDesignation || `${matchedDept.name} Manager`,
        pseudoName: metaPseudoName || "",
      };
    }

    if (metaRole === "manager") {
      const fallbackDept = metaDeptId ? departments.find((d) => d.id === metaDeptId) : null;
      const deptId = metaDeptId || fallbackDept?.id || "sales-department";
      const deptName = metaDeptName || fallbackDept?.name || "Sales Department";
      return {
        role: "manager" as const,
        roleTitle: metaRoleTitle || `${deptName} Manager`,
        departmentId: deptId,
        departmentName: deptName,
        designation: metaDesignation || `${deptName} Manager`,
        pseudoName: metaPseudoName || "",
      };
    }

    if (metaRole === "team_leader" || (metaRoleTitle && metaRoleTitle.toLowerCase().includes("team leader"))) {
      const dept = metaDeptId ? departments.find((d) => d.id === metaDeptId) : null;
      return {
        role: "team_leader" as const,
        roleTitle: metaRoleTitle || (dept?.name ? `${dept.name} Team Leader` : "Team Leader"),
        departmentId: metaDeptId || dept?.id || "production-house",
        departmentName: metaDeptName || dept?.name || "Production House",
        designation: metaDesignation || "Team Leader",
        pseudoName: metaPseudoName || "",
      };
    }

    if (metaRole === "custom" || (metaRoleTitle && !["agent", "working agent", "manager", "support specialist"].includes(metaRoleTitle.toLowerCase()))) {
      const dept = metaDeptId ? departments.find((d) => d.id === metaDeptId) : null;
      return {
        role: "custom" as const,
        roleTitle: metaRoleTitle || "Specialist",
        departmentId: metaDeptId || dept?.id || "production-house",
        departmentName: metaDeptName || dept?.name || "Production House",
        designation: metaDesignation || metaRoleTitle || "Specialist",
        pseudoName: metaPseudoName || "",
      };
    }

    // 2. Check if member of any department
    const memberDept = departments.find(
      (d) =>
        d.member_emails &&
        d.member_emails.some((m) => m.toLowerCase().trim() === cleanEmail)
    ) || (metaDeptId ? departments.find((d) => d.id === metaDeptId) : null);

    if (memberDept) {
      return {
        role: "agent" as const,
        roleTitle: metaRoleTitle || "Working Agent",
        departmentId: memberDept.id,
        departmentName: memberDept.name,
        designation: metaDesignation || undefined,
        pseudoName: metaPseudoName || "",
      };
    }

    if (metaDeptName) {
      return {
        role: "agent" as const,
        roleTitle: metaRoleTitle || "Working Agent",
        departmentId: metaDeptId || "sales-department",
        departmentName: metaDeptName,
        designation: metaDesignation || undefined,
        pseudoName: metaPseudoName || "",
      };
    }

    const fallbackAgentDeptId = metaDeptId || (cleanEmail.includes("emma") ? "ecommerce-department" : "sales-department");
    const fallbackAgentDeptName = fallbackAgentDeptId === "ecommerce-department" ? "E-commerce Department" : fallbackAgentDeptId === "sales-department" ? "Sales Department" : "Production House";

    return {
      role: "agent" as const,
      roleTitle: metaRoleTitle || "Working Agent",
      departmentId: fallbackAgentDeptId,
      departmentName: fallbackAgentDeptName,
      designation: metaDesignation || undefined,
      pseudoName: metaPseudoName || "",
    };
  }

  // Group stats by Agent — combine profiles, agent_presence logs, and leads!
  const agentStatsMap: Record<
    string,
    {
      name: string;
      email: string;
      pseudoName?: string;
      role: "admin" | "manager" | "team_leader" | "agent" | "custom" | string;
      roleTitle?: string;
      departmentId?: string;
      departmentName?: string;
      designation?: string;
      assignedWebsites: string[];
      totalLeads: number;
      newLeads: number;
      contacted: number;
      won: number;
      emailsSent: number;
      replies: number;
    }
  > = {};

  // 0. Pre-populate all registered Admins (static + dynamic) so they ALWAYS appear at the top
  const defaultAdminNames: Record<string, string> = {
    "garryamelia6265@gmail.com": "Garry Amelia",
    "jennifer.cisternino2027@gmail.com": "Jennifer Cisternino",
    "tzafar04@gmail.com": "Talha Zafar",
    "annusraees@gmail.com": "Annus Raees",
  };

  const allAdminsSet = new Set<string>(ADMIN_EMAILS.map((e) => e.toLowerCase()));
  dynamicAdmins.forEach((a) => {
    if (a.email) allAdminsSet.add(a.email.toLowerCase().trim());
  });

  allAdminsSet.forEach((email) => {
    const key = email.toLowerCase();
    const existingProf = profiles.find((p) => p.email.toLowerCase() === key);
    const dyn = dynamicAdmins.find((d) => d.email.toLowerCase() === key);
    let adminPseudo = "";
    let adminRoleTitle = "Super Admin";
    let adminDesignation = "Executive Management";
    if (existingProf?.avatar_url) {
      try {
        const parsed = JSON.parse(existingProf.avatar_url);
        if (parsed.pseudo_name) adminPseudo = parsed.pseudo_name;
        if (parsed.role_title) adminRoleTitle = parsed.role_title;
        if (parsed.designation) adminDesignation = parsed.designation;
      } catch {}
    }
    agentStatsMap[key] = {
      name: dyn?.name || existingProf?.full_name || defaultAdminNames[key] || key.split("@")[0] || "Admin",
      email: email,
      pseudoName: adminPseudo || "",
      role: "admin",
      roleTitle: adminRoleTitle,
      departmentId: "executive-admin",
      departmentName: "Executive Administration",
      designation: adminDesignation || "Super Admin",
      assignedWebsites: ["all"],
      totalLeads: 0,
      newLeads: 0,
      contacted: 0,
      won: 0,
      emailsSent: 0,
      replies: 0,
    };
  });

  // 1. Populate registered profiles from Supabase profiles table (ONLY APPROVED AGENTS AND ADMIN)
  profiles.forEach((p) => {
    if (!p.email) return;
    const isMainAdmin = isAdminEmail(p.email);
    let isApproved = isMainAdmin;
    let assignedWebsites: string[] = [];
    if ((p as any).avatar_url) {
      try {
        const parsed = JSON.parse((p as any).avatar_url);
        if (typeof parsed.approved === "boolean" && !isMainAdmin) {
          isApproved = parsed.approved;
        }
        if (Array.isArray(parsed.assigned_websites)) {
          assignedWebsites = parsed.assigned_websites;
        }
      } catch {}
    }
    // Hide pending agents from team cards until admin approves them!
    if (!isApproved) return;

    const key = p.email.toLowerCase();
    const { role, roleTitle, departmentId, departmentName, designation, pseudoName } = getRoleAndDepartment(p.email, p);
    const curAssigned = role === "admin" ? ["all"] : (agentAssignedWebsitesMap[key] || assignedWebsites);

    if (!agentStatsMap[key]) {
      agentStatsMap[key] = {
        name: p.full_name || p.email.split("@")[0] || (role === "manager" ? `${departmentName} Manager` : "Working Agent"),
        email: p.email,
        pseudoName: pseudoName || "",
        role,
        roleTitle,
        departmentId,
        departmentName,
        designation,
        assignedWebsites: curAssigned,
        totalLeads: 0,
        newLeads: 0,
        contacted: 0,
        won: 0,
        emailsSent: 0,
        replies: 0,
      };
    } else {
      if (p.full_name) agentStatsMap[key].name = p.full_name;
      if (pseudoName) agentStatsMap[key].pseudoName = pseudoName;
      agentStatsMap[key].role = role;
      if (roleTitle) agentStatsMap[key].roleTitle = roleTitle;
      agentStatsMap[key].departmentId = departmentId;
      agentStatsMap[key].departmentName = departmentName;
      if (designation) agentStatsMap[key].designation = designation;
      agentStatsMap[key].assignedWebsites = curAssigned;
    }
  });

  // 2. Populate active logged-in agents from emails_sent agent_presence records
  emailLogs.forEach((e: any) => {
    if (e.sequence_type === "agent_presence" && e.lead_email) {
      const email = e.lead_email.toLowerCase();
      // Do not add pending agents to agent stats cards
      const isPending = pendingProfiles.some((p) => p.email.toLowerCase() === email);
      if (isPending) return;

      const prof = profiles.find((p) => p.email?.toLowerCase() === email);
      const { role, roleTitle, departmentId, departmentName, designation, pseudoName } = getRoleAndDepartment(e.lead_email, prof);
      const curAssigned = role === "admin" ? ["all"] : (agentAssignedWebsitesMap[email] || []);

      if (!agentStatsMap[email]) {
        const name = e.subject || email.split("@")[0];
        agentStatsMap[email] = {
          name: name,
          email: e.lead_email,
          pseudoName: pseudoName || "",
          role,
          roleTitle,
          departmentId,
          departmentName,
          designation,
          assignedWebsites: curAssigned,
          totalLeads: 0,
          newLeads: 0,
          contacted: 0,
          won: 0,
          emailsSent: 0,
          replies: 0,
        };
      } else {
        if (pseudoName) agentStatsMap[email].pseudoName = pseudoName;
        agentStatsMap[email].role = role;
        if (roleTitle) agentStatsMap[email].roleTitle = roleTitle;
        agentStatsMap[email].departmentId = departmentId;
        agentStatsMap[email].departmentName = departmentName;
        if (designation) agentStatsMap[email].designation = designation;
      }
    }
  });

  // 3. Aggregate stats from leads table
  leads.forEach((l) => {
    const agentIdentifier = (l.assigned_agent_name || l.agent || "Unassigned").toLowerCase();
    const matchingKey = Object.keys(agentStatsMap).find(
      (k) => k === agentIdentifier || agentStatsMap[k]?.name.toLowerCase() === agentIdentifier || agentStatsMap[k]?.email.toLowerCase() === agentIdentifier
    ) || agentIdentifier;

    if (!agentStatsMap[matchingKey]) {
      const displayName = l.assigned_agent_name || l.agent || "Unassigned";
      const prof = profiles.find((p) => p.email?.toLowerCase() === displayName.toLowerCase() || p.full_name?.toLowerCase() === displayName.toLowerCase());
      const { role, roleTitle, departmentId, departmentName, designation, pseudoName } = getRoleAndDepartment(displayName, prof);
      const isMainAdmin = role === "admin";
      agentStatsMap[matchingKey] = {
        name: displayName,
        email: displayName.includes("@") ? displayName : "—",
        pseudoName: pseudoName || "",
        role,
        roleTitle,
        departmentId,
        departmentName,
        designation,
        assignedWebsites: isMainAdmin ? ["all"] : (agentAssignedWebsitesMap[displayName.toLowerCase()] || []),
        totalLeads: 0,
        newLeads: 0,
        contacted: 0,
        won: 0,
        emailsSent: 0,
        replies: 0,
      };
    }
    const stat = agentStatsMap[matchingKey]!;
    stat.totalLeads++;
    if (l.status === "new") stat.newLeads++;
    if (l.status !== "new" || customerEmailLogs.some((e: any) => e.lead_id === l.id || e.lead_email === l.email)) {
      stat.contacted++;
    }
    if (l.status === "won") stat.won++;
  });

  // Admins always appear first, then Department Managers, then Working Agents
  const adminOrder = [
    "garryamelia6265@gmail.com",
    "jennifer.cisternino2027@gmail.com",
    "tzafar04@gmail.com",
    "annusraees@gmail.com",
  ];
  const agentRows = Object.values(agentStatsMap).sort((a, b) => {
    const aIsAdmin = a.role === "admin" || isAdminEmail(a.email);
    const bIsAdmin = b.role === "admin" || isAdminEmail(b.email);
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    if (aIsAdmin && bIsAdmin) {
      const aIdx = adminOrder.indexOf(a.email.toLowerCase());
      const bIdx = adminOrder.indexOf(b.email.toLowerCase());
      return (aIdx !== -1 ? aIdx : 99) - (bIdx !== -1 ? bIdx : 99);
    }
    const aIsManager = a.role === "manager";
    const bIsManager = b.role === "manager";
    if (aIsManager && !bIsManager) return -1;
    if (!aIsManager && bIsManager) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-violet-400 shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Admin Control Center</h1>
            <span className="rounded-full bg-violet-500/20 px-3 py-0.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/30">
              LIVE REALTIME
            </span>
          </div>
          <p className="mt-1 text-sm text-white/40">
            Admin: <span className="font-medium text-violet-400">{user?.email}</span> · Auto sync active ·{" "}
            <span className="text-white/60">{lastUpdated.toLocaleTimeString()}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => {
              setShowAddAdminModal(true);
              setTab("admins");
            }}
            className="gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-violet-600 to-fuchsia-600 hover:from-amber-400 hover:to-fuchsia-500 text-white font-bold shadow-lg shadow-violet-500/20 active:scale-95 transition-all"
          >
            <Crown className="h-4 w-4 text-amber-200" />
            <span>Grant Super Admin</span>
          </Button>
          <Button
            onClick={fetchData}
            disabled={loading}
            className="gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh Live Data"}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={<Users className="h-6 w-6" />}
          label="Total Leads"
          value={totalLeads}
          sub="Across all agents"
          color="from-violet-900 via-violet-800 to-violet-700"
        />
        <StatCard
          icon={<Mail className="h-6 w-6" />}
          label="Outreach Sent"
          value={emailSent}
          sub="Leads contacted"
          color="from-fuchsia-900 via-fuchsia-800 to-fuchsia-700"
        />
        <StatCard
          icon={<CheckCircle2 className="h-6 w-6" />}
          label="Replies & Booked"
          value={emailReplied}
          sub="Meeting responses"
          color="from-emerald-900 via-emerald-800 to-emerald-700"
        />
        <StatCard
          icon={<UserCheck className="h-6 w-6" />}
          label="Won Deals"
          value={wonLeads}
          sub={`${conversionRate}% conversion`}
          color="from-blue-900 via-blue-800 to-blue-700"
        />
        <StatCard
          icon={<Zap className="h-6 w-6" />}
          label="New Leads"
          value={newLeads}
          sub="Pending outreach"
          color="from-slate-900 via-slate-800 to-slate-700"
        />
      </div>

      {/* Pending Agent Approval Notifications Banner */}
      {pendingProfiles.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 sm:p-5 shadow-xl backdrop-blur-md animate-fade-in space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex size-3 rounded-full bg-amber-500"></span>
              </span>
              <h2 className="text-base font-bold text-amber-200">
                Pending Approval Requests ({pendingProfiles.length})
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
              New Agent Waiting
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingProfiles.map((req: any) => {
              // fetchPendingSignups() returns PendingSignup objects with direct fields
              const reqName = req.name || req.email?.split("@")[0] || "Unknown";
              const reqEmail = req.email || req.lead_email || "";
              const reqPhone = req.phone || "";
              const reqDate = req.created_at || req.sent_at || "";
              const reqDeptId = req.department_id || "production-house";
              const deptLabel = reqDeptId === "ecommerce-department" ? "🛒 E-commerce" : reqDeptId === "sales-department" ? "📞 Sales" : "🎨 Production House";

              return (
                <div
                  key={req.id}
                  className="flex flex-col gap-2.5 rounded-xl border border-amber-500/30 bg-slate-900/90 p-3.5 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {reqName}
                      </p>
                      <p className="truncate text-xs text-slate-400">{reqEmail}</p>
                      {reqPhone && <p className="text-[11px] text-amber-300/90 mt-0.5 font-medium">📞 {reqPhone}</p>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleApproveAgent(req, reqDeptId)}
                        title={`Approve Access for ${deptLabel}`}
                        className="flex items-center justify-center size-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        onClick={() => handleRejectAgent(req)}
                        title="Decline / Reject Request"
                        className="flex items-center justify-center size-8 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition-all shadow-md active:scale-95"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[11px] flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                        {deptLabel}
                      </span>
                      {req.designation && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-purple-500/15 text-purple-200 border border-purple-500/30">
                          💼 {req.designation}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {reqDate ? (() => { try { const d = new Date(reqDate); return isNaN(d.getTime()) ? "Recently" : d.toLocaleDateString(); } catch { return "Recently"; } })() : "Recently"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Pipeline Bar */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-400" />
            <h2 className="font-bold text-white">Live Pipeline Breakdown</h2>
          </div>
          <span className="text-xs text-white/40">{totalLeads} total leads</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {["new", "no_answer", "contacted", "replied", "booked", "won"].map((s) => {
            const count = leads.filter((l) => l.status === s).length;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <div key={s} className="flex flex-1 flex-col gap-1.5 min-w-[90px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize font-medium text-white/60">{s.replace(/_/g, " ")}</span>
                  <span className="text-white font-bold">{count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      s === "won"
                        ? "bg-emerald-500"
                        : s === "replied"
                          ? "bg-teal-500"
                          : s === "booked"
                            ? "bg-amber-500"
                            : s === "new"
                              ? "bg-blue-500"
                              : s === "contacted"
                                ? "bg-purple-500"
                                : "bg-slate-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-white/30">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex flex-wrap border-b border-white/10">
          <button
            onClick={() => setTab("agents")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 sm:px-6 sm:py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
              tab === "agents"
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <UserCheck2 className="h-4 w-4 shrink-0" /> Agent Performance & Activity
          </button>
          <button
            onClick={() => setTab("admins")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 sm:px-6 sm:py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
              tab === "admins"
                ? "bg-violet-600/20 text-amber-300 border-b-2 border-amber-500"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Crown className="h-4 w-4 text-amber-400 shrink-0" /> Super Admins & Whitelist ({dynamicAdmins.length})
          </button>
          <button
            onClick={() => setTab("leads")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 sm:px-6 sm:py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
              tab === "leads"
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Users className="h-4 w-4 shrink-0" /> All Leads ({totalLeads})
          </button>
          <button
            onClick={() => setTab("emails")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-2.5 sm:px-6 sm:py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
              tab === "emails"
                ? "bg-violet-600/20 text-violet-300 border-b-2 border-violet-500"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Mail className="h-4 w-4" /> Email Logs ({customerEmailLogs.length})
          </button>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-white/40">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Fetching live database metrics...
          </div>
        )}

        {/* ── TAB: SUPER ADMIN ACCESS & WHITELIST ── */}
        {!loading && tab === "admins" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400" />
                  Super Admin Management & Pre-Approval Whitelist
                </h3>
                <p className="text-xs text-white/40">
                  Pre-approve any person by email. When they sign up or log in, they will immediately have full Super Admin access without requiring any manual approval.
                </p>
              </div>
              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs text-amber-300 font-semibold flex items-center gap-1.5 self-start sm:self-auto">
                <ShieldCheck className="h-3.5 w-3.5" />
                {dynamicAdmins.length} Active Super Admin{dynamicAdmins.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Quick Grant Super Admin Form Box */}
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-slate-900/80 to-purple-950/30 p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <h4 className="text-sm font-bold text-white">Pre-Approve & Grant Super Admin Role</h4>
              </div>
              <p className="text-xs text-white/50 mb-4">
                Enter an email address below. They do not need to be in the CRM yet — their email will be pre-registered so they get immediate 100% Super Admin rights upon first sign in.
              </p>
              <form onSubmit={handleAddSuperAdmin} className="grid gap-3 sm:grid-cols-12 items-end">
                <div className="sm:col-span-6 space-y-1.5">
                  <label className="text-xs font-semibold text-white/70">Admin Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="e.g. partner@company.com"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-semibold text-white/70">Full Name (Optional)</label>
                  <input
                    type="text"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="e.g. Alex Hunter"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-sm text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={isSubmittingAdmin || !newAdminEmail}
                    className="w-full h-[38px] rounded-xl bg-gradient-to-r from-amber-500 via-violet-600 to-fuchsia-600 text-white font-bold text-xs hover:opacity-90 shadow-md transition-all active:scale-95"
                  >
                    {isSubmittingAdmin ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Granting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        Grant Admin
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* List of Super Admins */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
                Authorized Super Admins List ({dynamicAdmins.length})
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                {dynamicAdmins.map((adm) => {
                  const isCurrentAuthUser = user?.email?.toLowerCase().trim() === adm.email.toLowerCase().trim();
                  return (
                    <div
                      key={adm.email}
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-md hover:border-violet-500/40 hover:bg-white/[0.07] transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-violet-500/30">
                          <AvatarFallback className="bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white font-bold text-sm">
                            {(adm.name || adm.email).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white truncate text-sm">{adm.name || adm.email.split("@")[0]}</p>
                            {adm.is_default ? (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                                <Crown className="w-3 h-3 text-amber-400" />
                                Primary Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                                <Shield className="w-3 h-3 text-emerald-400" />
                                Granted Admin
                              </span>
                            )}
                            {isCurrentAuthUser && (
                              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium border border-blue-500/30">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/50 truncate mt-0.5">{adm.email}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                            <span>Added by: <strong className="text-white/60">{adm.added_by || "System"}</strong></span>
                            <span>•</span>
                            <span>Access: <strong className="text-emerald-400 font-semibold">100% Full Super Admin</strong></span>
                          </div>
                        </div>
                      </div>

                      {!adm.is_default && (
                        <div className="shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isRevokingEmail === adm.email}
                            onClick={() => handleRevokeSuperAdmin(adm)}
                            title="Revoke Super Admin Access"
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl h-8 px-2.5 text-xs font-semibold gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Revoke</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 1: AGENT PERFORMANCE & ACTIVITY ── */}
        {!loading && tab === "agents" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-lg">Sales Team Activity & Performance</h3>
                <p className="text-xs text-white/40">Click any agent card to inspect their assigned leads & real-time activity</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60 font-semibold">
                {agentRows.length} Registered Agent{agentRows.length !== 1 ? "s" : ""}
              </span>
            </div>

            {agentRows.length === 0 ? (
              <div className="py-12 text-center text-white/30">
                No agent activity logged yet. Registered agents will appear here.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agentRows.map((a) => {
                  const winRate = a.totalLeads > 0 ? Math.round((a.won / a.totalLeads) * 100) : 0;
                  return (
                    <div
                      key={a.name}
                      onClick={() => openAgentModal(a)}
                      className="group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-5 shadow-inner hover:bg-white/10 hover:border-violet-500/50 transition-all"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                          <AvatarFallback className="bg-violet-600 text-white font-bold text-sm">
                            {a.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-white truncate group-hover:text-violet-300 transition-colors">{a.name}</p>
                                {a.pseudoName ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    🎭 {a.pseudoName}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-white/35 italic">
                                    (No Pseudo Set)
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-white/40 truncate mt-0.5">{a.email !== "—" ? a.email : "Active Team Member"}</p>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {/* Upper: Department Badge */}
                              {a.role === "admin" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30">
                                  🏢 Executive Administration
                                </span>
                              ) : a.departmentId === "ecommerce-department" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                                  🛒 E-commerce Department
                                </span>
                              ) : a.departmentId === "sales-department" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                                  📞 Sales Department
                                </span>
                              ) : a.departmentId === "production-house" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30">
                                  🎨 Production House
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30">
                                  🏢 {a.departmentName || "General Department"}
                                </span>
                              )}

                              {/* Lower: Role / Designation Badge */}
                              {a.role === "admin" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-violet-600/30 text-violet-200 border border-violet-500/40">
                                  🛡️ Admin
                                </span>
                              ) : a.role === "manager" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-gradient-to-r from-purple-500/25 to-pink-500/25 text-purple-200 ring-1 ring-purple-400/40 shadow-sm shadow-purple-500/10">
                                  <Sparkles className="size-2.5 text-purple-300 shrink-0" />
                                  <span>{a.designation || (a.departmentName ? `${a.departmentName} Manager` : "Department Manager")}</span>
                                </span>
                              ) : a.role === "team_leader" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 shadow-sm shadow-amber-500/10">
                                  <Star className="size-2.5 text-amber-400 fill-amber-400 shrink-0" />
                                  <span>{a.designation || a.roleTitle || (a.departmentName ? `${a.departmentName} Team Leader` : "Team Leader")}</span>
                                </span>
                              ) : a.designation ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-md font-bold bg-purple-500/20 text-purple-200 border border-purple-500/30 shadow-sm">
                                  💼 {a.designation}
                                </span>
                              ) : a.role === "custom" && a.roleTitle ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40">
                                  ✨ {a.roleTitle}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-white/10 text-white/80 border border-white/20">
                                  👤 Working Agent
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center my-4">
                        <div className="rounded-lg bg-white/5 p-2">
                          <p className="text-xs text-white/40">Assigned</p>
                          <p className="text-lg font-bold text-white">{a.totalLeads}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2">
                          <p className="text-xs text-white/40">Approached</p>
                          <p className="text-lg font-bold text-violet-300">{a.contacted}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2">
                          <p className="text-xs text-white/40">Won Deals</p>
                          <p className="text-lg font-bold text-emerald-400">{a.won}</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-white/60">
                          <span>Deal Win Rate</span>
                          <span className="font-bold text-emerald-400">{winRate}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${winRate}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 mt-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Globe className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          {a.role === "admin" ? (
                            <span className="text-[10px] text-violet-300 font-semibold truncate">All {availableWebsites.length} Websites</span>
                          ) : a.assignedWebsites && a.assignedWebsites.length > 0 ? (
                            <span className="text-[10px] text-emerald-300 font-semibold truncate">
                              {a.assignedWebsites.length} Site{a.assignedWebsites.length > 1 ? "s" : ""} Assigned
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-300/80 font-semibold truncate">
                              0 Sites (Silent / No Beeps)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-violet-400/80 group-hover:text-violet-300 font-medium flex items-center gap-1 shrink-0">
                          Configure & Inspect →
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: LEADS TABLE ── */}
        {!loading && tab === "leads" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-widest text-white/40">
                  <th className="px-5 py-3 text-left">Lead</th>
                  <th className="px-5 py-3 text-left">Company</th>
                  <th className="px-5 py-3 text-left">Agent</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-white/30">
                      No leads in database yet. Import leads to see them here.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-violet-600/30 text-xs font-bold text-violet-300">
                              {lead.name?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-white">{lead.name}</p>
                            <p className="text-xs text-white/40">{lead.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-white/60">{lead.company || "—"}</td>
                      <td className="px-5 py-3.5 text-white/60">{lead.assigned_agent_name || lead.agent || "Unassigned"}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(lead.status)}`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-white/40">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TAB 3: EMAIL LOGS TABLE ── */}
        {!loading && tab === "emails" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-widest text-white/40">
                  <th className="px-5 py-3 text-left">Subject</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {customerEmailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-white/30">
                      No customer email logs yet. Automated emails sent to leads will appear here.
                    </td>
                  </tr>
                ) : (
                  customerEmailLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="px-5 py-3.5 text-white/80">{log.subject || "—"}</td>
                      <td className="px-5 py-3.5 text-white/50 capitalize">{(log as any).sequence_type || log.type || "automation"}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(log.status)}`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-white/40">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── AGENT INSPECTOR MODAL ── */}
      {typeof document !== "undefined" && selectedAgent && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-6 shadow-2xl space-y-5 sm:space-y-6 max-h-[90dvh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-white/10 pb-4 gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <UserCheck className="h-5 w-5 text-violet-400 shrink-0" />
                  <h3 className="text-xl font-bold text-white">
                    Agent Workspace: <span className="text-violet-300">{selectedAgent.name}</span>
                  </h3>
                  {selectedAgent.pseudoName ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      🎭 {selectedAgent.pseudoName}
                    </span>
                  ) : (
                    <span className="text-xs text-white/40 italic">
                      (No Pseudo Set)
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-1">
                  {selectedAgent.email !== "—" ? selectedAgent.email : "Active Team Member"} · Inspecting assigned leads, department & real-time activity
                </p>
              </div>

              {/* Upper = Department, Lower = Role / Designation */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {selectedAgent.role === "admin" ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30">
                    🏢 Executive Administration
                  </span>
                ) : selectedAgent.departmentId === "ecommerce-department" ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                    🛒 E-commerce Department
                  </span>
                ) : selectedAgent.departmentId === "sales-department" ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                    📞 Sales Department
                  </span>
                ) : selectedAgent.departmentId === "production-house" ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30">
                    🎨 Production House
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30">
                    🏢 {selectedAgent.departmentName || "General Department"}
                  </span>
                )}

                {selectedAgent.role === "admin" ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-violet-600/30 text-violet-200 border border-violet-500/40">
                    🛡️ Admin
                  </span>
                ) : selectedAgent.role === "manager" ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-gradient-to-r from-purple-500/25 to-pink-500/25 text-purple-200 ring-1 ring-purple-400/40">
                    <Sparkles className="size-3 text-purple-300 shrink-0" />
                    <span>{selectedAgent.designation || (selectedAgent.departmentName ? `${selectedAgent.departmentName} Manager` : "Department Manager")}</span>
                  </span>
                ) : selectedAgent.role === "team_leader" ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40">
                    <Star className="size-3 text-amber-400 fill-amber-400 shrink-0" />
                    <span>{selectedAgent.designation || selectedAgent.roleTitle || "Team Leader"}</span>
                  </span>
                ) : selectedAgent.designation ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-md font-bold bg-purple-500/20 text-purple-200 border border-purple-500/30">
                    💼 {selectedAgent.designation}
                  </span>
                ) : selectedAgent.role === "custom" && selectedAgent.roleTitle ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300">
                    ✨ {selectedAgent.roleTitle}
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-white/10 text-white/80 border border-white/20">
                    👤 Working Agent
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAgent(null)}
                className="text-white/60 hover:text-white shrink-0"
              >
                ✕ Close
              </Button>
            </div>

            {(() => {
              const emailLower = (selectedAgent.email || "").toLowerCase();
              const nameLower = (selectedAgent.name || "").toLowerCase();
              const usernameLower = emailLower.includes("@") ? emailLower.split("@")[0]! : "";

              // All leads that belong to this agent (by assigned_agent_name or legacy agent field)
              const agentLeads = leads.filter((l) => {
                const assigned = (l.assigned_agent_name || l.agent || "").toLowerCase();
                if (!assigned) return false;
                return (
                  (emailLower && (assigned === emailLower || assigned.includes(emailLower))) ||
                  (nameLower && (assigned === nameLower || assigned.includes(nameLower))) ||
                  (usernameLower && assigned.includes(usernameLower))
                );
              });

              // Metric 1 — Assigned Leads: leads where Admin assigned to this agent
              // (assigned_at is set AND imported_by is NOT the agent's own email)
              const assignedLeads = agentLeads.filter((l: any) =>
                l.assigned_at && (l.imported_by || "").toLowerCase() !== emailLower
              );

              // Metric 2 — Agent Imported: leads the agent personally imported
              const agentImportedLeads = agentLeads.filter((l: any) =>
                l.imported_by && l.imported_by.toLowerCase() === emailLower
              );

              // Metric 3 — Contacted: leads currently in contacted status
              const contactedLeads = agentLeads.filter((l: any) => (l.status || "").toLowerCase() === "contacted");

              // Metric 4 — Replied: leads currently in replied status
              const repliedLeads = agentLeads.filter((l: any) => (l.status || "").toLowerCase() === "replied");

              // Metric 5 — Booked: leads currently in booked status
              const bookedLeads = agentLeads.filter((l: any) => (l.status || "").toLowerCase() === "booked");

              // Metric 6 — Won: leads currently in won status
              const wonLeads = agentLeads.filter((l: any) => (l.status || "").toLowerCase() === "won");

              const isTargetAdmin = isAdminEmail(selectedAgent.email);
              const currentSelectedWebsites = isTargetAdmin
                ? availableWebsites.map(w => w.slug)
                : (agentAssignedWebsitesMap[emailLower] || []);

              return (
                <div className="space-y-5">
                  {/* ── Role & Authority Level ── */}
                  {!isTargetAdmin && (
                    <div className="rounded-xl border border-violet-500/40 bg-violet-950/20 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-violet-400" />
                            <h4 className="text-sm font-bold text-white">Role & Authority</h4>
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              {selectedAgent.roleTitle || selectedAgent.role || "Working Agent"}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/50 mt-0.5">
                            Set this user's official CRM authority: Working Agent, Team Leader, Department Manager, or Custom Title.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: "agent", label: "Working Agent", icon: "👤" },
                            { id: "team_leader", label: "🌟 Team Leader", icon: "🌟" },
                            { id: "manager", label: "🟣 Dept Manager", icon: "🏢" },
                            { id: "custom", label: "✨ Custom Title", icon: "✍️" },
                          ].map((opt) => {
                            const isSel = editingRoleValue === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setEditingRoleValue(opt.id as any)}
                                className={`p-2.5 rounded-xl border text-left transition-all ${
                                  isSel
                                    ? "bg-violet-600/30 border-violet-500 text-white font-bold shadow-sm"
                                    : "bg-white/5 border-white/10 hover:border-white/20 text-white/60 hover:text-white"
                                }`}
                              >
                                <p className="text-xs truncate">{opt.label}</p>
                              </button>
                            );
                          })}
                        </div>

                        {editingRoleValue === "custom" && (
                          <div className="space-y-1 animate-fade-in">
                            <label className="text-[11px] text-indigo-300 font-semibold">Custom Role Title</label>
                            <input
                              type="text"
                              value={customRoleTitleInput}
                              onChange={(e) => setCustomRoleTitleInput(e.target.value)}
                              placeholder="e.g. Senior QA Lead, Outreach Director..."
                              className="w-full h-9 rounded-xl border border-indigo-500/40 bg-slate-900 px-3 text-xs text-white placeholder-white/30 focus:border-indigo-400 focus:outline-none"
                            />
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <select
                            value={selectedRoleDeptId}
                            onChange={(e) => setSelectedRoleDeptId(e.target.value)}
                            className="w-full sm:flex-1 h-9 rounded-xl border border-white/10 bg-slate-900 px-3 text-xs text-white focus:border-violet-500 focus:outline-none cursor-pointer"
                          >
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                Department: {d.name}
                              </option>
                            ))}
                          </select>

                          <Button
                            type="button"
                            size="sm"
                            disabled={savingRole}
                            onClick={handleSaveAgentRole}
                            className="w-full sm:w-auto h-9 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shrink-0"
                          >
                            {savingRole ? "Saving..." : "Save Role & Authority"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Department Assignment & Switcher ── */}
                  {!isTargetAdmin && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <FolderKanban className="h-4 w-4 text-violet-400" />
                            <h4 className="text-sm font-bold text-white">Assigned Department</h4>
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              {selectedAgent.departmentName || "Production House"}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/50 mt-0.5">
                            Click below to switch this agent's department. Sidebar menus, page access & task flows will immediately adapt.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {departments.map((dept) => {
                          const isCurrent = (selectedAgent.departmentId || "production-house") === dept.id;
                          const icon = dept.id === "ecommerce-department" ? "🛒" : dept.id === "sales-department" ? "📞" : "🎨";
                          return (
                            <button
                              key={dept.id}
                              type="button"
                              onClick={() => handleReassignAgentDepartment(selectedAgent.email, dept.id)}
                              className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                isCurrent
                                  ? "bg-violet-600/20 border-violet-500 text-white shadow-md shadow-violet-500/10"
                                  : "bg-white/5 border-white/10 hover:border-white/20 text-white/60 hover:text-white"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate text-white">{icon} {dept.name}</p>
                                <p className="text-[10px] text-white/40 truncate mt-0.5">
                                  {isCurrent ? "✓ Active Department" : "Click to reassign"}
                                </p>
                              </div>
                              {isCurrent && (
                                <div className="w-5 h-5 rounded-md flex items-center justify-center bg-violet-600 border border-violet-500 text-white shrink-0">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Agent Designation (Job Title) ── */}
                  {!isTargetAdmin && (
                    <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-purple-400" />
                            <h4 className="text-sm font-bold text-white">Official Job Designation</h4>
                            {selectedAgent.designation ? (
                              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30">
                                💼 {selectedAgent.designation}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                No Designation Set
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/50 mt-0.5">
                            Select or custom-type this member's designation. It will instantly update across their card and CRM profiles.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                        <select
                          value={editingDesignationValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingDesignationValue(val);
                            if (val !== "other") {
                              setCustomDesignationInput("");
                            }
                          }}
                          className="w-full sm:flex-1 h-9 rounded-xl border border-white/10 bg-slate-900 px-3 text-xs text-white focus:border-purple-500 focus:outline-none cursor-pointer"
                        >
                          <option value="">Select Designation...</option>
                          {(DEPARTMENT_DESIGNATIONS[selectedAgent.departmentId || "production-house"] || DEFAULT_DESIGNATIONS).map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                          <option value="other">✍️ Other (Custom Designation)</option>
                        </select>

                        {editingDesignationValue === "other" && (
                          <input
                            type="text"
                            value={customDesignationInput}
                            onChange={(e) => setCustomDesignationInput(e.target.value)}
                            placeholder="Type custom designation..."
                            className="w-full sm:flex-1 h-9 rounded-xl border border-purple-500/40 bg-slate-900 px-3 text-xs text-white placeholder-white/30 focus:border-purple-500 focus:outline-none"
                          />
                        )}

                        <Button
                          type="button"
                          size="sm"
                          disabled={savingDesignation}
                          onClick={() => {
                            const finalDesig = editingDesignationValue === "other" ? customDesignationInput.trim() : editingDesignationValue.trim();
                            handleSaveAgentDesignation(selectedAgent.email, finalDesig);
                          }}
                          className="h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shrink-0"
                        >
                          {savingDesignation ? "Saving..." : "Save Designation"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── Agent Persona (Display / Pseudo Name) ── */}
                  {!isTargetAdmin && (
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🎭</span>
                            <h4 className="text-sm font-bold text-white">Live Chat Persona (Display / Pseudo Name)</h4>
                            {selectedAgent.pseudoName ? (
                              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                                🎭 {selectedAgent.pseudoName}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                No Pseudo Set
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/50 mt-0.5">
                            Set this agent's public persona name. Website visitors will only see this name in chat, keeping their real identity protected.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={editingPseudoName}
                          onChange={(e) => setEditingPseudoName(e.target.value)}
                          placeholder="e.g. Michael, Jack, Alex, Sarah"
                          className="w-full sm:flex-1 h-9 rounded-xl border border-indigo-500/40 bg-slate-900 px-3 text-xs text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingPseudoName}
                          onClick={() => handleSaveAgentPseudoName(selectedAgent.email, editingPseudoName)}
                          className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0"
                        >
                          {savingPseudoName ? "Saving..." : "Save Persona"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* ── LiveChat AI Website Permissions & Assignment ── */}
                  <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-violet-400" />
                          <h4 className="text-sm font-bold text-white">LiveChat AI Website Permissions</h4>
                          {isTargetAdmin ? (
                            <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-bold border border-violet-500/30">
                              Admin (All Websites)
                            </span>
                          ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              currentSelectedWebsites.length === 0
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                              {currentSelectedWebsites.length === 0 ? 'No Websites Selected (Silent — No Beeps/Chats)' : `${currentSelectedWebsites.length} Website(s) Assigned`}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          {isTargetAdmin
                            ? "Admins automatically have 100% full access to all websites and hear all alerts."
                            : "Assign specific websites to this agent. If NO website is selected, this agent will NOT hear any audio beeps or receive livechat notifications. Monitoring, chats, visitor analytics, and audio beeps strictly apply only to selected websites."}
                        </p>
                      </div>

                      {!isTargetAdmin && (
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              const allSlugs = availableWebsites.map(w => w.slug);
                              setAgentAssignedWebsitesMap(prev => ({ ...prev, [emailLower]: allSlugs }));
                            }}
                            className="text-[11px] text-violet-400 hover:text-violet-300 underline font-medium cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-white/20">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAgentAssignedWebsitesMap(prev => ({ ...prev, [emailLower]: [] }));
                            }}
                            className="text-[11px] text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
                          >
                            Clear All (0 Sites / Silent)
                          </button>
                        </div>
                      )}
                    </div>

                    {!isTargetAdmin && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                        {availableWebsites.map((site) => {
                          const isChecked = currentSelectedWebsites.includes(site.slug);
                          return (
                            <div
                              key={site.slug}
                              onClick={() => {
                                const prev = currentSelectedWebsites;
                                const next = isChecked ? prev.filter(s => s !== site.slug) : [...prev, site.slug];
                                setAgentAssignedWebsitesMap(p => ({ ...p, [emailLower]: next }));
                              }}
                              className={`cursor-pointer rounded-xl p-3 border transition-all flex items-start justify-between gap-2 ${
                                isChecked
                                  ? 'bg-violet-600/20 border-violet-500 shadow-md shadow-violet-500/10 text-white'
                                  : 'bg-white/5 border-white/10 hover:border-white/20 text-white/60 hover:text-white'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate text-white">{site.name}</p>
                                <p className="text-[10px] text-white/40 truncate">{site.domain}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                isChecked
                                  ? 'bg-violet-600 border-violet-500 text-white'
                                  : 'border-white/20 bg-black/20'
                              }`}>
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!isTargetAdmin && (
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-[11px] text-white/40">
                          LiveChat AI will immediately sync these permissions.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingPermissions}
                          onClick={() => handleSaveAgentWebsites(selectedAgent.email, currentSelectedWebsites)}
                          className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl px-4 py-1.5 h-auto shadow-md"
                        >
                          {savingPermissions ? 'Saving...' : 'Save Website Permissions'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 6-Metric Reporting Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Assigned<br/>Leads</p>
                      <p className="text-xl font-bold text-white">{assignedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Agent<br/>Imported</p>
                      <p className="text-xl font-bold text-blue-300">{agentImportedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Contacted</p>
                      <p className="text-xl font-bold text-fuchsia-300">{contactedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Replied</p>
                      <p className="text-xl font-bold text-cyan-300">{repliedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Booked</p>
                      <p className="text-xl font-bold text-amber-300">{bookedLeads.length}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-[10px] text-white/40 leading-tight mb-1">Won</p>
                      <p className="text-xl font-bold text-emerald-400">{wonLeads.length}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Assigned Leads List ({agentLeads.length})</h4>
                    {agentLeads.length === 0 ? (
                      <p className="text-xs text-white/40 py-6 text-center rounded-xl bg-white/5">
                        No leads assigned to this agent yet. Leads imported by or assigned to this agent will appear here.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {agentLeads.map((l) => (
                          <div key={l.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-xs">
                            <div>
                              <p className="font-semibold text-white">{l.name}</p>
                              <p className="text-white/40">{l.email} · {l.company || "—"}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusBadge(l.status)}`}>
                              {l.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* ── GRANT SUPER ADMIN MODAL ── */}
      {typeof document !== "undefined" && showAddAdminModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-violet-500/30 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Grant Super Admin Access</h3>
                  <p className="text-xs text-white/50">Pre-approve an Admin by email address</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddAdminModal(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </Button>
            </div>

            <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-3.5 text-xs text-white/70 space-y-1">
              <p className="font-semibold text-violet-300">✨ How this works:</p>
              <p className="text-white/60">
                You can add any email address here. When that person signs in to the CRM (using Google OAuth or email), they will immediately have <strong>100% Super Admin rights</strong>. They will skip all approval screens and have full control over the CRM.
              </p>
            </div>

            <form onSubmit={handleAddSuperAdmin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">Admin Email Address *</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="e.g. colleague@company.com"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">Full Name (Optional)</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. Alex Hunter"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddAdminModal(false)}
                  className="text-white/60 hover:text-white text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingAdmin || !newAdminEmail}
                  className="gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-violet-600 to-fuchsia-600 text-white font-bold text-xs hover:opacity-90 shadow-lg shadow-violet-500/20 active:scale-95 transition-all"
                >
                  {isSubmittingAdmin ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Granting Access...
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4 text-amber-200" />
                      Grant Super Admin Access
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-white/30">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live — auto refreshes every 30 seconds · Supabase Realtime active
      </div>
    </div>
  );
}
