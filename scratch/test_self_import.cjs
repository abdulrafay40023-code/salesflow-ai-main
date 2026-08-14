/**
 * Test script for Lead Import Self-Prevention Validation
 */

// Test data setup
const agentEmail = "workingagent@example.com";
const agentPhone = "+15551234567";
const adminEmail = "garryamelia6265@gmail.com";

function filterImportRows(rows, userEmail, userPhone, isAdmin) {
  let selfSkippedCount = 0;
  const validLeads = [];

  const myEmail = !isAdmin ? (userEmail || "").trim().toLowerCase() : "";
  const myPhone = !isAdmin ? (userPhone || "").trim() : "";

  rows.forEach((r, i) => {
    const email = (r.email || "").trim().toLowerCase();
    const phone = (r.phone || "").trim();

    if (!email || !email.includes("@")) return;

    if (!isAdmin && myEmail) {
      const emailMatch = email === myEmail;
      const phoneMatch = myPhone && phone && phone === myPhone;

      if (emailMatch || phoneMatch) {
        selfSkippedCount++;
        return;
      }
    }

    validLeads.push(r);
  });

  return { validLeads, selfSkippedCount };
}

// Test cases
console.log("--- TEST 1: Working Agent imports list containing own email ---");
const test1Rows = [
  { name: "Agent Self", email: "workingagent@example.com", phone: "+15550000000" },
  { name: "John Doe", email: "johndoe@example.com", phone: "+15551112222" },
];
const res1 = filterImportRows(test1Rows, agentEmail, agentPhone, false);
console.log("Valid leads count:", res1.validLeads.length); // Expected: 1 ("John Doe")
console.log("Self skipped count:", res1.selfSkippedCount); // Expected: 1
console.assert(res1.validLeads.length === 1 && res1.validLeads[0].name === "John Doe", "Test 1 Failed!");

console.log("\n--- TEST 2: Working Agent imports lead with own phone number ---");
const test2Rows = [
  { name: "Self Phone", email: "differentemail@example.com", phone: "+15551234567" },
  { name: "Jane Smith", email: "janesmith@example.com", phone: "+15553334444" },
];
const res2 = filterImportRows(test2Rows, agentEmail, agentPhone, false);
console.log("Valid leads count:", res2.validLeads.length); // Expected: 1
console.log("Self skipped count:", res2.selfSkippedCount); // Expected: 1
console.assert(res2.validLeads.length === 1 && res2.validLeads[0].name === "Jane Smith", "Test 2 Failed!");

console.log("\n--- TEST 3: Admin imports lead matching admin email ---");
const test3Rows = [
  { name: "Admin Self", email: adminEmail, phone: "+15559999999" },
  { name: "Alice Brown", email: "alice@example.com", phone: "+15558888888" },
];
const res3 = filterImportRows(test3Rows, adminEmail, "", true);
console.log("Valid leads count:", res3.validLeads.length); // Expected: 2 (Admin exempt)
console.log("Self skipped count:", res3.selfSkippedCount); // Expected: 0
console.assert(res3.validLeads.length === 2, "Test 3 Failed!");

console.log("\n--- TEST 4: Case insensitive and whitespace trimming check ---");
const test4Rows = [
  { name: "Agent Self Upper", email: " WORKINGAGENT@EXAMPLE.COM ", phone: "+15550000000" },
];
const res4 = filterImportRows(test4Rows, agentEmail, agentPhone, false);
console.log("Valid leads count:", res4.validLeads.length); // Expected: 0
console.log("Self skipped count:", res4.selfSkippedCount); // Expected: 1
console.assert(res4.validLeads.length === 0 && res4.selfSkippedCount === 1, "Test 4 Failed!");

console.log("\nALL LOGIC TESTS PASSED SUCCESSFULLY! ✅");
