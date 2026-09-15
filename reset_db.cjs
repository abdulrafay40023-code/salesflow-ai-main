// Full DB & Auth reset script — wipes all test data and test auth users, preserving ONLY Garry Amelia admin
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';
const ADMIN_EMAIL = 'garryamelia6265@gmail.com';

const s = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('=== FULL DB & AUTH RESET ===');
  console.log('Preserving admin:', ADMIN_EMAIL);
  console.log('');

  // 1. Delete all non-admin auth users
  const { data: authUsers } = await s.auth.admin.listUsers();
  if (authUsers?.users) {
    for (const u of authUsers.users) {
      if (u.email !== ADMIN_EMAIL) {
        await s.auth.admin.deleteUser(u.id);
        console.log(`Deleted Auth User: ${u.email}`);
      }
    }
  }

  // 2. Clear meetings (all)
  await s.from('meetings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('meetings cleared');

  // 3. Clear emails_sent (all)
  await s.from('emails_sent').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('emails_sent cleared');

  // 4. Clear leads (all)
  await s.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('leads cleared');

  // 5. Clear pending_signups (all)
  await s.from('pending_signups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('pending_signups cleared');

  // 6. Clear profiles (non-admin)
  await s.from('profiles').delete().neq('email', ADMIN_EMAIL);
  console.log('profiles cleared (non-admin)');

  // 7. Ensure admin profile exists
  const { data: existing } = await s.from('profiles').select('*').eq('email', ADMIN_EMAIL).maybeSingle();
  if (existing) {
    await s.from('profiles').update({
      full_name: 'Garry Amelia',
      role: 'admin',
      avatar_url: JSON.stringify({ phone: '', approved: true, status: 'approved' })
    }).eq('email', ADMIN_EMAIL);
  } else {
    const adminUser = authUsers?.users?.find(u => u.email === ADMIN_EMAIL);
    await s.from('profiles').insert({
      id: adminUser?.id || 'admin-profile',
      email: ADMIN_EMAIL,
      full_name: 'Garry Amelia',
      role: 'admin',
      avatar_url: JSON.stringify({ phone: '', approved: true, status: 'approved' })
    });
  }

  console.log('');
  console.log('=== RESET COMPLETE ===');
}

run().catch(console.error);
