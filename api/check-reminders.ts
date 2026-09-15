import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import tls from "tls";


// ── Supabase credentials (same as app) ────────────────────────────────────
const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Nodemailer transporter ─────────────────────────────────────────────────
const GMAIL_USER = process.env["GMAIL_USER"] || "garryamelia6265@gmail.com";
const GMAIL_APP_PASS = process.env["GMAIL_APP_PASS"] || "vlnzgybqvbmapxnn";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
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

async function sendEmail(to: string | string[], subject: string, html: string) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return;
  await transporter.sendMail({
    from: `"Teals CRM Meetings" <${GMAIL_USER}>`,
    to: recipients.join(", "),
    subject,
    headers: {
      Date: getPktRfcDate(),
    },
    html,
  });
}

// ── Automatic Gmail IMAP Reply Checker (Strict Date-Aware) ──────────────────
function checkGmailRepliesForLeads(
  leadTargets: Array<{ email: string; minTimestampMs: number }>
): Promise<Set<string>> {
  return new Promise((resolve) => {
    const foundEmails = new Set<string>();
    if (!leadTargets || leadTargets.length === 0) return resolve(foundEmails);

    const timeout = setTimeout(() => {
      try { client.destroy(); } catch {}
      resolve(foundEmails);
    }, 15000);

    let client: any;
    try {
      client = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
    } catch {
      clearTimeout(timeout);
      return resolve(foundEmails);
    }

    let step = 0;
    let buffer = "";
    let currentTargetIdx = 0;
    let tagNum = 1;
    let currentCheckingId = "";

    function nextTag() { return `T${tagNum++}`; }

    function processNextTarget() {
      if (currentTargetIdx >= leadTargets.length) {
        const t = nextTag();
        try { client.write(`${t} LOGOUT\r\n`); } catch {}
        clearTimeout(timeout);
        resolve(foundEmails);
        return;
      }
      const target = leadTargets[currentTargetIdx];
      const t = nextTag();
      try {
        client.write(`${t} SEARCH FROM "${target.email}"\r\n`);
        step = 3;
        buffer = "";
      } catch {
        clearTimeout(timeout);
        resolve(foundEmails);
      }
    }

    client.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      buffer += text;

      if (step === 0 && buffer.includes("* OK")) {
        buffer = "";
        step = 1;
        const t = nextTag();
        try { client.write(`${t} LOGIN ${GMAIL_USER} ${GMAIL_APP_PASS}\r\n`); } catch {}
      } else if (step === 1 && (buffer.includes("T1 OK") || buffer.includes("OK LOGIN") || buffer.includes("OK [CAPABILITY"))) {
        buffer = "";
        step = 2;
        const t = nextTag();
        try { client.write(`${t} SELECT INBOX\r\n`); } catch {}
      } else if (step === 2 && (buffer.includes("OK [READ") || buffer.includes("OK SELECT"))) {
        buffer = "";
        processNextTarget();
      } else if (step === 3 && buffer.includes(`T${tagNum - 1} OK`)) {
        // Parse search result
        const target = leadTargets[currentTargetIdx];
        const searchLine = buffer.match(/\* SEARCH\s+(.*)/);
        const rawIds = searchLine && searchLine[1] ? searchLine[1].trim().split(/\s+/).filter(Boolean) : [];

        if (rawIds.length === 0) {
          buffer = "";
          currentTargetIdx++;
          processNextTarget();
        } else {
          // Fetch INTERNALDATE of the latest message for this sender
          const lastId = rawIds[rawIds.length - 1];
          currentCheckingId = lastId;
          buffer = "";
          step = 4;
          const t = nextTag();
          try { client.write(`${t} FETCH ${lastId} (INTERNALDATE)\r\n`); } catch {
            currentTargetIdx++;
            processNextTarget();
          }
        }
      } else if (step === 4 && buffer.includes(`T${tagNum - 1} OK`)) {
        const target = leadTargets[currentTargetIdx];
        const dateMatch = buffer.match(/INTERNALDATE "([^"]+)"/i);
        if (dateMatch) {
          const emailTime = new Date(dateMatch[1]).getTime();
          // STRICT CHECK: The reply MUST be received AFTER the lead was imported / outreach started
          if (!isNaN(emailTime) && emailTime >= target.minTimestampMs) {
            foundEmails.add(target.email);
          }
        }
        buffer = "";
        currentTargetIdx++;
        processNextTarget();
      }
    });

    client.on("error", () => {
      clearTimeout(timeout);
      try { client.destroy(); } catch {}
      resolve(foundEmails);
    });

    client.on("close", () => {
      clearTimeout(timeout);
      resolve(foundEmails);
    });
  });
}



