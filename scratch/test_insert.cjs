const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  const testLead = {
    name: "Test Lead",
    company: "Test Co",
    email: "test@example.com",
    phone: "+1 728-288-7071",
    country: "United States",
    status: "new",
    assigned_agent_name: "garryamelia6265@gmail.com",
    value: 5000,
    notes: ["Test note"],
    last_contact: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('leads').insert([testLead]).select('*');
  console.log('Error:', error);
  console.log('Data:', data);
}
testInsert();