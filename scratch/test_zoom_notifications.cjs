/**
 * Unit Test for Zoom Meeting Notification Timing Logic
 */

function evaluateZoomNotification(meeting, nowMs, dismissedNotifs = new Set()) {
  if (!meeting.scheduled_time) return null;
  const meetingStartMs = new Date(meeting.scheduled_time).getTime();
  if (isNaN(meetingStartMs)) return null;

  const elapsedPostStart = nowMs - meetingStartMs;

  // Auto-disappear 10 minutes (600,000 ms) after start time
  if (elapsedPostStart > 10 * 60 * 1000) return null;

  const id = `zoom-${meeting.id}`;
  if (dismissedNotifs.has(id)) return null;

  const isRed = nowMs >= meetingStartMs;

  return {
    id,
    isRed,
    color: isRed ? "RED" : "NORMAL",
    elapsedPostStartMinutes: elapsedPostStart / 60000,
  };
}

// ── TEST SETUP ──
const now = new Date("2026-08-14T10:00:00.000Z").getTime();

// 3 meetings booked at different times:
const meetingFuture = {
  id: "m1",
  title: "Meeting 1 || ZOOM: https://zoom.us/j/111",
  scheduled_time: new Date("2026-08-14T10:15:00.000Z").toISOString(), // 15 mins in future
};

const meetingJustStarted = {
  id: "m2",
  title: "Meeting 2 || ZOOM: https://zoom.us/j/222",
  scheduled_time: new Date("2026-08-14T10:00:00.000Z").toISOString(), // Starting NOW
};

const meetingStarted5mAgo = {
  id: "m3",
  title: "Meeting 3 || ZOOM: https://zoom.us/j/333",
  scheduled_time: new Date("2026-08-14T09:55:00.000Z").toISOString(), // Started 5 mins ago
};

const meetingStarted15mAgo = {
  id: "m4",
  title: "Meeting 4 || ZOOM: https://zoom.us/j/444",
  scheduled_time: new Date("2026-08-14T09:45:00.000Z").toISOString(), // Started 15 mins ago (> 10m cutoff)
};

console.log("=== ZOOM NOTIFICATION TIMING LOGIC TESTS ===\n");

// 1. Future meeting
const resFuture = evaluateZoomNotification(meetingFuture, now);
console.log("Meeting 1 (Future +15m):", resFuture);
console.assert(resFuture !== null && resFuture.isRed === false && resFuture.color === "NORMAL", "FAIL: Future meeting should be NORMAL color");

// 2. Just started meeting
const resJustStarted = evaluateZoomNotification(meetingJustStarted, now);
console.log("Meeting 2 (Just Started NOW):", resJustStarted);
console.assert(resJustStarted !== null && resJustStarted.isRed === true && resJustStarted.color === "RED", "FAIL: Meeting starting NOW should be RED");

// 3. Started 5m ago
const res5mAgo = evaluateZoomNotification(meetingStarted5mAgo, now);
console.log("Meeting 3 (Started 5m ago):", res5mAgo);
console.assert(res5mAgo !== null && res5mAgo.isRed === true && res5mAgo.color === "RED", "FAIL: Meeting started 5m ago should stay RED");

// 4. Started 15m ago (> 10m limit)
const res15mAgo = evaluateZoomNotification(meetingStarted15mAgo, now);
console.log("Meeting 4 (Started 15m ago):", res15mAgo);
console.assert(res15mAgo === null, "FAIL: Meeting started > 10m ago should auto-disappear (null)");

// 5. Dismissed meeting
const dismissed = new Set(["zoom-m2"]);
const resDismissed = evaluateZoomNotification(meetingJustStarted, now, dismissed);
console.log("Meeting 2 (Dismissed):", resDismissed);
console.assert(resDismissed === null, "FAIL: Dismissed meeting should be hidden");

console.log("\nALL ZOOM NOTIFICATION TIMING TESTS PASSED! ✅\n");
