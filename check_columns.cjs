const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

const s = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function addColumns() {
  console.log('=== CHECKING & ADDING MISSING COLUMNS TO MEETINGS TABLE ===');

  // Check if reminder_5m_sent exists
  const { data: test, error: testErr } = await s
    .from('meetings')
    .select('id, reminder_5m_sent, agent_email')
    .limit(1);

  if (!testErr) {
    console.log('✅ All required columns already exist in meetings table!');
    console.log('   - reminder_5m_sent: OK');
    console.log('   - agent_email: OK');
    return;
  }

  console.log('Missing columns detected:', testErr.message);
  console.log('\nRunning ALTER TABLE via Supabase SQL Editor REST API...');
  console.log('\n=== PLEASE RUN THE FOLLOWING SQL IN YOUR SUPABASE SQL EDITOR ===\n');
  console.log('ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS reminder_5m_sent BOOLEAN DEFAULT false;');
  console.log('ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS agent_email TEXT;');
  console.log('\n================================================================\n');
  console.log('Go to: https://supabase.com/dashboard/project/nyjhbeqpjfdhhvqvjzyy/sql/new');
}

addColumns().catch(e => console.error('Error:', e.message));
