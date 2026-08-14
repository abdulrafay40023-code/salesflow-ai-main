// Creates the pending_signups table in Supabase via direct fetch to the Supabase SQL endpoint
const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';
const PROJECT_REF = 'nyjhbeqpjfdhhvqvjzyy';

const sql = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.pending_signups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_initials TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pending_signups' AND policyname = 'Allow access to pending signups'
  ) THEN
    CREATE POLICY "Allow access to pending signups" ON public.pending_signups FOR ALL USING (true);
  END IF;
END $$;

-- Also fix emails_sent status check to allow 'approved' and 'rejected' values
ALTER TABLE public.emails_sent DROP CONSTRAINT IF EXISTS emails_sent_status_check;
ALTER TABLE public.emails_sent ADD CONSTRAINT emails_sent_status_check
  CHECK (status IN ('sent', 'pending', 'replied', 'no-response', 'approved', 'rejected'));
`;

async function run() {
  console.log('Creating pending_signups table via Supabase Management API...');

  // Try Supabase Management API (sql endpoint)
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql })
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.log('Management API failed:', resp.status, text.slice(0, 300));
    console.log('\n=== MANUAL STEP REQUIRED ===');
    console.log('Please run this SQL in your Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new');
    console.log('\n' + sql);
  } else {
    const json = await resp.json();
    console.log('Success!', json);
  }
}

run().catch(err => {
  console.error('Error:', err.message);
});
