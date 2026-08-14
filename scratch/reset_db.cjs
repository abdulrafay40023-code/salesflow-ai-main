/**
 * Teals CRM — Full Database Reset Script
 * ─────────────────────────────────────────
 * STEP 1: Backup all tables to JSON files
 * STEP 2: Delete all data from leads, emails_sent, meetings
 * STEP 3: Delete all non-admin profiles (+ their auth users via service role)
 * STEP 4: Confirm reset
 *
 * Admin email preserved: garryamelia6265@gmail.com
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL     = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const ANON_KEY         = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';
const ADMIN_EMAIL      = 'garryamelia6265@gmail.com';

// Two clients: anon for public tables, service for auth.users
const db      = createClient(SUPABASE_URL, ANON_KEY);
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Backup directory: project root / backups
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function fetchAll(table) {
  const { data, error } = await db.from(table).select('*');
  if (error) throw new Error(`Fetch ${table}: ${error.message}`);
  return data || [];
}

async function deleteAll(table) {
  const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`Delete ${table}: ${error.message}`);
}

(async () => {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Teals CRM — Database Reset');
  console.log('══════════════════════════════════════════════\n');

  // ─── STEP 1: BACKUP ─────────────────────────────────────
  console.log('▶ STEP 1: Creating backup...');

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const backupTimestamp = ts();
  const tables = ['profiles', 'leads', 'emails_sent', 'meetings', 'email_sequences'];
  const backup = {};

  for (const table of tables) {
    try {
      backup[table] = await fetchAll(table);
      console.log(`  ✔ ${table}: ${backup[table].length} rows backed up`);
    } catch (e) {
      console.log(`  ⚠ ${table}: ${e.message} (table may not exist, skipping)`);
      backup[table] = [];
    }
  }

  // Also backup auth users list via service role
  try {
    const { data: { users }, error } = await service.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    backup['auth_users'] = users;
    console.log(`  ✔ auth_users: ${users.length} users backed up`);
  } catch (e) {
    console.log(`  ⚠ auth_users: ${e.message}`);
    backup['auth_users'] = [];
  }

  const backupFile = path.join(BACKUP_DIR, `backup_${backupTimestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`\n  ✅ Backup saved → ${backupFile}\n`);

  // ─── STEP 2: WIPE ALL DATA ──────────────────────────────
  console.log('▶ STEP 2: Wiping all data tables...');
  console.log('  (order: meetings → emails_sent → leads — to respect FK constraints)');

  try {
    await deleteAll('meetings');
    console.log('  ✔ meetings: cleared');
  } catch (e) { console.log('  ✘ meetings:', e.message); }

  try {
    await deleteAll('emails_sent');
    console.log('  ✔ emails_sent: cleared');
  } catch (e) { console.log('  ✘ emails_sent:', e.message); }

  try {
    await deleteAll('leads');
    console.log('  ✔ leads: cleared');
  } catch (e) { console.log('  ✘ leads:', e.message); }

  // email_sequences has DEFAULT templates — keep them so email automation works
  console.log('  ℹ email_sequences: intentionally kept (email templates, not user data)');

  // ─── STEP 3: REMOVE NON-ADMIN PROFILES & AUTH USERS ────
  console.log('\n▶ STEP 3: Removing non-admin accounts...');

  // Get all profiles except admin
  const { data: allProfiles, error: pErr } = await db.from('profiles').select('*');
  if (pErr) {
    console.log('  ✘ Could not fetch profiles:', pErr.message);
  } else {
    const nonAdminProfiles = (allProfiles || []).filter(p => p.email !== ADMIN_EMAIL);
    console.log(`  Found ${nonAdminProfiles.length} non-admin profile(s) to remove`);

    for (const profile of nonAdminProfiles) {
      // Delete from profiles table first
      const { error: delPErr } = await db.from('profiles').delete().eq('id', profile.id);
      if (delPErr) {
        console.log(`  ✘ Delete profile ${profile.email}: ${delPErr.message}`);
      } else {
        console.log(`  ✔ Deleted profile: ${profile.email}`);
      }

      // Delete from auth.users via service role
      try {
        const { error: delAErr } = await service.auth.admin.deleteUser(profile.id);
        if (delAErr) {
          console.log(`  ⚠ Delete auth user ${profile.email}: ${delAErr.message} (may already be removed)`);
        } else {
          console.log(`  ✔ Deleted auth user: ${profile.email}`);
        }
      } catch (e) {
        console.log(`  ⚠ Auth delete for ${profile.email}: ${e.message}`);
      }
    }
  }

  // ─── VERIFY ADMIN PROFILE STILL EXISTS ─────────────────
  console.log('\n▶ Verifying admin account...');
  const { data: adminProfile, error: adminErr } = await db
    .from('profiles')
    .select('*')
    .eq('email', ADMIN_EMAIL)
    .single();

  if (adminErr || !adminProfile) {
    console.log(`  ✘ Admin profile not found! Error: ${adminErr?.message}`);
    console.log('  ⚠ You may need to re-login once to recreate your profile row.');
  } else {
    console.log(`  ✅ Admin account intact: ${adminProfile.email} (role: ${adminProfile.role})`);
  }

  // ─── STEP 4/5: FINAL COUNTS ─────────────────────────────
  console.log('\n▶ STEP 4/5: Final verification — all counts should be 0...\n');

  const checks = ['leads', 'emails_sent', 'meetings'];
  for (const table of checks) {
    const { data, error } = await db.from(table).select('id');
    if (error) {
      console.log(`  ✘ ${table}: ${error.message}`);
    } else {
      const count = (data || []).length;
      const icon = count === 0 ? '✅' : '⚠';
      console.log(`  ${icon} ${table}: ${count} rows remaining`);
    }
  }

  const { data: profilesLeft } = await db.from('profiles').select('email');
  console.log(`  ✅ profiles: ${(profilesLeft || []).length} account(s) remaining`);
  (profilesLeft || []).forEach(p => console.log(`     → ${p.email}`));

  console.log('\n══════════════════════════════════════════════');
  console.log('  Reset Complete ✅');
  console.log(`  Backup: ${backupFile}`);
  console.log('  No code was modified — only data was cleared.');
  console.log('══════════════════════════════════════════════\n');
})();
