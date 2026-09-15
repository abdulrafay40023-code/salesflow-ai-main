// Complete Verification of Case A, Case B, Case C + Checkpoints

function simulateBookingLifecycle(bookingAdvanceMins) {
  const isCaseA = bookingAdvanceMins <= 60;
  const isCaseB = bookingAdvanceMins > 60 && bookingAdvanceMins < 1440;
  const isCaseC = bookingAdvanceMins >= 1440;

  const events = [];

  // 1. Booking time
  const initialReminder24hSent = !isCaseC; // skipped for A & B
  const initialReminder1hSent = isCaseA;   // sent immediately for A

  if (isCaseA && bookingAdvanceMins > 5) {
    events.push({ at: "booking_immediate", type: "1_HOUR_REMINDER" });
  }

  // 2. Lifecycle checkpoints as time progresses
  const checkpoints = [
    { minsRemaining: 1440, name: "24h_mark" },
    { minsRemaining: 60, name: "1h_mark" },
    { minsRemaining: 5, name: "5m_mark" },
    { minsRemaining: 0, name: "0m_start" },
  ];

  let reminder24hSent = initialReminder24hSent;
  let reminder1hSent = initialReminder1hSent;
  let reminder5mSent = false;
  let completed = false;

  for (let currentMinsRemaining = bookingAdvanceMins; currentMinsRemaining >= 0; currentMinsRemaining -= 1) {
    // Check 0m start
    if (currentMinsRemaining === 0 && !completed) {
      completed = true;
      events.push({ at: `${currentMinsRemaining}m_remaining`, type: "STARTING_NOW" });
    }

    // Check 5m mark
    if (currentMinsRemaining <= 5 && currentMinsRemaining > 0 && !reminder5mSent) {
      reminder5mSent = true;
      events.push({ at: `${currentMinsRemaining}m_remaining`, type: "5_MIN_REMINDER" });
    }

    // Check 1h mark
    if (currentMinsRemaining <= 60 && currentMinsRemaining > 5 && !reminder1hSent) {
      reminder1hSent = true;
      events.push({ at: `${currentMinsRemaining}m_remaining`, type: "1_HOUR_REMINDER" });
    }

    // Check 24h mark
    if (currentMinsRemaining <= 1440 && currentMinsRemaining > 60 && !reminder24hSent) {
      reminder24hSent = true;
      events.push({ at: `${currentMinsRemaining}m_remaining`, type: "24_HOUR_REMINDER" });
    }
  }

  return events;
}

console.log("=== VERIFYING CASE A (e.g. booked 55 mins away) ===");
const caseAEvents = simulateBookingLifecycle(55);
console.log("Events:", caseAEvents);
// Expected: 1_HOUR_REMINDER at booking, 5_MIN_REMINDER at 5m, STARTING_NOW at 0m
const caseAPassed =
  caseAEvents.length === 3 &&
  caseAEvents[0].type === "1_HOUR_REMINDER" && caseAEvents[0].at === "booking_immediate" &&
  caseAEvents[1].type === "5_MIN_REMINDER" && caseAEvents[1].at === "5m_remaining" &&
  caseAEvents[2].type === "STARTING_NOW" && caseAEvents[2].at === "0m_remaining";
console.log("Case A Valid:", caseAPassed ? "✓ PASS" : "✗ FAIL");

console.log("\n=== VERIFYING CASE B (e.g. booked 12 hours / 720 mins away) ===");
const caseBEvents = simulateBookingLifecycle(720);
console.log("Events:", caseBEvents);
// Expected: 1_HOUR_REMINDER at 60m, 5_MIN_REMINDER at 5m, STARTING_NOW at 0m (24h skipped)
const caseBPassed =
  caseBEvents.length === 3 &&
  caseBEvents[0].type === "1_HOUR_REMINDER" && caseBEvents[0].at === "60m_remaining" &&
  caseBEvents[1].type === "5_MIN_REMINDER" && caseBEvents[1].at === "5m_remaining" &&
  caseBEvents[2].type === "STARTING_NOW" && caseBEvents[2].at === "0m_remaining";
console.log("Case B Valid:", caseBPassed ? "✓ PASS" : "✗ FAIL");

console.log("\n=== VERIFYING CASE C (e.g. booked 48 hours / 2880 mins away) ===");
const caseCEvents = simulateBookingLifecycle(2880);
console.log("Events:", caseCEvents);
// Expected: 24_HOUR_REMINDER at 1440m (24h), 1_HOUR_REMINDER at 60m, 5_MIN_REMINDER at 5m, STARTING_NOW at 0m
const caseCPassed =
  caseCEvents.length === 4 &&
  caseCEvents[0].type === "24_HOUR_REMINDER" && caseCEvents[0].at === "1440m_remaining" &&
  caseCEvents[1].type === "1_HOUR_REMINDER" && caseCEvents[1].at === "60m_remaining" &&
  caseCEvents[2].type === "5_MIN_REMINDER" && caseCEvents[2].at === "5m_remaining" &&
  caseCEvents[3].type === "STARTING_NOW" && caseCEvents[3].at === "0m_remaining";
console.log("Case C Valid:", caseCPassed ? "✓ PASS" : "✗ FAIL");

if (caseAPassed && caseBPassed && caseCPassed) {
  console.log("\n>>> ALL TEST CASES (A, B, C) PASSED 100% WITH EXACT CHECKPOINT TIMINGS! <<<");
} else {
  console.error("\n>>> FAILED TEST CASES! <<<");
  process.exit(1);
}
