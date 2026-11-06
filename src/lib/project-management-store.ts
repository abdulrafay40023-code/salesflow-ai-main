import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/crm-data";

export interface Department {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  manager_email: string | null;
  manager_name: string | null;
  team_leader_email?: string | null;
  team_leader_name?: string | null;
  member_emails: string[];
  subcategories: string[];
  created_at: string;
  created_by?: string;
}

export type ProjectDepartment = Department;

export interface ProjectRevision {
  revision_id: string;
  requested_by_name: string;
  requested_by_email: string;
  requested_at: string;
  issues_and_changes: string;
}

export interface ProjectTransfer {
  from_agent_name: string;
  from_agent_email: string;
  to_agent_name: string;
  to_agent_email: string;
  to_department_id?: string;
  to_department_name?: string;
  transferred_at: string;
  reason?: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  author_name: string;
  author_email: string;
  author_role: "admin" | "working_agent";
  content: string;
  mentions?: string[];
  reply_to?: {
    comment_id: string;
    author_name: string;
    author_email: string;
    content_snippet: string;
  } | null;
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  target_department_id: string;
  target_department_name: string;
  subcategory: string;
  priority: "urgent" | "high" | "medium" | "normal";
  status: "active" | "in_progress" | "done" | "cancelled";
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_company?: string;
  budget_or_value?: string;
  description: string;
  attachments_links?: string;
  attached_files?: Array<{ name: string; url: string; size?: number; type?: string }>;
  created_by_email: string;
  created_by_name: string;
  created_by_role?: "admin" | "working_agent";
  created_by_department: string;
  created_at: string;
  updated_at: string;
  claimed_by_email?: string | null;
  claimed_by_name?: string | null;
  claimed_by_role?: "admin" | "working_agent" | null;
  claimed_at?: string | null;
  completed_at?: string | null;
  completed_by_email?: string | null;
  completed_by_name?: string | null;
  completed_by_role?: "admin" | "working_agent" | null;
  completion_notes?: string | null;
  cancelled_at?: string | null;
  cancelled_by_email?: string | null;
  cancelled_by_name?: string | null;
  cancelled_by_role?: string | null;
  cancellation_reason?: string | null;
  seen_by_emails: string[];
  revision_history?: ProjectRevision[];
  transfer_history?: ProjectTransfer[];
  comments?: ProjectComment[];
}

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: "production-house",
    name: "Production House",
    description: "Designers, Full-Stack Developers, UI/UX Specialists & Multimedia Creators.",
    icon: "Palette",
    color: "violet",
    manager_email: null,
    manager_name: null,
    member_emails: [],
    subcategories: ["Graphic Design", "Web Development", "UI/UX Design", "Video Editing", "Custom Tech"],
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "ecommerce-department",
    name: "E-commerce Department",
    description: "Amazon, Shopify, Walmart, Store Automation, Product Hunting & Listing.",
    icon: "ShoppingBag",
    color: "emerald",
    manager_email: null,
    manager_name: null,
    member_emails: [],
    subcategories: ["Shopify Store Setup", "Amazon FBA Operations", "Product Listing & SEO", "Store Automation", "Inventory Management"],
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "sales-department",
    name: "Sales Department",
    description: "Cold Calling, Inbound Lead Qualification, Closing Deals & Demo Bookings.",
    icon: "PhoneCall",
    color: "blue",
    manager_email: null,
    manager_name: null,
    member_emails: [],
    subcategories: ["Outbound Power Calling", "Demo Booking & Presentation", "Closing & Contract Negotiation", "Client Follow-up & Retention"],
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

export function isEcommerceDepartment(deptId?: string | null, deptName?: string | null): boolean {
  if (!deptId && !deptName) return false;
  const cleanId = (deptId || "").toLowerCase().trim();
  const cleanName = (deptName || "").toLowerCase().trim();
  return (
    cleanId === "ecommerce-department" ||
    cleanId.includes("ecommerce") ||
    cleanId.includes("e-commerce") ||
    cleanName.includes("ecommerce") ||
    cleanName.includes("e-commerce")
  );
}

const STORAGE_PUBLIC_BASE = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co/storage/v1/object/public/teals-live-store";
const DEPTS_FILE = "crm-departments.json";
const PROJECTS_FILE = "crm-projects.json";

// ── BROADCAST REALTIME EVENT ────────────────────────────────────────────────
export async function broadcastProjectEvent(event: string, payload: any) {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("teals-crm-projects-sync");
      bc.postMessage({ event, payload });
      bc.close();
    }
  } catch {}

  try {
    const sendChannel = supabase.channel(`broadcast-send-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, {
      config: { broadcast: { self: true } },
    });
    await sendChannel.subscribe();
    await sendChannel.send({
      type: "broadcast",
      event: `crm_${event}`,
      payload,
    });
    supabase.removeChannel(sendChannel);
  } catch {}
}

// ── DEPARTMENTS STORAGE & FETCH ─────────────────────────────────────────────
const DUMMY_MOCK_EMAILS = new Set([
  "avareed826@gmail.com",
  "emmajohnson01732@gmail.com",
  "johndeep26626@gmail.com",
  "jackson6168173@gmail.com",
  "oliviasmith91637@gmail.com",
  "ellathomas81631@gmail.com",
  "ahsan.khan@teals.co",
]);

export function sanitizeDepartments(depts: Department[]): Department[] {
  if (!Array.isArray(depts)) return [];
  return depts.map((d) => ({
    ...d,
    manager_email: d.manager_email && DUMMY_MOCK_EMAILS.has(d.manager_email.toLowerCase().trim()) ? null : d.manager_email,
    manager_name: d.manager_email && DUMMY_MOCK_EMAILS.has(d.manager_email.toLowerCase().trim()) ? null : d.manager_name,
    team_leader_email: d.team_leader_email && DUMMY_MOCK_EMAILS.has(d.team_leader_email.toLowerCase().trim()) ? null : d.team_leader_email,
    team_leader_name: d.team_leader_email && DUMMY_MOCK_EMAILS.has(d.team_leader_email.toLowerCase().trim()) ? null : d.team_leader_name,
    member_emails: (d.member_emails || []).filter((m) => !DUMMY_MOCK_EMAILS.has(m.toLowerCase().trim())),
  }));
}

export async function fetchAllDepartments(): Promise<Department[]> {
  // 1. Direct Supabase Postgres DB (Instant query)
  try {
    const { data: dbDepts, error } = await supabase
      .from("departments")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && Array.isArray(dbDepts) && dbDepts.length > 0) {
      const sanitized = sanitizeDepartments(dbDepts);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("teals_crm_departments", JSON.stringify(sanitized));
        } catch {}
      }
      return sanitized;
    }
  } catch {}

  // 2. Prioritize /api/projects-store API (Server-side fresh download directly from Supabase, no CDN staleness)
  try {
    const apiRes = await fetch(`/api/projects-store?t=${Date.now()}`, { cache: "no-store" });
    if (apiRes.ok) {
      const { departments } = await apiRes.json();
      if (Array.isArray(departments) && departments.length > 0) {
        const sanitized = sanitizeDepartments(departments);
        if (typeof window !== "undefined") {
          localStorage.setItem("teals_crm_departments", JSON.stringify(sanitized));
        }
        return sanitized;
      }
    }
  } catch {}

  // 3. Fallback: Public Storage URL with cache-busting timestamp & headers
  try {
    const res = await fetch(`${STORAGE_PUBLIC_BASE}/${DEPTS_FILE}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const sanitized = sanitizeDepartments(list);
        if (typeof window !== "undefined") {
          localStorage.setItem("teals_crm_departments", JSON.stringify(sanitized));
        }
        return sanitized;
      }
    }
  } catch {}

  // 4. Fallback to localStorage cached
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("teals_crm_departments");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeDepartments(parsed);
        }
      }
    } catch {}
  }

  return sanitizeDepartments(DEFAULT_DEPARTMENTS);
}

