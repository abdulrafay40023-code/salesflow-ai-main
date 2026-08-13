const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM';
const ADMIN_EMAIL = 'garryamelia6265@gmail.com';

const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function wipe() {
  console.log("Wiping database while preserving Admin account...");

  const { error: e1 } = await s.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Leads deleted:", e1 ? e1.message : "OK");

  const { error: e2 } = await s.from('emails_sent').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Emails deleted:", e2 ? e2.message : "OK");

  const { error: e3 } = await s.from('meetings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Meetings deleted:", e3 ? e3.message : "OK");

  const { error: e4 } = await s.from('profiles').delete().neq('email', ADMIN_EMAIL);
  console.log("Non-admin profiles deleted:", e4 ? e4.message : "OK");

  // Ensure Admin profile is clean and active
  const adminMeta = JSON.stringify({ phone: "+1 (555) 019-2834", approved: true, status: "approved" });
  await s.from('profiles').upsert({
    id: "usr-admin-garry",
    email: ADMIN_EMAIL,
    full_name: "Garry Amelia",
    role: "admin",
    avatar_url: adminMeta,
  }, { onConflict: 'email' });

  const { data: finalProfiles } = await s.from('profiles').select('email, role, avatar_url');
  console.log("\nDatabase reset complete!");
  console.log("Remaining profiles:", finalProfiles);
}

wipe().catch(console.error);
