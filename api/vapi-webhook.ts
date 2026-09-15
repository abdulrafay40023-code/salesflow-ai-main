
// ── TIMEZONE & MEETING SCHEDULE HELPER ─────────────────────────────
export function normalizeClientTimezone(tzStr?: string): string {
  if (!tzStr) return "America/New_York"; // Default to EST
  const s = tzStr.toLowerCase().trim();
  if (s.includes("pdt") || s.includes("pst") || s.includes("pacific") || s.includes("california") || s.includes("los angeles") || s.includes("seattle") || s.includes("vancouver")) return "America/Los_Angeles";
  if (s.includes("mdt") || s.includes("mst") || s.includes("mountain") || s.includes("denver") || s.includes("arizona") || s.includes("phoenix") || s.includes("calgary")) return "America/Denver";
  if (s.includes("cdt") || s.includes("cst") || s.includes("central") || s.includes("chicago") || s.includes("texas") || s.includes("dallas") || s.includes("houston")) return "America/Chicago";
  if (s.includes("edt") || s.includes("est") || s.includes("eastern") || s.includes("new york") || s.includes("florida") || s.includes("miami") || s.includes("toronto")) return "America/New_York";
  if (s.includes("gmt") || s.includes("bst") || s.includes("uk") || s.includes("london") || s.includes("britain") || s.includes("england")) return "Europe/London";
  if (s.includes("cet") || s.includes("cest") || s.includes("paris") || s.includes("berlin") || s.includes("germany") || s.includes("france") || s.includes("spain") || s.includes("italy")) return "Europe/Paris";
  if (s.includes("pkt") || s.includes("pakistan") || s.includes("karachi") || s.includes("lahore") || s.includes("islamabad")) return "Asia/Karachi";
  if (s.includes("ist") || s.includes("india") || s.includes("mumbai") || s.includes("delhi")) return "Asia/Kolkata";
  if (s.includes("aest") || s.includes("aedt") || s.includes("sydney") || s.includes("melbourne") || s.includes("australia")) return "Australia/Sydney";
  return "America/New_York";
}

export function getTimezoneAbbreviation(ianaTz: string, dateObj: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: ianaTz, timeZoneName: "short" });
    const parts = formatter.formatToParts(dateObj);
    const tzPart = parts.find(p => p.type === "timeZoneName");
    return tzPart ? tzPart.value : "EST";
  } catch {
    return "EST";
  }
}

