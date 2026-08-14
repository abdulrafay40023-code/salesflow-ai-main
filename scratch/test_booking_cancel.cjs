const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function testBookingFlow() {
  console.log("▶ STEP 1: Creating test booking...");
  const testEmail = "testclient_cancel@example.com";
  const scheduledIso = new Date(Date.now() + 2 * 3600 * 1000).toISOString(); // 2 hours from now

  const { data: insertedMeeting, error: insertError } = await supabase
    .from("meetings")
    .insert({
      agent_email: "garryamelia6265@gmail.com",
      title: `Sales Meeting with Test Client (${testEmail}) @ 10:00 AM || ZOOM: https://zoom.us/j/123456`,
      scheduled_time: scheduledIso,
      reminder_24h_sent: true,
      reminder_1h_sent: false,
      completed: false,
    })
    .select("id, title, completed")
    .single();

  if (insertError) {
    console.error("❌ Insert failed:", insertError);
    return;
  }
  console.log("✅ Booking created:", insertedMeeting);

  console.log("\n▶ STEP 2: Testing cancellation (Option A)...");
  const { error: cancelError } = await supabase
    .from("meetings")
    .update({ completed: true, title: `[CANCELLED] ${insertedMeeting.title}` })
    .eq("id", insertedMeeting.id);

  if (cancelError) {
    console.error("❌ Cancel failed:", cancelError);
    return;
  }

  // Verify cancelled status in DB
  const { data: updatedMeeting } = await supabase
    .from("meetings")
    .select("id, title, completed")
    .eq("id", insertedMeeting.id)
    .single();

  console.log("✅ Meeting updated in DB:", updatedMeeting);
  if (updatedMeeting.completed === true && updatedMeeting.title.includes("[CANCELLED]")) {
    console.log("🎉 SUCCESS: Meeting is marked completed=true and title tagged [CANCELLED]!");
  } else {
    console.error("❌ VERIFICATION FAILED: Status not updated properly.");
  }

  // Cleanup test row
  await supabase.from("meetings").delete().eq("id", insertedMeeting.id);
  console.log("🧹 Test row cleaned up.");
}

testBookingFlow();
