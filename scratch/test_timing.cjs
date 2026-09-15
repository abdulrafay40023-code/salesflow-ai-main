// Verification of timing thresholds for meeting reminders

function simulateReminderCheck(minutesUntilMeeting) {
  const timeUntilMeetingMs = minutesUntilMeeting * 60 * 1000;
  const nowMs = Date.now();
  const meetingStartMs = nowMs + timeUntilMeetingMs;
  const elapsedPostStartMs = nowMs - meetingStartMs;

  const results = [];

  // Stage 4: Meeting Time Has Arrived (Starting NOW)
  if (nowMs >= meetingStartMs && elapsedPostStartMs <= 10 * 60 * 1000) {
    results.push("STARTING_NOW");
    return results;
  }

  if (nowMs > meetingStartMs) {
    results.push("ALREADY_PASSED");
    return results;
  }

  // Stage 3: 5-Minute Reminder (0 to 5 mins before meeting)
  if (timeUntilMeetingMs <= 5 * 60 * 1000 && timeUntilMeetingMs > 0) {
    results.push("5_MIN_REMINDER");
    return results;
  }

  // Stage 2: 1-Hour Reminder (ONLY when <= 60 mins before meeting)
  if (timeUntilMeetingMs <= 60 * 60 * 1000) {
    if (timeUntilMeetingMs >= 30 * 60 * 1000) {
      results.push("1_HOUR_REMINDER");
    } else if (timeUntilMeetingMs < 30 * 60 * 1000 && timeUntilMeetingMs > 0) {
      results.push("1_HOUR_SILENT_SKIP");
    }
    return results;
  }

  // Stage 1: 24-Hour Reminder (ONLY when <= 24 hours before meeting)
  if (timeUntilMeetingMs <= 24 * 60 * 60 * 1000) {
    if (timeUntilMeetingMs >= 18 * 60 * 60 * 1000) {
      results.push("24_HOUR_REMINDER");
    } else if (timeUntilMeetingMs < 18 * 60 * 60 * 1000 && timeUntilMeetingMs > 0) {
      results.push("24_HOUR_SILENT_SKIP");
    }
    return results;
  }

  results.push("FUTURE_PENDING");
  return results;
}

const testCases = [
  { mins: 2880, expected: "FUTURE_PENDING", desc: "48 hours (2 days) away" },
  { mins: 1440, expected: "24_HOUR_REMINDER", desc: "Exact 24 hours (1440 mins) away" },
  { mins: 1200, expected: "24_HOUR_REMINDER", desc: "20 hours (1200 mins) away" },
  { mins: 720,  expected: "24_HOUR_SILENT_SKIP", desc: "12 hours (same day, skipped 24h)" },
  { mins: 65,   expected: "24_HOUR_SILENT_SKIP", desc: "65 mins away (should NOT trigger 1h yet!)" },
  { mins: 60,   expected: "1_HOUR_REMINDER", desc: "Exact 60 mins (1 hour) away" },
  { mins: 45,   expected: "1_HOUR_REMINDER", desc: "45 mins away" },
  { mins: 20,   expected: "1_HOUR_SILENT_SKIP", desc: "20 mins away (short notice, skipped 1h)" },
  { mins: 5,    expected: "5_MIN_REMINDER", desc: "Exact 5 mins away" },
  { mins: 2,    expected: "5_MIN_REMINDER", desc: "2 mins away" },
  { mins: 0,    expected: "STARTING_NOW", desc: "Meeting time right now (0 mins)" },
  { mins: -5,   expected: "STARTING_NOW", desc: "5 mins after start (within 10m live window)" },
  { mins: -15,  expected: "ALREADY_PASSED", desc: "15 mins after start (expired)" },
];

console.log("=== RUNNING TIMING THRESHOLD TESTS ===");
let allPassed = true;
for (const tc of testCases) {
  const res = simulateReminderCheck(tc.mins)[0];
  const passed = res === tc.expected;
  if (!passed) allPassed = false;
  console.log(`${passed ? "✓ PASS" : "✗ FAIL"}: [${tc.desc}] -> Expected: ${tc.expected}, Got: ${res}`);
}

if (allPassed) {
  console.log("\nALL 13 TESTS PASSED PERFECTLY!");
} else {
  console.error("\nSOME TESTS FAILED!");
  process.exit(1);
}
