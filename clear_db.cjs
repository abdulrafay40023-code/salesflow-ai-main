const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM';
const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
(async () => {
  const r1 = await s.from('meetings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('meetings:', r1.error || 'cleared');
  const r2 = await s.from('emails_sent').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('emails_sent:', r2.error || 'cleared');
  const r3 = await s.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('leads:', r3.error || 'cleared');
  console.log('Done!');
})();
