import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import tls from "tls";

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
    from: `"Teals CRM Meetings" <${GMAIL_USER}>`,
    to: recipients.join(", "),
    subject,
    html,
  });
}

// ── Automatic Gmail IMAP Reply Checker ─────────────────────────────────────
function checkGmailRepliesForLeads(leadEmails: string[]): Promise<Set<string>> {
  return new Promise((resolve) => {
    const foundEmails = new Set<string>();
    if (!leadEmails || leadEmails.length === 0) return resolve(foundEmails);

    const targets = new Set(leadEmails.map((e) => e.trim().toLowerCase()));
    const timeout = setTimeout(() => resolve(foundEmails), 7000);

    try {
      const client = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false }, () => {
        client.write(`A1 LOGIN ${GMAIL_USER} ${GMAIL_APP_PASS}\r\n`);
      });

      let step = 0;
      let buffer = "";

      client.on("data", (chunk) => {
        buffer += chunk.toString();

        if (step === 0 && buffer.includes("A1 OK")) {
          buffer = "";
          step = 1;
          client.write("A2 SELECT INBOX\r\n");
        } else if (step === 1 && buffer.includes("A2 OK")) {
          buffer = "";
          step = 2;
          client.write("A3 FETCH *:-35 (BODY[HEADER.FIELDS (FROM)])\r\n");
        } else if (step === 2 && buffer.includes("A3 OK")) {
          const fromLines = buffer.match(/From:[^\r\n]+/gi) || [];
          for (const line of fromLines) {
            const emailMatch = line.match(/<([^>]+)>/) || line.match(/From:\s*(\S+@\S+)/i);
            if (emailMatch && emailMatch[1]) {
              const email = emailMatch[1].trim().toLowerCase();
              if (targets.has(email) && email !== GMAIL_USER.toLowerCase()) {
                foundEmails.add(email);
              }
            }
          }
          client.write("A4 LOGOUT\r\n");
          client.end();
          clearTimeout(timeout);
          resolve(foundEmails);
        }
      });

      client.on("error", () => {
        clearTimeout(timeout);
        resolve(foundEmails);
      });
    } catch {
      clearTimeout(timeout);
      resolve(foundEmails);
    }
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
      © ${new Date().getFullYear()} Teals CRM. All rights reserved.
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
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    let count = 0;
    const results: string[] = [];

    // ── 1. MEETING REMINDERS (NOW, 1H, 24H) ──────────────────────────────────
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
        const meetingTime = new Date(meeting.scheduled_time);

        // Format time & date in Asia/Karachi timezone (+05:00) or extract exact label from title
        let formattedTime = "";
        if (meeting.title && meeting.title.includes("@ ")) {
          formattedTime = meeting.title.split("@ ")[1]?.trim() || "";
        }
        if (!formattedTime) {
          formattedTime = meetingTime.toLocaleTimeString("en-US", {
            timeZone: "Asia/Karachi",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
        const formattedDate = meetingTime.toLocaleDateString("en-US", {
          timeZone: "Asia/Karachi",
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        // Extract client email from meeting title using Regex
        let leadEmail = "";
        if (meeting.title) {
          const match = meeting.title.match(/\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/);
          if (match && match[1]) leadEmail = match[1].trim();
        }
        const agentEmail = meeting.agent_email || "adrianajames267263@gmail.com";
        const recipients = Array.from(new Set([leadEmail, agentEmail].filter(Boolean)));

        if (recipients.length === 0) continue;

        // Stage 3: Meeting Time Has Arrived (Starting NOW)
        // ONLY trigger when current time `now` reaches or passes meeting time
        if (now.getTime() >= meetingTime.getTime()) {
          // ATOMIC CLAIM: Update completed = true BEFORE sending email!
          // If another request already claimed it, claimed array will be empty and we stop immediately!
          const { data: claimed } = await supabase
            .from("meetings")
            .update({ completed: true })
            .eq("id", meeting.id)
            .eq("completed", false)
            .select("id");

          if (!claimed || claimed.length === 0) {
            // Already sent by another thread! Skip!
            continue;
          }

          // Send EXACTLY 1 email to client and 1 email to agent
          if (leadEmail) {
            await sendEmail([leadEmail], `🔴 MEETING STARTING NOW — ${formattedTime}`, meetingNowHtml(formattedTime));
          }
          if (agentEmail && agentEmail.toLowerCase() !== leadEmail.toLowerCase()) {
            await sendEmail([agentEmail], `🔴 MEETING STARTING NOW — ${formattedTime}`, meetingNowHtml(formattedTime));
          }

          await supabase.from("emails_sent").insert({
            lead_id: meeting.lead_id || "",
            lead_email: leadEmail || agentEmail,
            subject: `🔴 MEETING STARTING NOW — ${formattedTime}`,
            sequence_type: "starting_now",
            status: "sent",
            sent_at: now.toISOString(),
          });

          count++;
          results.push(`NOW notification sent ONCE → Client: ${leadEmail} | Agent: ${agentEmail} at ${formattedTime}`);
          continue;
        }


        // Stage 2: 1-Hour Reminder
        if (!meeting.reminder_1h_sent && meetingTime.getTime() <= oneHourLater.getTime() && meetingTime.getTime() > (now.getTime() + 2 * 60 * 1000)) {
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
    }

    // ── 2. AUTOMATIC GMAIL REPLIES CHECKER (IMAP) ────────────────────────────
    const { data: activeLeads } = await supabase
      .from("leads")
      .select("id, name, email, status")
      .neq("status", "meeting")
      .neq("status", "booked")
      .neq("status", "won")
      .neq("status", "lost")
      .neq("status", "replied");

    if (activeLeads && activeLeads.length > 0) {
      const activeEmails = activeLeads.map((l) => l.email).filter(Boolean);
      const repliedEmailsSet = await checkGmailRepliesForLeads(activeEmails);

      if (repliedEmailsSet.size > 0) {
        for (const lead of activeLeads) {
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

    // ── 3. AUTOMATIC LEAD FOLLOW-UPS (24h, 48h, 72h, 10d) ────────────────────
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
        // Stage 4: Follow-up 4 (10 Days / 240 Hours)
        else if (hoursSinceImport >= 240 && !sentTypes.has("followup_10d")) {
          const mailOptions = {
            from: `"Teals CRM" <${GMAIL_USER}>`,
            to: lead.email,
            subject: "Final Check-in: Should we close your inquiry?",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
                <div style="padding: 24px; color: #334155; line-height: 1.6;">
                  <h2 style="color: #1e293b; margin-top: 0;">Final Touchpoint</h2>
                  <p>Hi ${lead.name || "there"},</p>
                  <p>We haven't heard back from you, so we're assuming this isn't a priority right now and will close your file for now.</p>
                  <p>If you ever want to connect in the future, you can book a slot below anytime:</p>
                  <div style="margin: 25px 0; text-align: center;">
                    <a href="https://salesflow-ai-main.vercel.app/book" style="background-color: #64748b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                      Book Slot Anytime
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
            subject: "Final Check-in: Should we close your inquiry?",
            sequence_type: "followup_10d",
            status: "sent",
            sent_at: now.toISOString(),
          });
          count++;
          results.push(`10d Lead Follow-up sent to ${lead.email}`);
        }
      }
    }

    return res.status(200).json({ success: true, processed: count, results });
  } catch (err: any) {
    console.error("check-reminders error:", err);
    return res.status(500).json({ success: false, error: err?.message });
  }
}
