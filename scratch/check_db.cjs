const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bcfxovomjcvgczqfubqf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZnhvdm9tamN2Z2N6cWZ1YnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwNjIxMzUsImV4cCI6MjA1NTYzODEzNX0.3gQ_yF5x8x4p_y5Z5y5Z5y5Z5y5Z5y5Z5y5Z5y5Z5y0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('leads').select('*').limit(20);
  console.log('Error:', error);
  console.log('Count:', data ? data.length : 0);
  if (data && data.length) {
    console.log('Sample Lead:', JSON.stringify(data[0], null, 2));
  }
}
check();