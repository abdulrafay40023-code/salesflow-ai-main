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

  const { email, id } = body;
  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === ADMIN_EMAIL) {
    return res.status(200).json({ ok: true, notice: "Admin preserved" });
  }

  try {
    // 1. Check if profile exists and is approved in profiles table
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, avatar_url, role")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (prof) {
      if (prof.role === "admin") {
        return res.status(200).json({ ok: true, notice: "Admin user" });
      }
      if (prof.avatar_url) {
        try {
          const parsed = JSON.parse(prof.avatar_url);
          if (parsed.approved === true) {
            return res.status(200).json({ ok: true, notice: "Approved agent" });
          }
        } catch {}
      }
    }

    // 2. User is not approved yet — keep auth user in auth.users so their Google OAuth provider identity remains intact, access is gated by profiles table
    return res.status(200).json({ ok: true, notice: "Unapproved Google OAuth user (access gated)" });
  } catch (err: any) {
    console.error("Clean unapproved auth error:", err);
    return res.status(500).json({ error: err.message || "Failed to clean auth user" });
  }
}
