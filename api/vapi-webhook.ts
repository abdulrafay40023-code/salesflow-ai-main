import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// ── TIMEZONE & MEETING SCHEDULE HELPER ─────────────────────────────
function normalizeClientTimezone(tzStr?: string, phoneStr?: string): string {
  if (tzStr) {
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
    if (s.includes("dubai") || s.includes("uae") || s.includes("gst")) return "Asia/Dubai";
  }

  // Detect country code from destination phone number
  if (phoneStr) {
    const p = phoneStr.trim().replace(/[^\d+]/g, "");
    if (p.startsWith("+44") || p.startsWith("44")) return "Europe/London";
    if (p.startsWith("+971") || p.startsWith("971")) return "Asia/Dubai";
    if (p.startsWith("+61") || p.startsWith("61")) return "Australia/Sydney";
    if (p.startsWith("+92") || p.startsWith("92")) return "Asia/Karachi";
    if (p.startsWith("+1") || p.startsWith("1")) return "America/New_York";
  }

  return "America/New_York";
}

function getTimezoneAbbreviation(ianaTz: string, dateObj: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: ianaTz, timeZoneName: "short" });
    const parts = formatter.formatToParts(dateObj);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart ? tzPart.value : "EST";
  } catch {
    return "EST";
  }
}

function parseTargetDate(raw?: string, now = new Date()): string {
  const s = (raw || "").toLowerCase().trim();
  if (s.includes("day after tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0] || "";
  }
  if (s.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0] || "";
  }
  if (s.includes("today")) {
    return now.toISOString().split("T")[0] || "";
  }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i++) {
    const dayName = days[i];
    if (dayName && s.includes(dayName)) {
      const currentDay = now.getDay();
      let diff = i - currentDay;
      if (diff <= 0) diff += 7;
      const target = new Date(now);
      target.setDate(target.getDate() + diff);
      return target.toISOString().split("T")[0] || "";
    }
  }
  if (raw) {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0] || "";
    }
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0] || "";
}

function parseTargetTime(raw?: string): { hours: number; minutes: number } {
  let s = (raw || "11:00 AM").toLowerCase().trim();
  if (s.includes("morning")) {
    s = s.replace(/in\s+the\s+morning/g, "").trim() + " am";
  } else if (s.includes("afternoon") || s.includes("evening") || s.includes("night")) {
    s = s.replace(/in\s+the\s+(afternoon|evening|night)/g, "").trim() + " pm";
  }
  s = s.replace(/o'?clock/gi, "").trim();

  let hours = 11;
  let minutes = 0;
  const match = s.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (match && match[1]) {
    hours = parseInt(match[1], 10);
    minutes = match[2] ? parseInt(match[2], 10) : 0;
    const isPm = match[3] && match[3].toLowerCase() === "pm";
    const isAm = match[3] && match[3].toLowerCase() === "am";
    if (!match[3]) {
      if (hours >= 1 && hours <= 8) hours += 12;
    } else {
      if (isPm && hours < 12) hours += 12;
      if (isAm && hours === 12) hours = 0;
    }
  }
  return { hours, minutes };
}

function calculateMeetingSchedule(rawDateStr?: string, rawTimeStr?: string, rawTzStr?: string, phoneStr?: string) {
  const now = new Date();
  const ianaTz = normalizeClientTimezone(rawTzStr, phoneStr);
  const dateStr = parseTargetDate(rawDateStr, now);
  const { hours, minutes } = parseTargetTime(rawTimeStr);

  const parts = dateStr.split(/[-/]/).map((n) => parseInt(n, 10));
  const y = parts[0] || now.getFullYear();
  const m = parts[1] || (now.getMonth() + 1);
  const d = parts[2] || now.getDate();

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
    const [fM, fD, fY] = (dPart || "").split("/").map(Number);
    const [fH, fMin, fS] = (tPart || "").split(":").map(Number);
    const inTzAsUtc = Date.UTC(fY || y, (fM || m) - 1, fD || d, fH === 24 ? 0 : fH || 0, fMin || 0, fS || 0);
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

const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SUPABASE_ANON_KEY"] ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";
const GMAIL_USER = process.env["GMAIL_USER"] || "garryamelia6265@gmail.com";
const GMAIL_APP_PASS = process.env["GMAIL_APP_PASS"] || "vlnzgybqvbmapxnn";

// Self-contained nodemailer transporter for Vercel Serverless
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASS,
  },
});

