import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// ── Supabase credentials (same as app) ────────────────────────────────────
const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Nodemailer transporter ─────────────────────────────────────────────────
const GMAIL_USER = "garryamelia6265@gmail.com";
const GMAIL_APP_PASS = "mchfrzwrftifihnl";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
});

async function sendEmail(to: string | string[], subject: string, html: string) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return;
  await transporter.sendMail({
    from: `"Nexa CRM Meetings" <${GMAIL_USER}>`,
    to: recipients.join(", "),
    subject,
    html,
  });
}

// ── Email Templates ────────────────────────────────────────────────────────
function meetingNowHtml(meetingTime: string) {
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
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-radius:0 0 8px 8px">
      © ${new Date().getFullYear()} Nexa CRM. All rights reserved.
    </div>
  </div>`;
}

function reminder1hHtml(meetingTime: string) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;background:#fff;border-radius:12px">
    <div style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:24px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:26px">⏰ Meeting in 1 Hour!</h1>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.7">
      <h2 style="color:#1e293b">Your meeting starts in 1 hour</h2>
      <p>This is a reminder that your sales meeting is scheduled at <strong>${meetingTime}</strong> — just 1 hour away.</p>
      <p>Please prepare your notes and be ready on time.</p>
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-radius:0 0 8px 8px">
      © ${new Date().getFullYear()} Nexa CRM. All rights reserved.
    </div>
  </div>`;
}

function reminder24hHtml(meetingDate: string, meetingTime: string) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;background:#fff;border-radius:12px">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;text-align:center;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:26px">📅 Meeting Tomorrow!</h1>
    </div>
    <div style="padding:28px;color:#334155;line-height:1.7">
      <h2 style="color:#1e293b">Your meeting is tomorrow</h2>
      <p>Reminder: your sales meeting is on <strong>${meetingDate}</strong> at <strong>${meetingTime}</strong>.</p>
      <p>Please review your materials and be prepared for the discussion.</p>
    </div>
    <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-radius:0 0 8px 8px">
      © ${new Date().getFullYear()} Nexa CRM. All rights reserved.
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
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: meetings, error } = await supabase
      .from("meetings")
      .select("id, lead_id, scheduled_time, reminder_24h_sent, reminder_1h_sent, completed")
      .eq("completed", false);

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!meetings || meetings.length === 0) {
      return res.status(200).json({ success: true, processed: 0, message: "No pending meetings" });
    }

    let count = 0;
    const results: string[] = [];

    for (const meeting of meetings) {
      const meetingTime = new Date(meeting.scheduled_time);
      const formattedTime = meetingTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Karachi",
      });
      const formattedDate = meetingTime.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Karachi",
      });

      // Fetch lead info
      let leadEmail = "";
      let agentEmail = GMAIL_USER;

      if (meeting.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("email, assigned_agent_name")
          .eq("id", meeting.lead_id)
          .single();

        if (lead?.email) {
          leadEmail = lead.email;
          agentEmail = lead.assigned_agent_name || GMAIL_USER;
        }
      }

      if (!leadEmail) {
        results.push(`Meeting ${meeting.id}: no lead email, skipped`);
        continue;
      }

      const recipients = [leadEmail, agentEmail].filter(
        (e, i, arr) => e && arr.indexOf(e) === i
      );

      // Stage 3: Meeting Starting NOW (mark completed so it only fires once)
      if (!meeting.completed && now.getTime() >= meetingTime.getTime()) {
        await sendEmail(recipients, `🔴 Your Meeting is Starting NOW — ${formattedTime}`, meetingNowHtml(formattedTime));
        await supabase.from("meetings").update({ completed: true }).eq("id", meeting.id);
        count++;
        results.push(`NOW email → ${recipients.join(", ")} at ${formattedTime}`);
        continue;
      }

      // Stage 2: 1-Hour Reminder
      if (!meeting.reminder_1h_sent && meetingTime.getTime() <= oneHourLater.getTime() && meetingTime.getTime() > now.getTime()) {
        await sendEmail(recipients, `⏰ Your Meeting Starts in 1 Hour — ${formattedTime}`, reminder1hHtml(formattedTime));
        await supabase.from("meetings").update({ reminder_1h_sent: true }).eq("id", meeting.id);
        count++;
        results.push(`1h reminder → ${recipients.join(", ")} at ${formattedTime}`);
      }

      // Stage 1: 24-Hour Reminder
      if (!meeting.reminder_24h_sent && meetingTime.getTime() <= oneDayLater.getTime() && meetingTime.getTime() > oneHourLater.getTime()) {
        await sendEmail(recipients, `📅 Meeting Tomorrow — ${formattedDate} at ${formattedTime}`, reminder24hHtml(formattedDate, formattedTime));
        await supabase.from("meetings").update({ reminder_24h_sent: true }).eq("id", meeting.id);
        count++;
        results.push(`24h reminder → ${recipients.join(", ")} at ${formattedTime}`);
      }
    }

    return res.status(200).json({ success: true, processed: count, results });
  } catch (err: any) {
    console.error("check-reminders error:", err);
    return res.status(500).json({ success: false, error: err?.message });
  }
}
