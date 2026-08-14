function calculateCardStates(m, nowMs) {
  const meetingStartMs = new Date(m.scheduled_time).getTime();
  const elapsedPostStart = nowMs - meetingStartMs;
  const diffMs = meetingStartMs - nowMs;

  const isExpired = elapsedPostStart > 10 * 60 * 1000;
  const isRed = nowMs >= meetingStartMs;

  const cards = [];
  if (!isExpired) {
    if (m.title && m.title.includes("|| ZOOM:")) {
      cards.push({ id: `zoom-${m.id}`, type: "zoom", isRed, label: "Zoom Meeting" });
    }
    if (diffMs <= 5 * 60 * 1000) {
      cards.push({ id: `now-${m.id}`, type: "now", label: "Starting NOW" });
    } else if (diffMs <= 65 * 60 * 1000) {
      cards.push({ id: `1h-${m.id}`, type: "1h", label: "Meeting in 1 Hour" });
    } else if (diffMs <= 25 * 60 * 60 * 1000) {
      cards.push({ id: `24h-${m.id}`, type: "24h", label: "Meeting Tomorrow" });
    }
  }

  return { isExpired, cards };
}

function runTest() {
  const baseTime = Date.now();

  // Test Meeting A: Scheduled 2 minutes in the future
  const meetingA = {
    id: "m-A",
    title: "Sales Meeting with Jana Kramer @ 10:10 PM || ZOOM: https://zoom.us/j/123",
    scheduled_time: new Date(baseTime + 2 * 60 * 1000).toISOString(),
  };

  // Test Meeting B: Scheduled 20 hours in the future
  const meetingB = {
    id: "m-B",
    title: "Sales Meeting with John Wick @ 09:15 PM || ZOOM: https://zoom.us/j/456",
    scheduled_time: new Date(baseTime + 20 * 3600 * 1000).toISOString(),
  };

  console.log("=== T1: BEFORE MEETING START ===");
  const t1A = calculateCardStates(meetingA, baseTime);
  const t1B = calculateCardStates(meetingB, baseTime);
  console.log("Meeting A cards (2 mins away):", t1A.cards.map(c => c.id));
  console.log("Meeting B cards (20 hrs away):", t1B.cards.map(c => c.id));

  console.log("\n=== T2: 5 MINUTES AFTER MEETING A START (start + 5m) ===");
  const t2Time = baseTime + 7 * 60 * 1000;
  const t2A = calculateCardStates(meetingA, t2Time);
  const t2B = calculateCardStates(meetingB, t2Time);
  console.log("Meeting A cards (isRed:", t2A.cards.find(c => c.type==='zoom')?.isRed, "):", t2A.cards.map(c => c.id));
  console.log("Meeting B cards:", t2B.cards.map(c => c.id));

  console.log("\n=== T3: 11 MINUTES AFTER MEETING A START (start + 11m) ===");
  const t3Time = baseTime + 13 * 60 * 1000;
  const t3A = calculateCardStates(meetingA, t3Time);
  const t3B = calculateCardStates(meetingB, t3Time);
  console.log("Meeting A cards (expired:", t3A.isExpired, "):", t3A.cards.map(c => c.id));
  console.log("Meeting B cards (still active):", t3B.cards.map(c => c.id));

  if (t3A.isExpired && t3A.cards.length === 0 && t3B.cards.length > 0) {
    console.log("\n🎉 ALL TESTS PASSED: Meeting A cards auto-disappeared at start+10m while Meeting B cards remained active!");
  } else {
    console.error("\n❌ TEST FAILED!");
  }
}

runTest();
