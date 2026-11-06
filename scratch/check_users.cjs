const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  console.log('--- PROFILES (' + (profiles ? profiles.length : 0) + ') ---', pErr);
  if (profiles) {
    profiles.forEach(p => console.log(JSON.stringify({ id: p.id, email: p.email, name: p.full_name, role: p.role, avatar_url: p.avatar_url })));
  }

  const { data: signups, error: sErr } = await supabase.from('pending_signups').select('*');
  console.log('--- PENDING SIGNUPS (' + (signups ? signups.length : 0) + ') ---', sErr);
  if (signups) {
    signups.forEach(s => console.log(JSON.stringify({ id: s.id, email: s.email, name: s.name, status: s.status })));
  }
}

check();
