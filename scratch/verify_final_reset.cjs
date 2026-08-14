const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function verifyFinalState() {
  const { data: leads } = await supabase.from('leads').select('id');
  const { data: meetings } = await supabase.from('meetings').select('id');
  const { data: emails } = await supabase.from('emails_sent').select('id');
  const { data: profiles } = await supabase.from('profiles').select('email, role');

  console.log('=== VERIFICATION SUMMARY ===');
  console.log('leads count:', leads ? leads.length : 0);
  console.log('meetings count:', meetings ? meetings.length : 0);
  console.log('emails_sent count:', emails ? emails.length : 0);
  console.log('profiles count:', profiles ? profiles.length : 0);
  console.log('profiles list:', profiles);
}

verifyFinalState();