export const loadProjectDepartments = fetchAllDepartments;

export async function saveAllDepartments(departments: Department[]): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("teals_crm_departments", JSON.stringify(departments));
    } catch {}
  }

  // 1. Direct Supabase Postgres DB upsert
  try {
    await supabase.from("departments").upsert(departments);
  } catch {}

  // 2. /api/projects-store sync
  try {
    await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_departments", departments }),
      keepalive: true,
    });
  } catch (err) {
    console.warn("Save departments API notice:", err);
  }

  await broadcastProjectEvent("departments_updated", { departments });
}

// ── SYNC PROFILE USER ROLE ──────────────────────────────────────────────────
export async function syncUserProfileRole(
  email: string | null | undefined,
  role: "admin" | "manager" | "agent",
  departmentId?: string | null
): Promise<void> {
  if (!email) return;
  const cleanEmail = email.toLowerCase().trim();
  if (isAdminEmail(cleanEmail)) return; // Admins are always admin

  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, avatar_url, role")
      .eq("email", cleanEmail)
      .maybeSingle();

    let meta: any = {};
    if (prof?.avatar_url) {
      try {
        meta = JSON.parse(prof.avatar_url);
      } catch {}
    }

    meta.role = role;
    if (role === "manager" && departmentId) {
      meta.department_id = departmentId;
    } else {
      delete meta.department_id;
    }

    const updatedAvatarUrl = JSON.stringify(meta);

    // Update avatar_url (stores custom role + department metadata) and role column
    const res = await supabase
      .from("profiles")
      .update({ avatar_url: updatedAvatarUrl, role: role === "manager" ? "manager" : "agent" })
      .eq("email", cleanEmail);

    if (res.error) {
      // Fallback if role column constraint prevents direct value
      await supabase
        .from("profiles")
        .update({ avatar_url: updatedAvatarUrl })
        .eq("email", cleanEmail);
    }
  } catch (err) {
    console.warn("syncUserProfileRole error:", err);
  }
}

// ── COMPREHENSIVE ROLE & TITLE UPDATE (Manager, Team Leader, Agent, Custom) ──
export async function updateUserRoleAndTitleSync({
  email,
  role,
  roleTitle,
  departmentId,
  departmentName,
  designation,
}: {
  email: string;
  role: "manager" | "team_leader" | "agent" | "custom" | string;
  roleTitle?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  designation?: string | null;
}): Promise<void> {
  if (!email) return;
  const cleanEmail = email.toLowerCase().trim();
  if (isAdminEmail(cleanEmail)) return; // Admins are protected

  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, avatar_url, role")
      .eq("email", cleanEmail)
      .maybeSingle();

    let meta: any = {};
    if (prof?.avatar_url) {
      try {
        meta = JSON.parse(prof.avatar_url);
      } catch {}
    }

    meta.role = role;
    if (roleTitle) {
      meta.role_title = roleTitle;
    } else if (role === "manager") {
      meta.role_title = departmentName ? `${departmentName} Manager` : "Manager";
    } else if (role === "team_leader") {
      meta.role_title = "Team Leader";
    } else if (role === "agent") {
      meta.role_title = meta.designation || "Support Specialist";
    }

    if (departmentId) meta.department_id = departmentId;
    if (departmentName) meta.department_name = departmentName;
    if (designation) meta.designation = designation;

    const updatedAvatarUrl = JSON.stringify(meta);
    const dbRole = role === "manager" ? "manager" : "agent";

    const res = await supabase
      .from("profiles")
      .update({ avatar_url: updatedAvatarUrl, role: dbRole })
      .eq("email", cleanEmail);

    if (res.error) {
      await supabase
        .from("profiles")
        .update({ avatar_url: updatedAvatarUrl })
        .eq("email", cleanEmail);
    }

    await broadcastProjectEvent("agent_role_updated", {
      email: cleanEmail,
      role,
      roleTitle: meta.role_title,
      departmentId: meta.department_id,
      departmentName: meta.department_name,
      designation: meta.designation,
    });
  } catch (err) {
    console.warn("updateUserRoleAndTitleSync error:", err);
  }
}

// ── ATOMIC SYNCHRONIZED MANAGER ALLOCATION ──────────────────────────────────
export async function assignDepartmentManagerSync({
  deptId,
  managerEmail,
  managerName,
  departments,
}: {
  deptId: string;
  managerEmail: string | null;
  managerName?: string | null;
  departments: Department[];
}): Promise<Department[]> {
  const cleanTarget = managerEmail ? managerEmail.toLowerCase().trim() : null;
  const currentDept = departments.find((d) => d.id === deptId);
  const oldManagerEmail = currentDept?.manager_email
    ? currentDept.manager_email.toLowerCase().trim()
    : null;

  const updatedDepartments = departments.map((d) => {
    // 1. Target Department
    if (d.id === deptId) {
      if (!cleanTarget) {
        return {
          ...d,
          manager_email: null,
          manager_name: null,
        };
      }
      return {
        ...d,
        manager_email: cleanTarget,
        manager_name: managerName || cleanTarget.split("@")[0],
        member_emails: Array.from(new Set([...d.member_emails, cleanTarget])),
      };
    }

    // 2. Other Departments:
    // If target manager was manager of another department, unassign from that department
    // (Enforces: 1 department per manager, 1 manager per department)
    if (cleanTarget && d.manager_email && d.manager_email.toLowerCase().trim() === cleanTarget) {
      return {
        ...d,
        manager_email: null,
        manager_name: null,
        member_emails: d.member_emails.filter((m) => m.toLowerCase().trim() !== cleanTarget),
      };
    }

    return d;
  });

  // Handle profile updates:
  // A. If an old manager was replaced and is no longer managing any department, demote to "agent"
  if (oldManagerEmail && oldManagerEmail !== cleanTarget) {
    const stillManaging = updatedDepartments.some(
      (d) => d.manager_email && d.manager_email.toLowerCase().trim() === oldManagerEmail
    );
    if (!stillManaging) {
      await syncUserProfileRole(oldManagerEmail, "agent", null);
    }
  }

  // B. If a new manager was assigned, promote them to "manager"
  if (cleanTarget) {
    await syncUserProfileRole(cleanTarget, "manager", deptId);
  }

  // Save departments to DB, storage, and API
  await saveAllDepartments(updatedDepartments);

  // Broadcast realtime event for profiles
  await broadcastProjectEvent("profiles_updated", {
    email: cleanTarget,
    role: cleanTarget ? "manager" : "agent",
    deptId: cleanTarget ? deptId : null,
    timestamp: Date.now(),
  });

  return updatedDepartments;
}

