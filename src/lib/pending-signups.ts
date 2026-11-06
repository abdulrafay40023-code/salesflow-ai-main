import { supabase } from "@/lib/supabase";

export type PendingSignup = {
  id: string;
  name: string;
  email: string;
  phone: string;
  pseudo_name?: string;
  role_title?: string;
  designation?: string;
  department_id?: string;
  department_name?: string;
  avatar_initials?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const DEPT_NAME_MAP: Record<string, string> = {
  "production-house": "Production House",
  "ecommerce-department": "E-commerce Department",
  "sales-department": "Sales Department",
};

/**
 * Inserts or updates a pending signup in `pending_signups` (with automatic fallback to request queue).
 */
export async function createPendingSignup(payload: {
  name: string;
  email: string;
  phone: string;
  pseudo_name?: string;
  role_title?: string;
  designation?: string;
  department_id?: string;
}): Promise<void> {
  const cleanEmail = payload.email.toLowerCase().trim();
  const trimmedName = payload.name.trim();
  const trimmedPhone = payload.phone.trim();
  const trimmedPseudoName = (payload.pseudo_name || "").trim();
  const trimmedRoleTitle = (payload.role_title || payload.designation || "").trim();
  const trimmedDesignation = (payload.designation || "").trim();
  const deptId = payload.department_id || "production-house";

  const initials = (trimmedPseudoName || trimmedName)
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const record = {
    name: trimmedName,
    email: cleanEmail,
    phone: trimmedPhone,
    pseudo_name: trimmedPseudoName,
    role_title: trimmedRoleTitle,
    designation: trimmedDesignation,
    department_id: deptId,
    avatar_initials: initials,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  // 1. Try physical table pending_signups
  try {
    await supabase.from("pending_signups").upsert(record, { onConflict: "email" });
  } catch (e) {
    console.log("pending_signups upsert notice:", e);
  }

  // 2. Insert/update fallback in emails_sent queue
  try {
    const queuePayload = JSON.stringify(record);

    await supabase.from("emails_sent").insert({
      lead_email: cleanEmail,
      sequence_type: "agent_approval_request",
      subject: queuePayload,
      status: "pending",
      sent_at: record.created_at,
    });
  } catch (e) {
    console.log("emails_sent fallback notice:", e);
  }
}

/**
 * Fetches all pending signups (status = 'pending').
 */
export async function fetchPendingSignups(): Promise<PendingSignup[]> {
  const list: PendingSignup[] = [];
  const seenEmails = new Set<string>();

  // 1. Fetch from pending_signups table
  try {
    const { data } = await supabase
      .from("pending_signups")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        if (row.email && !seenEmails.has(row.email.toLowerCase())) {
          seenEmails.add(row.email.toLowerCase());
          const deptId = row.department_id || "production-house";
          list.push({
            id: row.id,
            name: row.name || row.email.split("@")[0],
            email: row.email,
            phone: row.phone || "",
            pseudo_name: row.pseudo_name || "",
            role_title: row.role_title || row.designation || "",
            designation: row.designation || "",
            department_id: deptId,
            department_name: DEPT_NAME_MAP[deptId] || "Production House",
            avatar_initials: row.avatar_initials || row.name?.slice(0, 2).toUpperCase() || "AG",
            status: row.status || "pending",
            created_at: row.created_at,
          });
        }
      });
    }
  } catch {}

  // 2. Fetch from emails_sent queue fallback
  try {
    const { data: queueData } = await supabase
      .from("emails_sent")
      .select("id, lead_email, subject, status, sent_at")
      .eq("sequence_type", "agent_approval_request")
      .eq("status", "pending")
      .order("sent_at", { ascending: false });

    if (queueData && Array.isArray(queueData)) {
      queueData.forEach((row: any) => {
        if (row.lead_email && !seenEmails.has(row.lead_email.toLowerCase())) {
          seenEmails.add(row.lead_email.toLowerCase());
          let name = row.lead_email.split("@")[0];
          let phone = "";
          let designation = "";
          let pseudo_name = "";
          let role_title = "";
          let avatar_initials = name.slice(0, 2).toUpperCase();
          let deptId = "production-house";
          try {
            const p = JSON.parse(row.subject);
            if (p.name) name = p.name;
            if (p.phone) phone = p.phone;
            if (p.pseudo_name) pseudo_name = p.pseudo_name;
            if (p.role_title) role_title = p.role_title;
            if (p.designation) designation = p.designation;
            if (p.avatar_initials) avatar_initials = p.avatar_initials;
            if (p.department_id) deptId = p.department_id;
          } catch {}
          list.push({
            id: row.id,
            name,
            email: row.lead_email,
            phone,
            pseudo_name,
            role_title,
            designation,
            department_id: deptId,
            department_name: DEPT_NAME_MAP[deptId] || "Production House",
            avatar_initials,
            status: row.status || "pending",
            created_at: row.sent_at,
          });
        }
      });
    }
  } catch {}

  return list;
}