// ── Email Templates ────────────────────────────────────────────────────────
function meetingNowHtml(meetingTime: string, zoomJoinUrl?: string) {
  const zoomBtn = zoomJoinUrl
    ? `
    <div style="margin: 25px 0; text-align: center;">
      <a href="${zoomJoinUrl}" style="background-color: #dc2626; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(220,38,38,0.3);">
        🔴 Click Here to Join Zoom Meeting NOW
      </a>
      <p style="margin-top: 8px; font-size: 12px; color: #64748b;">Direct Link: <a href="${zoomJoinUrl}" style="color: #dc2626;">${zoomJoinUrl}</a></p>
    </div>`
    : `
    <div style="margin: 25px 0; text-align: center;">
      <a href="https://zoom.us/j/5539578967" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        📹 Join Zoom Meeting Room
      </a>
    </div>`;

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;background:#fff;border-radius:12px">
    <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:24px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:26px">🔴 Meeting Starting NOW!</h1>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.7">
      <h2 style="color:#1e293b">Your meeting is happening RIGHT NOW</h2>
      <p>The meeting scheduled for <strong>${meetingTime}</strong> is starting now.</p>
      <p>Please join immediately and be prepared for your sales discussion.</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;margin:20px 0;border-radius:4px">
        <strong style="color:#dc2626">⏰ Meeting Time: ${meetingTime}</strong>
      </div>
      ${zoomBtn}
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-radius:0 0 8px 8px">
      © ${new Date().getFullYear()} Teals CRM. All rights reserved.
    </div>
  </div>`;
}

function reminder1hHtml(meetingTime: string, durationText: string = "1 hour", zoomJoinUrl?: string) {
  const isOneHour = durationText.toLowerCase().includes("1 hour") || durationText.toLowerCase().includes("60");
  const displayDuration = isOneHour ? "1 Hour" : durationText;

  const zoomBtn = zoomJoinUrl
    ? `
    <div style="margin: 25px 0; text-align: center;">
      <a href="${zoomJoinUrl}" style="background-color: #d97706; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        📹 Join Zoom Meeting Room
      </a>
      <p style="margin-top: 8px; font-size: 12px; color: #64748b;">Direct Link: <a href="${zoomJoinUrl}" style="color: #d97706;">${zoomJoinUrl}</a></p>
    </div>`
    : `
    <div style="margin: 25px 0; text-align: center;">
      <a href="https://zoom.us/wc/join/5539578967" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        📹 Join Zoom Meeting Room
      </a>
    </div>`;

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;background:#fff;border-radius:12px">
    <div style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:24px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:26px">⏰ Meeting Starts in ${displayDuration}!</h1>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.7">
      <h2 style="color:#1e293b">Your meeting starts in ${durationText}</h2>
      <p>This is a reminder that your sales meeting is scheduled at <strong>${meetingTime}</strong> — just ${durationText} away.</p>
      <p>Please prepare your notes and be ready on time.</p>
      ${zoomBtn}
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-radius:0 0 8px 8px">
      © ${new Date().getFullYear()} Teals CRM. All rights reserved.
    </div>
  </div>`;
}

