/**
 * Universal Global Timezone & Meeting Schedule Engine
 * Supports USA, UK, Canada, Australia, Europe, Gulf, Asia, and all global territories.
 * Accurately calculates exact UTC ISO timestamp and Pakistan Standard Time (PKT, UTC+5).
 */

export function normalizeClientTimezone(tzStr?: string): string {
  if (!tzStr) return "America/New_York";
  const s = tzStr.toLowerCase().trim();

  // USA & Canada
  if (s.includes("pdt") || s.includes("pst") || s.includes("pacific") || s.includes("california") || s.includes("los angeles") || s.includes("seattle") || s.includes("san francisco") || s.includes("vancouver")) return "America/Los_Angeles";
  if (s.includes("mdt") || s.includes("mst") || s.includes("mountain") || s.includes("denver") || s.includes("arizona") || s.includes("phoenix") || s.includes("calgary") || s.includes("edmonton")) return "America/Denver";
  if (s.includes("cdt") || s.includes("cst") || s.includes("central") || s.includes("chicago") || s.includes("texas") || s.includes("dallas") || s.includes("houston") || s.includes("austin") || s.includes("winnipeg")) return "America/Chicago";
  if (s.includes("edt") || s.includes("est") || s.includes("eastern") || s.includes("new york") || s.includes("florida") || s.includes("miami") || s.includes("toronto") || s.includes("montreal") || s.includes("boston") || s.includes("atlanta") || s.includes("dc") || s.includes("washington")) return "America/New_York";
  if (s.includes("akst") || s.includes("akdt") || s.includes("alaska") || s.includes("anchorage")) return "America/Anchorage";
  if (s.includes("hst") || s.includes("hawaii") || s.includes("honolulu")) return "Pacific/Honolulu";

  // UK & Ireland
  if (s.includes("gmt") || s.includes("bst") || s.includes("uk") || s.includes("london") || s.includes("britain") || s.includes("england") || s.includes("scotland") || s.includes("dublin") || s.includes("ireland")) return "Europe/London";

  // Europe
  if (s.includes("cet") || s.includes("cest") || s.includes("paris") || s.includes("berlin") || s.includes("germany") || s.includes("france") || s.includes("spain") || s.includes("madrid") || s.includes("barcelona") || s.includes("italy") || s.includes("rome") || s.includes("milan") || s.includes("amsterdam") || s.includes("netherlands") || s.includes("brussels") || s.includes("belgium") || s.includes("vienna") || s.includes("austria") || s.includes("zurich") || s.includes("switzerland") || s.includes("stockholm") || s.includes("sweden") || s.includes("oslo") || s.includes("norway") || s.includes("copenhagen") || s.includes("denmark") || s.includes("warsaw") || s.includes("poland") || s.includes("prague") || s.includes("budapest")) return "Europe/Paris";
  if (s.includes("eet") || s.includes("eest") || s.includes("athens") || s.includes("greece") || s.includes("bucharest") || s.includes("helsinki") || s.includes("finland") || s.includes("kyiv") || s.includes("ukraine") || s.includes("istanbul") || s.includes("turkey")) return "Europe/Athens";

  // Middle East & Gulf
  if (s.includes("gst") || s.includes("dubai") || s.includes("uae") || s.includes("emirates") || s.includes("abu dhabi") || s.includes("muscat") || s.includes("oman")) return "Asia/Dubai";
  if (s.includes("ast") || s.includes("riyadh") || s.includes("saudi") || s.includes("doha") || s.includes("qatar") || s.includes("kuwait") || s.includes("bahrain")) return "Asia/Riyadh";

  // South Asia
  if (s.includes("pkt") || s.includes("pakistan") || s.includes("karachi") || s.includes("lahore") || s.includes("islamabad") || s.includes("rawalpindi") || s.includes("faisalabad") || s.includes("multan") || s.includes("peshawar")) return "Asia/Karachi";
  if (s.includes("ist") || s.includes("india") || s.includes("mumbai") || s.includes("delhi") || s.includes("bangalore") || s.includes("hyderabad") || s.includes("chennai") || s.includes("kolkata")) return "Asia/Kolkata";
  if (s.includes("bdt") || s.includes("bangladesh") || s.includes("dhaka")) return "Asia/Dhaka";
  if (s.includes("npt") || s.includes("nepal") || s.includes("kathmandu")) return "Asia/Kathmandu";
  if (s.includes("lkt") || s.includes("sri lanka") || s.includes("colombo")) return "Asia/Colombo";

  // East & Southeast Asia
  if (s.includes("sgt") || s.includes("singapore") || s.includes("malaysia") || s.includes("kuala lumpur") || s.includes("hong kong") || s.includes("shanghai") || s.includes("beijing") || s.includes("china") || s.includes("taipei") || s.includes("taiwan") || s.includes("manila") || s.includes("philippines") || s.includes("bali")) return "Asia/Singapore";
  if (s.includes("ict") || s.includes("bangkok") || s.includes("thailand") || s.includes("vietnam") || s.includes("hanoi") || s.includes("jakarta") || s.includes("indonesia")) return "Asia/Bangkok";
  if (s.includes("jst") || s.includes("kst") || s.includes("japan") || s.includes("tokyo") || s.includes("korea") || s.includes("seoul")) return "Asia/Tokyo";

  // Australia & New Zealand
  if (s.includes("aest") || s.includes("aedt") || s.includes("sydney") || s.includes("melbourne") || s.includes("canberra") || s.includes("brisbane") || s.includes("australia") || s.includes("nsw") || s.includes("victoria") || s.includes("queensland")) return "Australia/Sydney";
  if (s.includes("acst") || s.includes("acdt") || s.includes("adelaide") || s.includes("darwin")) return "Australia/Adelaide";
  if (s.includes("awst") || s.includes("perth") || s.includes("western australia")) return "Australia/Perth";
  if (s.includes("nzst") || s.includes("nzdt") || s.includes("new zealand") || s.includes("auckland") || s.includes("wellington")) return "Pacific/Auckland";

  // Latin America & Africa
  if (s.includes("sao paulo") || s.includes("brazil") || s.includes("rio") || s.includes("buenos aires") || s.includes("argentina") || s.includes("santiago") || s.includes("chile") || s.includes("bogota") || s.includes("colombia") || s.includes("lima") || s.includes("peru")) return "America/Sao_Paulo";
  if (s.includes("sast") || s.includes("south africa") || s.includes("johannesburg") || s.includes("cape town") || s.includes("cairo") || s.includes("egypt") || s.includes("lagos") || s.includes("nigeria") || s.includes("nairobi") || s.includes("kenya")) return "Africa/Johannesburg";

  // Default fallback
  return "America/New_York";
}

