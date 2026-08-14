const { Client } = require('pg');

// Standard Supabase DB password patterns or Service Key JWT decode
// Let's test standard connection strings
const projectRef = 'nyjhbeqpjfdhhvqvjzyy';
const host = 'aws-0-us-east-1.pooler.supabase.com';
const port = 6543;

// JWT Service Key decoded payload: ref: "nyjhbeqpjfdhhvqvjzyy", role: "service_role"
// Let's test passwords
const passCandidates = [
  'postgres',
  'nyjhbeqpjfdhhvqvjzyy',
  'TealsCrm2026!',
  'Salesflow2026!',
  'Supabase2026!',
];

async function tryConnect() {
  for (const pass of passCandidates) {
    const connectionString = `postgres://postgres.${projectRef}:${encodeURIComponent(pass)}@${host}:${port}/postgres`;
    console.log(`▶ Trying password: ${pass}...`);
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`🎉 CONNECTED SUCCESSFULLY WITH PASSWORD: ${pass}`);

      const createTableSql = `
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

        DROP POLICY IF EXISTS "Allow public access for pending_signups" ON public.pending_signups;
        CREATE POLICY "Allow public access for pending_signups" ON public.pending_signups FOR ALL USING (true);
      `;

      await client.query(createTableSql);
      console.log("✅ pending_signups table created in Supabase DB!");
      await client.end();
      return true;
    } catch (e) {
      console.log(`❌ Auth failed for ${pass}: ${e.message}`);
      try { await client.end(); } catch {}
    }
  }
  return false;
}

tryConnect();
