const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

async function tryCreatePendingSignups() {
  console.log("▶ Testing creation of pending_signups table...");

  const sql = `
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
    DROP POLICY IF EXISTS "Allow public insert for pending signups" ON public.pending_signups;
    CREATE POLICY "Allow public insert for pending signups" ON public.pending_signups FOR ALL USING (true);
  `;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ sql_query: sql }),
    });
    console.log("RPC exec_sql status:", res.status);
    const text = await res.text();
    console.log("RPC exec_sql response:", text);
  } catch (e) {
    console.log("RPC endpoint error:", e.message);
  }
}

tryCreatePendingSignups();
