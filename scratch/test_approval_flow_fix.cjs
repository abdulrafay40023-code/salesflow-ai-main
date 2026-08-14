const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function testApprovalSubmissionAndRefresh() {
  console.log("▶ TEST: Submitting approval request for test agent...");
  const testEmail = "test_agent_single_click@gmail.com";
  const testName = "Test Agent Single Click";
  const testPhone = "+1 (555) 999-8888";

  // 1. Simulate single-click submission (insert into emails_sent)
  const payload = JSON.stringify({
    name: testName,
    email: testEmail,
    phone: testPhone,
    status: "pending",
    created_at: new Date().toISOString(),
  });

  const { data: inserted, error: insertErr } = await supabase.from("emails_sent").insert({
    lead_email: testEmail,
    sequence_type: "agent_approval_request",
    subject: payload,
    status: "pending",
    sent_at: new Date().toISOString(),
  }).select("id").single();

  if (insertErr) {
    console.error("❌ Submission failed:", insertErr);
    return;
  }
  console.log("✅ Single click submission recorded in DB with ID:", inserted.id);

  // 2. Simulate page refresh / checkUserApprovalStatus logic
  console.log("\n▶ TEST: Simulating page refresh check for test agent...");
  const { data: pendingReq } = await supabase
    .from("emails_sent")
    .select("id, subject, status")
    .eq("lead_email", testEmail)
    .eq("sequence_type", "agent_approval_request")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendingReq) {
    console.error("❌ Page refresh failed: No pending request found in DB!");
    return;
  }

  let reqName = "";
  let reqPhone = "";
  try {
    const p = JSON.parse(pendingReq.subject);
    reqName = p.name;
    reqPhone = p.phone;
  } catch {}

  console.log("✅ Page refresh check succeeded:");
  console.log("   - Status:", pendingReq.status);
  console.log("   - Restored Name:", reqName);
  console.log("   - Restored Phone:", reqPhone);

  if (pendingReq.status === "pending" && reqName === testName && reqPhone === testPhone) {
    console.log("\n🎉 ALL TESTS PASSED: Single click submits immediately and page refresh preserves pending approval screen!");
  } else {
    console.error("\n❌ TEST FAILED: Restored data did not match expected values.");
  }

  // Cleanup test row
  await supabase.from("emails_sent").delete().eq("id", inserted.id);
  console.log("🧹 Test row cleaned up.");
}

testApprovalSubmissionAndRefresh();
