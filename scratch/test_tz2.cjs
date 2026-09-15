function normalizeTimezone(tzStr) {
  if (!tzStr) return "America/New_York";
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
  
  let timeStr = (rawTimeStr || "11:00 AM").trim();
  if (!/am|pm/i.test(timeStr)) {
    const num = parseInt(timeStr, 10);
    if (!isNaN(num)) {
      timeStr = num >= 9 && num <= 11 ? `${num}:00 AM` : `${num}:00 PM`;
    }
  }

  let dateStr = (rawDateStr || "").trim();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  if (!dateStr || dateStr.toLowerCase().includes("tomorrow") || isNaN(new Date(dateStr).getTime())) {
    if (dateStr.toLowerCase().includes("today")) {
      dateStr = now.toISOString().split("T")[0];
    } else {
      dateStr = tomorrow.toISOString().split("T")[0];
    }
  }

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

  const [y, m, d] = dateStr.split(/[-/]/).map(n => parseInt(n, 10));

  let candidate = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0));
  for (let iter = 0; iter < 3; iter++) {
    const formattedInTz = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).format(candidate);
    
    const [dPart, tPart] = formattedInTz.split(", ");
    const [fM, fD, fY] = dPart.split("/").map(Number);
    const [fH, fMin, fS] = tPart.split(":").map(Number);
    const inTzAsUtc = Date.UTC(fY, fM - 1, fD, fH === 24 ? 0 : fH, fMin, fS);
    const desiredAsUtc = Date.UTC(y, m - 1, d, hours, minutes, 0);
    const offsetDiff = desiredAsUtc - inTzAsUtc;
    if (offsetDiff === 0) break;
    candidate = new Date(candidate.getTime() + offsetDiff);
  }

  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  const targetIso = candidate.toISOString();
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

console.log('USA (EST 10 AM):', computeMeetingSchedule('2026-08-27', '10:00 AM', 'EST'));
console.log('USA (PST 10 AM):', computeMeetingSchedule('2026-08-27', '10:00 AM', 'PST'));
console.log('UK (London 2 PM):', computeMeetingSchedule('2026-08-27', '2:00 PM', 'London UK'));
console.log('Pakistan (PKT 5 PM):', computeMeetingSchedule('2026-08-27', '5:00 PM', 'PKT'));