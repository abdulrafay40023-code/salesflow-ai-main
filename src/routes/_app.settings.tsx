import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Copy,
  Globe,
  Palette,
  PhoneCall,
  ShoppingBag,
  Sparkles,
  UserRound,
  Users,
  Briefcase,
  X,
  Check,
  Lock,
  Shield,
  Star,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/crm/Topbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCrm } from "@/lib/crm-store";
import { isAdminEmail, ADMIN_EMAILS } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import {
  fetchPendingSignups,
  approvePendingSignup,
  removePendingOrApprovedSignup,
  type PendingSignup,
} from "@/lib/pending-signups";
import {
  fetchAllDepartments,
  assignDepartmentManagerSync,
  demoteManagerToAgentSync,
  updateUserRoleAndTitleSync,
  type Department,
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

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Teals CRM" },
      { name: "description", content: "Manage your profile, team members, and Meta Lead Ads integration." },
      { property: "og:title", content: "Settings — Teals CRM" },
    ],
  }),
  component: SettingsPage,
});

type DbProfile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "manager" | "agent" | string;
  department_id?: string;
  department_name?: string;
  created_at: string;
  avatar_url?: string;
};

function SettingsPage() {
  const { user, updateUserProfile } = useCrm();
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));
  const isManager = Boolean(user?.role === "manager");
  const isManagerOrAdmin = isAdmin || isManager;

  const [teamMembers, setTeamMembers] = useState<DbProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingSignup[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Profile Editor state
  const computedDefaultRoleTitle = (isAdmin || user?.role === "admin")
    ? (user?.role_title && user.role_title !== "Manager" ? user.role_title : "Admin")
    : (user?.role_title || user?.designation || (user?.role === "manager" ? "Manager" : "Support Specialist"));
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profilePseudo, setProfilePseudo] = useState(user?.pseudo_name || "");
  const [profileRoleTitle, setProfileRoleTitle] = useState(computedDefaultRoleTitle);
  const [profilePhone, setProfilePhone] = useState(user?.phone || "");
  const [profileSignature, setProfileSignature] = useState(user?.name ? `Best regards,\n${user.name}` : "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (user?.name) setProfileName(user.name);
    if (user?.pseudo_name) setProfilePseudo(user.pseudo_name);
    const defRole = (isAdmin || user?.role === "admin")
      ? (user?.role_title && user.role_title !== "Manager" ? user.role_title : "Admin")
      : (user?.role_title || user?.designation || (user?.role === "manager" ? "Manager" : "Support Specialist"));
    setProfileRoleTitle(defRole);
    if (user?.phone) setProfilePhone(user.phone);
  }, [user, isAdmin]);

  const handleSaveProfile = async () => {
    const cleanName = profileName.trim();
    const cleanPseudo = profilePseudo.trim();
    if (!cleanName) {
      toast.error("Real full name is required.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const finalRoleTitle = isManagerOrAdmin ? profileRoleTitle.trim() : (user?.role_title || computedDefaultRoleTitle);
      await updateUserProfile({
        name: cleanName,
        pseudo_name: cleanPseudo,
        role_title: finalRoleTitle,
        phone: profilePhone.trim(),
      });
      toast.success(
        cleanPseudo
          ? `Profile saved! Your active display persona is "${cleanPseudo}".`
          : "Profile details updated successfully!"
      );
    } catch (err: any) {
      toast.error("Failed to save profile: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Role & Department Assignment Modal state
  const [roleModal, setRoleModal] = useState<{
    open: boolean;
    member: DbProfile | null;
    selectedRole: "agent" | "team_leader" | "manager" | "custom";
    customRoleTitle: string;
    selectedDeptId: string;
    saving: boolean;
  }>({
    open: false,
    member: null,
    selectedRole: "agent",
    customRoleTitle: "",
    selectedDeptId: "",
    saving: false,
  });

  const openRoleModal = (m: DbProfile) => {
    let r: "agent" | "team_leader" | "manager" | "custom" = "agent";
    let title = "";
    let deptId = m.department_id || departments[0]?.id || "";

    if (m.role === "manager") {
      r = "manager";
    } else {
      try {
        if (m.avatar_url) {
          const parsed = JSON.parse(m.avatar_url);
          if (parsed.role === "team_leader" || (parsed.role_title && parsed.role_title.toLowerCase().includes("team leader"))) {
            r = "team_leader";
            title = parsed.role_title || "Team Leader";
          } else if (parsed.role === "custom" || (parsed.role_title && !["agent", "working agent", "manager"].includes(parsed.role_title.toLowerCase()))) {
            r = "custom";
            title = parsed.role_title || "";
          }
          if (parsed.department_id) deptId = parsed.department_id;
        }
      } catch {}
    }

    setRoleModal({
      open: true,
      member: m,
      selectedRole: r,
      customRoleTitle: title,
      selectedDeptId: deptId,
      saving: false,
    });
  };

  // Member Designation Modal state
  const [designationModal, setDesignationModal] = useState<{
    open: boolean;
    member: DbProfile | null;
    selectedDesignation: string;
    customInput: string;
    saving: boolean;
  }>({
    open: false,
    member: null,
    selectedDesignation: "",
    customInput: "",
    saving: false,
  });

  const getDeptIcon = (iconName?: string) => {
    switch (iconName) {
      case "Palette": return Palette;
      case "ShoppingBag": return ShoppingBag;
      case "PhoneCall": return PhoneCall;
      default: return Briefcase;
    }
  };

  async function fetchTeam() {
    setLoadingTeam(true);
    try {
      const defaultAdminNames: Record<string, string> = {
        "garryamelia6265@gmail.com": "Garry Amelia",
        "jennifer.cisternino2027@gmail.com": "Jennifer Cisternino",
        "tzafar04@gmail.com": "T Zafar",
        "annusraees@gmail.com": "Annus Raees",
      };

      // Fetch all departments & profiles concurrently
      const [depts, { data: profiles }] = await Promise.all([
        fetchAllDepartments(),
        supabase
          .from("profiles")
          .select("id,email,full_name,avatar_url,role,created_at")
          .order("created_at", { ascending: true }),
      ]);

      setDepartments(depts);

      const membersMap: Record<string, DbProfile> = {};

      // 1. Ensure all registered Admins are always populated
      ADMIN_EMAILS.forEach((admEmail) => {
        const key = admEmail.toLowerCase();
        const existing = profiles?.find((p) => p.email?.toLowerCase() === key);
        membersMap[key] = {
          id: existing?.id || `admin-${key}`,
          email: admEmail,
          full_name: existing?.full_name || defaultAdminNames[key] || admEmail.split("@")[0],
          role: "admin",
          created_at: existing?.created_at || new Date().toISOString(),
          avatar_url: existing?.avatar_url || JSON.stringify({ phone: "", approved: true, status: "approved" }),
        };
      });

      // 2. Add approved agents from Supabase profiles & match manager departments
      if (profiles) {
        profiles.forEach((p: any) => {
          if (!p.email) return;
          const key = p.email.toLowerCase();
          const isMainAdmin = isAdminEmail(p.email);
          let isApproved = isMainAdmin;
          let role: DbProfile["role"] = isMainAdmin ? "admin" : (p.role || "agent");
          let department_id: string | undefined = undefined;
          let department_name: string | undefined = undefined;

          if (p.avatar_url) {
            try {
              const meta = JSON.parse(p.avatar_url);
              if (typeof meta.approved === "boolean") isApproved = meta.approved;
              if (meta.role && !isMainAdmin) role = meta.role;
              if (meta.department_id) department_id = meta.department_id;
            } catch {}
          }

          // Check if this user is assigned as manager of any department
          const managedDept = depts.find(
            (d) => d.manager_email && d.manager_email.toLowerCase().trim() === key
          );
          if (managedDept && !isMainAdmin) {
            role = "manager";
            department_id = managedDept.id;
            department_name = managedDept.name;
          } else if (role === "manager" && department_id) {
            department_name = depts.find((d) => d.id === department_id)?.name;
          }

          if (isApproved) {
            membersMap[key] = {
              id: p.id,
              email: p.email,
              full_name: p.full_name || defaultAdminNames[key] || p.email.split("@")[0],
              role,
              department_id,
              department_name,
              created_at: p.created_at,
              avatar_url: p.avatar_url,
            };
          }
        });
      }

      // Sort: Admins first (Garry Amelia, Jennifer Cisternino, Talha Zafar, Annus Raees), then Managers and Agents alphabetically
      const adminOrder = [
        "garryamelia6265@gmail.com",
        "jennifer.cisternino2027@gmail.com",
        "tzafar04@gmail.com",
        "annusraees@gmail.com",
      ];
      const sortedMembers = Object.values(membersMap).sort((a, b) => {
        const aIsAdmin = a.role === "admin" || isAdminEmail(a.email);
        const bIsAdmin = b.role === "admin" || isAdminEmail(b.email);
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        if (aIsAdmin && bIsAdmin) {
          const aIdx = adminOrder.indexOf(a.email.toLowerCase());
          const bIdx = adminOrder.indexOf(b.email.toLowerCase());
          return (aIdx !== -1 ? aIdx : 99) - (bIdx !== -1 ? bIdx : 99);
        }
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });

      setTeamMembers(sortedMembers);

      // Fetch pending signups queue
      if (isAdmin) {
        const reqs = await fetchPendingSignups();
        setPendingRequests(reqs);
      }
    } catch (err) {
      console.error("Failed to load team:", err);
    } finally {
      setLoadingTeam(false);
    }
  }

  // Handle Approve button click
  async function handleApprovePendingRequest(req: PendingSignup) {
    try {
      await approvePendingSignup(req);
      toast.success(`Approved ${req.name} (${req.email})! Profile created in CRM.`);
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to approve user: " + err.message);
    }
  }

  // Handle Reject button click
  async function handleRejectPendingRequest(req: PendingSignup) {
    try {
      await removePendingOrApprovedSignup(req.email);
      toast.success(`Rejected access request for ${req.name} (${req.email}).`);
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to reject user: " + err.message);
    }
  }

  // Handle Demoting Manager to Agent
  async function handleDemoteToAgent(m: DbProfile) {
    if (isAdminEmail(m.email)) {
      toast.error("Admin role cannot be changed.");
      return;
    }
    try {
      await demoteManagerToAgentSync({ managerEmail: m.email, departments });
      toast.success(`Updated ${m.full_name || m.email}'s role to Agent.`);
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to update role: " + err.message);
    }
  }

  // Handle Confirm Role Assignment (Admin, Manager, Team Leader, Agent, Custom)
  async function handleConfirmRoleAssignment() {
    if (!roleModal.member) return;
    const memberEmail = roleModal.member.email.toLowerCase().trim();
    if (isAdminEmail(memberEmail)) {
      toast.error("Admin role is permanent and cannot be modified.");
      return;
    }

    setRoleModal((prev) => ({ ...prev, saving: true }));
    try {
      const finalRole = roleModal.selectedRole;
      let finalTitle = "";
      const targetDept = departments.find((d) => d.id === roleModal.selectedDeptId);

      if (finalRole === "manager") {
        if (!roleModal.selectedDeptId) {
          toast.error("Please select a department for the Manager.");
          setRoleModal((prev) => ({ ...prev, saving: false }));
          return;
        }
        await assignDepartmentManagerSync({
          deptId: roleModal.selectedDeptId,
          managerEmail: memberEmail,
          managerName: roleModal.member.full_name,
          departments,
        });
        finalTitle = targetDept ? `${targetDept.name} Manager` : "Department Manager";
      } else if (finalRole === "team_leader") {
        finalTitle = targetDept ? `${targetDept.name} Team Leader` : "Team Leader";
        await updateUserRoleAndTitleSync({
          email: memberEmail,
          role: "team_leader",
          roleTitle: finalTitle,
          departmentId: roleModal.selectedDeptId || null,
          departmentName: targetDept?.name || null,
        });
      } else if (finalRole === "custom") {
        finalTitle = roleModal.customRoleTitle.trim() || "Specialist";
        await updateUserRoleAndTitleSync({
          email: memberEmail,
          role: "custom",
          roleTitle: finalTitle,
          departmentId: roleModal.selectedDeptId || null,
          departmentName: targetDept?.name || null,
        });
      } else {
        // "agent"
        if (roleModal.member.role === "manager") {
          await demoteManagerToAgentSync({ managerEmail: memberEmail, departments });
        }
        finalTitle = "Support Specialist";
        await updateUserRoleAndTitleSync({
          email: memberEmail,
          role: "agent",
          roleTitle: finalTitle,
          departmentId: roleModal.selectedDeptId || null,
          departmentName: targetDept?.name || null,
        });
      }

      toast.success(`Role updated for ${roleModal.member.full_name || memberEmail}: ${finalTitle || finalRole}!`);
      setRoleModal({
        open: false,
        member: null,
        selectedRole: "agent",
        customRoleTitle: "",
        selectedDeptId: "",
        saving: false,
      });
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to update role: " + err.message);
      setRoleModal((prev) => ({ ...prev, saving: false }));
    }
  }

  // Handle Remove member
  async function handleRemoveMember(m: DbProfile) {
    if (isAdminEmail(m.email)) {
      toast.error("Admin cannot be removed.");
      return;
    }
    try {
      if (m.role === "manager") {
        await demoteManagerToAgentSync({ managerEmail: m.email, departments });
      }
      await removePendingOrApprovedSignup(m.email);
      toast.success(`Removed ${m.full_name || m.email} from CRM.`);
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to remove member: " + err.message);
    }
  }

  // Handle Save Member Designation
  async function handleSaveMemberDesignation() {
    if (!designationModal.member) return;
    const finalDesig = designationModal.selectedDesignation === "other"
      ? designationModal.customInput.trim()
      : designationModal.selectedDesignation.trim();

    setDesignationModal((prev) => ({ ...prev, saving: true }));
    try {
      const cleanEmail = designationModal.member.email.toLowerCase().trim();
      const { data: prof } = await supabase.from("profiles").select("*").eq("email", cleanEmail).maybeSingle();

      let meta: any = { approved: true, status: "approved" };
      if (prof?.avatar_url) {
        try { meta = JSON.parse(prof.avatar_url); } catch {}
      }
      meta.designation = finalDesig;

      if (prof) {
        await supabase.from("profiles").update({ avatar_url: JSON.stringify(meta) }).eq("email", cleanEmail);
      } else {
        await supabase.from("profiles").upsert({
          email: cleanEmail,
          full_name: designationModal.member.full_name,
          role: designationModal.member.role,
          avatar_url: JSON.stringify(meta),
        }, { onConflict: "email" });
      }

      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("teals-crm-profiles-sync");
          bc.postMessage({ type: "PROFILE_UPDATED", email: cleanEmail, designation: finalDesig });
          bc.close();
        }
      } catch {}

      toast.success(`💼 Designation "${finalDesig || "None"}" saved for ${designationModal.member.full_name || cleanEmail}!`);
      setDesignationModal({ open: false, member: null, selectedDesignation: "", customInput: "", saving: false });
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to save designation: " + err.message);
      setDesignationModal((prev) => ({ ...prev, saving: false }));
    }
  }

  useEffect(() => {
    fetchTeam();

    const subId = Math.random().toString(36).substring(2, 9);
    const profileSub = supabase
      .channel(`settings-profiles-${subId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchTeam())
      .subscribe();

    const signupsSub = supabase
      .channel(`settings-signups-${subId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_signups" }, () => fetchTeam())
      .subscribe();

    const projLiveChannel = supabase.channel(`settings-projects-sync-${subId}`, {
      config: { broadcast: { self: true } },
    });
    projLiveChannel
      .on("broadcast", { event: "crm_departments_updated" }, () => fetchTeam())
      .on("broadcast", { event: "crm_profiles_updated" }, () => fetchTeam())
      .subscribe();

    let projBc: any = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        projBc = new BroadcastChannel("teals-crm-projects-sync");
        projBc.onmessage = (e: any) => {
          if (e?.data?.event === "departments_updated" || e?.data?.event === "profiles_updated") {
            fetchTeam();
          }
        };
      }
    } catch {}

    const interval = setInterval(fetchTeam, 10000);

    return () => {
      profileSub.unsubscribe();
      signupsSub.unsubscribe();
      supabase.removeChannel(projLiveChannel);
      if (projBc) projBc.close();
      clearInterval(interval);
    };
  }, [isAdmin]);

  const initials = (user?.name ?? "NX")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your workspace, team and integrations." />

      <Tabs defaultValue="profile">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          {[
            ["profile", "Profile", UserRound],
            ["team", "Team Members", Users],
            ["meta", "Meta Lead Ads", Globe],
          ]
            .filter(([v]) => isManagerOrAdmin || v === "profile")
            .map(([v, label, Icon]) => {
              const I = Icon as typeof UserRound;
              return (
                <TabsTrigger key={v as string} value={v as string} className="rounded-lg">
                  <I className="size-4" /> {label as string}
                </TabsTrigger>
              );
            })}
        </TabsList>

        {/* ── PROFILE ──────────────────────────────── */}
        <TabsContent value="profile" className="mt-5">
          <div className="panel max-w-2xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display text-lg font-bold">{profileName || user?.name || "Agent"}</p>
                    {user?.pseudo_name && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-bold text-violet-300">
                        🎭 Persona: {user.pseudo_name}
                      </span>
                    )}
                    {isAdmin ? (
                      <Badge variant="default" className="rounded-full text-[10px] capitalize">
                        Admin
                      </Badge>
                    ) : user?.role === "manager" ? (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">
                        Manager
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="rounded-full text-[10px] capitalize">
                        Agent
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                  {user?.designation && (
                    <p className="text-[11px] text-purple-400 font-medium mt-0.5">💼 {user.designation}</p>
                  )}
                </div>
              </div>

              {profilePseudo && (
                <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-3 text-right">
                  <p className="text-[10px] text-violet-400 font-semibold uppercase">Public Chat Identity</p>
                  <p className="text-sm font-bold text-white">{profilePseudo}</p>
                  <p className="text-[11px] text-slate-400">{profileRoleTitle || "Support Specialist"}</p>
                </div>
              )}
            </div>

            <Separator className="my-2" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-200">
                  Real Full Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  className="rounded-xl border-border bg-surface-2"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your official real name"
                />
                <p className="text-[10px] text-muted-foreground">Internal name visible only to Admins.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-violet-300">
                    Pseudo Name (Display Name) <span className="text-red-400">*</span>
                  </Label>
                  <span className="text-[10px] text-violet-400 font-medium">Shown to Clients</span>
                </div>
                <Input
                  className="rounded-xl border-violet-500/40 bg-violet-950/20 text-white placeholder:text-slate-500 focus:border-violet-400"
                  value={profilePseudo}
                  onChange={(e) => setProfilePseudo(e.target.value)}
                  placeholder="e.g. Jack, Alex, Mike"
                />
                <p className="text-[10px] text-violet-300/80">Website visitors see this name in Live Chat.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-200">
                    Role / Department Title (Display Title)
                  </Label>
                  {!isManagerOrAdmin && (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium">
                      <Lock className="size-3" /> Managed by Admin & Manager
                    </span>
                  )}
                </div>
                <Input
                  className={`rounded-xl border-border bg-surface-2 ${!isManagerOrAdmin ? "cursor-not-allowed opacity-75" : ""}`}
                  value={profileRoleTitle}
                  onChange={(e) => isManagerOrAdmin && setProfileRoleTitle(e.target.value)}
                  readOnly={!isManagerOrAdmin}
                  placeholder="e.g. Manager, Support Specialist"
                />
                <p className="text-[10px] text-muted-foreground">
                  {isManagerOrAdmin
                    ? "Displayed right underneath your pseudo name."
                    : "Role is set by CRM Administrator or Department Manager."}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-200">Work Email</Label>
                <Input
                  className="rounded-xl border-border bg-surface-2 cursor-not-allowed opacity-75"
                  value={user?.email ?? ""}
                  readOnly
                />
                <p className="text-[10px] text-muted-foreground">Managed by CRM administrator.</p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-200">Phone Number</Label>
                <Input
                  className="rounded-xl border-border bg-surface-2"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-200">Email Signature</Label>
                <Textarea
                  className="min-h-24 rounded-xl border-border bg-surface-2 font-mono text-xs"
                  value={profileSignature}
                  onChange={(e) => setProfileSignature(e.target.value)}
                  placeholder="Add your email signature..."
                />
              </div>
            </div>

            <Button
              className="mt-4 rounded-xl bg-primary text-primary-foreground font-semibold px-6 shadow-md"
              onClick={handleSaveProfile}
              disabled={isSavingProfile || !profileName.trim()}
            >
              {isSavingProfile ? (
                <>
                  <RefreshCw className="size-4 animate-spin mr-2" />
                  Saving Profile...
                </>
              ) : (
                "Save Profile Changes"
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ── TEAM MEMBERS (live from Supabase profiles with Approval & Removal) ── */}
        <TabsContent value="team" className="mt-5">
          <div className="space-y-4">

            {/* ── PENDING APPROVAL REQUESTS ── */}
            {isAdmin && pendingRequests.length > 0 && (
              <div className="panel divide-y divide-border">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <h2 className="font-display text-lg font-bold flex items-center gap-2">
                      🟡 Pending Approval Requests
                      <span className="rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5">{pendingRequests.length}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground">New agents waiting for your approval to access the CRM</p>
                  </div>
                </div>
                {pendingRequests.map((req) => {
                  const reqInitials = req.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={req.id} className="flex flex-wrap items-center justify-between gap-4 p-5 bg-amber-500/5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs font-bold">{reqInitials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="truncate text-sm font-semibold">{req.name}</p>
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">Pending Approval</span>
                            {req.pseudo_name && (
                              <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-[10px] text-violet-300 font-bold">
                                🎭 Pseudo: {req.pseudo_name}
                              </span>
                            )}
                            {req.department_name && (
                              <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] text-blue-400 font-semibold">
                                🏢 {req.department_name}
                              </span>
                            )}
                            {req.designation && (
                              <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-300 font-semibold">
                                💼 {req.designation}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{req.email}</p>
                          {req.phone && <p className="text-[11px] text-muted-foreground/80 mt-0.5">📞 {req.phone}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            Requested: {(() => {
                              const d = req.created_at || (req as any).sent_at;
                              if (!d) return "Recently";
                              const parsed = new Date(d);
                              return isNaN(parsed.getTime()) ? "Recently" : parsed.toLocaleString();
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprovePendingRequest(req)}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 shadow-sm"
                        >
                          ✅ Approve Access
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectPendingRequest(req)}
                          className="rounded-xl text-xs font-semibold px-3 py-1.5"
                        >
                          ❌ Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── APPROVED / ACTIVE MEMBERS ── */}
            <div className="panel divide-y divide-border">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="font-display text-lg font-bold">Active Team Members</h2>
                  <p className="text-sm text-muted-foreground">
                    {loadingTeam ? "Loading..." : `${teamMembers.length} member${teamMembers.length !== 1 ? "s" : ""} with CRM access`}
                  </p>
                </div>
              </div>

              {loadingTeam ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading team...</div>
              ) : teamMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-muted-foreground">
                  <Users className="h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">No team members yet</p>
                  <p className="text-xs">Members appear here once you approve their access request</p>
                </div>
              ) : (
                teamMembers.map((m) => {
                  const memberInitials = (m.full_name || m.email)
                    .split(" ")
                    .map((p: string) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const memberIsAdmin = isAdminEmail(m.email) || m.role === "admin";

                  let phone = "";
                  let designation = "";
                  let pseudo_name = "";
                  let deptName = m.department_name || "";
                  let isApproved = memberIsAdmin;
                  if ((m as any).avatar_url) {
                    try {
                      const parsed = JSON.parse((m as any).avatar_url);
                      phone = parsed.phone || "";
                      designation = parsed.designation || "";
                      pseudo_name = parsed.pseudo_name || "";
                      if (parsed.department_name && !deptName) {
                        deptName = parsed.department_name;
                      }
                      if (typeof parsed.approved === "boolean" && !memberIsAdmin) {
                        isApproved = parsed.approved;
                      }
                    } catch {}
                  }

                  return (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{memberInitials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="truncate text-sm font-semibold">{m.full_name || m.email.split("@")[0]}</p>
                            
                            {memberIsAdmin ? (
                              <Badge variant="default" className="rounded-full text-[10px] capitalize">
                                Admin
                              </Badge>
                            ) : m.role === "manager" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 shadow-sm">
                                <Sparkles className="size-3 text-purple-400" />
                                <span>{deptName ? `${deptName} Manager` : "Department Manager"}</span>
                              </span>
                            ) : (() => {
                              try {
                                if (m.avatar_url) {
                                  const parsed = JSON.parse(m.avatar_url);
                                  if (parsed.role === "team_leader" || (parsed.role_title && parsed.role_title.toLowerCase().includes("team leader"))) {
                                    return (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 shadow-sm">
                                        <Star className="size-3 text-amber-400 fill-amber-400" />
                                        <span>{deptName ? `${deptName} Team Leader` : "Team Leader"}</span>
                                      </span>
                                    );
                                  }
                                  if (parsed.role === "custom" || (parsed.role_title && !["agent", "working agent", "manager", "support specialist"].includes(parsed.role_title.toLowerCase()))) {
                                    return (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300 shadow-sm">
                                        <Sparkles className="size-3 text-indigo-400" />
                                        <span>{parsed.role_title}</span>
                                      </span>
                                    );
                                  }
                                }
                              } catch {}
                              return (
                                <Badge variant="secondary" className="rounded-full text-[10px] capitalize">
                                  Agent
                                </Badge>
                              );
                            })()}

                            {deptName && m.role !== "manager" && !memberIsAdmin && (
                              <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] text-blue-400 font-semibold">
                                🏢 {deptName}
                              </span>
                            )}

                            {designation && (
                              <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-300 font-semibold">
                                💼 {designation}
                              </span>
                            )}

                            {pseudo_name && (
                              <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-300 font-semibold flex items-center gap-1">
                                🎭 {pseudo_name}
                              </span>
                            )}

                            {isApproved && (
                              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.2 text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="size-3" /> Approved
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                          {phone && <p className="text-[11px] text-muted-foreground/80 mt-0.5">📞 {phone}</p>}
                        </div>
                      </div>

                      {isManagerOrAdmin && !memberIsAdmin && (
                        <div className="flex flex-wrap shrink-0 items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRoleModal(m)}
                            className="rounded-xl text-[11px] h-8 px-3 border-violet-500/40 bg-violet-950/20 text-violet-300 hover:bg-violet-500/20 hover:text-white font-semibold gap-1.5"
                          >
                            <Sparkles className="size-3 text-violet-400" />
                            <span>Change Role</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              let curDesig = "";
                              try {
                                if (m.avatar_url) {
                                  const parsed = JSON.parse(m.avatar_url);
                                  curDesig = parsed.designation || "";
                                }
                              } catch {}
                              const deptList = (m.department_id && DEPARTMENT_DESIGNATIONS[m.department_id]) || DEFAULT_DESIGNATIONS;
                              const isPreset = deptList.includes(curDesig);
                              setDesignationModal({
                                open: true,
                                member: m,
                                selectedDesignation: isPreset ? curDesig : (curDesig ? "other" : ""),
                                customInput: isPreset ? "" : curDesig,
                                saving: false,
                              });
                            }}
                            className="rounded-xl text-[11px] h-8 px-2.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
                          >
                            💼 Designation
                          </Button>

                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveMember(m)}
                              className="rounded-xl text-xs h-8 px-3"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── META LEAD ADS INTEGRATION ───────────── */}
        <TabsContent value="meta" className="mt-5">
          <div className="panel max-w-3xl space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="size-5 text-blue-400" />
                  <h3 className="font-display text-lg font-bold">Facebook & Instagram Lead Ads</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect Meta Developer Lead Ads webhook to auto-import leads into Admin Dashboard pool.
                </p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                🟢 Webhook Endpoint Ready
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Webhook Callback URL (Vercel Serverless Endpoint)</Label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    readOnly
                    value="https://salesflow-ai-main.vercel.app/api/meta-webhook"
                    className="rounded-xl bg-surface-2 font-mono text-xs text-blue-300"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl shrink-0 gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText("https://salesflow-ai-main.vercel.app/api/meta-webhook");
                      toast.success("Copied Meta Webhook URL to clipboard!");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Meta Verification Token (`hub.verify_token`)</Label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    readOnly
                    value="salesflow_meta_secret_token"
                    className="rounded-xl bg-surface-2 font-mono text-xs text-emerald-300"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl shrink-0 gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText("salesflow_meta_secret_token");
                      toast.success("Copied verify token!");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy Token
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 space-y-2">
              <p className="text-xs font-bold text-blue-300">📌 How to connect Meta Lead Ads:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                <li>Go to <strong>Meta for Developers</strong> → App Dashboard → Add Webhooks product.</li>
                <li>Select <strong>Page</strong> object → Subscribe to <code>leadgen</code> fields.</li>
                <li>Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> provided above.</li>
                <li>When leads submit your Meta Lead Form, they will instantly land in <strong>Admin Dashboard</strong> as New Leads!</li>
              </ol>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── ASSIGN ROLE & AUTHORITY MODAL ───────────────────────── */}
      {roleModal.open && roleModal.member && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setRoleModal({ open: false, member: null, selectedRole: "agent", customRoleTitle: "", selectedDeptId: "", saving: false })}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d121f] p-6 shadow-2xl space-y-5 my-8 text-white max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-violet-600/20 text-violet-400">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">Assign Role & Authority</h3>
                  <p className="text-xs text-white/50">
                    Assign Working Agent, Team Leader, Department Manager, or Custom Role.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRoleModal({ open: false, member: null, selectedRole: "agent", customRoleTitle: "", selectedDeptId: "", saving: false })}
                className="text-white/40 hover:text-white p-1 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Target User Info */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-violet-600/30 text-violet-300 text-xs font-bold">
                  {(roleModal.member.full_name || roleModal.member.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {roleModal.member.full_name || roleModal.member.email.split("@")[0]}
                </p>
                <p className="text-[11px] text-white/50 truncate">{roleModal.member.email}</p>
              </div>
              <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-bold text-violet-300 capitalize">
                Current: {roleModal.member.role}
              </span>
            </div>

            {/* Role Options */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-white/70 block">Select Role / Authority Level</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "agent", label: "Working Agent", desc: "Standard CRM agent", icon: "👤", color: "border-slate-500/30" },
                  { id: "team_leader", label: "🌟 Team Leader", desc: "Leads department team", icon: "🌟", color: "border-amber-500/40" },
                  { id: "manager", label: "🟣 Dept Manager", desc: "Full department authority", icon: "🏢", color: "border-purple-500/40" },
                  { id: "custom", label: "✨ Custom Title", desc: "Custom role or position", icon: "✍️", color: "border-indigo-500/40" },
                ].map((opt) => {
                  const isSel = roleModal.selectedRole === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setRoleModal((prev) => ({ ...prev, selectedRole: opt.id as any }))}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSel
                          ? "bg-violet-600/25 border-violet-500 text-white shadow-md"
                          : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05] text-white/70 hover:text-white"
                      }`}
                    >
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{opt.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Role Title Input */}
            {roleModal.selectedRole === "custom" && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 animate-fade-in">
                <Label className="text-xs font-semibold text-indigo-300">Custom Role / Title</Label>
                <Input
                  value={roleModal.customRoleTitle}
                  onChange={(e) => setRoleModal((prev) => ({ ...prev, customRoleTitle: e.target.value }))}
                  placeholder="e.g. Senior QA Lead, Head of Outreach, Operations Specialist"
                  className="rounded-xl border-indigo-500/40 bg-black/40 text-white text-xs h-9"
                />
                <p className="text-[10px] text-indigo-300/70">This custom title will appear on their profile and in chat to users.</p>
              </div>
            )}

            {/* Department Selection List */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-white/70 block">
                Assign to Department ({departments.length})
              </Label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto p-1 scrollbar-thin">
                {departments.map((dept) => {
                  const isSelected = roleModal.selectedDeptId === dept.id;
                  return (
                    <div
                      key={dept.id}
                      onClick={() => setRoleModal((prev) => ({ ...prev, selectedDeptId: dept.id }))}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-violet-600/20 border-violet-500 shadow-sm"
                          : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="p-1.5 rounded-lg bg-white/5 text-white/60">
                          {React.createElement(getDeptIcon(dept.icon), { className: "size-3.5" })}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{dept.name}</p>
                          {dept.manager_name && (
                            <p className="text-[10px] text-white/40 truncate">Manager: {dept.manager_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <div
                          className={`size-4 rounded-full border flex items-center justify-center ${
                            isSelected ? "border-violet-500 bg-violet-600 text-white" : "border-white/20 bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="size-2.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                disabled={roleModal.saving}
                onClick={() => setRoleModal({ open: false, member: null, selectedRole: "agent", customRoleTitle: "", selectedDeptId: "", saving: false })}
                className="rounded-xl text-xs text-white/60 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={roleModal.saving}
                onClick={handleConfirmRoleAssignment}
                className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 shadow-sm"
              >
                {roleModal.saving ? "Saving..." : "Save Role & Authority"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── SET MEMBER DESIGNATION MODAL ───────────────────────── */}
      {designationModal.open && designationModal.member && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setDesignationModal({ open: false, member: null, selectedDesignation: "", customInput: "", saving: false })}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d121f] p-6 shadow-2xl space-y-5 my-8 text-white max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-600/20 text-purple-400">
                  <Briefcase className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">Member Job Designation</h3>
                  <p className="text-xs text-white/50">
                    Set specific designation for this team member.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDesignationModal({ open: false, member: null, selectedDesignation: "", customInput: "", saving: false })}
                className="text-white/40 hover:text-white p-1 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Target User Info */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-purple-600/30 text-purple-300 text-xs font-bold">
                  {(designationModal.member.full_name || designationModal.member.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {designationModal.member.full_name || designationModal.member.email.split("@")[0]}
                </p>
                <p className="text-[11px] text-white/50 truncate">{designationModal.member.email}</p>
              </div>
              <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 capitalize">
                {designationModal.member.role}
              </span>
            </div>

            {/* Designation Selection */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-white/70 block">
                Select or Type Designation
              </Label>
              <select
                value={designationModal.selectedDesignation}
                onChange={(e) =>
                  setDesignationModal((prev) => ({
                    ...prev,
                    selectedDesignation: e.target.value,
                  }))
                }
                className="w-full h-10 rounded-xl border border-white/15 bg-surface-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- No Designation (None) --</option>
                {((designationModal.member.department_id && DEPARTMENT_DESIGNATIONS[designationModal.member.department_id]) || DEFAULT_DESIGNATIONS).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="other">✍️ Other (Custom Designation)</option>
              </select>

              {designationModal.selectedDesignation === "other" && (
                <div className="space-y-1.5 pt-1 animate-fade-in">
                  <Label className="text-xs text-purple-300 font-medium">Type Custom Designation</Label>
                  <Input
                    placeholder="e.g. Lead UI/UX Designer, Senior Closer..."
                    value={designationModal.customInput}
                    onChange={(e) =>
                      setDesignationModal((prev) => ({ ...prev, customInput: e.target.value }))
                    }
                    className="h-10 rounded-xl bg-white/5 border-white/15 text-white text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                disabled={designationModal.saving}
                onClick={() =>
                  setDesignationModal({ open: false, member: null, selectedDesignation: "", customInput: "", saving: false })
                }
                className="rounded-xl text-xs text-white/60 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={designationModal.saving}
                onClick={handleSaveMemberDesignation}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 shadow-sm"
              >
                {designationModal.saving ? "Saving..." : "Save Designation"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
