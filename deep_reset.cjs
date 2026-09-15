const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';
const ADMIN_EMAIL = 'garryamelia6265@gmail.com';

const s = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function deepReset() {
  console.log('=== PERFORMING COMPLETE AUTH & DB RESET ===');

  // 1. Fetch all Auth users
  const { data: authUsers, error: listErr } = await s.auth.admin.listUsers();
  if (listErr) {
    console.error('Failed to list auth users:', listErr.message);
  } else if (authUsers?.users) {
    for (const user of authUsers.users) {
      if (user.email !== ADMIN_EMAIL) {
        console.log(`Deleting Auth User: ${user.email} (${user.id})...`);
        const { error: delErr } = await s.auth.admin.deleteUser(user.id);
        if (delErr) {
          console.error(` Failed to delete auth user ${user.email}:`, delErr.message);
        } else {
          console.log(` Deleted auth user ${user.email} ✓`);
        }
      } else {
        console.log(` Preserving Admin Auth User: ${user.email}`);
      }
    }
  }

  // 2. Delete non-admin profiles explicitly
  const { data: profs } = await s.from('profiles').select('id, email');
  if (profs) {
    for (const p of profs) {
      if (p.email !== ADMIN_EMAIL) {
        console.log(`Deleting Profile: ${p.email} (${p.id})...`);
        await s.from('profiles').delete().eq('id', p.id);
      }
    }
  }

  // 3. Clear pending_signups
  await s.from('pending_signups').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 4. Clear emails_sent
  await s.from('emails_sent').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 5. Clear leads
  await s.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 6. Clear meetings
  await s.from('meetings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 7. Verify Admin profile exists
  const { data: adminProf } = await s.from('profiles').select('*').eq('email', ADMIN_EMAIL).maybeSingle();
  if (!adminProf) {
    const adminUser = authUsers?.users?.find(u => u.email === ADMIN_EMAIL);
    const userId = adminUser?.id || 'admin-profile';
    await s.from('profiles').insert({
      id: userId,
      email: ADMIN_EMAIL,
      full_name: 'Garry Amelia',
      role: 'admin',
      avatar_url: JSON.stringify({ phone: '', approved: true, status: 'approved' })
    });
  } else {
    await s.from('profiles').update({
      full_name: 'Garry Amelia',
      role: 'admin',
      avatar_url: JSON.stringify({ phone: '', approved: true, status: 'approved' })
    }).eq('email', ADMIN_EMAIL);
  }

  console.log('\n=== DEEP RESET COMPLETED SUCCESSFULLY ===');
}

deepReset().catch(console.error);