// ── DEMOTE MANAGER TO AGENT ─────────────────────────────────────────────────
export async function demoteManagerToAgentSync({
  managerEmail,
  departments,
}: {
  managerEmail: string;
  departments: Department[];
}): Promise<Department[]> {
  const cleanTarget = managerEmail.toLowerCase().trim();

  const updatedDepartments = departments.map((d) => {
    if (d.manager_email && d.manager_email.toLowerCase().trim() === cleanTarget) {
      return {
        ...d,
        manager_email: null,
        manager_name: null,
      };
    }
    return d;
  });

  await syncUserProfileRole(cleanTarget, "agent", null);
  await saveAllDepartments(updatedDepartments);

  await broadcastProjectEvent("profiles_updated", {
    email: cleanTarget,
    role: "agent",
    timestamp: Date.now(),
  });

  return updatedDepartments;
}


export function getDeletedCommentIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("teals_crm_deleted_comment_ids");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function trackDeletedCommentId(commentId: string) {
  if (typeof window === "undefined" || !commentId) return;
  try {
    const set = getDeletedCommentIds();
    set.add(commentId);
    localStorage.setItem("teals_crm_deleted_comment_ids", JSON.stringify(Array.from(set)));
  } catch {}
}

export function getDeletedProjectIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("teals_crm_deleted_project_ids");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function trackDeletedProjectId(projectId: string) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    const set = getDeletedProjectIds();
    set.add(projectId);
    localStorage.setItem("teals_crm_deleted_project_ids", JSON.stringify(Array.from(set)));
  } catch {}
}

export function removeDeletedProjectId(projectId: string) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    const set = getDeletedProjectIds();
    set.delete(projectId);
    localStorage.setItem("teals_crm_deleted_project_ids", JSON.stringify(Array.from(set)));
  } catch {}
}

export function getRecentLocalComments(): ProjectComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("teals_crm_recent_local_comments");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cutoff = Date.now() - 15 * 60 * 1000;
        return parsed.filter((c: ProjectComment) => {
          const t = new Date(c.created_at).getTime();
          return !isNaN(t) && t > cutoff;
        });
      }
    }
  } catch {}
  return [];
}

export function saveRecentLocalComment(comment: ProjectComment) {
  if (typeof window === "undefined" || !comment || !comment.id) return;
  try {
    const list = getRecentLocalComments();
    if (!list.some((c) => c.id === comment.id)) {
      list.push(comment);
      localStorage.setItem("teals_crm_recent_local_comments", JSON.stringify(list));
    }
  } catch {}
}

export function removeRecentLocalComment(commentId: string) {
  if (typeof window === "undefined" || !commentId) return;
  try {
    const list = getRecentLocalComments().filter((c) => c.id !== commentId);
    localStorage.setItem("teals_crm_recent_local_comments", JSON.stringify(list));
  } catch {}
}

// ── PROJECTS STORAGE & FETCH ────────────────────────────────────────────────
export async function fetchAllProjects(): Promise<Project[]> {
  const deletedCommentIds = getDeletedCommentIds();
  const deletedProjectIds = getDeletedProjectIds();
  const recentLocal = getRecentLocalComments();

  let projectsList: Project[] = [];
  let dbLoaded = false;

  // 1. Direct Supabase Postgres DB (Instant query, zero caching)
  try {
    const { data: dbData, error: dbErr } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (!dbErr && Array.isArray(dbData)) {
      projectsList = dbData;
      dbLoaded = true;
    }
  } catch {}

  // 2. Only fallback if direct DB query failed (e.g. network offline or error)
  if (!dbLoaded) {
    try {
      const apiRes = await fetch(`/api/projects-store?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
      });
      if (apiRes.ok) {
        const { projects } = await apiRes.json();
        if (Array.isArray(projects)) {
          projectsList = projects;
          dbLoaded = true;
        }
      }
    } catch {}
  }

  // 3. Fallback: Public Storage URL only if still not loaded
  if (!dbLoaded) {
    try {
      const res = await fetch(`${STORAGE_PUBLIC_BASE}/${PROJECTS_FILE}?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" },
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          projectsList = list;
          dbLoaded = true;
        }
      }
    } catch {}
  }

  // 4. Fallback to localStorage cached data only if still not loaded
  if (!dbLoaded && typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("teals_crm_projects");
      if (cached) {
        const localList: Project[] = JSON.parse(cached);
        if (Array.isArray(localList)) {
          projectsList = localList;
        }
      }
    } catch {}
  }

  // Filter out any explicitly deleted projects
  const activeProjects = projectsList.filter((p) => p && p.id && !deletedProjectIds.has(p.id));

  // Merge recent local comments so no comments ever vanish across page reloads/refreshes
  const cleaned = activeProjects.map((p) => {
    const commentMap = new Map<string, ProjectComment>();

    (p.comments || []).forEach((c: ProjectComment) => {
      if (c && c.id && !deletedCommentIds.has(c.id)) {
        commentMap.set(c.id, c);
        // If server already persisted it, clean it up from the local pending queue
        removeRecentLocalComment(c.id);
      }
    });

    recentLocal.forEach((c) => {
      if (c.project_id === p.id && !deletedCommentIds.has(c.id) && !commentMap.has(c.id)) {
        commentMap.set(c.id, c);
        // Resend in background if missing from server
        fetch("/api/projects-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_comment", projectId: p.id, comment: c }),
          keepalive: true,
        }).catch(() => {});
      }
    });

    const combinedComments = Array.from(commentMap.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let cancelledData: any = {};
    if (p.status === "cancelled" && p.completion_notes) {
      try {
        const parsed = JSON.parse(p.completion_notes);
        if (parsed && typeof parsed === "object") {
          cancelledData = parsed;
        }
      } catch {
        cancelledData = { cancellation_reason: p.completion_notes };
      }
    }

    return {
      ...p,
      cancelled_at: p.cancelled_at || cancelledData.cancelled_at || p.updated_at,
      cancelled_by_email: p.cancelled_by_email || cancelledData.cancelled_by_email || "",
      cancelled_by_name: p.cancelled_by_name || cancelledData.cancelled_by_name || "Department Manager",
      cancelled_by_role: p.cancelled_by_role || cancelledData.cancelled_by_role || "manager",
      cancellation_reason: p.cancellation_reason || cancelledData.cancellation_reason || p.completion_notes || "Project removed by department manager.",
      comments: combinedComments,
    };
  });

  // Filter out any duplicate projects created simultaneously (same title, same client, same department, created within 60s of each other)
  const dedupedProjects: Project[] = [];
  const duplicateIdsToDelete: string[] = [];

  cleaned.forEach((p) => {
    const isDuplicate = dedupedProjects.some((existing) => {
      if (existing.id === p.id) return true;
      const sameTitle = (existing.title || "").trim().toLowerCase() === (p.title || "").trim().toLowerCase();
      const sameDept = existing.target_department_id === p.target_department_id;
      const sameClient = (existing.client_company || "").trim().toLowerCase() === (p.client_company || "").trim().toLowerCase();
      const sameCreator = (existing.created_by_email || "").trim().toLowerCase() === (p.created_by_email || "").trim().toLowerCase();
      const timeDiff = Math.abs(new Date(existing.created_at).getTime() - new Date(p.created_at).getTime());
      return sameTitle && sameDept && sameClient && sameCreator && timeDiff < 60000;
    });

    if (isDuplicate) {
      duplicateIdsToDelete.push(p.id);
    } else {
      dedupedProjects.push(p);
    }
  });

  if (duplicateIdsToDelete.length > 0) {
    // Delete duplicate project rows in background
    duplicateIdsToDelete.forEach((dupId) => {
      supabase.from("projects").delete().eq("id", dupId).then(() => {}).catch(() => {});
      trackDeletedProjectId(dupId);
    });
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("teals_crm_projects", JSON.stringify(dedupedProjects));
    } catch {}
  }

  return dedupedProjects;
}

