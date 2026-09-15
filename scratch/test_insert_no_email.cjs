const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  const test1 = await supabase.from('leads').insert({
    name: 'Test Lead Empty Email',
    email: '',
    phone: '+1234567890',
    status: 'new',
    assigned_agent_name: 'garryamelia6265@gmail.com'
  }).select();
  console.log('Test 1 (empty string email) result:', test1.error ? test1.error.message : 'SUCCESS', test1.data);

  const test2 = await supabase.from('leads').insert({
    name: 'Test Lead Null Email',
    email: null,
    phone: '+1987654321',
    status: 'new',
    assigned_agent_name: 'garryamelia6265@gmail.com'
  }).select();
  console.log('Test 2 (null email) result:', test2.error ? test2.error.message : 'SUCCESS', test2.data);

  if (test1.data && test1.data[0]) await supabase.from('leads').delete().eq('id', test1.data[0].id);
  if (test2.data && test2.data[0]) await supabase.from('leads').delete().eq('id', test2.data[0].id);
}

testInsert();