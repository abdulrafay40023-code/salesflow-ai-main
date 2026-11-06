const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('c:/Users/Rafay/Downloads/chatbot project/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0]?.trim();
  const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (k) env[k] = v;
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function inspect() {
  const { data: files } = await supabase.storage.from('teals-live-store').list('conversations');
  console.log('Conversations files count:', files?.length);
  for (const f of files || []) {
    const { data } = await supabase.storage.from('teals-live-store').download('conversations/' + f.name);
    if (data) {
      const text = await data.text();
      try {
        const c = JSON.parse(text);
        console.log('Conv:', {
          file: f.name,
          id: c.id,
          visitor_id: c.visitor_id,
          visitor_name: c.visitor_name,
          chat_number: c.chat_number,
          messages_count: c.messages?.length,
          last_msg: c.messages?.[c.messages.length - 1]?.content?.substring(0, 40),
          created_at: c.created_at
        });
      } catch (e) {}
    }
  }

  const { data: sFiles } = await supabase.storage.from('teals-live-store').list('sessions');
  console.log('Sessions files count:', sFiles?.length);
  for (const sf of sFiles || []) {
    const { data } = await supabase.storage.from('teals-live-store').download('sessions/' + sf.name);
    if (data) {
      const text = await data.text();
      try {
        const s = JSON.parse(text);
        if (s.ip_address?.includes('69.85.82.27') || sf.name.includes('69.85')) {
          console.log('Session matching IP:', {
            file: sf.name,
            token: s.visitor_token,
            ip: s.ip_address,
            visitor_name: s.visitor_name,
            last_active: s.last_active_at
          });
        }
      } catch (e) {}
    }
  }
}

inspect();