export async function saveAllProjects(projects: Project[]): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("teals_crm_projects", JSON.stringify(projects));
    } catch {}
  }

  // 1. Direct Supabase Postgres DB upsert with column sanitation
  try {
    const sanitizedForDb = projects.map((p) => {
      const {
        cancelled_at,
        cancelled_by_email,
        cancelled_by_name,
        cancelled_by_role,
        cancellation_reason,
        ...rest
      } = p as any;
      return rest;
    });
    await supabase.from("projects").upsert(sanitizedForDb);
  } catch {}

  // 2. /api/projects-store sync
  try {
    await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_projects", projects }),
      keepalive: true,
    });
  } catch (err) {
    console.warn("Save projects API notice:", err);
  }
}

// ── PROJECT ACTIONS ─────────────────────────────────────────────────────────

export async function createNewProject(projectData: Omit<Project, "id" | "created_at" | "updated_at" | "seen_by_emails" | "status"> & { claimed_by_email?: string | null; claimed_by_name?: string | null; claimed_by_role?: "admin" | "working_agent" | null }): Promise<Project> {
  const now = new Date().toISOString();
  const createdByEmail = (projectData.created_by_email || "").toLowerCase().trim();
  let directAssignEmail = (projectData.claimed_by_email || "").toLowerCase().trim();
  let directAssignName = projectData.claimed_by_name;
  let directAssignRole = projectData.claimed_by_role;

  // E-commerce Department rule: Working agents cannot be assigned directly on creation!
  // Allowed: Unassigned (open pool in queue) OR Department Manager OR Admin.
  if (directAssignEmail && isEcommerceDepartment(projectData.target_department_id, projectData.target_department_name)) {
    try {
      const allDepts = await fetchAllDepartments();
      const ecomDept = allDepts.find(
        (d) => d.id === projectData.target_department_id || isEcommerceDepartment(d.id, d.name)
      );
      const isDeptManager = ecomDept?.manager_email && ecomDept.manager_email.toLowerCase().trim() === directAssignEmail;
      const isAdmin = isAdminEmail(directAssignEmail);

      if (!isDeptManager && !isAdmin) {
        directAssignEmail = "";
        directAssignName = null;
        directAssignRole = null;
      }
    } catch {}
  }

  const isDirectlyAssigned = Boolean(directAssignEmail);
  const initialTransfers: ProjectTransfer[] = isDirectlyAssigned
    ? [
        {
          from_agent_name: projectData.created_by_name || "Creator",
          from_agent_email: createdByEmail,
          to_agent_name: directAssignName || directAssignEmail.split("@")[0],
          to_agent_email: directAssignEmail,
          to_department_id: projectData.target_department_id,
          to_department_name: projectData.target_department_name,
          transferred_at: now,
          reason: "Assigned directly during project creation",
        },
      ]
    : [];

  const newProj: Project = {
    ...projectData,
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: isDirectlyAssigned ? "in_progress" : "active",
    created_by_role: projectData.created_by_role || (isAdminEmail(createdByEmail) ? "admin" : "working_agent"),
    claimed_by_email: isDirectlyAssigned ? directAssignEmail : null,
    claimed_by_name: isDirectlyAssigned ? (directAssignName || directAssignEmail.split("@")[0]) : null,
    claimed_by_role: isDirectlyAssigned ? (directAssignRole || (isAdminEmail(directAssignEmail) ? "admin" : "working_agent")) : null,
    claimed_at: isDirectlyAssigned ? now : null,
    created_at: now,
    updated_at: now,
    seen_by_emails: [createdByEmail].filter(Boolean),
    comments: [],
    revision_history: [],
    transfer_history: initialTransfers,
  };

  let created: Project = newProj;

  // 1. Direct Supabase Postgres DB insert
  try {
    const { data: dbData, error } = await supabase
      .from("projects")
      .insert([newProj])
      .select("*")
      .single();
    if (!error && dbData) {
      created = dbData;
    }
  } catch {}

  // 2. /api/projects-store sync
  try {
    const res = await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_project", project: created }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.project) created = data.project;
    }
  } catch {}

  // 3. Update local storage
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("teals_crm_projects");
      const list = cached ? JSON.parse(cached) : [];
      if (Array.isArray(list)) {
        const updated = [created, ...list.filter((p: any) => p.id !== created.id)];
        localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
      }
    } catch {}
  }
  removeDeletedProjectId(created.id);
  await broadcastProjectEvent("project_created", { project: created });
  return created;
}

