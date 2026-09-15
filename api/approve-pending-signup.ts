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

export default async function handler(req: any, res: any) {
  // Support CORS
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

  const { name, email, phone } = body || {};
  if (!email || !name) {
    const errObj = { error: "Missing required fields: name, email" };
    return res.status ? res.status(400).json(errObj) : new Response(JSON.stringify(errObj), { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // Step 1: Check if user already exists in auth.users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    let authUserId: string;

    if (existingAuthUser) {
      // User already in auth — update app_metadata so provider is 'google'
      authUserId = existingAuthUser.id;
      try {
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          app_metadata: {
            provider: "google",
            providers: ["google"],
          },
        });
      } catch {}
    } else {
      // Create a new auth user with Google provider specified in app_metadata
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          phone: phone || "",
          role: "agent",
        },
        app_metadata: {
          provider: "google",
          providers: ["google"],
        },
      });

      if (createErr || !newUser?.user?.id) {
        console.error("Failed to create auth user:", createErr);
        const errObj = { error: "Failed to create auth user: " + (createErr?.message || "unknown") };
        return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
      }
      authUserId = newUser.user.id;
    }

    // Step 2: Upsert profile using the REAL auth UUID (satisfies foreign key constraint!)
    const meta = JSON.stringify({ phone: phone || "", approved: true, status: "approved" });
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: authUserId,
        email: cleanEmail,
        full_name: name,
        avatar_url: meta,
        role: "agent",
      },
      { onConflict: "id" }
    );

    if (profErr) {
      console.error("Failed to upsert profile:", profErr);
      const errObj = { error: "Profile creation failed: " + profErr.message };
      return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
    }

    // Step 3: Delete from pending_signups table
    await supabaseAdmin.from("pending_signups").delete().eq("email", cleanEmail);

    // Step 4: Clean up fallback queue
    await supabaseAdmin
      .from("emails_sent")
      .delete()
      .eq("lead_email", cleanEmail)
      .eq("sequence_type", "agent_approval_request");

    const successObj = { success: true, authUserId };
    return res.status
      ? res.status(200).json(successObj)
      : new Response(JSON.stringify(successObj), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("approve-pending-signup error:", err);
    const errObj = { error: err?.message || "Internal server error" };
    return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
  }
}
