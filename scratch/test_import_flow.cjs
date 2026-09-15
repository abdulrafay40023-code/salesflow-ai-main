const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testNoEmailImport() {
  const leadToInsert = {
    name: 'Hammad Test Phone Lead',
    company: '',
    email: '', // Empty string for no email
    phone: '7282887071',
    status: 'new',
    assigned_agent_name: 'garryamelia6265@gmail.com',
    notes: ['Imported via test script with NO email']
  };

  const { data, error } = await supabase.from('leads').insert([leadToInsert]).select();
  if (error) {
    console.error('Insert error:', error.message);
    return;
  }

  console.log('Successfully inserted lead with NO email:', data[0]);

  // Query back
  const { data: queried } = await supabase.from('leads').select('*').eq('id', data[0].id);
  console.log('Query result:', queried[0].name, 'Email:', queried[0].email, 'Phone:', queried[0].phone);

  // Clean up
  await supabase.from('leads').delete().eq('id', data[0].id);
  console.log('Cleaned up test record.');
}

testNoEmailImport();