export async function claimProject(projectId: string, agentEmail: string, agentName: string): Promise<Project | null> {
  let claimed: Project | null = null;
  const now = new Date().toISOString();
  const cleanEmail = agentEmail.toLowerCase().trim();

  // 1. Direct Supabase Postgres DB update (Fast, authoritative)
  try {
    const { data: curr } = await supabase.from("projects").select("seen_by_emails").eq("id", projectId).maybeSingle();
    const existingSeen = Array.isArray(curr?.seen_by_emails) ? curr.seen_by_emails : [];
    const seenBy = Array.from(new Set([...existingSeen, cleanEmail]));

    const { data: updatedDb, error: dbErr } = await supabase
      .from("projects")
      .update({
        claimed_by_email: cleanEmail,
        claimed_by_name: agentName || cleanEmail.split("@")[0],
        claimed_by_role: isAdminEmail(cleanEmail) ? "admin" : "working_agent",
        claimed_at: now,
        status: "in_progress",
        updated_at: now,
        seen_by_emails: seenBy,
      })
      .eq("id", projectId)
      .select("*")
      .single();

    if (!dbErr && updatedDb) {
      claimed = updatedDb;
    }
  } catch {}

  // 2. /api/projects-store fallback & sync
  try {
    const res = await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim_project", projectId, agentEmail: cleanEmail, agentName }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.project && !claimed) claimed = data.project;
    }
  } catch {}

  if (!claimed) {
    const currentProjects = await fetchAllProjects();
    const updatedList = currentProjects.map((p) => {
      if (p.id === projectId) {
        claimed = {
          ...p,
          claimed_by_email: cleanEmail,
          claimed_by_name: agentName,
          claimed_by_role: isAdminEmail(cleanEmail) ? "admin" : "working_agent",
          claimed_at: now,
          status: "in_progress",
          updated_at: now,
          seen_by_emails: Array.from(new Set([...p.seen_by_emails, cleanEmail])),
        };
        return claimed;
      }
      return p;
    });
    await saveAllProjects(updatedList);
  }

  if (claimed) {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_projects");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const updated = list.map((p: any) => (p.id === claimed!.id ? claimed : p));
            localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
          }
        }
      } catch {}
    }
    await broadcastProjectEvent("project_claimed", { project: claimed });
  }
  return claimed;
}

export async function transferProject(
  projectId: string,
  fromAgent: { name: string; email: string },
  toAgent: { name: string; email: string },
  toDepartment?: { id: string; name: string },
  reason?: string
): Promise<Project | null> {
  let transferred: Project | null = null;
  const now = new Date().toISOString();
  let toEmail = (toAgent?.email || "").toLowerCase().trim();
  let toName = toAgent?.name || "Unassigned";

  // E-commerce Department rule: Cannot transfer directly to an individual working agent!
  // Allowed: Unassigned (open department queue) OR Department Manager OR Admin.
  if (toEmail && isEcommerceDepartment(toDepartment?.id, toDepartment?.name)) {
    try {
      const allDepts = await fetchAllDepartments();
      const ecomDept = allDepts.find(
        (d) => d.id === toDepartment?.id || isEcommerceDepartment(d.id, d.name)
      );
      const isDeptManager = ecomDept?.manager_email && ecomDept.manager_email.toLowerCase().trim() === toEmail;
      const isAdmin = isAdminEmail(toEmail);

      if (!isDeptManager && !isAdmin) {
        toEmail = "";
        toName = "Unassigned Queue";
      }
    } catch {}
  }

  const fromEmail = (fromAgent?.email || "").toLowerCase().trim();

  const transferRecord: ProjectTransfer = {
    from_agent_name: fromAgent?.name || "Agent",
    from_agent_email: fromEmail,
    to_agent_name: toEmail ? (toName || "Unassigned") : "Unassigned Queue",
    to_agent_email: toEmail,
    to_department_id: toDepartment?.id,
    to_department_name: toDepartment?.name,
    transferred_at: now,
    reason,
  };

  // 1. Direct Supabase Postgres DB update
  try {
    const { data: curr } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    if (curr) {
      const existingTransfers = Array.isArray(curr.transfer_history) ? curr.transfer_history : [];
      const { data: updatedDb, error: dbErr } = await supabase
        .from("projects")
        .update({
          claimed_by_email: toEmail ? toEmail : null,
          claimed_by_name: toAgent?.name || null,
          claimed_by_role: toEmail ? (isAdminEmail(toEmail) ? "admin" : "working_agent") : null,
          claimed_at: toEmail ? now : null,
          target_department_id: toDepartment?.id || curr.target_department_id,
          target_department_name: toDepartment?.name || curr.target_department_name,
          status: toEmail ? "in_progress" : "active",
          updated_at: now,
          seen_by_emails: [fromEmail].filter(Boolean),
          transfer_history: [...existingTransfers, transferRecord],
        })
        .eq("id", projectId)
        .select("*")
        .single();

      if (!dbErr && updatedDb) {
        transferred = updatedDb;
      }
    }
  } catch {}

  // 2. /api/projects-store fallback & sync
  try {
    const res = await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transfer_project", projectId, fromAgent, toAgent, toDepartment, reason }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.project && !transferred) transferred = data.project;
    }
  } catch {}

  if (transferred) {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_projects");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const updated = list.map((p: any) => (p.id === transferred!.id ? transferred : p));
            localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
          }
        }
      } catch {}
    }
    await broadcastProjectEvent("project_transferred", { project: transferred });
  }
  return transferred;
}

export async function markProjectDone(
  projectId: string,
  completedBy: { name: string; email: string },
  completionNotes?: string
): Promise<Project | null> {
  let done: Project | null = null;
  const now = new Date().toISOString();
  const compEmail = (completedBy?.email || "").toLowerCase().trim();

  // 1. Direct Supabase Postgres DB update (Fast, authoritative)
  try {
    const { data: updatedDb, error: dbErr } = await supabase
      .from("projects")
      .update({
        status: "done",
        completed_at: now,
        completed_by_email: compEmail,
        completed_by_name: completedBy?.name || "Agent",
        completed_by_role: isAdminEmail(compEmail) ? "admin" : "working_agent",
        completion_notes: completionNotes || null,
        updated_at: now,
      })
      .eq("id", projectId)
      .select("*")
      .single();

    if (!dbErr && updatedDb) {
      done = updatedDb;
    }
  } catch {}

  // 2. /api/projects-store sync
  try {
    const res = await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_done", projectId, completedBy, notes: completionNotes }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.project && !done) done = data.project;
    }
  } catch {}

  if (!done) {
    const currentProjects = await fetchAllProjects();
    const updatedList = currentProjects.map((p) => {
      if (p.id === projectId) {
        done = {
          ...p,
          status: "done",
          completed_at: now,
          completed_by_email: compEmail,
          completed_by_name: completedBy?.name || "Agent",
          completed_by_role: isAdminEmail(compEmail) ? "admin" : "working_agent",
          completion_notes: completionNotes || null,
          updated_at: now,
        };
        return done;
      }
      return p;
    });
    await saveAllProjects(updatedList);
  }

  if (done) {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_projects");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const updated = list.map((p: any) => (p.id === done!.id ? done : p));
            localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
          }
        }
      } catch {}
    }
    await broadcastProjectEvent("project_completed", { project: done });
  }
  return done;
}

