const { createClient } = require('@supabase/supabase-js');
const url = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

const sb = createClient(url, key);

async function run() {
  const { data: meetings, error } = await sb.from('meetings').select('*');
  console.log('Meetings count:', meetings?.length, error);
  if (meetings?.length) {
    meetings.forEach(m => console.log(m.id, m.title, m.scheduled_time, m.agent_email, m.completed));
  }
}
run();
