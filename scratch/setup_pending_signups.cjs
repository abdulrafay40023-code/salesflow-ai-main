const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function setupPendingSignupsTable() {
  console.log("▶ Creating pending_signups table in Supabase via RPC / REST query...");

  // Execute DDL via SQL RPC or test query
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS public.pending_signups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      avatar_initials TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pending_signups' AND policyname = 'Allow public insert for pending signups'
      ) THEN
        CREATE POLICY "Allow public insert for pending signups" ON public.pending_signups FOR ALL USING (true);
      END IF;
    END $$;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: createTableQuery });
    if (error) {
      console.log("RPC exec_sql not available, testing standard REST insert/select on pending_signups...");
    } else {
      console.log("✅ SQL DDL executed successfully via RPC!");
    }
  } catch (e) {
    console.log("RPC error:", e.message);
  }

  // Verify table accessibility
  const { data: testData, error: testErr } = await supabase.from('pending_signups').select('*').limit(1);
  if (testErr) {
    console.error("❌ pending_signups query error:", testErr.message);
  } else {
    console.log("✅ pending_signups table exists and is accessible! Found rows:", testData.length);
  }
}

setupPendingSignupsTable();