export async function requestProjectRedo(
  projectId: string,
  requestedBy: { name: string; email: string },
  issuesAndChanges: string
): Promise<Project | null> {
  let redone: Project | null = null;
  const now = new Date().toISOString();
  const reqEmail = (requestedBy?.email || "").toLowerCase().trim();

  const rev: ProjectRevision = {
    revision_id: "rev_" + Date.now(),
    requested_by_name: requestedBy?.name || "Admin",
    requested_by_email: reqEmail,
    requested_at: now,
    issues_and_changes: issuesAndChanges || "",
  };

  // 1. Direct Supabase Postgres DB update
  try {
    const { data: curr } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    if (curr) {
      const rawExisting = Array.isArray(curr.revision_history) ? curr.revision_history : [];
      // Deduplicate revisions
      const seen = new Set<string>();
      const existingRevisions: ProjectRevision[] = [];
      rawExisting.forEach((r: any) => {
        if (!r) return;
        const key = r.revision_id || `${(r.issues_and_changes || "").trim()}_${new Date(r.requested_at).toISOString().slice(0, 16)}`;
        if (!seen.has(key)) {
          seen.add(key);
          existingRevisions.push(r);
        }
      });

      // Avoid double-submitting duplicate in last 10 seconds
      const isDuplicateRecent = existingRevisions.some(
        (r) =>
          r.issues_and_changes.trim() === issuesAndChanges.trim() &&
          Math.abs(new Date(r.requested_at).getTime() - new Date(now).getTime()) < 10000
      );
      const finalRevisions = isDuplicateRecent ? existingRevisions : [...existingRevisions, rev];

      const nextStatus = curr.claimed_by_email ? "in_progress" : "active";
      const { data: updatedDb, error: dbErr } = await supabase
        .from("projects")
        .update({
          status: nextStatus,
          completed_at: null,
          completed_by_email: null,
          completed_by_name: null,
          completed_by_role: null,
          updated_at: now,
          seen_by_emails: [reqEmail].filter(Boolean),
          revision_history: finalRevisions,
        })
        .eq("id", projectId)
        .select("*")
        .single();

      if (!dbErr && updatedDb) {
        redone = updatedDb;
      }
    }
  } catch {}

  // 2. /api/projects-store fallback & sync
  try {
    const res = await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request_redo", projectId, requestedBy, issues: issuesAndChanges }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.project && !redone) redone = data.project;
    }
  } catch {}

  if (!redone) {
    const currentProjects = await fetchAllProjects();
    const updatedList = currentProjects.map((p) => {
      if (p.id === projectId) {
        redone = {
          ...p,
          status: p.claimed_by_email ? "in_progress" : "active",
          completed_at: null,
          completed_by_email: null,
          completed_by_name: null,
          completed_by_role: null,
          updated_at: now,
          seen_by_emails: [reqEmail].filter(Boolean),
          revision_history: [...(p.revision_history || []), rev],
        };
        return redone;
      }
      return p;
    });
    await saveAllProjects(updatedList);
  }

  if (redone) {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_projects");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const updated = list.map((p: any) => (p.id === redone!.id ? redone : p));
            localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
          }
        }
      } catch {}
    }
    await broadcastProjectEvent("project_redo_requested", { project: redone });
  }
  return redone;
}

export async function cancelProjectWithReason(
  projectId: string,
  cancelledBy: { name: string; email: string; role?: string },
  reason: string
): Promise<Project | null> {
  let cancelled: Project | null = null;
  const now = new Date().toISOString();
  const cleanEmail = (cancelledBy?.email || "").toLowerCase().trim();
  const cancellationPayload = {
    cancelled_at: now,
    cancelled_by_email: cleanEmail,
    cancelled_by_name: cancelledBy?.name || "Department Manager",
    cancelled_by_role: cancelledBy?.role || "manager",
    cancellation_reason: reason.trim(),
  };

  // 1. Direct Supabase Postgres DB update (authoritative, schema safe)
  try {
    const { data: updatedDb, error: dbErr } = await supabase
      .from("projects")
      .update({
        status: "cancelled",
        completion_notes: JSON.stringify(cancellationPayload),
        updated_at: now,
      })
      .eq("id", projectId)
      .select("*")
      .single();

    if (!dbErr && updatedDb) {
      cancelled = {
        ...updatedDb,
        ...cancellationPayload,
      };
    }
  } catch {}

  // 2. /api/projects-store fallback & sync
  try {
    const res = await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_project", projectId, cancelledBy, reason }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.project && !cancelled) cancelled = data.project;
    }
  } catch {}

  if (!cancelled) {
    const currentProjects = await fetchAllProjects();
    const updatedList = currentProjects.map((p) => {
      if (p.id === projectId) {
        cancelled = {
          ...p,
          status: "cancelled",
          completion_notes: JSON.stringify(cancellationPayload),
          ...cancellationPayload,
          updated_at: now,
        };
        return cancelled;
      }
      return p;
    });
    await saveAllProjects(updatedList);
  }

  if (cancelled) {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_projects");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const updated = list.map((p: any) => (p.id === cancelled!.id ? cancelled : p));
            localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
          }
        }
      } catch {}
    }
    await broadcastProjectEvent("project_cancelled", { project: cancelled });
  }
  return cancelled;
}

export async function markProjectSeen(projectId: string, agentEmail: string): Promise<void> {
  if (!agentEmail || !projectId) return;
  const clean = agentEmail.toLowerCase().trim();
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("teals_crm_projects");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const updated = list.map((p: any) => {
            if (p.id === projectId) {
              const seen = (p.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
              if (!seen.includes(clean)) {
                return { ...p, seen_by_emails: [...(p.seen_by_emails || []), clean] };
              }
            }
            return p;
          });
          localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
        }
      }
    } catch {}
  }

  try {
    const { data: dbProj } = await supabase.from("projects").select("seen_by_emails").eq("id", projectId).maybeSingle();
    if (dbProj) {
      const seen = (dbProj.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
      if (!seen.includes(clean)) {
        await supabase.from("projects").update({
          seen_by_emails: [...seen, clean]
        }).eq("id", projectId);
      }
    }
  } catch {}

  try {
    await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_seen", projectId, agentEmail: clean }),
      keepalive: true,
    });
  } catch {}

  await broadcastProjectEvent("projects_marked_seen", { agentEmail: clean, projectId });
}

export async function markAllProjectsSeen(agentEmail: string): Promise<void> {
  if (!agentEmail) return;
  const clean = agentEmail.toLowerCase().trim();
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("teals_crm_projects");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const updated = list.map((p: any) => {
            const seen = (p.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
            if (!seen.includes(clean)) {
              return { ...p, seen_by_emails: [...(p.seen_by_emails || []), clean] };
            }
            return p;
          });
          localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
        }
      }
    } catch {}
  }

  try {
    const { data: projs } = await supabase.from("projects").select("id, seen_by_emails");
    if (Array.isArray(projs)) {
      for (const p of projs) {
        const seen = (p.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
        if (!seen.includes(clean)) {
          await supabase.from("projects").update({
            seen_by_emails: [...seen, clean]
          }).eq("id", p.id);
        }
      }
    }
  } catch {}

  try {
    await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_seen", agentEmail: clean }),
      keepalive: true,
    });
  } catch {}

  await broadcastProjectEvent("projects_marked_seen", { agentEmail: clean });
}