function reminder24hHtml(meetingDate: string, meetingTime: string, zoomJoinUrl?: string) {
  const zoomBtn = zoomJoinUrl
    ? `
    <div style="margin: 25px 0; text-align: center;">
      <a href="${zoomJoinUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        📹 Join Zoom Meeting Room
      </a>
      <p style="margin-top: 8px; font-size: 12px; color: #64748b;">Direct Link: <a href="${zoomJoinUrl}" style="color: #4f46e5;">${zoomJoinUrl}</a></p>
    </div>`
    : `
    <div style="margin: 25px 0; text-align: center;">
      <a href="https://zoom.us/wc/join/5539578967" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        📹 Join Zoom Meeting Room
      </a>
    </div>`;

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;background:#fff;border-radius:12px">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:26px">📅 Meeting Tomorrow!</h1>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.7">
      <h2 style="color:#1e293b">Your meeting is tomorrow</h2>
      <p>Reminder: your sales meeting is on <strong>${meetingDate}</strong> at <strong>${meetingTime}</strong>.</p>
      <p>Please review your materials and be prepared for the discussion.</p>
      ${zoomBtn}
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-radius:0 0 8px 8px">
      © ${new Date().getFullYear()} Teals CRM. All rights reserved.
    </div>
  </div>`;
}

function reminder5mHtml(meetingTime: string, zoomJoinUrl?: string) {
  const zoomBtn = zoomJoinUrl
    ? `
    <div style="margin: 25px 0; text-align: center;">
      <a href="${zoomJoinUrl}" style="background-color: #d97706; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        ⏳ Click Here to Join Zoom Meeting in 5 Mins
      </a>
      <p style="margin-top: 8px; font-size: 12px; color: #64748b;">Direct Link: <a href="${zoomJoinUrl}" style="color: #d97706;">${zoomJoinUrl}</a></p>
    </div>`
    : `
    <div style="margin: 25px 0; text-align: center;">
      <a href="https://zoom.us/wc/join/5539578967" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        📹 Join Zoom Meeting Room
      </a>
    </div>`;

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;background:#fff;border-radius:12px">
    <div style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:24px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:26px">⏳ Meeting in 5 Minutes!</h1>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.7">
      <h2 style="color:#1e293b">Your meeting starts in 5 minutes</h2>
      <p>This is a quick reminder that your sales meeting scheduled at <strong>${meetingTime}</strong> starts in 5 minutes.</p>
      <p>Please click the link below to enter the Zoom meeting room on time.</p>
      ${zoomBtn}
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-radius:0 0 8px 8px">
      © ${new Date().getFullYear()} Teals CRM. All rights reserved.
    </div>
  </div>`;
}

