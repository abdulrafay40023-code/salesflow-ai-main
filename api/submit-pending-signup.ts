import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk";
const ADMIN_EMAIL = "garryamelia6265@gmail.com";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body: any = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {}

  const { name, email, phone, department_id, designation, pseudo_name, role_title } = body;
  if (!email || !name) {
    return res.status(400).json({ error: "Missing name or email" });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === ADMIN_EMAIL) {
    return res.status(400).json({ error: "Cannot submit pending request for admin email" });
  }

  const deptId = department_id || "production-house";
  const trimmedDesignation = (designation || "").trim();
  const trimmedPseudoName = (pseudo_name || "").trim();
  const trimmedRoleTitle = (role_title || designation || "").trim();

  const initials = name
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  try {
    // 1. Insert into pending_signups table (safely without failing if columns differ)
    try {
      await supabase.from("pending_signups").upsert(
        {
          name,
          email: cleanEmail,
          phone: phone || "",
          designation: trimmedDesignation,
          department_id: deptId,
          avatar_initials: initials,
          status: "pending",
          created_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
    } catch {
      await supabase.from("pending_signups").upsert(
        {
          name,
          email: cleanEmail,
          phone: phone || "",
          department_id: deptId,
          avatar_initials: initials,
          status: "pending",
          created_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
    }

    // 2. Insert into emails_sent queue fallback (always preserves full JSON including pseudo_name and role_title)
    const queuePayload = JSON.stringify({
      name,
      email: cleanEmail,
      phone: phone || "",
      designation: trimmedDesignation,
      pseudo_name: trimmedPseudoName,
      role_title: trimmedRoleTitle,
      department_id: deptId,
      avatar_initials: initials,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    await supabase.from("emails_sent").insert({
      lead_email: cleanEmail,
      sequence_type: "agent_approval_request",
      subject: queuePayload,
      status: "pending",
      sent_at: new Date().toISOString(),
    });

    // 3. Remove non-admin profile from profiles table if any existed (kept unapproved until admin approves)
    await supabase.from("profiles").delete().eq("email", cleanEmail);

    // Keep user in auth.users so their Google OAuth provider identity remains 'Google' (not converted to 'Email')
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Submit pending signup error:", err);
    return res.status(500).json({ error: err.message || "Failed to submit request" });
  }
}