export async function addProjectComment(
  projectId: string,
  comment: {
    id?: string;
    author_name: string;
    author_email: string;
    author_role: "admin" | "working_agent";
    content: string;
    mentions?: string[];
    reply_to?: {
      comment_id: string;
      author_name: string;
      author_email: string;
      content_snippet: string;
    } | null;
    created_at?: string;
  }
): Promise<Project | null> {
  const now = new Date().toISOString();
  const commentAuthorEmail = (comment.author_email || "").toLowerCase().trim();

  const newComment: ProjectComment = {
    id: comment.id || ("cmt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)),
    project_id: projectId,
    author_name: comment.author_name || "Agent",
    author_email: commentAuthorEmail,
    author_role: comment.author_role || (isAdminEmail(commentAuthorEmail) ? "admin" : "working_agent"),
    content: comment.content || "",
    mentions: Array.isArray(comment.mentions) ? comment.mentions : [],
    reply_to: comment.reply_to || null,
    created_at: comment.created_at || now,
  };

  // 1. Immediately save to recent local comments queue
  saveRecentLocalComment(newComment);

  // 2. Immediately update local projects cache
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("teals_crm_projects");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const updated = list.map((p: any) => {
            if (p.id === projectId) {
              const existing = Array.isArray(p.comments) ? p.comments : [];
              const exists = existing.some((c: any) => c.id === newComment.id);
              return {
                ...p,
                comments: exists ? existing : [...existing, newComment],
                updated_at: now,
                seen_by_emails: [commentAuthorEmail].filter(Boolean),
              };
            }
            return p;
          });
          localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
        }
      }
    } catch {}
  }

  let updatedProject: Project | null = null;

  // 3. Try Supabase Postgres DB directly first (10ms atomic write)
  try {
    const { data: dbProj, error: dbErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (!dbErr && dbProj) {
      const existing = Array.isArray(dbProj.comments) ? dbProj.comments : [];
      const exists = existing.some((c: any) => c.id === newComment.id);
      const updatedComments = exists ? existing : [...existing, newComment];
      const { data: savedDb, error: updateErr } = await supabase
        .from("projects")
        .update({
          comments: updatedComments,
          updated_at: now,
          seen_by_emails: [commentAuthorEmail].filter(Boolean),
        })
        .eq("id", projectId)
        .select("*")
        .single();

      if (!updateErr && savedDb) {
        updatedProject = savedDb;
      }
    }
  } catch {}

  // 4. Fallback to /api/projects-store with keepalive
  if (!updatedProject) {
    try {
      const res = await fetch("/api/projects-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_comment", projectId, comment: newComment }),
        keepalive: true,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          updatedProject = data.project;
        } else if (Array.isArray(data.projects)) {
          updatedProject = data.projects.find((p: any) => p.id === projectId) || null;
        }
      }
    } catch {}
  }

  if (!updatedProject) {
    const currentProjects = await fetchAllProjects();
    const updatedList = currentProjects.map((p) => {
      if (p.id === projectId) {
        const existing = Array.isArray(p.comments) ? p.comments : [];
        const exists = existing.some((c: any) => c.id === newComment.id);
        updatedProject = {
          ...p,
          comments: exists ? existing : [...existing, newComment],
          updated_at: now,
          seen_by_emails: [commentAuthorEmail].filter(Boolean),
        };
        return updatedProject;
      }
      return p;
    });
    await saveAllProjects(updatedList);
  }

  if (updatedProject) {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_projects");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const updated = list.map((p: any) => (p.id === updatedProject!.id ? updatedProject : p));
            localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
          }
        }
      } catch {}
    }
    await broadcastProjectEvent("project_comment_added", { project: updatedProject });
  }
  return updatedProject;
}

export async function deleteProject(projectId: string, requesterEmail: string): Promise<boolean> {
  trackDeletedProjectId(projectId);
  let success = false;

  // 1. Direct Supabase Postgres DB delete
  try {
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (!error) {
      success = true;
    }
  } catch {}

  // 2. /api/projects-store sync
  try {
    const res = await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_project", projectId, requesterEmail }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) success = true;
    }
  } catch {}

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("teals_crm_projects");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const updated = list.filter((p: any) => p.id !== projectId);
          localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
        }
      }
    } catch {}
  }

  await broadcastProjectEvent("project_deleted", { projectId });
  return success;
}

export async function deleteProjectComment(
  projectId: string,
  commentId: string,
  requesterEmail: string
): Promise<Project | null> {
  trackDeletedCommentId(commentId);
  removeRecentLocalComment(commentId);
  let updatedProject: Project | null = null;
  const now = new Date().toISOString();

  // 1. Direct Supabase Postgres DB update (Fast, authoritative)
  try {
    const { data: dbProj, error: selErr } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    if (!selErr && dbProj) {
      const filteredComments = (dbProj.comments || []).filter((c: any) => c.id !== commentId);
      const { data: savedDb, error: updateErr } = await supabase
        .from("projects")
        .update({
          comments: filteredComments,
          updated_at: now,
        })
        .eq("id", projectId)
        .select("*")
        .single();

      if (!updateErr && savedDb) {
        updatedProject = savedDb;
      }
    }
  } catch {}

  // 2. /api/projects-store fallback & sync
  try {
    const res = await fetch("/api/projects-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_comment", projectId, commentId, requesterEmail }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.project && !updatedProject) updatedProject = data.project;
    }
  } catch {}

  if (!updatedProject) {
    const currentProjects = await fetchAllProjects();
    const updatedList = currentProjects.map((p) => {
      if (p.id === projectId) {
        updatedProject = {
          ...p,
          comments: (p.comments || []).filter((c) => c.id !== commentId),
          updated_at: now,
        };
        return updatedProject;
      }
      return p;
    });
    await saveAllProjects(updatedList);
  }

  if (updatedProject) {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("teals_crm_projects");
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const updated = list.map((p: any) => (p.id === updatedProject!.id ? updatedProject : p));
            localStorage.setItem("teals_crm_projects", JSON.stringify(updated));
          }
        }
      } catch {}
    }
    await broadcastProjectEvent("project_comment_deleted", { project: updatedProject, commentId });
  }
  return updatedProject;
}

// ── PERMISSION CHECK HELPERS ────────────────────────────────────────────────
export function isUserAdminOrManager(
  userEmail: string | undefined | null,
  userRole: string | undefined | null,
  department?: Department | null
): boolean {
  if (!userEmail) return false;
  const clean = userEmail.toLowerCase().trim();
  if (userRole === "admin" || isAdminEmail(clean)) return true;
  if (department && department.manager_email && department.manager_email.toLowerCase().trim() === clean) {
    return true;
  }
  return false;
}

export function getUserAssignedDepartment(
  userEmail: string | undefined | null,
  departments: Department[]
): Department | null {
  if (!userEmail) return null;
  const clean = userEmail.toLowerCase().trim();
  return (
    departments.find(
      (d) =>
        (d.manager_email && d.manager_email.toLowerCase().trim() === clean) ||
        d.member_emails.some((m) => m.toLowerCase().trim() === clean)
    ) || null
  );
}

export function getUserAssignedDepartments(
  userEmail: string | undefined | null,
  departments: Department[]
): Department[] {
  if (!userEmail) return [];
  const clean = userEmail.toLowerCase().trim();
  return departments.filter(
    (d) =>
      (d.manager_email && d.manager_email.toLowerCase().trim() === clean) ||
      d.member_emails.some((m) => m.toLowerCase().trim() === clean)
  );
}

