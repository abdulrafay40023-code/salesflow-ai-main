const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function inspectDb() {
  const { data: meetings } = await supabase.from('meetings').select('*');
  console.log("=== MEETINGS IN DB ===");
  console.log(JSON.stringify(meetings, null, 2));

  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log("=== PROFILES IN DB ===");
  console.log(JSON.stringify(profiles, null, 2));
}

inspectDb();
