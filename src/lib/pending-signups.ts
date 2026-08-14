import { supabase } from "@/lib/supabase";

export type PendingSignup = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_initials?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

/**
 * Inserts or updates a pending signup in `pending_signups` (with automatic fallback to request queue).
 */
export async function createPendingSignup(payload: {
  name: string;
  email: string;
  phone: string;
}): Promise<void> {
  const initials = payload.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const record = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
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
    const queuePayload = JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      avatar_initials: initials,
      status: "pending",
      created_at: record.created_at,
    });

    await supabase.from("emails_sent").insert({
      lead_email: payload.email,
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
      .select("id, name, email, phone, avatar_initials, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        if (row.email && !seenEmails.has(row.email.toLowerCase())) {
          seenEmails.add(row.email.toLowerCase());
          list.push({
            id: row.id,
            name: row.name || row.email.split("@")[0],
            email: row.email,
            phone: row.phone || "",
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
          let avatar_initials = name.slice(0, 2).toUpperCase();
          try {
            const p = JSON.parse(row.subject);
            if (p.name) name = p.name;
            if (p.phone) phone = p.phone;
            if (p.avatar_initials) avatar_initials = p.avatar_initials;
          } catch {}
          list.push({
            id: row.id,
            name,
            email: row.lead_email,
            phone,
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
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone || "",
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
      let avatar_initials = name.slice(0, 2).toUpperCase();
      try {
        const p = JSON.parse(data.subject);
        if (p.name) name = p.name;
        if (p.phone) phone = p.phone;
        if (p.avatar_initials) avatar_initials = p.avatar_initials;
      } catch {}
      return {
        id: data.id,
        name,
        email: cleanEmail,
        phone,
        avatar_initials,
        status: data.status as any,
        created_at: data.sent_at,
      };
    }
  } catch {}

  return null;
}

/**
 * Approves a pending signup:
 * 1. Creates profile entry in `profiles` table (role: agent, status: approved).
 * 2. Removes record from `pending_signups`.
 */
export async function approvePendingSignup(signup: PendingSignup): Promise<void> {
  // 1. Create profile in real profiles table
  const meta = JSON.stringify({ phone: signup.phone, approved: true, status: "approved" });
  await supabase.from("profiles").upsert({
    id: "agent-" + Date.now(),
    email: signup.email,
    full_name: signup.name,
    avatar_url: meta,
    role: "agent",
  });

  // 2. Remove row from pending_signups table
  try {
    await supabase.from("pending_signups").delete().eq("email", signup.email);
  } catch {}

  // 3. Mark row in fallback queue
  try {
    await supabase
      .from("emails_sent")
      .update({ status: "approved" })
      .eq("lead_email", signup.email)
      .eq("sequence_type", "agent_approval_request");
  } catch {}
}

/**
 * Removes/rejects a pending signup or approved member:
 * 1. Removes row from `pending_signups`.
 * 2. Removes row from `profiles` table (if approved).
 */
export async function removePendingOrApprovedSignup(email: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === "garryamelia6265@gmail.com") return;

  // 1. Delete from pending_signups
  try {
    await supabase.from("pending_signups").delete().eq("email", cleanEmail);
  } catch {}

  // 2. Delete from profiles
  try {
    await supabase.from("profiles").delete().eq("email", cleanEmail);
  } catch {}

  // 3. Update queue fallback
  try {
    await supabase
      .from("emails_sent")
      .update({ status: "rejected" })
      .eq("lead_email", cleanEmail)
      .eq("sequence_type", "agent_approval_request");
  } catch {}
}
