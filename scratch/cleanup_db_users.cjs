const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALLOWED_ADMINS = [
  { email: "garryamelia6265@gmail.com", name: "Garry Amelia" },
  { email: "tzafar04@gmail.com", name: "Talha Zafar" },
  { email: "annusraees@gmail.com", name: "Muhammad Annus" },
  { email: "jennifer.cisternino2027@gmail.com", name: "Jennifer Cisternino" }
];

const ALLOWED_ADMIN_EMAILS = new Set(ALLOWED_ADMINS.map(a => a.email.toLowerCase()));

async function cleanup() {
  console.log("Starting DB user cleanup...");

  // 1. Fetch all profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  if (pErr) console.error("Error fetching profiles:", pErr);

  if (profiles) {
    for (const p of profiles) {
      const email = (p.email || '').toLowerCase().trim();
      if (!ALLOWED_ADMIN_EMAILS.has(email)) {
        console.log(`Deleting non-admin profile: ${email} (${p.full_name})`);
        await supabase.from('profiles').delete().eq('id', p.id);
      } else {
        console.log(`Retaining admin profile: ${email} (${p.full_name})`);
        // Ensure role is admin
        if (p.role !== 'admin') {
          await supabase.from('profiles').update({ role: 'admin' }).eq('id', p.id);
        }
      }
    }
  }

  // 2. Ensure all 4 admins exist in profiles table
  for (const adm of ALLOWED_ADMINS) {
    const { data: existing } = await supabase.from('profiles').select('*').eq('email', adm.email.toLowerCase()).maybeSingle();
    if (!existing) {
      console.log(`Creating missing admin profile for: ${adm.email}`);
      const meta = JSON.stringify({ phone: "", approved: true, status: "approved" });
      await supabase.from('profiles').insert({
        email: adm.email.toLowerCase(),
        full_name: adm.name,
        role: "admin",
        avatar_url: meta
      });
    }
  }

  // 3. Clear all pending_signups so everyone will register afresh with pseudo name & real name
  console.log("Clearing pending_signups...");
  const { error: signupsErr } = await supabase.from('pending_signups').delete().neq('email', 'keep_none_placeholder@none.com');
  if (signupsErr) console.log("pending_signups clear error:", signupsErr);

  // 4. Clear fallback queue in emails_sent
  console.log("Clearing agent_approval_request from emails_sent...");
  await supabase.from('emails_sent').delete().eq('sequence_type', 'agent_approval_request');

  // 5. Verify final profiles
  const { data: finalProfiles } = await supabase.from('profiles').select('email, full_name, role, avatar_url');
  console.log("\n=== FINAL ACTIVE PROFILES IN DB ===");
  finalProfiles?.forEach(p => console.log(p.email, '|', p.full_name, '|', p.role));

  console.log("\nCleanup finished successfully!");
}

cleanup().catch(console.error);
