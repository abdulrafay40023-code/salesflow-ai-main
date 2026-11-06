const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('c:/Users/Rafay/Downloads/salesflow-ai-main/.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0]?.trim();
  const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (k) env[k] = v;
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function checkLatest() {
  const { data: meetings } = await supabase.from('meetings').select('*').order('created_at', { ascending: false }).limit(2);
  console.log('Latest meetings:', JSON.stringify(meetings, null, 2));

  const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(2);
  console.log('Latest leads:', JSON.stringify(leads, null, 2));
}

checkLatest();
