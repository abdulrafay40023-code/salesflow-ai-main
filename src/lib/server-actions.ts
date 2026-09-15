
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

import { createServerFn } from "@tanstack/react-start";
import {
  send1DayMeetingReminderEmail,
  send1HourMeetingReminderEmail,
  send5MinMeetingReminderEmail,
  sendBookingFormEmail,
  sendMeetingConfirmationEmail,
  sendMeetingStartedNowEmail,
  sendReminderEmail,
  sendWelcomeEmail,
  sendMeetingCancellationEmail,
} from "./email-service";
import { supabase } from "./supabase";
import { createZoomMeeting } from "./zoom-service";
import {
  VAPI_PRIVATE_KEY,
  VAPI_ASSISTANT_ID,
  VAPI_PHONE_NUMBER_ID,
  formatE164Phone,
} from "./vapi-client";

const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";

// Robust Spoken Email Normalizer (handles "at", "dot", spaces, and spoken punctuation)
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

/**
 * 1. Trigger Welcome Email
 */
export const triggerWelcomeEmailFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; leadId?: string; agentEmail?: string }) => data)
  .handler(async ({ data }) => {
    try {
      await sendWelcomeEmail({ toEmail: data.email, agentEmail: data.agentEmail });

      if (data.leadId) {
        await supabase.from("emails_sent").insert({
          lead_id: data.leadId,
          lead_email: data.email,
          subject: "Welcome to Teals CRM",
          sequence_type: "welcome",
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (err: any) {
      console.error("Welcome email server error:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * 2. Trigger 24-Hour Follow-up Reminder Email
 */
export const triggerReminderEmailFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; reminderNumber: number; leadId?: string }) => data)
  .handler(async ({ data }) => {
    try {
      await sendReminderEmail({
        toEmail: data.email,
        reminderNumber: data.reminderNumber,
      });

      if (data.leadId) {
        await supabase.from("emails_sent").insert({
          lead_id: data.leadId,
          lead_email: data.email,
          subject: `24h Follow-up Reminder #${data.reminderNumber}`,
          sequence_type: "reminder",
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (err: any) {
      console.error("Reminder email server error:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * 3. Send Booking Form Email (upon lead reply/intent)
 */
export const triggerBookingFormEmailFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; leadId?: string; agentEmail?: string; leadName?: string }) => data)
  .handler(async ({ data }) => {
    try {
      await sendBookingFormEmail({
        toEmail: data.email,
        agentEmail: data.agentEmail,
        leadName: data.leadName,
      });

      if (data.leadId) {
        await supabase.from("emails_sent").insert({
          lead_id: data.leadId,
          lead_email: data.email,
          subject: "Meeting Booking Link",
          sequence_type: "booking_link",
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        // Mark lead status as contacted / qualified
        await supabase.from("leads").update({ status: "qualified" }).eq("id", data.leadId);
      }
      return { success: true };
    } catch (err: any) {
      console.error("Booking form email server error:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * 4. Trigger Meeting Booking & Confirmation Emails
 */
export const confirmMeetingBookingFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      leadEmail: string;
      agentEmail?: string;
      date: string;
      time: string;
      rawTime?: string;
      scheduledIso?: string;
      leadId?: string;
      leadName?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      let leadId = data.leadId;
      const cleanLeadEmail = (data.leadEmail || "").trim().toLowerCase();
      let realAgentEmail = (data.agentEmail || "").trim();

      // 1. Fetch or verify lead
      if (!leadId && cleanLeadEmail) {
        const { data: foundLead } = await supabase
          .from("leads")
          .select("id, assigned_agent_name, agent")
          .ilike("email", cleanLeadEmail)
          .maybeSingle();

        if (foundLead) {
          leadId = foundLead.id;
          realAgentEmail = foundLead.assigned_agent_name || foundLead.agent || realAgentEmail;
        }
      }

      if (!realAgentEmail || realAgentEmail === "Unassigned" || !realAgentEmail.includes("@")) {
        realAgentEmail = "garryamelia6265@gmail.com";
      }

      // 2. Generate dynamic Zoom Meeting Link
      let zoomJoinUrl = "https://zoom.us/j/5539578967";
      try {
        const zoomRes = await createZoomMeeting({
          topic: `Sales Call with ${data.leadName || data.leadEmail}`,
          startTimeIso: data.scheduledIso,
          durationMinutes: 30,
        });
        if (zoomRes.success && zoomRes.joinUrl) {
          zoomJoinUrl = zoomRes.joinUrl;
        }
      } catch (e) {
        console.log("Zoom API fallback to default link");
      }

      // 3. Send initial confirmation email to BOTH Lead & Agent
      await sendMeetingConfirmationEmail({
        leadEmail: data.leadEmail,
        agentEmail: realAgentEmail,
        meetingDate: data.date,
        meetingTime: data.time,
      });

      // 4. Update lead status in Supabase to "booked"
      if (data.leadEmail) {
        await supabase
          .from("leads")
          .update({ status: "booked", assigned_agent_name: realAgentEmail })
          .eq("email", data.leadEmail.trim());
      }

      // 5. Log confirmation email in emails_sent
      await supabase.from("emails_sent").insert({
        lead_id: leadId || null,
        lead_email: data.leadEmail,
        subject: `Meeting Confirmed: ${data.date} at ${data.time}`,
        sequence_type: "meeting_confirmed",
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      // 6. Calculate exact scheduled ISO timestamp & short-notice reminder flags
      const now = new Date();
      let scheduledIso = data.scheduledIso;
      if (!scheduledIso || isNaN(new Date(scheduledIso).getTime())) {
        const [y, m, d] = (data.date || "").split("-").map(Number);
        const [h, min] = (data.rawTime || data.time || "10:00").split(":").map(Number);
        if (y && m && d) {
          const dt = new Date(y, m - 1, d, h || 10, min || 0, 0);
          scheduledIso = dt.toISOString();
        } else {
          scheduledIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
      }

      const meetingDateTime = new Date(scheduledIso);
      const diffMs = meetingDateTime.getTime() - now.getTime();

      // Rule: If booked with LESS than 24h remaining, skip 24h reminder (mark sent = true immediately)
      const isWithin24h = diffMs < 24 * 60 * 60 * 1000;

      // Rule: If booked with <= 1 hour remaining, fire 1h reminder IMMEDIATELY at booking time
      const isWithin1h = diffMs <= 60 * 60 * 1000;
      if (isWithin1h && diffMs > 5 * 60 * 1000) {
        send1HourMeetingReminderEmail({
          leadEmail: data.leadEmail,
          agentEmail: realAgentEmail,
          meetingTime: data.time,
        }).catch((err) => console.log("Short-notice 1h reminder send notice:", err));
      }

      // Rule: If booked with <= 5 minutes remaining, fire 5m reminder IMMEDIATELY at booking time
      const isWithin5m = diffMs <= 5 * 60 * 1000 && diffMs > 0;
      if (isWithin5m) {
        send5MinMeetingReminderEmail({
          leadEmail: data.leadEmail,
          agentEmail: realAgentEmail,
          meetingTime: data.time,
        }).catch((err) => console.log("Short-notice 5m reminder send notice:", err));
      }

      // Insert meeting into Supabase
      const { data: insertedMeeting } = await supabase
        .from("meetings")
        .insert({
          lead_id: leadId || null,
          agent_email: realAgentEmail,
          title: `Sales Meeting with ${data.leadName || data.leadEmail} (${data.leadEmail}) @ ${data.time} || ZOOM: ${zoomJoinUrl}`,
          scheduled_time: scheduledIso,
          reminder_24h_sent: isWithin24h ? true : false,
          reminder_1h_sent: isWithin1h ? true : false,
          completed: false,
        })
        .select("id")
        .single();

      return { success: true, meetingId: insertedMeeting?.id };
    } catch (err: any) {
      console.error("Confirm meeting server error:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * 5. Automated Background Check for 24-Hour, 1-Hour, 5-Minute and Meeting Starting NOW Emails
 */
export const checkAndSendMeetingRemindersFn = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    try {
      const now = new Date();
      const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      // Fetch pending meetings
      const { data: upcomingMeetings } = await supabase
        .from("meetings")
        .select("id, lead_id, scheduled_time, reminder_24h_sent, reminder_1h_sent, completed, title")
        .eq("completed", false);

      if (!upcomingMeetings) return { success: true, processed: 0 };

      let count = 0;
      for (const m of upcomingMeetings) {
        const meetingTime = new Date(m.scheduled_time);

        // Fetch lead email AND assigned agent name
        let leadEmail: string | null = null;
        let agentEmail = "garryamelia6265@gmail.com";

        if (m.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("email, assigned_agent_name, agent")
            .eq("id", m.lead_id)
            .single();

          if (lead?.email) {
            leadEmail = lead.email;
            agentEmail = lead.assigned_agent_name || lead.agent || agentEmail;
          }
        }

        if (!leadEmail) continue;

        const formattedTimeStr = meetingTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        // Ignore cancelled meetings
        if (m.title && m.title.includes("[CANCELLED]")) continue;

        // Stage 1: 24-Hour Reminder (Sent 1 day before)
        if (!m.reminder_24h_sent && meetingTime <= oneDayLater && meetingTime > oneHourLater) {
          await send1DayMeetingReminderEmail({
            leadEmail: leadEmail,
            agentEmail: agentEmail,
            meetingDate: meetingTime.toLocaleDateString(),
            meetingTime: formattedTimeStr,
          });
          await supabase.from("meetings").update({ reminder_24h_sent: true }).eq("id", m.id);
          count++;
        }

        // Stage 2: 1-Hour Reminder (Sent 60 minutes before)
        if (!m.reminder_1h_sent && meetingTime <= oneHourLater && meetingTime > new Date(now.getTime() + 5 * 60 * 1000)) {
          await send1HourMeetingReminderEmail({
            leadEmail: leadEmail,
            agentEmail: agentEmail,
            meetingTime: formattedTimeStr,
          });
          await supabase.from("meetings").update({ reminder_1h_sent: true }).eq("id", m.id);
          count++;
        }

        // Stage 3: 5-Minute Reminder (Sent 5 minutes before)
        const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
        if (meetingTime <= fiveMinLater && meetingTime > now) {
          await send5MinMeetingReminderEmail({
            leadEmail: leadEmail,
            agentEmail: agentEmail,
            meetingTime: formattedTimeStr,
          }).catch(() => {});
          count++;
        }

        // Stage 4: Meeting Starting NOW (Sent right at the scheduled meeting time)
        if (!m.completed && now.getTime() >= meetingTime.getTime()) {
          await sendMeetingStartedNowEmail({
            leadEmail: leadEmail,
            agentEmail: agentEmail,
            meetingTime: formattedTimeStr,
          });
          await supabase
            .from("meetings")
            .update({ completed: true })
            .eq("id", m.id);
          count++;
        }
      }

      return { success: true, processed: count };
    } catch (err: any) {
      console.error("Meeting reminder check error:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * Cancel Meeting Session
 */
export const cancelMeetingBookingFn = createServerFn({ method: "POST" })
  .validator((data: { meetingId?: string; leadEmail?: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (data.meetingId) {
        await supabase
          .from("meetings")
          .update({ completed: true, title: `[CANCELLED] Meeting Session` })
          .eq("id", data.meetingId);
      }
      if (data.leadEmail) {
        const { data: foundMeetings } = await supabase
          .from("meetings")
          .select("id, title")
          .eq("completed", false);

        if (foundMeetings) {
          for (const m of foundMeetings) {
            if (m.title && m.title.toLowerCase().includes(data.leadEmail.toLowerCase())) {
              await supabase
                .from("meetings")
                .update({ completed: true, title: `[CANCELLED] ${m.title}` })
                .eq("id", m.id);
            }
          }
        }

        await supabase
          .from("leads")
          .update({ status: "cancelled" })
          .eq("email", data.leadEmail.trim());
      }
      return { success: true };
    } catch (err: any) {
      console.error("Cancel meeting error:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * 8. Mark Lead as Replied
 */
export const markLeadAsRepliedFn = createServerFn({ method: "POST" })
  .validator((data: { leadId?: string; leadEmail?: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (data.leadId) {
        await supabase.from("leads").update({ status: "replied" }).eq("id", data.leadId);
      } else if (data.leadEmail) {
        await supabase.from("leads").update({ status: "replied" }).ilike("email", data.leadEmail);
      }

      await supabase.from("emails_sent").insert({
        lead_id: data.leadId || null,
        lead_email: data.leadEmail,
        subject: "Re: Welcome to Teals CRM / Inquiry Reply",
        sequence_type: "welcome",
        status: "replied",
        sent_at: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Mark replied error:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * 9. Trigger Next Follow-up Email Stage
 */
export const triggerNextFollowUpFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      leadId: string;
      leadEmail: string;
      leadName?: string;
      stage: "24h" | "48h" | "72h" | "10d";
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      const stageMap = {
        "24h": { sequence: "followup_24h", subject: "Quick Follow-up: Checking in on your inquiry" },
        "48h": { sequence: "followup_48h", subject: "Following up on our previous note — Teals CRM" },
        "72h": { sequence: "followup_72h", subject: "10-minute slot open for a live sales demo" },
        "10d": { sequence: "followup_10d", subject: "Final Check-in: Should we close your inquiry?" },
      };

      const info = stageMap[data.stage];
      if (!info) throw new Error("Invalid stage");

      const reminderNum = data.stage === "24h" ? 1 : data.stage === "48h" ? 2 : data.stage === "72h" ? 3 : 4;
      await sendReminderEmail({
        toEmail: data.leadEmail,
        reminderNumber: reminderNum,
      });

      await supabase.from("emails_sent").insert({
        lead_id: data.leadId,
        lead_email: data.leadEmail,
        subject: info.subject,
        sequence_type: info.sequence,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Trigger next follow-up error:", err);
      return { success: false, error: err?.message };
    }
  });


/**
 * 10. Start Live Outbound Vapi AI Phone Call to Lead
 */
export const startVapiPhoneCallFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      leadId?: string;
      leadName?: string;
      phoneNumber: string;
      leadEmail?: string;
      agentEmail?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      const e164Phone = formatE164Phone(data.phoneNumber);
      if (!e164Phone || e164Phone.length < 7) {
        throw new Error(`Invalid phone number: ${data.phoneNumber}. Must be a valid phone number with country code.`);
      }

      const cleanLeadEmail = (data.leadEmail || "").trim().toLowerCase();
      const hasKnownEmail = Boolean(cleanLeadEmail && cleanLeadEmail.includes("@") && cleanLeadEmail.includes("."));
      const customerName = data.leadName || "Valued Prospect";
      const agentEmail = data.agentEmail || PRIMARY_ADMIN_EMAIL;
      const nowFormatted = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      const currentTimeFormatted = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

            // Dynamic System Prompt customized for whether lead has email or needs email collection
      let customSystemPrompt = "";
      if (hasKnownEmail) {
        customSystemPrompt = `You are Alex, a top-tier Senior Sales Executive at Teals CRM.
The prospect's name is ${customerName}.
The prospect's email is ALREADY verified and on file: ${cleanLeadEmail}.
Current Live Time Context: Today is ${nowFormatted} at ${currentTimeFormatted} PKT.

YOUR MISSION & CONVERSATION FLOW:
1. GREETING & PITCH:
   Greet warmly and ask how they currently manage their sales leads and follow-ups.
   Briefly pitch how Teals CRM automates lead capture, follow-ups, and pipeline tracking.
   Offer a quick 15-minute demo: "Would you be open to a quick 15-minute demo to see how it works?"

2. DATE, TIME & TIMEZONE NEGOTIATION RULES (CRITICAL):
   - When they agree, ask: "Awesome! Which day works best for you — tomorrow, or another day this week?"
   - When they mention a day, negotiate a convenient time.
   - If the prospect gives only a time (e.g. "at 2 PM") without mentioning the day, ASK: "Which day works best for you — tomorrow, or another day this week?"
   - If the prospect mentions a time earlier today that has already passed, POLITELY SAY: "Since [time] today has already passed, did you mean tomorrow at [time] or a different upcoming day?"
   - TIMEZONE INQUIRY (MANDATORY): Always ask or verify their timezone: "And just so our calendar invite matches your exact clock, what timezone are you in?" (e.g. Eastern/EST, Pacific/PST, Central/CST, UK/GMT, etc.)

3. NO NEED TO ASK FOR EMAIL:
   DO NOT ask for their email address since we already have ${cleanLeadEmail} on file!

4. CLOSING & DISCONNECT FLOW (MANDATORY EXACT WORDS & 2-SECOND PAUSE):
   Once day, time, and timezone are agreed, say EXACTLY:
   "Thank you! Your demo is confirmed for [Day] at [Time] [Timezone]. I have sent your calendar invite and Zoom meeting link to your email on file (${cleanLeadEmail}). When it's time for the meeting, simply click the Zoom link to connect with our team. Have a wonderful day, goodbye!"
   After saying this, allow 2 seconds for the prospect to say "Thank you / Okay / Goodbye", and then trigger the endCall tool to disconnect.

5. IF PROSPECT DECLINES OR RESCHEDULES:
   Politely say: "No problem at all! We will follow up with you later. Have a wonderful day, goodbye!" and trigger endCall tool.`;
      } else {
        customSystemPrompt = `You are Alex, a top-tier Senior Sales Executive at Teals CRM.
The prospect's name is ${customerName}.
The prospect does NOT have an email on file yet.
Current Live Time Context: Today is ${nowFormatted} at ${currentTimeFormatted} PKT.

YOUR MISSION & CONVERSATION FLOW:
1. GREETING & PITCH:
   Greet warmly and ask how they currently manage their sales leads and follow-ups.
   Briefly pitch how Teals CRM automates lead capture, follow-ups, and pipeline tracking.
   Offer a quick 15-minute demo: "Would you be open to a quick 15-minute demo to see how it works?"

2. DATE, TIME & TIMEZONE NEGOTIATION RULES (CRITICAL):
   - When they agree, ask: "Awesome! Which day works best for you — tomorrow, or another day this week?"
   - When they mention a day, negotiate a convenient time.
   - If the prospect gives only a time (e.g. "at 2 PM") without mentioning the day, ASK: "Which day works best for you — tomorrow, or another day this week?"
   - If the prospect mentions a time earlier today that has already passed, POLITELY SAY: "Since [time] today has already passed, did you mean tomorrow at [time] or a different upcoming day?"
   - TIMEZONE INQUIRY (MANDATORY): Always ask or verify their timezone: "And just so our calendar invite matches your exact clock, what timezone are you in?" (e.g. Eastern/EST, Pacific/PST, Central/CST, UK/GMT, etc.)

3. STEP TO GET & SPELL-VERIFY EMAIL (CRITICAL ACCURACY):
   - Step 3a: Ask: "And what is the best email address to send your calendar invite and Zoom meeting link to?"
   - Step 3b: When the prospect says their email, ask them to spell it:
     "Could you please spell that out letter by letter so I make sure I have it 100% accurate?"
   - Step 3c: When the prospect spells it out, REPEAT AND SPELL IT BACK TO CONFIRM:
     "Let me confirm: [spell it out clearly, e.g. j-o-h-n at gmail dot com]. Is that correct?"
   - Wait for the prospect to say "Yes", "Correct", "That is right", or "Haan".
   - If they correct any part, acknowledge smoothly, adjust it, and confirm once more.

4. CLOSING & DISCONNECT FLOW (MANDATORY EXACT WORDS & 2-SECOND PAUSE):
   Once day, time, timezone, and email are verified, say EXACTLY:
   "Thank you! Your demo is confirmed for [Day] at [Time] [Timezone]. I have sent your calendar invite and Zoom meeting link to [spelled email address]. When it's time for the meeting, simply click the Zoom link to connect with our team. Have a wonderful day, goodbye!"
   After saying this, allow 2 seconds for the prospect to say "Thank you / Okay / Goodbye", and then trigger the endCall tool to disconnect.

5. IF PROSPECT DECLINES OR CANNOT PROVIDE EMAIL:
   Politely say: "No problem at all! We will follow up with you later. Have a wonderful day, goodbye!" and trigger endCall tool.`;
      }

      console.log(`Initiating Vapi Outbound Call to ${e164Phone} via Assistant ${VAPI_ASSISTANT_ID} (hasKnownEmail: ${hasKnownEmail})`);

      const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          customer: {
            number: e164Phone,
            name: customerName,
          },
          assistantOverrides: {
            variableValues: {
              customerName: customerName,
              customerEmail: cleanLeadEmail,
              agentEmail: agentEmail,
            },
            model: {
              provider: "openai",
              model: "gpt-4.1",
              messages: [
                {
                  role: "system",
                  content: customSystemPrompt,
                },
              ],
              tools: [
                {
                  type: "endCall",
                },
              ],
            },
          },
        }),
      });

      const responseData = await vapiResponse.json();

      if (!vapiResponse.ok) {
        console.error("Vapi call error response:", responseData);
        throw new Error(responseData.message || responseData.error || "Failed to initiate AI call through Vapi");
      }

      console.log("Vapi Call Initiated successfully:", responseData);

      const nowIso = new Date().toISOString();

      // Update lead status to contacted
      if (data.leadId) {
        await supabase
          .from("leads")
          .update({
            status: "contacted",
            contacted_at: nowIso,
          })
          .eq("id", data.leadId);
      } else if (cleanLeadEmail) {
        await supabase
          .from("leads")
          .update({
            status: "contacted",
            contacted_at: nowIso,
          })
          .ilike("email", cleanLeadEmail);
      }

      // Log call into emails_sent / activity table
      await supabase.from("emails_sent").insert({
        lead_id: data.leadId || null,
        lead_email: cleanLeadEmail || e164Phone,
        subject: `📞 AI Outbound Call Initiated to ${e164Phone} (${customerName})`,
        sequence_type: "ai_call",
        status: "sent",
        sent_at: nowIso,
      });

      return {
        success: true,
        callId: responseData.id,
        phone: e164Phone,
        message: "Call initiated successfully! Phone is ringing.",
      };
    } catch (err: any) {
      console.error("Start AI phone call error:", err);
      return { success: false, error: err?.message || "Failed to start call" };
    }
  });

/**
 * 11. Fetch Call Logs, Audio Recordings & Transcripts from Vapi
 */
export const getVapiCallLogsFn = createServerFn({ method: "POST" })
  .validator((data: { limit?: number; phoneNumber?: string } = {}) => data)
  .handler(async ({ data }) => {
    try {
      const limit = data?.limit || 20;
      const res = await fetch(
        `https://api.vapi.ai/call?limit=${limit}&assistantId=${VAPI_ASSISTANT_ID}`,
        {
          headers: {
            Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
          },
        }
      );

      if (!res.ok) {
        return { success: false, calls: [] };
      }

      const calls = await res.json();
      if (!Array.isArray(calls)) {
        return { success: true, calls: [] };
      }

      const enrichedCalls = await Promise.all(
        calls.slice(0, 15).map(async (c: any) => {
          try {
            if (!c?.id) return c;
            const singleRes = await fetch(`https://api.vapi.ai/call/${c.id}`, {
              headers: {
                Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
              },
            });
            if (!singleRes.ok) return c;
            const single = await singleRes.json();

            const presignedAudio =
              single.artifact?.presignedMonoUrl ||
              single.artifact?.presignedStereoUrl ||
              single.artifact?.presignedCustomerUrl ||
              single.artifact?.presignedAssistantUrl ||
              single.recordingUrl ||
              c.recordingUrl;

            return {
              ...c,
              ...single,
              duration: single.duration || c.duration,
              transcript: single.transcript || c.transcript || single.artifact?.transcript,
              summary: single.summary || c.summary || single.analysis?.summary,
              recordingUrl: presignedAudio,
              stereoRecordingUrl: presignedAudio,
            };
          } catch {
            return c;
          }
        })
      );

      return { success: true, calls: enrichedCalls };
    } catch (err: any) {
      console.error("Fetch Vapi calls error:", err);
      return { success: false, error: err?.message, calls: [] };
    }
  });

/**
 * 12. Get Specific Call Status, Duration, Recording, Live Messages & Transcript by Call ID
 */
export const getVapiCallStatusFn = createServerFn({ method: "POST" })
  .validator((data: { callId: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (!data?.callId) return { success: false, status: "ended" };
      const res = await fetch(`https://api.vapi.ai/call/${data.callId}`, {
        headers: {
          Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
        },
      });

      if (!res.ok) {
        return { success: false, status: "ended" };
      }

      const call = await res.json();
      const presignedAudio =
        call.artifact?.presignedMonoUrl ||
        call.artifact?.presignedStereoUrl ||
        call.recordingUrl ||
        call.stereoRecordingUrl ||
        "";

      return {
        success: true,
        status: call.status,
        endedReason: call.endedReason,
        duration: call.duration,
        recordingUrl: presignedAudio,
        transcript: call.transcript || call.artifact?.transcript || "",
        summary: call.summary || call.analysis?.summary || "",
        messages: call.messages || [],
        listenUrl: call.monitor?.listenUrl || "",
        controlUrl: call.monitor?.controlUrl || "",
      };
    } catch (err: any) {
      return { success: false, status: "ended" };
    }
  });

/**
 * 12B. Manually Stop/Hangup a Vapi Phone Call
 */
export const stopVapiCallFn = createServerFn({ method: "POST" })
  .validator((data: { callId: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (!data?.callId) return { success: false };
      const res = await fetch(`https://api.vapi.ai/call/${data.callId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
        },
      });
      return { success: res.ok };
    } catch {
      return { success: false };
    }
  });

/**
 * 13. Process Post-Call Meeting Booking from Vapi Transcript & Send Confirmation Email
 */
export const processVapiCallBookingFn = createServerFn({ method: "POST" })
  .validator(
    (data: { callId: string; leadId?: string; leadEmail?: string }) => data
  )
  .handler(async ({ data }) => {
    try {
      if (!data?.callId) return { success: false, booked: false };

      // Poll / retry up to 3 times to allow Vapi post-call analysis to finish generating
      let call: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(`https://api.vapi.ai/call/${data.callId}`, {
          headers: {
            Authorization: `Bearer ${VAPI_PRIVATE_KEY}`,
          },
        });
        if (res.ok) {
          call = await res.json();
          if (call?.analysis?.structuredData && Object.keys(call.analysis.structuredData).length > 0) {
            break;
          }
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (!call) return { success: false, booked: false };

      const transcript = call.transcript || call.artifact?.transcript || "";
      const analysis = call.analysis || {};
      const structuredData = analysis.structuredData || {};

      const emailMatches = transcript.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
      const extractedDirect = emailMatches && emailMatches.length > 0 ? emailMatches[emailMatches.length - 1] : null;

      // Extract client email from structuredData, transcript regex, lead data or customer data
      let clientEmail =
        normalizeSpokenEmail(structuredData.clientEmail) ||
        normalizeSpokenEmail(structuredData.email) ||
        normalizeSpokenEmail(extractedDirect || "") ||
        normalizeSpokenEmail(transcript) ||
        (data.leadEmail ? normalizeSpokenEmail(data.leadEmail) : null) ||
        (call.customer?.email ? normalizeSpokenEmail(call.customer.email) : null);

      if (!clientEmail && data.leadId) {
        const { data: leadDb } = await supabase
          .from("leads")
          .select("email")
          .eq("id", data.leadId)
          .maybeSingle();
        if (leadDb?.email) clientEmail = normalizeSpokenEmail(leadDb.email);
      }

      // Check if slot was booked or scheduling was agreed to
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

      if (clientEmail && data.leadId) {
        // Always save the spoken / provided email into Supabase lead record
        await supabase
          .from("leads")
          .update({ email: clientEmail })
          .eq("id", data.leadId);
      }

      if (!isBooked && !clientEmail) {
        return {
          success: true,
          booked: false,
          message: "Call finished without booking.",
        };
      }

      if (!clientEmail) {
        return {
          success: true,
          booked: false,
          error: "No email address found to send invite to.",
        };
      }

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

      // Find assigned agent
      let assignedAgent = PRIMARY_ADMIN_EMAIL;
      let clientName = "Valued Client";
      if (data.leadId) {
        const { data: leadDb } = await supabase
          .from("leads")
          .select("assigned_agent_name, agent, name")
          .eq("id", data.leadId)
          .maybeSingle();
        if (leadDb?.assigned_agent_name || leadDb?.agent) {
          assignedAgent = leadDb.assigned_agent_name || leadDb.agent;
        }
        if (leadDb?.name) clientName = leadDb.name;
      }

      // 1. Update lead status in Supabase
      if (data.leadId) {
        await supabase
          .from("leads")
          .update({
            status: "booked",
            booked_at: nowIso,
            contacted_at: nowIso,
            email: clientEmail,
          })
          .eq("id", data.leadId);
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
      // Prevent duplicate emails if both webhook and client poll finish around the same time
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: existingMeeting } = await supabase
        .from("meetings")
        .select("id, scheduled_time, created_at")
        .eq("lead_email", clientEmail)
        .gte("created_at", tenMinutesAgo)
        .maybeSingle();

      if (existingMeeting) {
        console.log(`Meeting for ${clientEmail} already booked recently (${existingMeeting.id}). Skipping duplicate confirmation email.`);
        return {
          success: true,
          booked: true,
          clientEmail,
          bookingDate: bookingDateStr,
          bookingTime: bookingTimeStr,
          scheduledIso,
        };
      }

      // 2. Insert Meeting into Supabase (checked by check-reminders cron for automated 24h, 1h, 5m Zoom link reminders)
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
      } catch (e) {
        console.error("Confirmation email error:", e);
      }

      // 4. Log in emails_sent
      await supabase.from("emails_sent").insert({
        lead_id: data.leadId || null,
        lead_email: clientEmail,
        subject: `Meeting Confirmed via AI Voice Call: ${bookingDateStr} at ${bookingTimeStr}`,
        sequence_type: "ai_voice_booking",
        status: "sent",
        sent_at: nowIso,
      });

      return {
        success: true,
        booked: true,
        clientEmail,
        bookingDate: bookingDateStr,
        bookingTime: bookingTimeStr,
        message: `Meeting successfully booked! Confirmation email sent to ${clientEmail}`,
      };
    } catch (err: any) {
      console.error("Process Vapi booking error:", err);
      return { success: false, booked: false, error: err?.message };
    }
  });

/**
 * 15. Get Agent Booked Slots
 */
export const getAgentBookedSlotsFn = createServerFn({ method: "POST" })
  .validator((data: { agentEmail?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const agent = data.agentEmail || PRIMARY_ADMIN_EMAIL;
      const { data: meetings, error } = await supabase
        .from("meetings")
        .select("scheduled_time, completed")
        .eq("agent_email", agent)
        .eq("completed", false);

      if (error) throw error;

      return {
        success: true,
        bookedSlots: (meetings || []).map((m: any) => m.scheduled_time),
      };
    } catch (err: any) {
      return { success: false, error: err?.message, bookedSlots: [] };
    }
  });


/**
 * 16. Notify Admin when Working Agent clears leads
 */
export const notifyAdminLeadsClearedFn = createServerFn({ method: "POST" })
  .validator((data: {
    agentName: string;
    agentEmail: string;
    scopeTitle: string;
    deletedCount: number;
  }) => data)
  .handler(async ({ data }) => {
    try {
      await sendLeadClearAuditEmail({
        agentName: data.agentName,
        agentEmail: data.agentEmail,
        scopeTitle: data.scopeTitle,
        deletedCount: data.deletedCount,
      });
      return { success: true };
    } catch (err: any) {
      console.error("notifyAdminLeadsClearedFn error:", err);
      return { success: false, error: err?.message };
    }
  });