// ── Main handler ───────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const now = new Date();
    const nowMs = now.getTime();

    let count = 0;
    const results: string[] = [];

    // ── 1. MEETING REMINDERS (NOW, 5M, 1H, 24H) ──────────────────────────────────
    const { data: meetings, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("completed", false);

    if (error) {
      console.error("Fetch meetings error:", error);
    }

    if (meetings && meetings.length > 0) {
      for (const meeting of meetings) {
        if (!meeting.scheduled_time) continue;
        if (meeting.title && meeting.title.includes("[CANCELLED]")) continue;

        const meetingTime = new Date(meeting.scheduled_time);
        const meetingStartMs = meetingTime.getTime();
        if (isNaN(meetingStartMs)) continue;

        const timeUntilMeetingMs = meetingStartMs - nowMs;
        const elapsedPostStartMs = nowMs - meetingStartMs;

        // Strip ZOOM suffix from title to get clean title
        const cleanTitle = meeting.title ? meeting.title.split("|| ZOOM:")[0].trim() : "";

        // Extract Zoom join URL from title if present, default to Web Client join link
        let storedZoomUrl = "https://zoom.us/wc/join/5539578967";
        if (meeting.title && meeting.title.includes("|| ZOOM:")) {
          const extracted = meeting.title.split("|| ZOOM:")[1]?.trim();
          if (extracted) storedZoomUrl = extracted;
        }

        // Format time & date — ALWAYS use title-extracted time (browser local time, already correct)
        // Never rely on server toLocaleTimeString() which uses UTC and shows wrong AM/PM
        let formattedTime = "";
        if (cleanTitle && cleanTitle.includes("@ ")) {
          formattedTime = cleanTitle.split("@ ")[1]?.trim() || "";
        }
        if (!formattedTime) {
          // Fallback: format from ISO in PKT
          formattedTime = meetingTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Karachi",
          });
        }

        // For the date, extract from title (e.g. "on 2026-08-19 @") or format in Asia/Karachi PKT (never UTC!)
        let formattedDate = "";
        if (cleanTitle.includes(" on ") && cleanTitle.includes(" @ ")) {
          const datePart = cleanTitle.split(" on ")[1]?.split(" @ ")[0]?.trim();
          if (datePart && datePart.includes("-")) {
            const [y, m, d] = datePart.split("-").map(Number);
            if (y && m && d) {
              formattedDate = new Date(y, m - 1, d).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
            }
          }
        }
        if (!formattedDate) {
          formattedDate = meetingTime.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "Asia/Karachi",
          });
        }

        // Extract client email
        let leadEmail = "";
        if (cleanTitle) {
          const match = cleanTitle.match(/\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/);
          if (match && match[1]) leadEmail = match[1].trim();
        }
        if (!leadEmail && cleanTitle) {
          const anyEmailMatch = cleanTitle.match(/[\w.-]+@[\w.-]+\.\w+/);
          if (anyEmailMatch) leadEmail = anyEmailMatch[0].trim();
        }
        if (!leadEmail && meeting.lead_id) {
          try {
            const { data: l } = await supabase.from("leads").select("email").eq("id", meeting.lead_id).maybeSingle();
            if (l?.email) leadEmail = l.email.trim();
          } catch {}
        }
        const agentEmail = meeting.agent_email || "garryamelia6265@gmail.com";
        const recipients = Array.from(new Set([leadEmail, agentEmail].filter(Boolean)));

        if (recipients.length === 0) continue;

        // ── Timezone-aware time formatting ──
        // Client sees the time they selected (stored in title = their local time)
        // Agent (in Pakistan PKT = UTC+5) sees the converted Pakistan time
        const agentFormattedTime = meetingTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Karachi", // PKT = UTC+5
        });
        const agentFormattedDate = meetingTime.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "Asia/Karachi",
        });
        // Client time = what they selected (extracted from title already correct)
        const clientFormattedTime = formattedTime;
        const clientFormattedDate = formattedDate;

        // Helper: send separate email to client and agent with their respective times
        async function sendToRecipients(
          subjectFn: (t: string) => string,
          htmlFn: (t: string, z: string) => string,
          zoom: string
        ) {
          const clientEmail = leadEmail;
          if (clientEmail) {
            await sendEmail([clientEmail], subjectFn(clientFormattedTime), htmlFn(clientFormattedTime, zoom));
          }
          if (agentEmail) {
            await sendEmail([agentEmail], subjectFn(agentFormattedTime) + " [PKT]", htmlFn(agentFormattedTime, zoom));
          }
        }


        // ── Stage 4: Meeting Time Has Arrived (Starting NOW) ──
        // Triggered at start time and kept active for 10 mins post-start on Dashboard & Cards
        if (nowMs >= meetingStartMs) {
          // If meeting is already older than 10 minutes post-start, silently mark completed and do NOT send email!
          if (elapsedPostStartMs > 10 * 60 * 1000) {
            await supabase.from("meetings").update({ completed: true }).eq("id", meeting.id);
            continue;
          }

          const isNowEmailSent = meeting.title && meeting.title.includes("|| NOW_SENT");

          if (!isNowEmailSent) {
            // Atomically mark NOW_SENT in title and set reminder flags so no other cron can duplicate
            const newTitle = `${meeting.title || ""} || NOW_SENT`;
            const { data: claimedNow } = await supabase
              .from("meetings")
              .update({
                title: newTitle,
                reminder_5m_sent: true,
                reminder_1h_sent: true,
                reminder_24h_sent: true,
              })
              .eq("id", meeting.id)
              .not("title", "ilike", "%|| NOW_SENT%")
              .select("id");

            if (claimedNow && claimedNow.length > 0) {
              await sendToRecipients(
                (t) => `🔴 MEETING STARTING NOW — ${t}`,
                (t, z) => meetingNowHtml(t, z),
                storedZoomUrl
              );

              await supabase.from("emails_sent").insert({
                lead_id: meeting.lead_id || null,
                lead_email: leadEmail || agentEmail,
                subject: `🔴 MEETING STARTING NOW — ${clientFormattedTime}`,
                sequence_type: "starting_now",
                status: "sent",
                sent_at: now.toISOString(),
              });

              count++;
              results.push(`NOW notification sent to: ${recipients.join(", ")} at ${clientFormattedTime} / PKT ${agentFormattedTime}`);
            }
          }

          // ALWAYS continue so no older reminder sequence can run for past/started meetings
          continue;
        }

        // ── Stage 3: 5-Minute Reminder ──
        // Fires when remaining time is <= 5 minutes (and > 0)
        const FIVE_MIN_MS = 5 * 60 * 1000;
        if (!meeting.reminder_5m_sent && timeUntilMeetingMs <= FIVE_MIN_MS && timeUntilMeetingMs > 0) {
          const { data: claimed5m } = await supabase
            .from("meetings")
            .update({ reminder_5m_sent: true, reminder_1h_sent: true, reminder_24h_sent: true })
            .eq("id", meeting.id)
            .eq("reminder_5m_sent", false)
            .select("id");

          if (claimed5m && claimed5m.length > 0) {
            await sendToRecipients(
              (t) => `⏳ Meeting Starts in 5 Minutes — ${t}`,
              (t, z) => reminder5mHtml(t, z),
              storedZoomUrl
            );

            await supabase.from("emails_sent").insert({
              lead_id: meeting.lead_id || null,
              lead_email: leadEmail || agentEmail,
              subject: `⏳ Meeting Starts in 5 Minutes — ${clientFormattedTime}`,
              sequence_type: "meeting_reminder_5m",
              status: "sent",
              sent_at: now.toISOString(),
            });

            count++;
            results.push(`5m reminder → ${recipients.join(", ")} at client:${clientFormattedTime} / PKT:${agentFormattedTime}`);
          }
          continue;
        }

        // ── Stage 2: 1-Hour Reminder ──
        // STRICT EXACT WINDOW: fires ONLY when remaining time is <= 60 minutes (never fires at 61 min / 10:49)
        const ONE_HOUR_MS = 60 * 60 * 1000;
        if (!meeting.reminder_1h_sent && timeUntilMeetingMs <= ONE_HOUR_MS && timeUntilMeetingMs > FIVE_MIN_MS) {
          const { data: claimed1h } = await supabase
            .from("meetings")
            .update({ reminder_1h_sent: true, reminder_24h_sent: true })
            .eq("id", meeting.id)
            .eq("reminder_1h_sent", false)
            .select("id");

          if (claimed1h && claimed1h.length > 0) {
            const minsUntil = Math.max(1, Math.round(timeUntilMeetingMs / (60 * 1000)));
            const durationLabel = (minsUntil >= 50 && minsUntil <= 60) ? "1 Hour" : `${minsUntil} Minutes`;
            const durationText = (minsUntil >= 50 && minsUntil <= 60) ? "1 hour" : `${minsUntil} minutes`;

            await sendToRecipients(
              (t) => `⏰ Reminder: Your Sales Meeting Starts in ${durationLabel} — ${t}`,
              (t, z) => reminder1hHtml(t, durationText, z),
              storedZoomUrl
            );

            await supabase.from("emails_sent").insert({
              lead_id: meeting.lead_id || null,
              lead_email: leadEmail || agentEmail,
              subject: `⏰ Reminder: Your Sales Meeting Starts in ${durationLabel} — ${clientFormattedTime}`,
              sequence_type: "meeting_reminder_1h",
              status: "sent",
              sent_at: now.toISOString(),
            });

            count++;
            results.push(`1h reminder → ${recipients.join(", ")} at client:${clientFormattedTime} / PKT:${agentFormattedTime}`);
          }
          continue;
        }

        // ── Stage 1: 24-Hour Reminder ──
        // STRICT EXACT WINDOW: fires ONLY when remaining time is <= 24 hours (never fires at 24h 1min / 10:49)
        const TWENTY_FOUR_HOUR_MS = 24 * 60 * 60 * 1000;
        if (!meeting.reminder_24h_sent && timeUntilMeetingMs <= TWENTY_FOUR_HOUR_MS && timeUntilMeetingMs > ONE_HOUR_MS) {
          const bookingTimeMs = meeting.created_at ? new Date(meeting.created_at).getTime() : nowMs;
          const initialGapMs = meetingStartMs - bookingTimeMs;

          if (initialGapMs >= 23.5 * 60 * 60 * 1000) {
            const { data: claimed24h } = await supabase
              .from("meetings")
              .update({ reminder_24h_sent: true })
              .eq("id", meeting.id)
              .eq("reminder_24h_sent", false)
              .select("id");

            if (claimed24h && claimed24h.length > 0) {
              // Client gets their date+time, Agent gets PKT date+time
              if (leadEmail) {
                await sendEmail([leadEmail], `📅 Meeting Tomorrow — ${clientFormattedDate} at ${clientFormattedTime}`, reminder24hHtml(clientFormattedDate, clientFormattedTime, storedZoomUrl));
              }
              if (agentEmail) {
                await sendEmail([agentEmail], `📅 Meeting Tomorrow — ${agentFormattedDate} at ${agentFormattedTime} [PKT]`, reminder24hHtml(agentFormattedDate, agentFormattedTime, storedZoomUrl));
              }

              await supabase.from("emails_sent").insert({
                lead_id: meeting.lead_id || null,
                lead_email: leadEmail || agentEmail,
                subject: `📅 Meeting Tomorrow — ${clientFormattedDate} at ${clientFormattedTime}`,
                sequence_type: "meeting_reminder_24h",
                status: "sent",
                sent_at: now.toISOString(),
              });

              count++;
              results.push(`24h reminder → ${recipients.join(", ")} at client:${clientFormattedTime} / PKT:${agentFormattedTime}`);
            }
          } else {
            // Booked within 24 hours (Case A or B) -> mark 24h sent SILENTLY without sending 24h email
            await supabase
              .from("meetings")
              .update({ reminder_24h_sent: true })
              .eq("id", meeting.id)
              .eq("reminder_24h_sent", false);
          }
          continue;
        }
      }
    }

    // ── 2. AUTOMATIC GMAIL REPLIES CHECKER (IMAP) ────────────────────────────
    // Only check leads who have actually received a CRM email (in emails_sent table)
    const { data: sentEmailLeads } = await supabase
      .from("emails_sent")
      .select("lead_email, sent_at")
      .neq("sequence_type", "reply");

    const sentEmailMap = new Map<string, number>();
    (sentEmailLeads || []).forEach((r: any) => {
      const em = (r.lead_email || "").toLowerCase().trim();
      const sTime = r.sent_at ? new Date(r.sent_at).getTime() : 0;
      if (em) {
        const prev = sentEmailMap.get(em) || 0;
        if (sTime > prev) sentEmailMap.set(em, sTime);
      }
    });

    const { data: activeLeads } = await supabase
      .from("leads")
      .select("id, name, email, status, created_at")
      .neq("status", "meeting")
      .neq("status", "booked")
      .neq("status", "won")
      .neq("status", "lost")
      .neq("status", "replied");

    // Only check leads who CRM has emailed
    const leadsToCheck = (activeLeads || []).filter(
      (l: any) => l.email && sentEmailMap.has(l.email.toLowerCase().trim())
    );

    if (leadsToCheck.length > 0) {
      const leadTargets = leadsToCheck.map((l: any) => {
        const em = l.email.toLowerCase().trim();
        const sentTime = sentEmailMap.get(em) || new Date(l.created_at || 0).getTime();
        return {
          email: em,
          minTimestampMs: sentTime,
        };
      });

      const repliedEmailsSet = await checkGmailRepliesForLeads(leadTargets);

      if (repliedEmailsSet.size > 0) {
        for (const lead of leadsToCheck) {
          if (lead.email && repliedEmailsSet.has(lead.email.trim().toLowerCase())) {
            await supabase.from("leads").update({ status: "replied" }).eq("id", lead.id);

            await supabase.from("emails_sent").insert({
              lead_id: lead.id,
              lead_email: lead.email,
              subject: "Direct Email Reply Received",
              sequence_type: "reply",
              status: "replied",
              sent_at: now.toISOString(),
            });

            count++;
            results.push(`[Auto-Detect] ${lead.email} automatically marked as REPLIED via Gmail IMAP!`);
          }
        }
      }
    }

    // ── 3. AUTOMATIC LEAD FOLLOW-UPS (24h, 48h, 72h ONLY) ────────────────────
    const { data: pendingLeads } = await supabase
      .from("leads")
      .select("id, name, email, status, created_at, assigned_agent_name")
      .neq("status", "meeting")
      .neq("status", "booked")
      .neq("status", "won")
      .neq("status", "lost")
      .neq("status", "replied");

    if (pendingLeads && pendingLeads.length > 0) {
      for (const lead of pendingLeads) {
        if (!lead.email || !lead.email.includes("@")) continue;

        const createdAt = new Date(lead.created_at || now.toISOString());
        const hoursSinceImport = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        // Auto-mark lead as "no_answer" after 24 hours if still in "new" status (un-replied & un-booked)
        if (hoursSinceImport >= 24 && lead.status === "new") {
          await supabase.from("leads").update({ status: "no_answer" }).eq("id", lead.id);
          results.push(`[Auto-Status] ${lead.email} automatically marked as NO ANSWER (24h passed)`);
        }

        const { data: sentEmails } = await supabase
          .from("emails_sent")
          .select("sequence_type")
          .eq("lead_id", lead.id);

        const sentTypes = new Set((sentEmails || []).map((e) => e.sequence_type));

        // Stage 1: Follow-up 1 (24 Hours)
        if (hoursSinceImport >= 24 && !sentTypes.has("followup_24h")) {
          const mailOptions = {
            from: `"Teals CRM" <${GMAIL_USER}>`,
            to: lead.email,
            subject: "Quick Follow-up: Checking in on your inquiry",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
                <div style="padding: 24px; color: #334155; line-height: 1.6;">
                  <h2 style="color: #1e293b; margin-top: 0;">Checking In</h2>
                  <p>Hi ${lead.name || "there"},</p>
                  <p>We are following up on our previous message to see if you have any questions or if you'd like to schedule a quick discussion with our team.</p>
                  <div style="margin: 25px 0; text-align: center;">
                    <a href="https://salesflow-ai-main.vercel.app/book" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                      Schedule a Meeting
                    </a>
                  </div>
                </div>
              </div>
            `,
          };
          await transporter.sendMail(mailOptions);
          await supabase.from("emails_sent").insert({
            lead_id: lead.id,
            lead_email: lead.email,
            subject: "Quick Follow-up: Checking in on your inquiry",
            sequence_type: "followup_24h",
            status: "sent",
            sent_at: now.toISOString(),
          });
          count++;
          results.push(`24h Lead Follow-up sent to ${lead.email}`);
        }
        // Stage 2: Follow-up 2 (48 Hours)
        else if (hoursSinceImport >= 48 && !sentTypes.has("followup_48h")) {
          const mailOptions = {
            from: `"Teals CRM" <${GMAIL_USER}>`,
            to: lead.email,
            subject: "Following up on our previous note — Teals CRM",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
                <div style="padding: 24px; color: #334155; line-height: 1.6;">
                  <h2 style="color: #1e293b; margin-top: 0;">Following Up</h2>
                  <p>Hi ${lead.name || "there"},</p>
                  <p>We wanted to send one more quick note regarding your inquiry. Our team is ready to help you streamline your sales pipeline.</p>
                  <div style="margin: 25px 0; text-align: center;">
                    <a href="https://salesflow-ai-main.vercel.app/book" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                      Schedule a Meeting Now
                    </a>
                  </div>
                </div>
              </div>
            `,
          };
          await transporter.sendMail(mailOptions);
          await supabase.from("emails_sent").insert({
            lead_id: lead.id,
            lead_email: lead.email,
            subject: "Following up on our previous note — Teals CRM",
            sequence_type: "followup_48h",
            status: "sent",
            sent_at: now.toISOString(),
          });
          count++;
          results.push(`48h Lead Follow-up sent to ${lead.email}`);
        }
        // Stage 3: Follow-up 3 (72 Hours)
        else if (hoursSinceImport >= 72 && !sentTypes.has("followup_72h")) {
          const mailOptions = {
            from: `"Teals CRM" <${GMAIL_USER}>`,
            to: lead.email,
            subject: "10-minute slot open for a live sales demo",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
                <div style="padding: 24px; color: #334155; line-height: 1.6;">
                  <h2 style="color: #1e293b; margin-top: 0;">Live Demo Slot</h2>
                  <p>Hi ${lead.name || "there"},</p>
                  <p>We have a 10-minute slot open this week for a live walkthrough of our automated CRM workspace.</p>
                  <div style="margin: 25px 0; text-align: center;">
                    <a href="https://salesflow-ai-main.vercel.app/book" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                      Reserve Your 10-Min Demo
                    </a>
                  </div>
                </div>
              </div>
            `,
          };
          await transporter.sendMail(mailOptions);
          await supabase.from("emails_sent").insert({
            lead_id: lead.id,
            lead_email: lead.email,
            subject: "10-minute slot open for a live sales demo",
            sequence_type: "followup_72h",
            status: "sent",
            sent_at: now.toISOString(),
          });
          count++;
          results.push(`72h Lead Follow-up sent to ${lead.email}`);
        }
      }
    }

    return res.status(200).json({ success: true, processed: count, results });
  } catch (err: any) {
    console.error("check-reminders error:", err);
    return res.status(500).json({ success: false, error: err?.message });
  }
}
