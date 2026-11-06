const { createClient } = require('@supabase/supabase-js');
const url = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

const sb = createClient(url, key);

async function cleanAll() {
  console.log('Cleaning test meetings and consultation notifications...');
  
  // 1. Delete all meetings
  const { error: meetErr } = await sb.from('meetings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Meetings cleared, error:', meetErr);

  // 2. Delete test leads from consultation bookings
  const { error: leadErr } = await sb.from('leads').delete().ilike('company', '%Consultation%');
  console.log('Consultation leads cleared, error:', leadErr);

  // 3. Clear meeting-related emails from emails_sent
  const { error: emailErr } = await sb.from('emails_sent').delete().ilike('sequence_type', '%meeting%');
  console.log('Meeting emails cleared, error:', emailErr);

  // Check remaining count
  const { count: mCount } = await sb.from('meetings').select('*', { count: 'exact', head: true });
  console.log('Remaining meetings count:', mCount);
}

cleanAll();
