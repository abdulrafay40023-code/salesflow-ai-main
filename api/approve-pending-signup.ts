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
const ADMINS_FILE = "crm-admins.json";

export const DEFAULT_ADMINS = [
  {
    email: "garryamelia6265@gmail.com",
    name: "Garry Amelia",
    role: "admin",
    added_by: "System",
    created_at: "2026-01-01T00:00:00.000Z",
    is_default: true,
  },
  {
    email: "jennifer.cisternino2027@gmail.com",
    name: "Jennifer Cisternino",
    role: "admin",
    added_by: "System",
    created_at: "2026-01-01T00:00:00.000Z",
    is_default: true,
  },
  {
    email: "tzafar04@gmail.com",
    name: "Talha Zafar",
    role: "admin",
    added_by: "System",
    created_at: "2026-01-01T00:00:00.000Z",
    is_default: true,
  },
  {
    email: "annusraees@gmail.com",
    name: "Annus Raees",
    role: "admin",
    added_by: "System",
    created_at: "2026-01-01T00:00:00.000Z",
    is_default: true,
  },
];

async function ensureBucket() {
  try {
    await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, { public: true });
  } catch {}
}

async function getStoredDynamicAdmins(): Promise<any[]> {
  const adminsMap = new Map<string, any>();

  // 1. Base default admins
  DEFAULT_ADMINS.forEach((adm) => {
    adminsMap.set(adm.email.toLowerCase(), adm);
  });

  // 2. Storage file
  try {
    const { data, error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download(ADMINS_FILE);
    if (!error && data) {
      const text = await data.text();
      const list = JSON.parse(text);
      if (Array.isArray(list)) {
        list.forEach((item) => {
          if (item?.email) {
            const key = item.email.toLowerCase().trim();
            adminsMap.set(key, {
              email: key,
              name: item.name || key.split("@")[0],
              role: "admin",
              added_by: item.added_by || "Admin",
              created_at: item.created_at || new Date().toISOString(),
              is_default: DEFAULT_ADMINS.some((d) => d.email.toLowerCase() === key),
            });
          }
        });
      }
    }
  } catch {}

  // 3. Profiles table
  try {
    const { data: profs, error } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, created_at, role")
      .eq("role", "admin");

    if (!error && Array.isArray(profs)) {
      profs.forEach((p) => {
        if (p.email) {
          const key = p.email.toLowerCase().trim();
          if (!adminsMap.has(key)) {
            adminsMap.set(key, {
              email: key,
              name: p.full_name || key.split("@")[0],
              role: "admin",
              added_by: "Admin Panel",
              created_at: p.created_at || new Date().toISOString(),
              is_default: DEFAULT_ADMINS.some((d) => d.email.toLowerCase() === key),
            });
          }
        }
      });
    }
  } catch {}

  // 4. Fallback queue in emails_sent
  try {
    const { data: queueData } = await supabaseAdmin
      .from("emails_sent")
      .select("lead_email, subject, sent_at")
      .eq("sequence_type", "dynamic_admin_whitelist");

    if (queueData && Array.isArray(queueData)) {
      queueData.forEach((q) => {
        if (q.lead_email) {
          const key = q.lead_email.toLowerCase().trim();
          let name = key.split("@")[0];
          let added_by = "Admin";
          try {
            const parsed = JSON.parse(q.subject);
            if (parsed.name) name = parsed.name;
            if (parsed.added_by) added_by = parsed.added_by;
          } catch {}
          if (!adminsMap.has(key)) {
            adminsMap.set(key, {
              email: key,
              name,
              role: "admin",
              added_by,
              created_at: q.sent_at || new Date().toISOString(),
              is_default: DEFAULT_ADMINS.some((d) => d.email.toLowerCase() === key),
            });
          }
        }
      });
    }
  } catch {}

  return Array.from(adminsMap.values());
}

async function saveDynamicAdmins(admins: any[]) {
  try {
    await ensureBucket();
    const jsonBlob = new Blob([JSON.stringify(admins, null, 2)], { type: "application/json" });
    await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(ADMINS_FILE, jsonBlob, {
      upsert: true,
      contentType: "application/json",
    });
  } catch (err) {
    console.error("Failed to save admins file to storage:", err);
  }
}

export default async function handler(req: any, res: any) {
  // Support CORS
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : new Response("OK");
  }

  // GET: Fetch Admin List
  if (req.method === "GET") {
    try {
      const admins = await getStoredDynamicAdmins();
      const payload = { ok: true, admins };
      return res.status
        ? res.status(200).json(payload)
        : new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
    } catch (err: any) {
      const errObj = { error: err.message || "Failed to fetch admin list" };
      return res.status
        ? res.status(500).json(errObj)
        : new Response(JSON.stringify(errObj), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  if (req.method !== "POST") {
    const errObj = { error: "Method not allowed" };
    return res.status ? res.status(405).json(errObj) : new Response(JSON.stringify(errObj), { status: 405 });
  }

  let body: any = {};
  try {
    if (req.body) {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } else if (typeof req.json === "function") {
      body = await req.json();
    }
  } catch {}

  const { action, name, email, phone, added_by } = body || {};

  // ── ACTION: ADD ADMIN ──────────────────────────────────────────────────────
  if (action === "add_admin") {
    if (!email) {
      const errObj = { error: "Email is required" };
      return res.status ? res.status(400).json(errObj) : new Response(JSON.stringify(errObj), { status: 400 });
    }
    const cleanEmail = email.toLowerCase().trim();
    const displayName = (name || cleanEmail.split("@")[0]).trim();
    const addedBy = added_by || "Admin";

    try {
      // 1. Check or create auth user
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuthUser = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === cleanEmail
      );

      let authUserId: string;
      if (existingAuthUser) {
        authUserId = existingAuthUser.id;
        try {
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            user_metadata: { full_name: displayName, role: "admin" },
            app_metadata: { provider: "google", providers: ["google"] },
          });
        } catch {}
      } else {
        const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          email_confirm: true,
          user_metadata: { full_name: displayName, role: "admin" },
          app_metadata: { provider: "google", providers: ["google"] },
        });
        authUserId = newUser?.user?.id || `admin-${Date.now()}`;
      }

      // 2. Upsert profile
      const meta = JSON.stringify({ phone: "", approved: true, status: "approved", added_by: addedBy });
      try {
        await supabaseAdmin.from("profiles").upsert(
          {
            id: authUserId,
            email: cleanEmail,
            full_name: displayName,
            role: "admin",
            avatar_url: meta,
          },
          { onConflict: "email" }
        );
      } catch {}

      // 3. Update Storage file
      const currentAdmins = await getStoredDynamicAdmins();
      const existingIdx = currentAdmins.findIndex((a) => a.email.toLowerCase() === cleanEmail);
      const newEntry = {
        email: cleanEmail,
        name: displayName,
        role: "admin",
        added_by: addedBy,
        created_at: new Date().toISOString(),
        is_default: DEFAULT_ADMINS.some((d) => d.email.toLowerCase() === cleanEmail),
      };

      if (existingIdx >= 0) {
        currentAdmins[existingIdx] = { ...currentAdmins[existingIdx], ...newEntry };
      } else {
        currentAdmins.push(newEntry);
      }
      await saveDynamicAdmins(currentAdmins);

      // 4. Fallback in emails_sent
      try {
        await supabaseAdmin.from("emails_sent").insert({
          lead_email: cleanEmail,
          sequence_type: "dynamic_admin_whitelist",
          subject: JSON.stringify({ name: displayName, added_by: addedBy }),
          status: "approved",
          sent_at: new Date().toISOString(),
        });
      } catch {}

      // 5. Cleanup pending signups
      try {
        await supabaseAdmin.from("pending_signups").delete().eq("email", cleanEmail);
        await supabaseAdmin
          .from("emails_sent")
          .delete()
          .eq("lead_email", cleanEmail)
          .eq("sequence_type", "agent_approval_request");
      } catch {}

      const successObj = { ok: true, admin: newEntry, admins: currentAdmins };
      return res.status
        ? res.status(200).json(successObj)
        : new Response(JSON.stringify(successObj), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (err: any) {
      console.error("Add admin error:", err);
      const errObj = { error: err.message || "Failed to add admin" };
      return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
    }
  }

  // ── ACTION: REMOVE ADMIN ───────────────────────────────────────────────────
  if (action === "remove_admin") {
    if (!email) {
      const errObj = { error: "Email is required" };
      return res.status ? res.status(400).json(errObj) : new Response(JSON.stringify(errObj), { status: 400 });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (DEFAULT_ADMINS.some((d) => d.email.toLowerCase() === cleanEmail)) {
      const errObj = { error: "Cannot remove primary system default admin" };
      return res.status ? res.status(400).json(errObj) : new Response(JSON.stringify(errObj), { status: 400 });
    }

    try {
      const currentAdmins = await getStoredDynamicAdmins();
      const filtered = currentAdmins.filter((a) => a.email.toLowerCase() !== cleanEmail);
      await saveDynamicAdmins(filtered);

      try {
        await supabaseAdmin.from("profiles").update({ role: "agent" }).eq("email", cleanEmail);
      } catch {}

      try {
        await supabaseAdmin
          .from("emails_sent")
          .delete()
          .eq("lead_email", cleanEmail)
          .eq("sequence_type", "dynamic_admin_whitelist");
      } catch {}

      const successObj = { ok: true, admins: filtered };
      return res.status
        ? res.status(200).json(successObj)
        : new Response(JSON.stringify(successObj), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (err: any) {
      const errObj = { error: err.message || "Failed to remove admin" };
      return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
    }
  }

  // ── ACTION: REGULAR AGENT APPROVAL ─────────────────────────────────────────
  if (!email || !name) {
    const errObj = { error: "Missing required fields: name, email" };
    return res.status ? res.status(400).json(errObj) : new Response(JSON.stringify(errObj), { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();
  const targetDeptId = body.department_id || "production-house";

  try {
    // Step 1: Check if user already exists in auth.users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    const designation = (body.designation || "").trim();
    let authUserId = "";

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      try {
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            full_name: name,
            phone: phone || "",
            designation: designation || "",
            role: "agent",
          },
          app_metadata: {
            provider: "google",
            providers: ["google"],
          },
        });
      } catch {}
    } else {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          phone: phone || "",
          designation: designation || "",
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

    // Step 2: Upsert profile
    const pseudoName = (body.pseudo_name || "").trim();
    const roleTitle = (body.role_title || designation || "").trim();
    const meta = JSON.stringify({
      phone: phone || "",
      designation: designation || "",
      pseudo_name: pseudoName,
      role_title: roleTitle,
      approved: true,
      status: "approved",
      department_id: targetDeptId,
    });
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

    // Step 3: Assign agent to their chosen department
    try {
      let departments: any[] = [];
      const { data: dbDepts } = await supabaseAdmin.from("departments").select("*");
      if (Array.isArray(dbDepts) && dbDepts.length > 0) {
        departments = dbDepts;
      } else {
        const { data: storageData } = await supabaseAdmin.storage.from(STORAGE_BUCKET).download("crm-departments.json");
        if (storageData) {
          const text = await storageData.text();
          departments = JSON.parse(text);
        }
      }

      if (Array.isArray(departments) && departments.length > 0) {
        const updated = departments.map((d: any) => {
          const existingMembers = Array.isArray(d.member_emails)
            ? d.member_emails.map((e: string) => (e || "").toLowerCase().trim())
            : [];
          if (d.id === targetDeptId) {
            if (!existingMembers.includes(cleanEmail)) {
              return { ...d, member_emails: [...existingMembers, cleanEmail] };
            }
            return d;
          } else {
            return { ...d, member_emails: existingMembers.filter((m: string) => m !== cleanEmail) };
          }
        });

        await supabaseAdmin.from("departments").upsert(updated);
        await ensureBucket();
        const blob = Buffer.from(JSON.stringify(updated, null, 2));
        await supabaseAdmin.storage.from(STORAGE_BUCKET).upload("crm-departments.json", blob, {
          upsert: true,
          contentType: "application/json",
          cacheControl: "0",
        });
      }
    } catch (deptErr) {
      console.warn("Department assignment notice:", deptErr);
    }

    // Step 4: Delete from pending_signups table
    await supabaseAdmin.from("pending_signups").delete().eq("email", cleanEmail);

    // Step 5: Clean up fallback queue
    await supabaseAdmin
      .from("emails_sent")
      .delete()
      .eq("lead_email", cleanEmail)
      .eq("sequence_type", "agent_approval_request");

    // Step 6: Log agent approval activity in emails_sent for Activity & Notifications feed
    try {
      const deptName = targetDeptId === "ecommerce-department" ? "E-commerce Department" : targetDeptId === "sales-department" ? "Sales Department" : "Production House";
      await supabaseAdmin.from("emails_sent").insert({
        lead_email: cleanEmail,
        sequence_type: "agent_approved",
        subject: `${name} joined ${deptName} as Working Agent`,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    } catch {}

    const successObj = { success: true, authUserId, department_id: targetDeptId };
    return res.status
      ? res.status(200).json(successObj)
      : new Response(JSON.stringify(successObj), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("approve-pending-signup error:", err);
    const errObj = { error: err?.message || "Internal server error" };
    return res.status ? res.status(500).json(errObj) : new Response(JSON.stringify(errObj), { status: 500 });
  }
}
