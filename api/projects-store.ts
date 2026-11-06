import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env["VITE_SUPABASE_URL"] ||
  process.env["SUPABASE_URL"] ||
  "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";

const SERVICE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STORAGE_BUCKET = "teals-live-store";
const DEPTS_FILE = "crm-departments.json";
const PROJECTS_FILE = "crm-projects.json";

const ADMIN_EMAILS = [
  "garryamelia6265@gmail.com",
  "jennifer.cisternino2027@gmail.com",
  "ashal.raza@teals.co",
  "tzafar04@gmail.com",
  "annusraees@gmail.com",
  "superadmin@teals.ai",
  "admin@teals.ai",
];

function isUserAdmin(email?: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

function isEcommerceDept(deptId?: string, deptName?: string): boolean {
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

export const DEFAULT_DEPARTMENTS = [
  {
    id: "production-house",
    name: "Production House",
    description: "Designers, Full-Stack Developers, UI/UX Specialists and Multimedia Creators.",
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
    description: "Amazon, Shopify, Walmart, Store Automation, Product Hunting and Listing.",
    icon: "ShoppingBag",
    color: "emerald",
    manager_email: null,
    manager_name: null,
    member_emails: [],
    subcategories: ["Shopify Store Setup", "Amazon FBA Operations", "Product Listing and SEO", "Store Automation", "Inventory Management"],
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "sales-department",
    name: "Sales Department",
    description: "Cold Calling, Inbound Lead Qualification, Closing Deals and Demo Bookings.",
    icon: "PhoneCall",
    color: "blue",
    manager_email: null,
    manager_name: null,
    member_emails: [],
    subcategories: ["Outbound Power Calling", "Demo Booking and Presentation", "Closing and Contract Negotiation", "Client Follow-up and Retention"],
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

async function ensureBucket() {
  try {
    await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, { public: true });
  } catch {}
}

let memoryProjectsCache: { projects: any[]; timestamp: number } | null = null;
let memoryDeptsCache: { departments: any[]; timestamp: number } | null = null;

async function getStoredDepartments(): Promise<any[]> {
  if (memoryDeptsCache && Date.now() - memoryDeptsCache.timestamp < 3000) {
    return memoryDeptsCache.departments;
  }
  // 1. Query Postgres departments table directly
  try {
    const { data: dbDepts, error } = await supabaseAdmin.from("departments").select("*").order("created_at", { ascending: true });
    if (!error && Array.isArray(dbDepts) && dbDepts.length > 0) {
      memoryDeptsCache = { departments: dbDepts, timestamp: Date.now() };
      return dbDepts;
    }
  } catch {}

  // 2. Storage JSON fallback
  try {
    const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(DEPTS_FILE);
    if (!error && data) {
      const text = await data.text();
      const list = JSON.parse(text);
      if (Array.isArray(list) && list.length > 0) {
        memoryDeptsCache = { departments: list, timestamp: Date.now() };
        return list;
      }
    }
  } catch {}
  return memoryDeptsCache ? memoryDeptsCache.departments : DEFAULT_DEPARTMENTS;
}

let writeQueue: Promise<any> = Promise.resolve();

function executeWithLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => {});
  return next;
}

async function getStoredProjects(): Promise<any[]> {
  if (memoryProjectsCache && Date.now() - memoryProjectsCache.timestamp < 3000) {
    return memoryProjectsCache.projects;
  }
  // 1. Query Postgres projects table directly
  try {
    const { data: dbProjs, error } = await supabaseAdmin.from("projects").select("*").order("created_at", { ascending: false });
    if (!error && Array.isArray(dbProjs)) {
      const mapped = dbProjs.map((p) => {
        if (p.status === "cancelled" && p.completion_notes) {
          try {
            const parsed = JSON.parse(p.completion_notes);
            if (parsed && typeof parsed === "object") {
              return { ...p, ...parsed };
            }
          } catch {
            return { ...p, cancellation_reason: p.completion_notes };
          }
        }
        return p;
      });
      memoryProjectsCache = { projects: mapped, timestamp: Date.now() };
      return mapped;
    }
  } catch {}

  // 2. Storage JSON fallback
  try {
    const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(PROJECTS_FILE);
    if (!error && data) {
      const text = await data.text();
      const list = JSON.parse(text);
      if (Array.isArray(list)) {
        memoryProjectsCache = { projects: list, timestamp: Date.now() };
        return list;
      }
    }
  } catch {}
  return memoryProjectsCache ? memoryProjectsCache.projects : [];
}

async function writeDepartments(departments: any[]) {
  memoryDeptsCache = { departments, timestamp: Date.now() };
  try {
    await supabaseAdmin.from("departments").upsert(departments);
  } catch {}
  await ensureBucket();
  const blob = Buffer.from(JSON.stringify(departments, null, 2));
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(DEPTS_FILE, blob, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) {
    console.error("writeDepartments upload error:", error);
  }
}

async function writeProjects(projects: any[]) {
  memoryProjectsCache = { projects, timestamp: Date.now() };
  try {
    const sanitizedForDb = projects.map((p) => {
      const {
        cancelled_at,
        cancelled_by_email,
        cancelled_by_name,
        cancelled_by_role,
        cancellation_reason,
        ...rest
      } = p;
      return rest;
    });
    await supabaseAdmin.from("projects").upsert(sanitizedForDb);
  } catch (err) {
    console.warn("writeProjects DB upsert notice:", err);
  }
  await ensureBucket();
  const blob = Buffer.from(JSON.stringify(projects, null, 2));
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(PROJECTS_FILE, blob, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) {
    console.error("writeProjects upload error:", error);
  }
}

const NO_CACHE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
  "Content-Type": "application/json",
};