export function getTimezoneAbbreviation(ianaTz: string, dateObj: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: ianaTz, timeZoneName: "short" });
    const parts = formatter.formatToParts(dateObj);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart ? tzPart.value : "EST";
  } catch {
    return "EST";
  }
}

export function calculateMeetingSchedule(
  rawDateStr?: string,
  rawTimeStr?: string,
  rawTzStr?: string
) {
  const now = new Date();
  const ianaTz = normalizeClientTimezone(rawTzStr);

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

  let hours = 11;
  let minutes = 0;
  const timeMatch = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const isPm = timeMatch[3] && timeMatch[3].toLowerCase() === "pm";
    const isAm = timeMatch[3] && timeMatch[3].toLowerCase() === "am";
    if (isPm && hours < 12) hours += 12;
    if (isAm && hours === 12) hours = 0;
  }

  const [y, m, d] = dateStr.split(/[-/]/).map((n) => parseInt(n, 10));

  // Converge candidate UTC time to exact local time in ianaTz
  let candidate = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0));
  for (let iter = 0; iter < 3; iter++) {
    const formattedInTz = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(candidate);

    const [dPart, tPart] = formattedInTz.split(", ");
    if (!dPart || !tPart) break;
    const [fM, fD, fY] = dPart.split("/").map(Number);
    const [fH, fMin, fS] = tPart.split(":").map(Number);
    const inTzAsUtc = Date.UTC(fY, fM - 1, fD, fH === 24 ? 0 : fH, fMin, fS);
    const desiredAsUtc = Date.UTC(y, m - 1, d, hours, minutes, 0);
    const offsetDiff = desiredAsUtc - inTzAsUtc;
    if (offsetDiff === 0) break;
    candidate = new Date(candidate.getTime() + offsetDiff);
  }

  // If the scheduled time is already in the past, roll forward by 24 hours
  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  const targetIso = candidate.toISOString();
  const meetingDateObj = new Date(targetIso);
  const tzAbbr = getTimezoneAbbreviation(ianaTz, meetingDateObj);

  const clientFormattedTime =
    meetingDateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: ianaTz,
    }) + ` ${tzAbbr}`;

  const clientFormattedDate = meetingDateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: ianaTz,
  });

  const agentFormattedTime =
    meetingDateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Karachi",
    }) + " PKT";

  const agentFormattedDate = meetingDateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Karachi",
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