export function isUserMentionedInComment(
  comment?: ProjectComment | null,
  userEmail?: string | null,
  userName?: string | null
): boolean {
  if (!comment) return false;
  const cleanEmail = (userEmail || "").toLowerCase().trim();
  const authorEmail = (comment.author_email || "").toLowerCase().trim();

  // If the logged-in user wrote this comment, it is not an incoming mention for them
  if (cleanEmail && authorEmail && cleanEmail === authorEmail) {
    return false;
  }

  const cleanName = (userName || "").toLowerCase().trim();
  const nameParts = cleanName.split(/\s+/).filter((p) => p.length > 1);

  // 1. Check structured mentions array
  if (Array.isArray(comment.mentions) && comment.mentions.length > 0) {
    for (const m of comment.mentions) {
      const raw = m.toLowerCase().replace(/^@/, "").trim();
      if (!raw) continue;
      if (raw === "everyone" || raw === "all") return true;
      if (cleanEmail && (cleanEmail === raw || cleanEmail.startsWith(raw) || raw.includes(cleanEmail))) return true;
      if (cleanName && (cleanName === raw || cleanName.includes(raw) || raw.includes(cleanName))) return true;
      if (nameParts.some((np) => np === raw || raw.includes(np))) return true;
    }
  }

  // 2. Check comment text content for inline @mentions
  const text = (comment.content || "").toLowerCase();
  if (text.includes("@everyone") || text.includes("@all")) return true;
  if (cleanEmail && text.includes(`@${cleanEmail}`)) return true;
  if (cleanName && text.includes(`@${cleanName}`)) return true;
  for (const np of nameParts) {
    if (text.includes(`@${np}`)) return true;
  }

  return false;
}

export function isUserMentionedInProject(
  project?: Project | null,
  userEmail?: string | null,
  userName?: string | null
): boolean {
  if (!project || !Array.isArray(project.comments)) return false;
  return project.comments.some((c) => isUserMentionedInComment(c, userEmail, userName));
}

export type UserAccessInfo = {
  isAdmin: boolean;
  isManager: boolean;
  managerDepartmentName: string | null;
  isProductionAgent: boolean;
  isEcommerceAgent: boolean;
  isSalesAgent: boolean;
  departmentId: string | null;
  departmentName: string | null;
  allowedRoutes: string[];
};

export function getUserAccessInfo(
  user: { email?: string | null; role?: string | null; department_id?: string | null; department_name?: string | null; avatar_url?: string | null } | null,
  departments: Department[] = []
): UserAccessInfo {
  if (!user || !user.email) {
    return {
      isAdmin: false,
      isManager: false,
      managerDepartmentName: null,
      isProductionAgent: false,
      isEcommerceAgent: false,
      isSalesAgent: false,
      departmentId: null,
      departmentName: null,
      allowedRoutes: [],
    };
  }

  const cleanEmail = user.email.toLowerCase().trim();
  const isAdmin = Boolean(user.role === "admin" || isAdminEmail(cleanEmail));

  if (isAdmin) {
    return {
      isAdmin: true,
      isManager: false,
      managerDepartmentName: null,
      isProductionAgent: false,
      isEcommerceAgent: false,
      isSalesAgent: false,
      departmentId: null,
      departmentName: "Administration",
      allowedRoutes: ["*"],
    };
  }

  // Parse avatar_url metadata if available
  let metaRole = user.role;
  let metaDeptId = user.department_id || "";
  let metaDeptName = user.department_name || "";
  if (user.avatar_url) {
    try {
      const parsed = JSON.parse(user.avatar_url);
      if (parsed.role) metaRole = parsed.role;
      if (parsed.department_id) metaDeptId = parsed.department_id;
      if (parsed.department_name) metaDeptName = parsed.department_name;
    } catch {}
  }

  const allDeptsToSearch = departments && departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;

  // Check if user is manager of any department
  const managedDept = allDeptsToSearch.find(
    (d) => d.manager_email && d.manager_email.toLowerCase().trim() === cleanEmail
  );
  const isManager = Boolean(user.role === "manager" || metaRole === "manager" || managedDept);

  if (isManager) {
    const resolvedDeptId = managedDept?.id || metaDeptId || user.department_id || (
      cleanEmail.includes("ahsan") ? "production-house" : (cleanEmail.includes("ava") || cleanEmail.includes("reed")) ? "ecommerce-department" : "sales-department"
    );

    const resolvedDeptName = managedDept?.name || metaDeptName || (
      resolvedDeptId === "production-house"
        ? "Production House"
        : resolvedDeptId === "ecommerce-department"
        ? "E-commerce Department"
        : "Sales Department"
    );

    return {
      isAdmin: false,
      isManager: true,
      managerDepartmentName: resolvedDeptName,
      isProductionAgent: false,
      isEcommerceAgent: false,
      isSalesAgent: false,
      departmentId: resolvedDeptId,
      departmentName: `${resolvedDeptName} Manager`,
      allowedRoutes: [
        "/dashboard",
        "/notifications",
        "/leads",
        "/email",
        "/follow-ups",
        "/livechat",
        "/projects",
        "/settings",
        "/meta-leads",
        "/reports",
      ],
    };
  }

  // Non-manager working agent
  const memberDept = allDeptsToSearch.find(
    (d) => Array.isArray(d.member_emails) && d.member_emails.some((m) => m.toLowerCase().trim() === cleanEmail)
  );

  const effectiveDeptId = memberDept?.id || metaDeptId || user.department_id || (
    cleanEmail.includes("emma") ? "ecommerce-department" : "production-house"
  );
  const effectiveDeptName = memberDept?.name || metaDeptName || (
    effectiveDeptId === "production-house"
      ? "Production House"
      : effectiveDeptId === "ecommerce-department"
      ? "E-commerce Department"
      : "Sales Department"
  );

  const isProductionAgent = effectiveDeptId === "production-house";
  const isEcommerceAgent = effectiveDeptId === "ecommerce-department";
  const isSalesAgent = !isProductionAgent && !isEcommerceAgent;

  let allowedRoutes: string[] = [];
  if (isProductionAgent) {
    allowedRoutes = ["/projects", "/settings"];
  } else if (isEcommerceAgent) {
    allowedRoutes = ["/projects", "/livechat", "/settings"];
  } else {
    // Sales agent
    allowedRoutes = [
      "/dashboard",
      "/notifications",
      "/leads",
      "/email",
      "/follow-ups",
      "/livechat",
      "/projects",
      "/settings",
    ];
  }

  return {
    isAdmin: false,
    isManager: false,
    managerDepartmentName: null,
    isProductionAgent,
    isEcommerceAgent,
    isSalesAgent,
    departmentId: effectiveDeptId,
    departmentName: `${effectiveDeptName} Working Agent`,
    allowedRoutes,
  };
}