async function readRequestBody(req: any): Promise<any> {
  if (!req) return {};
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    if (typeof req.body === "object") {
      return req.body;
    }
  }
  if (typeof req.json === "function") {
    try { return await req.json(); } catch {}
  }
  if (typeof req.text === "function") {
    try {
      const text = await req.text();
      return text ? JSON.parse(text) : {};
    } catch {}
  }
  if (typeof req[Symbol.asyncIterator] === "function" || typeof req.on === "function") {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      if (chunks.length > 0) {
        const raw = Buffer.concat(chunks).toString("utf8");
        return raw ? JSON.parse(raw) : {};
      }
    } catch {}
  }
  return {};
}

export default async function handler(req: any, res: any) {
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : new Response("OK", { headers: NO_CACHE_HEADERS });
  }

  if (req.method === "GET") {
    try {
      const [departments, projects] = await Promise.all([
        getStoredDepartments(),
        getStoredProjects(),
      ]);
      const payload = { success: true, departments, projects };
      return res.status ? res.status(200).json(payload) : new Response(JSON.stringify(payload), { status: 200, headers: NO_CACHE_HEADERS });
    } catch (err: any) {
      const errPayload = { error: err?.message || "Failed to load project data" };
      return res.status ? res.status(500).json(errPayload) : new Response(JSON.stringify(errPayload), { status: 500, headers: NO_CACHE_HEADERS });
    }
  }

  if (req.method === "POST") {
    return executeWithLock(async () => {
      const body = await readRequestBody(req);
      const {
        action,
        departments,
        projects,
        project,
        projectId,
        agentEmail,
        agentName,
        fromAgent,
        toAgent,
        toDepartment,
        reason,
        completedBy,
        notes,
        requestedBy,
        issues,
        comment,
        commentId,
        requesterEmail,
      } = body || {};

      try {
      if (action === "upload_file") {
        const { fileName, fileBase64, contentType } = body || {};
        if (!fileName || !fileBase64) {
          const err = { error: "Missing fileName or fileBase64" };
          return res.status ? res.status(400).json(err) : new Response(JSON.stringify(err), { status: 400 });
        }

        const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");
        const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const storagePath = "project-files/" + Date.now() + "_" + safeName;

        const { error } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, buffer, {
            upsert: true,
            contentType: contentType || "application/octet-stream",
          });

        if (error) {
          console.error("Storage upload error:", error);
          const errObj = { error: error.message };
          return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
        }

        const publicUrl = SUPABASE_URL + "/storage/v1/object/public/" + STORAGE_BUCKET + "/" + storagePath;

        const result = {
          success: true,
          url: publicUrl,
          fileName,
          storagePath,
          size: buffer.length,
          contentType: contentType || "application/octet-stream",
        };

        return res.status ? res.status(200).json(result) : new Response(JSON.stringify(result), { status: 200 });
      }

      if (action === "save_departments" && Array.isArray(departments)) {
        const sanitized = departments.map((d: any) => ({
          ...d,
          manager_email: isUserAdmin(d.manager_email) ? null : (d.manager_email || null),
          manager_name: isUserAdmin(d.manager_email) ? null : (d.manager_name || null),
          member_emails: Array.isArray(d.member_emails)
            ? d.member_emails.filter((m: string) => !isUserAdmin(m))
            : [],
        }));
        await writeDepartments(sanitized);
        return res.status ? res.status(200).json({ success: true, departments: sanitized }) : new Response(JSON.stringify({ success: true, departments: sanitized }), { status: 200 });
      }

      if (action === "save_projects" && Array.isArray(projects)) {
        await writeProjects(projects);
        return res.status ? res.status(200).json({ success: true, projects }) : new Response(JSON.stringify({ success: true, projects }), { status: 200 });
      }

      if (action === "create_project" && project) {
        const current = await getStoredProjects();
        const now = new Date().toISOString();
        const createdByEmail = (project.created_by_email || "").toLowerCase().trim();
        let directAssignEmail = (project.claimed_by_email || "").toLowerCase().trim();
        let directAssignName = project.claimed_by_name;
        let directAssignRole = project.claimed_by_role;

        const isEcommerce = isEcommerceDept(project.target_department_id, project.target_department_name);
        if (isEcommerce && directAssignEmail) {
          const depts = await getStoredDepartments();
          const ecomDept = depts.find((d: any) => d.id === project.target_department_id || isEcommerceDept(d.id, d.name));
          const isDeptManager = ecomDept?.manager_email && ecomDept.manager_email.toLowerCase().trim() === directAssignEmail;
          const isAdmin = isUserAdmin(directAssignEmail);

          if (!isDeptManager && !isAdmin) {
            directAssignEmail = "";
            directAssignName = null;
            directAssignRole = null;
          }
        }

        const isDirectlyAssigned = Boolean(directAssignEmail);
        const newProj = {
          ...project,
          id: project.id || "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
          status: isDirectlyAssigned ? "in_progress" : "active",
          claimed_by_email: isDirectlyAssigned ? directAssignEmail : null,
          claimed_by_name: isDirectlyAssigned ? (directAssignName || directAssignEmail.split("@")[0]) : null,
          claimed_by_role: isDirectlyAssigned ? (directAssignRole || (isUserAdmin(directAssignEmail) ? "admin" : "working_agent")) : null,
          claimed_at: isDirectlyAssigned ? (project.claimed_at || now) : null,
          created_by_role: project.created_by_role || (isUserAdmin(createdByEmail) ? "admin" : "working_agent"),
          created_at: now,
          updated_at: now,
          seen_by_emails: [createdByEmail].filter(Boolean),
        };
        const updated = [newProj, ...current];
        await writeProjects(updated);
        return res.status ? res.status(200).json({ success: true, project: newProj }) : new Response(JSON.stringify({ success: true, project: newProj }), { status: 200 });
      }

      if (action === "claim_project" && projectId && agentEmail) {
        const current = await getStoredProjects();
        const now = new Date().toISOString();
        const cleanEmail = agentEmail.toLowerCase().trim();
        let targetProj = null;
        const updated = current.map((p) => {
          if (p.id === projectId) {
            targetProj = {
              ...p,
              claimed_by_email: cleanEmail,
              claimed_by_name: agentName || cleanEmail.split("@")[0],
              claimed_by_role: isUserAdmin(cleanEmail) ? "admin" : "working_agent",
              claimed_at: now,
              status: "in_progress",
              updated_at: now,
              seen_by_emails: Array.from(new Set([...(p.seen_by_emails || []), cleanEmail])),
            };
            return targetProj;
          }
          return p;
        });
        await writeProjects(updated);
        return res.status ? res.status(200).json({ success: true, project: targetProj }) : new Response(JSON.stringify({ success: true, project: targetProj }), { status: 200 });
      }

      if (action === "transfer_project" && projectId) {
        const current = await getStoredProjects();
        const now = new Date().toISOString();
        let toEmail = (toAgent?.email || "").toLowerCase().trim();
        let toName = toAgent?.name || "Unassigned";

        const targetDeptId = toDepartment?.id;
        const targetDeptName = toDepartment?.name;
        const isEcommerce = isEcommerceDept(targetDeptId, targetDeptName);

        if (isEcommerce && toEmail) {
          const depts = await getStoredDepartments();
          const ecomDept = depts.find((d: any) => d.id === targetDeptId || isEcommerceDept(d.id, d.name));
          const isDeptManager = ecomDept?.manager_email && ecomDept.manager_email.toLowerCase().trim() === toEmail;
          const isAdmin = isUserAdmin(toEmail);

          if (!isDeptManager && !isAdmin) {
            toEmail = "";
            toName = "Unassigned Queue";
          }
        }

        let updatedProj = null;
        const updated = current.map((p) => {
          if (p.id === projectId) {
            const transferRecord = {
              from_agent_name: fromAgent?.name || "Agent",
              from_agent_email: (fromAgent?.email || "").toLowerCase().trim(),
              to_agent_name: toEmail ? toName : "Unassigned Queue",
              to_agent_email: toEmail,
              to_department_id: toDepartment?.id,
              to_department_name: toDepartment?.name,
              transferred_at: now,
              reason,
            };
            updatedProj = {
              ...p,
              claimed_by_email: toEmail ? toEmail : null,
              claimed_by_name: toEmail ? toName : null,
              claimed_by_role: toEmail ? (isUserAdmin(toEmail) ? "admin" : "working_agent") : null,
              claimed_at: toEmail ? now : null,
              target_department_id: toDepartment?.id || p.target_department_id,
              target_department_name: toDepartment?.name || p.target_department_name,
              status: toEmail ? "in_progress" : "active",
              updated_at: now,
              seen_by_emails: [(fromAgent?.email || "").toLowerCase().trim()].filter(Boolean),
              transfer_history: [...(p.transfer_history || []), transferRecord],
            };
            return updatedProj;
          }
          return p;
        });
        await writeProjects(updated);
        return res.status ? res.status(200).json({ success: true, project: updatedProj }) : new Response(JSON.stringify({ success: true, project: updatedProj }), { status: 200 });
      }

      if (action === "mark_done" && projectId) {
        const current = await getStoredProjects();
        const now = new Date().toISOString();
        const compEmail = (completedBy?.email || "").toLowerCase().trim();
        let doneProj = null;
        const updated = current.map((p) => {
          if (p.id === projectId) {
            doneProj = {
              ...p,
              status: "done",
              completed_at: now,
              completed_by_email: compEmail,
              completed_by_name: completedBy?.name || "Agent",
              completed_by_role: isUserAdmin(compEmail) ? "admin" : "working_agent",
              completion_notes: notes || null,
              updated_at: now,
            };
            return doneProj;
          }
          return p;
        });
        await writeProjects(updated);
        return res.status ? res.status(200).json({ success: true, project: doneProj }) : new Response(JSON.stringify({ success: true, project: doneProj }), { status: 200 });
      }

      if (action === "request_redo" && projectId) {
        const current = await getStoredProjects();
        const now = new Date().toISOString();
        let redoProj = null;
        const updated = current.map((p) => {
          if (p.id === projectId) {
            const rev = {
              revision_id: "rev_" + Date.now(),
              requested_by_name: requestedBy?.name || "Admin",
              requested_by_email: (requestedBy?.email || "").toLowerCase().trim(),
              requested_at: now,
              issues_and_changes: issues || "",
            };
            redoProj = {
              ...p,
              status: p.claimed_by_email ? "in_progress" : "active",
              completed_at: null,
              completed_by_email: null,
              completed_by_name: null,
              completed_by_role: null,
              updated_at: now,
              seen_by_emails: [(requestedBy?.email || "").toLowerCase().trim()].filter(Boolean),
              revision_history: [...(p.revision_history || []), rev],
            };
            return redoProj;
          }
          return p;
        });
        await writeProjects(updated);
        return res.status ? res.status(200).json({ success: true, project: redoProj }) : new Response(JSON.stringify({ success: true, project: redoProj }), { status: 200 });
      }

      if (action === "cancel_project" && projectId && reason) {
        const current = await getStoredProjects();
        const now = new Date().toISOString();
        const cancelledBy = body.cancelledBy || {};
        const cleanEmail = (cancelledBy.email || "").toLowerCase().trim();
        const cancellationPayload = {
          cancelled_at: now,
          cancelled_by_email: cleanEmail,
          cancelled_by_name: cancelledBy.name || "Department Manager",
          cancelled_by_role: cancelledBy.role || "manager",
          cancellation_reason: reason.trim(),
        };

        // Direct schema-safe Postgres update
        try {
          await supabaseAdmin
            .from("projects")
            .update({
              status: "cancelled",
              completion_notes: JSON.stringify(cancellationPayload),
              updated_at: now,
            })
            .eq("id", projectId);
        } catch (err) {
          console.warn("cancel_project Postgres update notice:", err);
        }

        let cancelledProj: any = null;
        const updated = current.map((p) => {
          if (p.id === projectId) {
            cancelledProj = {
              ...p,
              status: "cancelled",
              completion_notes: JSON.stringify(cancellationPayload),
              ...cancellationPayload,
              updated_at: now,
            };
            return cancelledProj;
          }
          return p;
        });
        await writeProjects(updated);
        return res.status ? res.status(200).json({ success: true, project: cancelledProj }) : new Response(JSON.stringify({ success: true, project: cancelledProj }), { status: 200 });
      }

      if (action === "mark_seen" && projectId && agentEmail) {
        const clean = agentEmail.toLowerCase().trim();
        const current = await getStoredProjects();
        let changed = false;
        const updated = current.map((p) => {
          if (p.id === projectId) {
            const seen = (p.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
            if (!seen.includes(clean)) {
              changed = true;
              return {
                ...p,
                seen_by_emails: [...seen, clean],
              };
            }
          }
          return p;
        });

        // 1. Authoritative Postgres DB update using supabaseAdmin
        try {
          const { data: dbProj } = await supabaseAdmin.from("projects").select("seen_by_emails").eq("id", projectId).maybeSingle();
          if (dbProj) {
            const seen = (dbProj.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
            if (!seen.includes(clean)) {
              await supabaseAdmin.from("projects").update({ seen_by_emails: [...seen, clean] }).eq("id", projectId);
            }
          }
        } catch (err) {
          console.warn("mark_seen DB update notice:", err);
        }

        // 2. Storage JSON update
        if (changed) {
          await writeProjects(updated);
        }
        return res.status ? res.status(200).json({ success: true }) : new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      if (action === "mark_all_seen" && agentEmail) {
        const clean = agentEmail.toLowerCase().trim();
        const current = await getStoredProjects();
        let changed = false;
        const updated = current.map((p) => {
          const seen = (p.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
          if (!seen.includes(clean)) {
            changed = true;
            return {
              ...p,
              seen_by_emails: [...seen, clean],
            };
          }
          return p;
        });

        // 1. Authoritative Postgres DB update using supabaseAdmin
        try {
          const { data: dbProjs } = await supabaseAdmin.from("projects").select("id, seen_by_emails");
          if (Array.isArray(dbProjs)) {
            for (const dp of dbProjs) {
              const seen = (dp.seen_by_emails || []).map((e: string) => (e || "").toLowerCase().trim());
              if (!seen.includes(clean)) {
                await supabaseAdmin.from("projects").update({ seen_by_emails: [...seen, clean] }).eq("id", dp.id);
              }
            }
          }
        } catch (err) {
          console.warn("mark_all_seen DB update notice:", err);
        }

        // 2. Storage JSON update
        if (changed) {
          await writeProjects(updated);
        }
        return res.status ? res.status(200).json({ success: true }) : new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      if (action === "add_comment") {
        const cmtData = comment || body.comment;
        const pId = projectId || body.projectId;
        if (!pId || !cmtData) {
          const errRes = { error: "Missing projectId or comment in add_comment payload" };
          return res.status ? res.status(400).json(errRes) : new Response(JSON.stringify(errRes), { status: 400, headers: NO_CACHE_HEADERS });
        }

        const current = await getStoredProjects();
        const now = new Date().toISOString();
        const commentAuthorEmail = (cmtData.author_email || "").toLowerCase().trim();
        const newComment = {
          id: cmtData.id || ("cmt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)),
          project_id: pId,
          author_name: cmtData.author_name || "Agent",
          author_email: commentAuthorEmail,
          author_role: cmtData.author_role || (isUserAdmin(commentAuthorEmail) ? "admin" : "working_agent"),
          content: cmtData.content || "",
          mentions: Array.isArray(cmtData.mentions) ? cmtData.mentions : [],
          reply_to: cmtData.reply_to || null,
          created_at: cmtData.created_at || now,
        };

        let targetProj: any = null;
        const updated = current.map((p) => {
          if (p.id === pId) {
            const existingComments = Array.isArray(p.comments) ? p.comments : [];
            const alreadyExists = existingComments.some((c: any) => c.id === newComment.id);
            targetProj = {
              ...p,
              comments: alreadyExists ? existingComments : [...existingComments, newComment],
              updated_at: now,
              seen_by_emails: [commentAuthorEmail].filter(Boolean),
            };
            return targetProj;
          }
          return p;
        });

        if (!targetProj) {
          const errRes = { error: `Project ${pId} not found` };
          return res.status ? res.status(404).json(errRes) : new Response(JSON.stringify(errRes), { status: 404, headers: NO_CACHE_HEADERS });
        }

        await writeProjects(updated);
        const resPayload = { success: true, project: targetProj, comment: newComment };
        return res.status ? res.status(200).json(resPayload) : new Response(JSON.stringify(resPayload), { status: 200, headers: NO_CACHE_HEADERS });
      }

      if (action === "delete_project" && projectId) {
        const currentProjects = await getStoredProjects();
        const cleanRequester = (body.requesterEmail || "").toLowerCase().trim();
        const targetProj = currentProjects.find((p) => p.id === projectId);
        if (!targetProj) {
          return res.status ? res.status(404).json({ error: "Project not found" }) : new Response(JSON.stringify({ error: "Project not found" }), { status: 404 });
        }

        const isAdmin = isUserAdmin(cleanRequester);
        if (!isAdmin) {
          return res.status ? res.status(403).json({ error: "Unauthorized. Permanent deletion of projects is strictly restricted to Admins only." }) : new Response(JSON.stringify({ error: "Unauthorized. Permanent deletion of projects is strictly restricted to Admins only." }), { status: 403 });
        }

        const updated = currentProjects.filter((p) => p.id !== projectId);
        try {
          await supabaseAdmin.from("projects").delete().eq("id", projectId);
        } catch {}
        await writeProjects(updated);
        return res.status ? res.status(200).json({ success: true, deletedProjectId: projectId }) : new Response(JSON.stringify({ success: true, deletedProjectId: projectId }), { status: 200 });
      }

      if (action === "delete_comment" && projectId && (commentId || body.commentId)) {
        const cId = commentId || body.commentId;
        const [currentProjects, currentDepts] = await Promise.all([
          getStoredProjects(),
          getStoredDepartments(),
        ]);
        const cleanRequester = (requesterEmail || body.requesterEmail || "").toLowerCase().trim();
        const targetProj = currentProjects.find((p) => p.id === projectId);
        if (!targetProj) {
          return res.status ? res.status(404).json({ error: "Project not found" }) : new Response(JSON.stringify({ error: "Project not found" }), { status: 404 });
        }

        const isAdmin = isUserAdmin(cleanRequester);
        const targetDept = currentDepts.find((d) => d.id === targetProj.target_department_id);
        const isManager = targetDept && targetDept.manager_email && targetDept.manager_email.toLowerCase().trim() === cleanRequester;
        const targetComment = (targetProj.comments || []).find((c: any) => c.id === cId);
        const isAuthor = targetComment && targetComment.author_email?.toLowerCase().trim() === cleanRequester;

        if (!isAdmin && !isManager && !isAuthor) {
          return res.status ? res.status(403).json({ error: "Unauthorized. Only admins and department managers can delete comments." }) : new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
        }

        let updatedProj: any = null;
        const updated = currentProjects.map((p) => {
          if (p.id === projectId) {
            updatedProj = {
              ...p,
              comments: (p.comments || []).filter((c: any) => c.id !== cId),
              updated_at: new Date().toISOString(),
            };
            return updatedProj;
          }
          return p;
        });

        await writeProjects(updated);
        return res.status ? res.status(200).json({ success: true, project: updatedProj, deletedCommentId: cId }) : new Response(JSON.stringify({ success: true, project: updatedProj, deletedCommentId: cId }), { status: 200 });
      }

      if (action === "list" || !action) {
        const [departmentsList, projectsList] = await Promise.all([
          getStoredDepartments(),
          getStoredProjects(),
        ]);
        return res.status ? res.status(200).json({ success: true, departments: departmentsList, projects: projectsList }) : new Response(JSON.stringify({ success: true, departments: departmentsList, projects: projectsList }), { status: 200 });
      }

      const errAction = { error: `Invalid action: ${action}` };
      return res.status ? res.status(400).json(errAction) : new Response(JSON.stringify(errAction), { status: 400, headers: NO_CACHE_HEADERS });
    } catch (err: any) {
      console.error("projects-store API error:", err);
      const errObj = { error: err?.message || "Internal server error" };
      return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
    }
    });
  }

  return res.status ? res.status(405).json({ error: "Method not allowed" }) : new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}
