const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.5Z-lC1Q_wV0tG_oZ_g70vK1X2G80S7Q0t7V0X0Z0V00'; // anon/service fallback

const s = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM');

async function backup() {
  console.log("Exporting Supabase database backup...");
  
  const { data: leads } = await s.from('leads').select('*');
  const { data: emails } = await s.from('emails_sent').select('*');
  const { data: meetings } = await s.from('meetings').select('*');
  const { data: profiles } = await s.from('profiles').select('*');

  const dump = {
    timestamp: new Date().toISOString(),
    supabase_url: SUPABASE_URL,
    leads: leads || [],
    emails_sent: emails || [],
    meetings: meetings || [],
    profiles: profiles || [],
  };

  const backupPath = path.join(__dirname, 'supabase_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(dump, null, 2));
  console.log(`Backup successfully created at: ${backupPath}`);
  console.log(`Leads: ${dump.leads.length}, Emails: ${dump.emails_sent.length}, Meetings: ${dump.meetings.length}, Profiles: ${dump.profiles.length}`);
}

backup().catch(console.error);