function getPktRfcDate(): string {
  const now = new Date();
  const pktMs = now.getTime() + 5 * 60 * 60 * 1000;
  const d = new Date(pktMs);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[d.getUTCDay()];
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = d.getUTCHours().toString().padStart(2, "0");
  const mins = d.getUTCMinutes().toString().padStart(2, "0");
  const secs = d.getUTCSeconds().toString().padStart(2, "0");
  return `${dayName}, ${day} ${month} ${year} ${hours}:${mins}:${secs} +0500`;
}

// Robust Spoken Email Normalizer (converts "at" -> "@", "dot" -> ".", handles spaced letters, domains, and spoken punctuation)
function normalizeSpokenEmail(raw?: string): string | null {
  if (!raw) return null;
  let s = String(raw).toLowerCase().trim();

  // Strip speech filler prefixes e.g. "my email is", "it's", "it is", "sure, it's"
  s = s.replace(/^(?:my\s+(?:email|mail)\s+(?:address\s+)?is\s+|it'?s\s+|it\s+is\s+|email\s+is\s+|sure\s*,?\s*)+/gi, "");
  s = s.replace(/[",';?!]/g, " ");

  // Normalize spoken words to punctuation
  s = s
    .replace(/\bat\s+the\s+rate\s+(?:of\s+)?/gi, "@")
    .replace(/\bat\s+sign\b/gi, "@")
    .replace(/\b(?:at)\b/gi, "@")
    .replace(/\bdot\b/gi, ".")
    .replace(/\bpoint\b/gi, ".")
    .replace(/\bunderscore\b/gi, "_")
    .replace(/\b(?:dash|hyphen)\b/gi, "-");

  // Remove whitespace around symbols
  s = s.replace(/\s*@\s*/g, "@").replace(/\s*\.\s*/g, ".");
  s = s.replace(/\s+/g, "");

  // Fix common domain vocalizations
  s = s
    .replace(/@g\s*mail/i, "@gmail")
    .replace(/@y\s*ahoo/i, "@yahoo")
    .replace(/@hot\s*mail/i, "@hotmail")
    .replace(/@out\s*look/i, "@outlook")
    .replace(/@i\s*cloud/i, "@icloud");

  // If user said "john@gmail" without ".com", auto-append ".com"
  if (/@(gmail|yahoo|hotmail|outlook|icloud)$/i.test(s)) {
    s += ".com";
  }

  // Clean trailing or doubled dots
  s = s.replace(/\.+/g, ".").replace(/\.@/g, "@").replace(/@\./g, "@").replace(/^\.+|\.+$/g, "");

  const match = s.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (match && match[1]) return match[1].toLowerCase().trim();
  return s.includes("@") && s.includes(".") ? s : null;
}

function extractEmailFromText(text: string): string | null {
  if (!text) return null;

  // 1. Direct standard email match
  const standardMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
  if (standardMatch && standardMatch.length > 0) {
    const found = standardMatch[standardMatch.length - 1];
    if (found) return found.toLowerCase().trim();
  }

  // 2. Pattern match for spoken emails in transcripts: "something at something dot com"
  const spokenPattern = /([a-zA-Z0-9._\s-]{1,50})\s*(?:@|at\s+the\s+rate(?:\s+of)?|at|at\s+sign)\s*([a-zA-Z0-9_\s-]{1,30})\s*(?:\.|\bdot\b)\s*(com|co|net|org|io|ai|pk|uk|edu|gov|xyz|live|tech)/gi;
  let match;
  const candidates: string[] = [];

  while ((match = spokenPattern.exec(text)) !== null) {
    const rawLocal = match[1] || "";
    const rawDomain = match[2] || "";
    const tld = match[3] || "com";

    const local = rawLocal
      .replace(/^(?:.*?\b(?:is|email|address|mail)\b)+/i, "")
      .replace(/\s+/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .toLowerCase();

    const domain = rawDomain.replace(/\s+/g, "").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();

    if (domain.length >= 2 && local.length >= 2) {
      candidates.push(`${local}@${domain}.${tld}`.toLowerCase());
    }
  }

  if (candidates.length > 0 && candidates[candidates.length - 1]) {
    return candidates[candidates.length - 1] ?? null;
  }

  return normalizeSpokenEmail(text);
}

// ── SHARED STRATEGY SESSION BOOKING & CONFIRMATION HELPER ───────────
async function executeBookingAndSendConfirmation({
  clientEmail,
  rawDate,
  rawTime,
  rawTz,
  customerNumber,
  lead,
  clientName,
  assignedAgent,
}: {
  clientEmail?: string | null;
  rawDate?: string;
  rawTime?: string;
  rawTz?: string;
  customerNumber?: string;
  lead?: any;
  clientName?: string;
  assignedAgent?: string;
}) {
  const cleanEmail = normalizeSpokenEmail(clientEmail || "");
  if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return { success: false, error: "Valid email address is required to book a session." };
  }

  const cleanPhone = (customerNumber || lead?.phone || "").replace(/[^\d]/g, "");
  const scheduleInfo = calculateMeetingSchedule(rawDate, rawTime, rawTz, customerNumber);
  const scheduledIso = scheduleInfo.scheduledIso;
  const nowIso = new Date().toISOString();
  const zoomUrl = "https://zoom.us/j/5539578967";
  const effectiveAgent = assignedAgent || lead?.assigned_agent_name || lead?.agent || PRIMARY_ADMIN_EMAIL;
  const effectiveName = clientName || lead?.name || "Valued Client";

  // 1. Update Lead Status to "booked" & email in Supabase
  if (lead?.id) {
    await supabase
      .from("leads")
      .update({
        status: "booked",
        booked_at: nowIso,
        contacted_at: nowIso,
        email: cleanEmail,
      })
      .eq("id", lead.id);
  } else {
    const { data: leads } = await supabase.from("leads").select("*");
    const matched = leads?.find((l: any) => {
      const lPhone = (l.phone || "").replace(/[^\d]/g, "");
      return (
        (lPhone && cleanPhone && (lPhone.includes(cleanPhone) || cleanPhone.includes(lPhone))) ||
        (l.email && l.email.toLowerCase() === cleanEmail.toLowerCase())
      );
    });

    if (matched) {
      await supabase
        .from("leads")
        .update({
          status: "booked",
          booked_at: nowIso,
          contacted_at: nowIso,
          email: cleanEmail,
        })
        .eq("id", matched.id);
    } else {
      await supabase
        .from("leads")
        .update({
          status: "booked",
          booked_at: nowIso,
          contacted_at: nowIso,
        })
        .ilike("email", cleanEmail);
    }
  }

  // ── IDEMPOTENCY GUARD (Prevents duplicate meetings in last 10 minutes) ──
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existingMeetings } = await supabase
    .from("meetings")
    .select("id, scheduled_time, created_at, title")
    .gte("created_at", tenMinutesAgo);

  const isDuplicate = (existingMeetings || []).some(
    (m: any) => m.title && m.title.includes(cleanEmail)
  );

  if (isDuplicate) {
    console.log(`Meeting for ${cleanEmail} already booked recently. Skipping duplicate confirmation email.`);
    return {
      success: true,
      alreadyBooked: true,
      scheduleInfo,
      clientEmail: cleanEmail,
      message: "Duplicate meeting skipped safely.",
    };
  }

  // 2. Insert Meeting Record into Supabase
  const meetingTitle = `Sales Meeting with ${effectiveName} (${cleanEmail}) on ${scheduleInfo.clientFormattedDate} @ ${scheduleInfo.clientFormattedTime} || PKT: ${scheduleInfo.agentFormattedTime} || ZOOM: ${zoomUrl}`;

  await supabase.from("meetings").insert({
    lead_id: lead?.id || null,
    agent_email: effectiveAgent,
    title: meetingTitle,
    scheduled_time: scheduledIso,
    completed: false,
    reminder_24h_sent: false,
    reminder_1h_sent: false,
  });

  // 3. Send Confirmation Emails via Nodemailer
  try {
    const clientMailOptions = {
      from: `"AMZ Solutions Hub" <${GMAIL_USER}>`,
      to: cleanEmail,
      subject: `✅ Meeting Confirmed: 1-on-1 Strategy Session with AMZ Solutions Hub (${scheduleInfo.clientFormattedDate} at ${scheduleInfo.clientFormattedTime})`,
      headers: {
        Date: getPktRfcDate(),
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 22px; font-weight: bold;">AMZ Solutions Hub</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">eCommerce Automation &amp; Store Management Services</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <h2 style="color: #1e293b; margin-top: 0;">Strategy Session Confirmed!</h2>
            <p>Hi <strong>${effectiveName}</strong>,</p>
            <p>Thank you for speaking with our sales team! Your 1-on-1 Zoom strategy consultation with our Senior E-Commerce Specialist has been successfully confirmed.</p>
            
            <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="margin: 6px 0;">📅 <strong>Date:</strong> ${scheduleInfo.clientFormattedDate}</p>
              <p style="margin: 6px 0;">⏰ <strong>Time:</strong> ${scheduleInfo.clientFormattedTime} (Your Local Time)</p>
              <p style="margin: 6px 0;">👤 <strong>Attendees:</strong> ${cleanEmail} &amp; Senior Specialist (${effectiveAgent})</p>
              <p style="margin: 6px 0;">💻 <strong>Meeting Link:</strong> <a href="${zoomUrl}" style="color: #4f46e5; font-weight: bold; text-decoration: underline;">Join Zoom Meeting</a></p>
            </div>

            <div style="margin: 25px 0; text-align: center;">
              <a href="${zoomUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px;">
                🚀 Join Zoom Meeting at Scheduled Time
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
              During this 1-on-1 session, our specialist will present a customized roadmap for building and scaling automated stores across Amazon FBA, Shopify, and Walmart.
            </p>
            <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px;">
              Need to reschedule? Reply directly to this email or visit <a href="https://www.amzsolutionshub.com" style="color: #4f46e5;">amzsolutionshub.com</a>.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(clientMailOptions);
    console.log(`Confirmation email sent successfully to prospect: ${cleanEmail}`);

    // Send Notification to Assigned Agent / Admin with PKT conversion
    if (effectiveAgent && effectiveAgent.includes("@")) {
      const agentMailOptions = {
        from: `"AMZ Solutions Hub Appointments" <${GMAIL_USER}>`,
        to: effectiveAgent,
        subject: `📅 New Meeting Booked: ${scheduleInfo.agentFormattedDate} at ${scheduleInfo.agentFormattedTime} [PKT] (${effectiveName})`,
        headers: {
          Date: getPktRfcDate(),
        },
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff; border-radius: 12px;">
            <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 20px;">New Strategy Session Booked via AI Call</h2>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.6;">
              <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 4px 0; color: #1e1b4b;"><strong>🇵🇰 Pakistan Time [PKT]:</strong> ${scheduleInfo.agentFormattedDate} at ${scheduleInfo.agentFormattedTime}</p>
                <p style="margin: 4px 0; color: #4338ca;"><strong>🌐 Client Local Time:</strong> ${scheduleInfo.clientFormattedDate} at ${scheduleInfo.clientFormattedTime}</p>
                <p style="margin: 4px 0;"><strong>Prospect Name:</strong> ${effectiveName}</p>
                <p style="margin: 4px 0;"><strong>Prospect Email:</strong> ${cleanEmail}</p>
                <p style="margin: 4px 0;"><strong>Prospect Phone:</strong> ${customerNumber || lead?.phone || "On File"}</p>
                <p style="margin: 4px 0;"><strong>Assigned Host:</strong> ${effectiveAgent}</p>
                <p style="margin: 4px 0;"><strong>Zoom Link:</strong> <a href="${zoomUrl}">${zoomUrl}</a></p>
              </div>
            </div>
          </div>
        `,
      };
      await transporter.sendMail(agentMailOptions).catch((e) => console.log("Agent email notice:", e?.message));
    }
  } catch (emailErr) {
    console.error("Failed to send meeting confirmation email:", emailErr);
  }

  // 4. Log in emails_sent
  await supabase.from("emails_sent").insert({
    lead_id: lead?.id || null,
    lead_email: cleanEmail,
    subject: `Meeting Confirmed via AI Voice Call: ${scheduleInfo.clientFormattedDate} at ${scheduleInfo.clientFormattedTime}`,
    sequence_type: "ai_voice_booking",
    status: "sent",
    sent_at: nowIso,
  });

  return {
    success: true,
    action: "booked",
    scheduleInfo,
    clientEmail: cleanEmail,
    bookingDate: scheduleInfo.clientFormattedDate,
    bookingTime: scheduleInfo.clientFormattedTime,
    zoomUrl,
  };
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
    return res.status(200).json({ status: "Vapi webhook listener is active", timestamp: new Date().toISOString() });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body || {};
    const message = payload.message || payload;
    const messageType = message.type || payload.type;

    console.log("Incoming Vapi Webhook Event:", messageType);

    // ── REAL-TIME FUNCTION TOOL CALLS (saveLeadEmail, bookStrategySession) ─
    if (messageType === "tool-calls") {
      const toolCalls = message.toolCalls || message.toolCallList || payload.toolCalls || [];
      const call = message.call || payload.call || {};
      const customerNumber = call.customer?.number || "";
      const cleanPhone = customerNumber.replace(/[^\d]/g, "");

      const results: any[] = [];

      // Find lead in Supabase by customer phone
      const { data: leads } = await supabase.from("leads").select("*");
      let matchedLead = leads?.find((l: any) => {
        const lPhone = (l.phone || "").replace(/[^\d]/g, "");
        return lPhone && cleanPhone && (lPhone.includes(cleanPhone) || cleanPhone.includes(lPhone));
      });

      for (const tc of toolCalls) {
        const fnName = tc.function?.name;
        let args: any = {};
        try {
          args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments || {});
        } catch {
          args = {};
        }

        if (fnName === "saveLeadEmail") {
          const rawEmail = args.email || args.leadEmail;
          const cleanEmail = normalizeSpokenEmail(rawEmail);
          console.log(`⚡ Tool Call [saveLeadEmail]: raw="${rawEmail}" -> clean="${cleanEmail}" for phone: ${customerNumber}`);

          if (cleanEmail) {
            if (matchedLead) {
              await supabase.from("leads").update({ email: cleanEmail }).eq("id", matchedLead.id);
              console.log(`✅ Real-time save: Updated lead ${matchedLead.id} email to: ${cleanEmail}`);
            } else if (leads && leads.length > 0) {
              const target = leads.find((l: any) => !l.email || l.email === "—" || l.email.includes("placeholder"));
              if (target) {
                await supabase.from("leads").update({ email: cleanEmail }).eq("id", target.id);
                console.log(`✅ Real-time save: Updated recent lead ${target.id} email to: ${cleanEmail}`);
              }
            }

            results.push({
              toolCallId: tc.id,
              result: `Email ${cleanEmail} has been successfully recorded and saved into the CRM database.`,
            });
          } else {
            results.push({
              toolCallId: tc.id,
              result: `Could not parse a valid email from "${rawEmail}". Please confirm clearly with caller.`,
            });
          }
        } else if (fnName === "saveLeadDetails") {
          const rawEmail = args.email || args.leadEmail;
          const cleanEmail = normalizeSpokenEmail(rawEmail);
          const rawWhatsapp = args.whatsapp || args.whatsappNumber;
          const cleanWhatsapp = (rawWhatsapp || "").trim();
          const notes = args.notes || "";
          console.log(`⚡ Tool Call [saveLeadDetails]: email="${cleanEmail}", whatsapp="${cleanWhatsapp}", notes="${notes}" for phone: ${customerNumber}`);

          if (matchedLead) {
            const updates: any = {};
            if (cleanEmail) updates.email = cleanEmail;
            const existingNotes = Array.isArray(matchedLead.notes) ? [...matchedLead.notes] : [];
            if (cleanWhatsapp) existingNotes.push(`WhatsApp: ${cleanWhatsapp}`);
            if (notes) existingNotes.push(notes);
            if (existingNotes.length > 0) updates.notes = existingNotes;
            await supabase.from("leads").update(updates).eq("id", matchedLead.id);
          }

          results.push({
            toolCallId: tc.id,
            result: `Lead details successfully recorded. Email: ${cleanEmail || "None"}, WhatsApp: ${cleanWhatsapp || "None"}.`,
          });
        } else if (fnName === "bookStrategySession" || fnName === "bookZoomMeeting") {
          const rawEmail = args.email || args.clientEmail || args.leadEmail;
          const rawDate = args.bookingDate || args.date;
          const rawTime = args.bookingTime || args.time;
          const rawTz = args.timezone || args.tz;
          console.log(`⚡ Tool Call [${fnName}]: email="${rawEmail}", date="${rawDate}", time="${rawTime}", tz="${rawTz}"`);

          const bookingResult = await executeBookingAndSendConfirmation({
            clientEmail: rawEmail,
            rawDate,
            rawTime,
            rawTz,
            customerNumber,
            lead: matchedLead,
            clientName: matchedLead?.name || call.customer?.name,
            assignedAgent: matchedLead?.assigned_agent_name || matchedLead?.agent || PRIMARY_ADMIN_EMAIL,
          });

          if (bookingResult.success && bookingResult.scheduleInfo) {
            const s = bookingResult.scheduleInfo;
            results.push({
              toolCallId: tc.id,
              result: `Strategy session successfully confirmed for ${s.clientFormattedDate} at ${s.clientFormattedTime} (which corresponds to ${s.agentFormattedTime}). The Zoom link (https://zoom.us/j/5539578967) and calendar invite have been emailed to ${bookingResult.clientEmail}.`,
            });
          } else {
            results.push({
              toolCallId: tc.id,
              result: `Booking notice: ${bookingResult.error || "Unable to confirm session"}. Please verify date and email.`,
            });
          }
        } else {
          results.push({
            toolCallId: tc.id,
            result: "Success",
          });
        }
      }

      return res.status(200).json({ results });
    }

    if (messageType === "end-of-call-report" || messageType === "call.ended") {
      const call = message.call || payload.call || payload;
      const transcript = call.transcript || message.transcript || call.artifact?.transcript || "";
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
          lead = leads.find((l: any) => {
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

      // Check tool calls history for saveLeadEmail
      let toolCallEmail: string | null = null;
      const messagesList = call.messages || call.artifact?.messages || [];
      if (Array.isArray(messagesList)) {
        for (const m of messagesList) {
          const tcs = m.toolCalls || m.tool_calls || [];
          for (const t of tcs) {
            if (t.function?.name === "saveLeadEmail") {
              try {
                const a = typeof t.function.arguments === "string" ? JSON.parse(t.function.arguments) : t.function.arguments;
                const parsed = normalizeSpokenEmail(a?.email || a?.leadEmail);
                if (parsed) toolCallEmail = parsed;
              } catch {}
            }
          }
        }
      }

      // Extract client email from all possible sources
      let clientEmail =
        toolCallEmail ||
        normalizeSpokenEmail(structuredData.clientEmail) ||
        normalizeSpokenEmail(structuredData.email) ||
        extractEmailFromText(transcript) ||
        (lead?.email && lead.email !== "—" ? lead.email.toLowerCase().trim() : null);

      if (clientEmail) {
        clientEmail = clientEmail.toLowerCase().trim();
      }

      const assignedAgent = lead?.assigned_agent_name || lead?.agent || PRIMARY_ADMIN_EMAIL;
      const clientName = lead?.name || structuredData.clientName || "Valued Client";

      if (isBooked && clientEmail) {
        console.log("🎉 Call Result: BOOKING DETECTED! Booking slot for:", clientEmail);

        const bookingResult = await executeBookingAndSendConfirmation({
          clientEmail,
          rawDate: structuredData.bookingDate,
          rawTime: structuredData.bookingTime,
          rawTz:
            structuredData.timezone ||
            transcript.match(
              /\b(est|edt|pst|pdt|cst|cdt|mst|mdt|gmt|bst|pkt|ist|aest|aedt|eastern|pacific|central|mountain|london|pakistan)\b/i
            )?.[0],
          customerNumber,
          lead,
          clientName,
          assignedAgent,
        });

        return res.status(200).json({
          action: "booked",
          clientEmail,
          ...bookingResult,
        });
      } else {
        console.log("Call completed without booking. Ensuring lead status is contacted and email recorded.");
        const nowIso = new Date().toISOString();

        if (lead?.id) {
          const updatePayload: any = {
            status: "contacted",
            contacted_at: nowIso,
          };
          if (clientEmail && clientEmail.includes("@") && clientEmail.includes(".")) {
            updatePayload.email = clientEmail;
            console.log(`✅ Saved prospect email for non-booked lead ${lead.id}: ${clientEmail}`);
          }
          await supabase
            .from("leads")
            .update(updatePayload)
            .eq("id", lead.id);
        }

        return res.status(200).json({
          success: true,
          action: "contacted",
          leadId: lead?.id,
          clientEmail: clientEmail || null,
        });
      }
    }

    return res.status(200).json({ success: true, message: "Event received" });
  } catch (err: any) {
    console.error("Vapi webhook handler error:", err);
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
