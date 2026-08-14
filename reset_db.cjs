// Full DB reset — wipes all test data, keeps only Garry Amelia admin account
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';
const ADMIN_EMAIL = 'garryamelia6265@gmail.com';

const s = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('=== FULL DB RESET ===');
  console.log('Preserving admin:', ADMIN_EMAIL);
  console.log('');

  // 1. Clear meetings (all)
  const r1 = await s.from('meetings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('meetings cleared:', r1.error ? r1.error.message : `OK (${r1.count ?? '?'} rows)`);

  // 2. Clear emails_sent (all)
  const r2 = await s.from('emails_sent').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('emails_sent cleared:', r2.error ? r2.error.message : `OK (${r2.count ?? '?'} rows)`);

  // 3. Clear leads (all)
  const r3 = await s.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('leads cleared:', r3.error ? r3.error.message : `OK (${r3.count ?? '?'} rows)`);

  // 4. Clear pending_signups (all)
  const r4 = await s.from('pending_signups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('pending_signups cleared:', r4.error ? r4.error.message : `OK (${r4.count ?? '?'} rows)`);

  // 5. Clear profiles — but KEEP Garry Amelia admin
  const r5 = await s.from('profiles').delete().neq('email', ADMIN_EMAIL);
  console.log('profiles cleared (non-admin):', r5.error ? r5.error.message : `OK (${r5.count ?? '?'} rows)`);

  // 6. Ensure admin profile exists and is correct
  const { data: existing } = await s
    .from('profiles')
    .select('id, email, role')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (existing) {
    await s.from('profiles').update({
      full_name: 'Garry Amelia',
      role: 'admin',
      avatar_url: JSON.stringify({ phone: '', approved: true, status: 'approved' })
    }).eq('email', ADMIN_EMAIL);
    console.log('Admin profile verified & updated ✓');
  } else {
    const { data: authData } = await s.auth.admin.listUsers();
    const adminUser = authData?.users?.find(u => u.email === ADMIN_EMAIL);
    const userId = adminUser?.id || ('admin-' + Date.now());
    await s.from('profiles').insert({
      id: userId,
      email: ADMIN_EMAIL,
      full_name: 'Garry Amelia',
      role: 'admin',
      avatar_url: JSON.stringify({ phone: '', approved: true, status: 'approved' })
    });
    console.log('Admin profile created ✓');
  }

  console.log('');
  console.log('=== RESET COMPLETE ===');
}

run().catch(console.error);