/**
 * Checks if a specific email has a pending request.
 */
export async function getPendingSignupByEmail(email: string): Promise<PendingSignup | null> {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();

  // Check physical table
  try {
    const { data } = await supabase
      .from("pending_signups")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (data) {
      const deptId = (data as any).department_id || "production-house";
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        pseudo_name: (data as any).pseudo_name || "",
        role_title: (data as any).role_title || (data as any).designation || "",
        designation: (data as any).designation || "",
        department_id: deptId,
        department_name: DEPT_NAME_MAP[deptId] || "Production House",
        avatar_initials: data.avatar_initials || data.name?.slice(0, 2).toUpperCase() || "AG",
        status: data.status,
        created_at: data.created_at,
      };
    }
  } catch {}

  // Check fallback queue
  try {
    const { data } = await supabase
      .from("emails_sent")
      .select("*")
      .eq("lead_email", cleanEmail)
      .eq("sequence_type", "agent_approval_request")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      let name = cleanEmail.split("@")[0];
      let phone = "";
      let designation = "";
      let pseudo_name = "";
      let role_title = "";
      let avatar_initials = name.slice(0, 2).toUpperCase();
      let deptId = "production-house";
      try {
        const p = JSON.parse(data.subject);
        if (p.name) name = p.name;
        if (p.phone) phone = p.phone;
        if (p.pseudo_name) pseudo_name = p.pseudo_name;
        if (p.role_title) role_title = p.role_title;
        if (p.designation) designation = p.designation;
        if (p.avatar_initials) avatar_initials = p.avatar_initials;
        if (p.department_id) deptId = p.department_id;
      } catch {}
      return {
        id: data.id,
        name,
        email: cleanEmail,
        phone,
        pseudo_name,
        role_title,
        designation,
        department_id: deptId,
        department_name: DEPT_NAME_MAP[deptId] || "Production House",
        avatar_initials,
        status: data.status as any,
        created_at: data.sent_at,
      };
    }
  } catch {}

  return null;
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Approves a pending signup via server-side API:
 * 1. API creates auth.users entry (so profiles FK is satisfied)
 * 2. API creates profile with real auth UUID
 * 3. Assigns agent to their chosen department
 * 4. Removes from pending_signups & marks fallback queue
 */
export async function approvePendingSignup(signup: PendingSignup, departmentId?: string): Promise<void> {
  const cleanEmail = signup.email.toLowerCase().trim();
  const targetDeptId = departmentId || signup.department_id || "production-house";

  // Call server-side API which uses Service Role key to create auth user + profile + assign department
  const res = await fetch("/api/approve-pending-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: signup.name,
      email: cleanEmail,
      phone: signup.phone || "",
      pseudo_name: signup.pseudo_name || "",
      role_title: signup.role_title || signup.designation || "",
      designation: signup.designation || "",
      department_id: targetDeptId,
    }),
  });

  if (!res.ok) {
    let msg = "Approval failed";
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {}
    throw new Error(msg);
  }
}


/**
 * Removes/rejects a pending signup or approved member:
 * Calls server-side API which uses Service Role key to completely delete user from:
 * 1. `pending_signups`
 * 2. `profiles`
 * 3. `auth.users`
 */
export async function removePendingOrApprovedSignup(email: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail || cleanEmail === "garryamelia6265@gmail.com") return;

  // Call server-side API to remove from database and auth.users
  try {
    await fetch("/api/reject-pending-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail }),
    });
  } catch (e) {
    console.error("Reject signup API call failed:", e);
  }

  // Client-side fallback cleanup
  try {
    await supabase.from("pending_signups").delete().eq("email", cleanEmail);
  } catch {}
  try {
    await supabase.from("profiles").delete().eq("email", cleanEmail);
  } catch {}
  try {
    await supabase.from("emails_sent").delete().eq("lead_email", cleanEmail);
  } catch {}
}
