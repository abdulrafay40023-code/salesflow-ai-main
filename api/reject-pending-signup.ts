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

const ADMIN_EMAIL = "garryamelia6265@gmail.com";

export default async function handler(req: any, res: any) {
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : new Response("OK");
  }

  if (req.method !== "POST") {
    return res.status
      ? res.status(405).json({ error: "Method not allowed" })
      : new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let body: any = {};
  try {
    if (req.body) {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } else if (typeof req.json === "function") {
      body = await req.json();
    }
  } catch {}

  const { email } = body || {};
  if (!email) {
    const errObj = { error: "Missing email" };
    return res.status ? res.status(400).json(errObj) : new Response(JSON.stringify(errObj), { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (cleanEmail === ADMIN_EMAIL) {
    const errObj = { error: "Cannot delete Admin user" };
    return res.status ? res.status(400).json(errObj) : new Response(JSON.stringify(errObj), { status: 400 });
  }

  try {
    // 1. Delete from profiles
    await supabaseAdmin.from("profiles").delete().eq("email", cleanEmail);

    // 2. Delete from pending_signups
    await supabaseAdmin.from("pending_signups").delete().eq("email", cleanEmail);

    // 3. Delete queue fallback and presence logs
    await supabaseAdmin
      .from("emails_sent")
      .delete()
      .eq("lead_email", cleanEmail);

    // 4. Delete user completely from auth.users using Service Role key
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    if (usersData?.users) {
      const match = usersData.users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
      if (match && match.id) {
        await supabaseAdmin.auth.admin.deleteUser(match.id);
        console.log(`Successfully deleted unapproved/rejected user ${cleanEmail} from auth.users`);
      }
    }

    const successObj = { success: true };
    return res.status
      ? res.status(200).json(successObj)
      : new Response(JSON.stringify(successObj), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Reject pending signup error:", err);
    const errObj = { error: err?.message || "Internal server error" };
    return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
  }
}
