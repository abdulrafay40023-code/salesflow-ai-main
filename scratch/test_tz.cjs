function normalizeTimezone(tzStr) {
  if (!tzStr) return "America/New_York"; // Default to EST/EDT for US/UK calls
  const s = tzStr.toLowerCase().trim();
  if (s.includes("pdt") || s.includes("pst") || s.includes("pacific") || s.includes("california") || s.includes("los angeles")) return "America/Los_Angeles";
  if (s.includes("mdt") || s.includes("mst") || s.includes("mountain") || s.includes("denver")) return "America/Denver";
  if (s.includes("cdt") || s.includes("cst") || s.includes("central") || s.includes("chicago") || s.includes("texas")) return "America/Chicago";
  if (s.includes("edt") || s.includes("est") || s.includes("eastern") || s.includes("new york") || s.includes("florida")) return "America/New_York";
  if (s.includes("gmt") || s.includes("bst") || s.includes("uk") || s.includes("london") || s.includes("britain")) return "Europe/London";
  if (s.includes("cet") || s.includes("cest") || s.includes("paris") || s.includes("berlin") || s.includes("germany")) return "Europe/Paris";
  if (s.includes("pkt") || s.includes("pakistan") || s.includes("karachi") || s.includes("lahore")) return "Asia/Karachi";
  if (s.includes("ist") || s.includes("india")) return "Asia/Kolkata";
  if (s.includes("aest") || s.includes("aedt") || s.includes("sydney") || s.includes("australia")) return "Australia/Sydney";
  return "America/New_York";
}

function getTimezoneAbbr(ianaTz, dateObj) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: ianaTz, timeZoneName: "short" });
    const parts = formatter.formatToParts(dateObj);
    const tzPart = parts.find(p => p.type === "timeZoneName");
    return tzPart ? tzPart.value : ianaTz;
  } catch {
    return "EST";
  }
}

function computeMeetingSchedule(rawDateStr, rawTimeStr, rawTzStr) {
  const now = new Date();
  const ianaTz = normalizeTimezone(rawTzStr);
  
  // Format clean time
  let timeStr = (rawTimeStr || "11:00 AM").trim();
  // Ensure AM/PM
  if (!/am|pm/i.test(timeStr)) {
    const num = parseInt(timeStr, 10);
    if (!isNaN(num)) {
      timeStr = num >= 9 && num <= 11 ? `${num}:00 AM` : `${num}:00 PM`;
    }
  }

  // Format clean date
  let dateStr = (rawDateStr || "").trim();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  if (!dateStr || dateStr.toLowerCase().includes("tomorrow") || isNaN(new Date(dateStr).getTime())) {
    if (dateStr.toLowerCase().includes("today")) {
      dateStr = now.toISOString().split("T")[0];
    } else {
      dateStr = tomorrow.toISOString().split("T")[0];
    }
  }

  // Parse candidate date in client timezone
  // Use Intl to parse client date-time into exact UTC instant
  let targetIso;
  try {
    // Construct approximate UTC then adjust for timezone offset
    // Helper: find UTC timestamp that corresponds to dateStr + timeStr in ianaTz
    const [y, m, d] = dateStr.split(/[-/]/).map(n => parseInt(n, 10));
    let hours = 11, minutes = 0;
    const timeMatch = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const isPm = timeMatch[3] && timeMatch[3].toLowerCase() === "pm";
      const isAm = timeMatch[3] && timeMatch[3].toLowerCase() === "am";
      if (isPm && hours < 12) hours += 12;
      if (isAm && hours === 12) hours = 0;
    }

    // Binary search/offset calculation for exact target ISO
    let approxUtc = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0));
    // Determine offset of ianaTz at this approx time
    const tzString = approxUtc.toLocaleString("en-US", { timeZone: ianaTz, hour12: false });
    const localInTz = new Date(tzString);
    const diffMs = approxUtc.getTime() - localInTz.getTime();
    const exactUtc = new Date(approxUtc.getTime() + diffMs);

    // If time is in the past, roll forward by 24h
    if (exactUtc.getTime() <= now.getTime()) {
      exactUtc.setTime(exactUtc.getTime() + 24 * 60 * 60 * 1000);
    }
    targetIso = exactUtc.toISOString();
  } catch (e) {
    targetIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  const meetingDateObj = new Date(targetIso);
  const tzAbbr = getTimezoneAbbr(ianaTz, meetingDateObj);

  const clientFormattedTime = meetingDateObj.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: ianaTz
  }) + ` ${tzAbbr}`;

  const clientFormattedDate = meetingDateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: ianaTz
  });

  const agentFormattedTime = meetingDateObj.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Karachi"
  }) + " PKT";

  const agentFormattedDate = meetingDateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Karachi"
  });

  return {
    scheduledIso: targetIso,
    ianaTz,
    tzAbbr,
    clientFormattedDate,
    clientFormattedTime,
    agentFormattedDate,
    agentFormattedTime,
  };
}

// Test case 1: USA Client (EST) chooses Tomorrow at 10 AM
console.log('Test 1 (EST Tomorrow 10 AM):', computeMeetingSchedule('tomorrow', '10:00 AM', 'EST'));

// Test 2: USA Client (PST California) chooses 2 PM
console.log('Test 2 (PST California 2 PM):', computeMeetingSchedule('2026-08-27', '2:00 PM', 'PST'));

// Test 3: UK Client (London GMT) chooses 4 PM
console.log('Test 3 (UK London 4 PM):', computeMeetingSchedule('2026-08-27', '4:00 PM', 'GMT'));

// Test 4: Past time for today (e.g. today 10 AM when current time is 9 PM)
console.log('Test 4 (Past time rollover):', computeMeetingSchedule('today', '10:00 AM', 'EST'));