export function calculateMeetingSchedule(rawDateStr?: string, rawTimeStr?: string, rawTzStr?: string) {
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

  // Converge candidate UTC time to exact local time in ianaTz
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

  // If the scheduled time is already in the past, roll forward by 24 hours
  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  const targetIso = candidate.toISOString();
  const meetingDateObj = new Date(targetIso);
  const tzAbbr = getTimezoneAbbreviation(ianaTz, meetingDateObj);

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

import { createClient } from "@supabase/supabase-js";
import {
  sendMeetingConfirmationEmail,
  GMAIL_USER,
} from "../src/lib/email-service";

const SUPABASE_URL =
  process.env["VITE_SUPABASE_URL"] || "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["VITE_SUPABASE_ANON_KEY"] ||
  "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";

// Robust Spoken Email Normalizer (converts "at" -> "@", "dot" -> ".", handles spoken letters and formatting)
function normalizeSpokenEmail(raw: string): string | null {
  if (!raw) return null;
  let s = raw.toLowerCase().trim();
  s = s
    .replace(/\bat\s+the\s+rate\s+(?:of\s+)?/gi, "@")
    .replace(/\bat\b/gi, "@")
    .replace(/\bdot\b/gi, ".")
    .replace(/\bunderscore\b/gi, "_")
    .replace(/\b(?:dash|hyphen)\b/gi, "-");
  s = s.replace(/\s*@\s*/g, "@").replace(/\s*\.\s*/g, ".");
  s = s.replace(/\s+/g, "");
  s = s.replace(/\.+@/g, "@").replace(/@\.+/g, "@").replace(/\.+$/, "").replace(/^\.+/, "");
  const match = s.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (match) return match[1].toLowerCase().trim();
  return s.includes("@") && s.includes(".") ? s : null;
}

function extractEmailFromText(text: string): string | null {
  return normalizeSpokenEmail(text);
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ status: "Vapi webhook listener is active" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body || {};
    const message = payload.message || payload;
    const messageType = message.type || payload.type;

    console.log("Incoming Vapi Webhook Event:", messageType);

    if (messageType === "end-of-call-report" || messageType === "call.ended") {
      const call = message.call || payload.call || payload;
      const transcript = call.transcript || message.transcript || "";
      const customerNumber = call.customer?.number || "";
      const analysis = message.analysis || call.analysis || {};
      const structuredData = analysis.structuredData || {};

      console.log("Processing Call Report for:", customerNumber);
      console.log("Structured Data:", JSON.stringify(structuredData));

      // Find the corresponding lead in Supabase
      let lead: any = null;
      if (customerNumber) {
        const cleanPhone = customerNumber.replace(/[^\d]/g, "");
        const { data: leads } = await supabase.from("leads").select("*");
        if (leads && leads.length > 0) {
          lead = leads.find((l) => {
            const lPhone = (l.phone || "").replace(/[^\d]/g, "");
            return lPhone && cleanPhone && (lPhone.includes(cleanPhone) || cleanPhone.includes(lPhone));
          });
        }
      }

      // Check if slot was booked
      const isBooked =
        structuredData.booked === true ||
        structuredData.isBooked === true ||
        Boolean(structuredData.clientEmail) ||
        Boolean(structuredData.bookingTime) ||
        transcript.toLowerCase().includes("send you a calendar invite") ||
        transcript.toLowerCase().includes("meeting link") ||
        transcript.toLowerCase().includes("calendar link") ||
        transcript.toLowerCase().includes("send over the invite") ||
        transcript.toLowerCase().includes("confirmed for") ||
        transcript.toLowerCase().includes("demo is confirmed") ||
        transcript.toLowerCase().includes("looking forward to speaking") ||
        transcript.toLowerCase().includes("works great for us");

      // Extract client email
      let clientEmail =
        structuredData.clientEmail ||
        structuredData.email ||
        extractEmailFromText(transcript) ||
        lead?.email;

      if (clientEmail) {
        clientEmail = clientEmail.toLowerCase().trim();
      }

      const assignedAgent = lead?.assigned_agent_name || lead?.agent || PRIMARY_ADMIN_EMAIL;
      const clientName = lead?.name || structuredData.clientName || "Valued Client";

      if (isBooked && clientEmail) {
        console.log("🎉 Call Result: BOOKING DETECTED! Booking slot for:", clientEmail);

        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        let rawDate = (structuredData.bookingDate || "").trim();
        let bookingTimeStr = (structuredData.bookingTime || "11:00 AM").trim();
        let bookingDateStr: string;

        if (
          !rawDate ||
          rawDate.toLowerCase().includes("tomorrow") ||
          isNaN(new Date(rawDate).getTime())
        ) {
          if (rawDate.toLowerCase().includes("today") || transcript.toLowerCase().includes("next hour")) {
            bookingDateStr = now.toISOString().split("T")[0];
            const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
            if (!structuredData.bookingTime) {
              bookingTimeStr = nextHour.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });
            }
          } else {
            bookingDateStr = tomorrow.toISOString().split("T")[0];
          }
        } else {
          bookingDateStr = rawDate;
        }

        // Smart Future Time & Timezone Calculation:
        const tzExtracted = structuredData.timezone || transcript.match(/\b(est|edt|pst|pdt|cst|cdt|mst|mdt|gmt|bst|pkt|ist|aest|aedt|eastern|pacific|central|mountain|london|pakistan)\b/i)?.[0] || "EST";
        const scheduleInfo = calculateMeetingSchedule(rawDate || structuredData.bookingDate, structuredData.bookingTime, tzExtracted);
        const scheduledIso = scheduleInfo.scheduledIso;
        const nowIso = new Date().toISOString();

        // 1. Update Lead Status to "booked" in Supabase
        if (lead?.id) {
          await supabase
            .from("leads")
            .update({
              status: "booked",
              booked_at: nowIso,
              contacted_at: nowIso,
              email: clientEmail,
            })
            .eq("id", lead.id);
        } else {
          await supabase
            .from("leads")
            .update({
              status: "booked",
              booked_at: nowIso,
              contacted_at: nowIso,
            })
            .ilike("email", clientEmail);
        }

        // ── SINGLE EMAIL IDEMPOTENCY GUARD ───────────────────────────────
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: existingMeeting } = await supabase
          .from("meetings")
          .select("id, scheduled_time, created_at")
          .eq("lead_email", clientEmail)
          .gte("created_at", tenMinutesAgo)
          .maybeSingle();

        if (existingMeeting) {
          console.log(`Webhook: Meeting for ${clientEmail} already booked recently (${existingMeeting.id}). Skipping duplicate confirmation email.`);
          return res.status(200).json({
            success: true,
            action: "booked",
            clientEmail,
            bookingDate: bookingDateStr,
            bookingTime: bookingTimeStr,
            message: "Duplicate confirmation email skipped safely.",
          });
        }

        // 2. Insert Meeting Record into Supabase
        await supabase.from("meetings").insert({
          title: `AI Sales Demo with ${clientName} (${scheduleInfo.clientFormattedTime} / PKT ${scheduleInfo.agentFormattedTime})`,
          scheduled_time: scheduledIso,
          lead_email: clientEmail,
          agent_email: assignedAgent,
          status: "confirmed",
          completed: false,
          created_at: nowIso,
        });

        // 3. Send Personalized Timezone Confirmation Emails
        try {
          await sendMeetingConfirmationEmail({
            leadEmail: clientEmail,
            agentEmail: assignedAgent,
            meetingDate: scheduleInfo.clientFormattedDate,
            meetingTime: scheduleInfo.clientFormattedTime,
            clientDate: scheduleInfo.clientFormattedDate,
            clientTime: scheduleInfo.clientFormattedTime,
            agentDate: scheduleInfo.agentFormattedDate,
            agentTime: scheduleInfo.agentFormattedTime,
          });
          console.log(`Confirmation email sent successfully to ${clientEmail} & ${assignedAgent}`);
        } catch (emailErr) {
          console.error("Failed to send meeting confirmation email:", emailErr);
        }

        // 4. Log in emails_sent
        await supabase.from("emails_sent").insert({
          lead_id: lead?.id || null,
          lead_email: clientEmail,
          subject: `Meeting Confirmed via AI Voice Call: ${bookingDateStr} at ${bookingTimeStr}`,
          sequence_type: "ai_voice_booking",
          status: "sent",
          sent_at: nowIso,
        });

        return res.status(200).json({
          success: true,
          action: "booked",
          clientEmail,
          bookingDate: bookingDateStr,
          bookingTime: bookingTimeStr,
        });
      } else {
        console.log("Call completed without booking. Ensuring lead status is contacted.");
        const nowIso = new Date().toISOString();

        if (lead?.id) {
          await supabase
            .from("leads")
            .update({
              status: "contacted",
              contacted_at: nowIso,
            })
            .eq("id", lead.id);
        }

        return res.status(200).json({
          success: true,
          action: "contacted",
          leadId: lead?.id,
        });
      }
    }

    return res.status(200).json({ success: true, message: "Event received" });
  } catch (err: any) {
    console.error("Vapi webhook handler error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
