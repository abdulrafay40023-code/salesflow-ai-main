const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkPendingApprovalsTable() {
  const { data, error } = await supabase.from('pending_approvals').select('*').limit(1);
  if (error) {
    console.log('pending_approvals table error:', error.message);
  } else {
    console.log('pending_approvals table exists! Current rows:', data.length);
  }
}

checkPendingApprovalsTable();
