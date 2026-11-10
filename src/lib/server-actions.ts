
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

export function parseTargetDate(raw?: string, now = new Date()): string {
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

export function parseTargetTime(raw?: string): { hours: number; minutes: number } {
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

export function calculateMeetingSchedule(rawDateStr?: string, rawTimeStr?: string, rawTzStr?: string) {
  const now = new Date();
  const ianaTz = normalizeClientTimezone(rawTzStr);
  const dateStr = parseTargetDate(rawDateStr, now);
  const { hours, minutes } = parseTargetTime(rawTimeStr);

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
  VAPI_ACCOUNTS_POOL,
  CARTESIA_VOICE_CONFIG,
  VapiAccount,
  formatE164Phone,
} from "./vapi-client";

let vapiCallRotationIndex = 0;

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

      // 3. Calculate accurate Pakistan Time [PKT] for the Agent
      let agentTimeStr = data.time;
      let agentDateStr = data.date;
      const clientTimeStr = data.time;
      const clientDateStr = data.date;

      if (data.scheduledIso) {
        try {
          const dObj = new Date(data.scheduledIso);
          if (!isNaN(dObj.getTime())) {
            agentTimeStr = new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Karachi",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).format(dObj);

            agentDateStr = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Karachi",
            }).format(dObj); // YYYY-MM-DD
          }
        } catch (e) {
          console.warn("PKT conversion error in confirmMeetingBookingFn:", e);
        }
      }

      // Send initial confirmation email to BOTH Lead & Agent
      await sendMeetingConfirmationEmail({
        leadEmail: data.leadEmail,
        agentEmail: realAgentEmail,
        meetingDate: data.date,
        meetingTime: data.time,
        agentTime: agentTimeStr,
        agentDate: agentDateStr,
        clientTime: clientTimeStr,
        clientDate: clientDateStr,
      });

      // 4. Update lead status in Supabase to "booked" & add PKT note
      if (data.leadEmail) {
        const { data: leadRecord } = await supabase
          .from("leads")
          .select("notes")
          .eq("email", data.leadEmail.trim())
          .maybeSingle();

        const existingNotes = Array.isArray(leadRecord?.notes) ? leadRecord.notes : [];
        const bookingNote = `📅 Meeting Booked: ${agentDateStr} at ${agentTimeStr} [PKT] (Client Local Time: ${clientDateStr} at ${clientTimeStr}) | Zoom: ${zoomJoinUrl}`;

        await supabase
          .from("leads")
          .update({
            status: "booked",
            assigned_agent_name: realAgentEmail,
            notes: [...existingNotes, bookingNote],
          })
          .eq("email", data.leadEmail.trim());
      }

      // 5. Log confirmation email in emails_sent
      await supabase.from("emails_sent").insert({
        lead_id: leadId || null,
        lead_email: data.leadEmail,
        subject: `Meeting Confirmed: ${agentDateStr} at ${agentTimeStr} [PKT] (Client: ${clientDateStr} at ${clientTimeStr})`,
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

export function getTimeUntilMeeting(scheduledIso: string): string {
  try {
    const diffMs = new Date(scheduledIso).getTime() - Date.now();
    if (diffMs <= 0) return "in a few moments / right now";
    const totalMins = Math.round(diffMs / (60 * 1000));
    if (totalMins < 60) {
      return `in ${totalMins} minute${totalMins === 1 ? "" : "s"}`;
    }
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours < 24) {
      if (mins === 0) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
      return `in ${hours} hour${hours === 1 ? "" : "s"} and ${mins} minute${mins === 1 ? "" : "s"}`;
    }
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (remHours === 0) return `in ${days} day${days === 1 ? "" : "s"}`;
    return `in ${days} day${days === 1 ? "" : "s"} and ${remHours} hour${remHours === 1 ? "" : "s"}`;
  } catch {
    return "at your scheduled time";
  }
}

/**
 * 4b. Claim Meeting Booking Action
 * Triggered when a human sales agent claims a meeting in the CRM (Notifications or Dashboard).
 * Updates meetings and leads, and dispatches full confirmation emails with Zoom link to BOTH client & claiming agent!
 */
export const claimMeetingBookingFn = createServerFn({ method: "POST" })
  .validator((data: { meetingId: string; claimingEmail: string; claimingName: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { meetingId, claimingEmail, claimingName } = data;
      if (!meetingId) throw new Error("Missing meetingId");

      // 1. Fetch meeting and related lead
      const { data: meeting, error: mErr } = await supabase
        .from("meetings")
        .select("*, leads(*)")
        .eq("id", meetingId)
        .maybeSingle();

      if (mErr) throw mErr;
      if (!meeting) throw new Error("Meeting not found");

      // 2. Update meetings table with claiming agent email
      const { error: updateErr } = await supabase
        .from("meetings")
        .update({ agent_email: claimingEmail })
        .eq("id", meetingId);

      if (updateErr) throw updateErr;

      // 3. Update lead if exists
      const rawLead = Array.isArray(meeting.leads) ? meeting.leads[0] : meeting.leads;
      const leadId = meeting.lead_id || rawLead?.id;
      if (leadId) {
        const existingNotes = Array.isArray(rawLead?.notes) ? rawLead.notes : [];
        const claimNote = `🔒 Meeting claimed by ${claimingName} (${claimingEmail}) on ${new Date().toISOString()}`;
        await supabase
          .from("leads")
          .update({
            assigned_agent_name: claimingName,
            notes: [...existingNotes, claimNote],
          })
          .eq("id", leadId);
      }

      // 4. Extract client info and times
      const titleEmailMatch = meeting.title?.match(/\(([^)]+@[^)]+)\)/);
      const titleNameMatch = meeting.title?.match(/with\s+([^(]+)\s*\(/i);
      const leadEmail = (rawLead?.email || titleEmailMatch?.[1] || "").trim();
      const leadName = (rawLead?.name || titleNameMatch?.[1] || "").trim() || "Valued Client";
      const scheduledIso = meeting.scheduled_time;
      let zoomUrl = "https://zoom.us/j/5539578967";

      if (meeting.title && meeting.title.includes("ZOOM:")) {
        const parts = meeting.title.split("ZOOM:");
        if (parts[1]) zoomUrl = parts[1].trim();
      }

      let clientDateStr = "";
      let clientTimeStr = "";
      let agentDateStr = "";
      let agentTimeStr = "";
      let clientTz = "America/Denver";

      if (scheduledIso) {
        const dObj = new Date(scheduledIso);
        if (!isNaN(dObj.getTime())) {
          // Agent time in PKT
          agentTimeStr = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Karachi",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(dObj);
          agentDateStr = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Karachi",
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
          }).format(dObj);

          // Client local timezone from notes or default America/Denver
          if (rawLead?.notes && Array.isArray(rawLead.notes)) {
            const noteStr = rawLead.notes.join(" ");
            const tzMatch = noteStr.match(/\[([A-Za-z_]+\/[A-Za-z_]+)\]/);
            if (tzMatch && tzMatch[1]) clientTz = tzMatch[1];
          }

          try {
            clientTimeStr = new Intl.DateTimeFormat("en-US", {
              timeZone: clientTz,
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).format(dObj);
            clientDateStr = new Intl.DateTimeFormat("en-US", {
              timeZone: clientTz,
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric"
            }).format(dObj);
          } catch {
            clientTimeStr = agentTimeStr;
            clientDateStr = agentDateStr;
          }
        }
      }

      const timeUntilMeeting = scheduledIso ? getTimeUntilMeeting(scheduledIso) : "at scheduled time";

      // 5. Send confirmation emails to BOTH Client and Claiming Agent
      if (leadEmail) {
        await sendMeetingConfirmationEmail({
          leadEmail,
          agentEmail: claimingEmail,
          meetingDate: clientDateStr,
          meetingTime: clientTimeStr,
          clientDate: clientDateStr,
          clientTime: clientTimeStr,
          agentDate: agentDateStr,
          agentTime: agentTimeStr,
          leadName,
          agentName: claimingName,
          zoomLink: zoomUrl,
          timeUntilMeeting,
          clientTz,
        });

        // Track in emails_sent
        await supabase.from("emails_sent").insert({
          lead_id: leadId || null,
          lead_email: leadEmail,
          subject: `Meeting Claim Confirmed (${timeUntilMeeting}): ${clientDateStr} at ${clientTimeStr} with ${claimingName}`,
          sequence_type: "meeting_claimed_confirmation",
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      return { success: true };
    } catch (e: any) {
      console.error("claimMeetingBookingFn error:", e);
      throw e;
    }
  });

/**
 * 4c. Transfer Meeting Booking Action
 * Triggered by Sales Manager, Team Leader, or Admin to reassign any meeting to a sales agent.
 */
export const transferMeetingBookingFn = createServerFn({ method: "POST" })
  .validator((data: {
    meetingId: string;
    targetAgentEmail: string;
    targetAgentName: string;
    transferredByEmail: string;
    transferredByName: string;
  }) => data)
  .handler(async ({ data }) => {
    try {
      const { meetingId, targetAgentEmail, targetAgentName, transferredByEmail, transferredByName } = data;
      if (!meetingId || !targetAgentEmail) throw new Error("Missing meetingId or targetAgentEmail");

      // 1. Fetch meeting and related lead
      const { data: meeting, error: mErr } = await supabase
        .from("meetings")
        .select("*, leads(*)")
        .eq("id", meetingId)
        .maybeSingle();

      if (mErr) throw mErr;
      if (!meeting) throw new Error("Meeting not found");

      // 2. Update meetings table with new agent email
      const { error: updateErr } = await supabase
        .from("meetings")
        .update({ agent_email: targetAgentEmail })
        .eq("id", meetingId);

      if (updateErr) throw updateErr;

      // 3. Update lead if exists
      const rawLead = Array.isArray(meeting.leads) ? meeting.leads[0] : meeting.leads;
      const leadId = meeting.lead_id || rawLead?.id;
      if (leadId) {
        const existingNotes = Array.isArray(rawLead?.notes) ? rawLead.notes : [];
        const transferNote = `🔄 Meeting transferred by ${transferredByName} (${transferredByEmail}) to ${targetAgentName} (${targetAgentEmail}) on ${new Date().toISOString()}`;
        await supabase
          .from("leads")
          .update({
            assigned_agent_name: targetAgentName,
            notes: [...existingNotes, transferNote],
          })
          .eq("id", leadId);
      }

      // 4. Extract client info and times
      const titleEmailMatch = meeting.title?.match(/\(([^)]+@[^)]+)\)/);
      const titleNameMatch = meeting.title?.match(/with\s+([^(]+)\s*\(/i);
      const leadEmail = (rawLead?.email || titleEmailMatch?.[1] || "").trim();
      const leadName = (rawLead?.name || titleNameMatch?.[1] || "").trim() || "Valued Client";
      const scheduledIso = meeting.scheduled_time;
      let zoomUrl = "https://zoom.us/j/5539578967";

      if (meeting.title && meeting.title.includes("ZOOM:")) {
        const parts = meeting.title.split("ZOOM:");
        if (parts[1]) zoomUrl = parts[1].trim();
      }

      let clientDateStr = "";
      let clientTimeStr = "";
      let agentDateStr = "";
      let agentTimeStr = "";
      let clientTz = "America/Denver";

      if (scheduledIso) {
        const dObj = new Date(scheduledIso);
        if (!isNaN(dObj.getTime())) {
          agentTimeStr = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Karachi",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(dObj);
          agentDateStr = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Karachi",
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
          }).format(dObj);

          if (rawLead?.notes && Array.isArray(rawLead.notes)) {
            const noteStr = rawLead.notes.join(" ");
            const tzMatch = noteStr.match(/\[([A-Za-z_]+\/[A-Za-z_]+)\]/);
            if (tzMatch && tzMatch[1]) clientTz = tzMatch[1];
          }

          try {
            clientTimeStr = new Intl.DateTimeFormat("en-US", {
              timeZone: clientTz,
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).format(dObj);
            clientDateStr = new Intl.DateTimeFormat("en-US", {
              timeZone: clientTz,
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric"
            }).format(dObj);
          } catch {
            clientTimeStr = agentTimeStr;
            clientDateStr = agentDateStr;
          }
        }
      }

      const timeUntilMeeting = scheduledIso ? getTimeUntilMeeting(scheduledIso) : "at scheduled time";

      // 5. Send confirmation emails to BOTH Client and New Agent
      if (leadEmail) {
        await sendMeetingConfirmationEmail({
          leadEmail,
          agentEmail: targetAgentEmail,
          meetingDate: clientDateStr,
          meetingTime: clientTimeStr,
          clientDate: clientDateStr,
          clientTime: clientTimeStr,
          agentDate: agentDateStr,
          agentTime: agentTimeStr,
          leadName,
          agentName: targetAgentName,
          zoomLink: zoomUrl,
          timeUntilMeeting,
          clientTz,
          isTransfer: true,
          transferredByName,
        });

        // Track in emails_sent
        await supabase.from("emails_sent").insert({
          lead_id: leadId || null,
          lead_email: leadEmail,
          subject: `Meeting Transferred (${timeUntilMeeting}): ${clientDateStr} at ${clientTimeStr} with ${targetAgentName}`,
          sequence_type: "meeting_transferred_confirmation",
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      return { success: true };
    } catch (e: any) {
      console.error("transferMeetingBookingFn error:", e);
      throw e;
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
        // Keep active and visible for 20 minutes post start time so agents can see the live red banner and Join Zoom button
        const twentyMinutesPostStart = new Date(meetingTime.getTime() + 20 * 60 * 1000);
        const hasStarted = now.getTime() >= meetingTime.getTime();
        const pastGracePeriod = now.getTime() >= twentyMinutesPostStart.getTime();

        if (!m.completed && hasStarted) {
          const rawTitle = m.title || "";
          const nowSent = rawTitle.includes("|| NOW_SENT");

          if (!nowSent) {
            await sendMeetingStartedNowEmail({
              leadEmail: leadEmail,
              agentEmail: agentEmail,
              meetingTime: formattedTimeStr,
            }).catch(() => {});
            await supabase
              .from("meetings")
              .update({ title: `${rawTitle} || NOW_SENT` })
              .eq("id", m.id);
            count++;
          }

          // Only mark completed / missed AFTER 20 minutes post meeting start time
          if (pastGracePeriod) {
            const isUnclaimed = !m.agent_email || m.agent_email === "unassigned" || m.agent_email === "garryamelia6265@gmail.com";
            const missedTag = isUnclaimed ? " [MISSED]" : "";
            await supabase
              .from("meetings")
              .update({
                completed: true,
                title: `${rawTitle}${missedTag}`
              })
              .eq("id", m.id);
            count++;
          }
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
      const rawLeadName = (data.leadName || "").trim();
      const hasRealName = Boolean(
        rawLeadName &&
        rawLeadName.toLowerCase() !== "valued prospect" &&
        rawLeadName.toLowerCase() !== "lead" &&
        rawLeadName.toLowerCase() !== "prospect" &&
        rawLeadName.toLowerCase() !== "unknown"
      );
      const customerName = hasRealName ? rawLeadName : "";

      // Step 1 Opener: Natural human greeting asking how they are doing
      const dynamicFirstMessage = hasRealName
        ? `Hi ${customerName}! How are you doing today?`
        : `Hi there! How are you doing today?`;

      const agentEmail = data.agentEmail || PRIMARY_ADMIN_EMAIL;
      const nowFormatted = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      const currentTimeFormatted = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

      // Dynamic System Prompt customized for AMZ Solutions Hub (amzsolutionshub.com)
      // Dynamic Knowledge Base based strictly on https://www.amzsolutionshub.com/
      const amzKnowledgeBase = `
AUTHENTIC FACTS ABOUT AMZ SOLUTIONS HUB (amzsolutionshub.com):
- Company: AMZ Solutions Hub — A premier, full-service eCommerce agency.
- Official Website: amzsolutionshub.com
- Core Services:
  1. Amazon FBA Automation: Product hunting, verified supplier sourcing, SEO listing optimization, PPC advertising, account health, FBA fulfillment.
  2. Shopify Dropshipping: Turnkey high-converting store, winning product research, Meta/TikTok viral ads, automated supplier fulfillment.
  3. Walmart Dropshipping & Automation: WFS compliant catalog setup, inventory sync, and buy box optimization.
  4. TikTok Shop Automation: Viral product launch, creator affiliate marketing, automated order processing.
  5. Etsy & eBay Automation: Niche store setup and automated order management.
  6. E-book Services: Digital formatting, publishing, and marketing.
- Key Value: 100% Done-For-You (DFY) hands-off store management, dedicated account managers, transparent weekly reporting.
- Physical Offices: Greenacres, Florida (US) & Berkshire, England (UK).
- Pricing/Cost Question Answer: "Every model is customized to your budget and target marketplace. In our quick 15-minute Zoom session, our Senior Specialist breaks down exact profit margins, store models, and a custom roadmap for your budget with zero obligation."
`;

      const conversationalHumanStyle = `
CONVERSATIONAL STYLE & POINT-TO-POINT BREVITY (STRICT RULES):
- POINT-TO-POINT BREVITY: Every single response must be short, crisp, and direct (1 to 2 sentences MAXIMUM). NEVER deliver long paragraphs or lectures!
- FIRST-TRY COMPREHENSION: Listen with razor-sharp attention. Understand the caller's answers, questions, objections, and emails on the very first try without asking them to repeat unnecessarily.
- REAL WEBSITE FACTS ONLY: Stick 100% strictly to the factual services of AMZ Solutions Hub (amzsolutionshub.com). Do NOT invent fake guarantees, fake percentages, or imaginary features.
- NATURAL HUMAN FLOW: Speak with natural warmth, polite confidence, and occasional natural human fillers ("gotcha", "sure thing", "absolutely", "ah"). If appropriate, add a light friendly chuckle ("haha, totally understand!").
- ACTIVE LISTENING & PAUSE HANDLING: If the caller interrupts or objects, stop talking immediately, address their exact point in 1 sentence, and guide them back smoothly.
`;

      let customSystemPrompt = "";
      if (hasKnownEmail) {
        customSystemPrompt = `You are Alex, a top-tier Senior Sales Executive at AMZ Solutions Hub (amzsolutionshub.com).
${hasRealName ? `The prospect's name is ${customerName}.` : "The prospect's name is not specified."}
The prospect's email is ALREADY verified and on file: ${cleanLeadEmail}.
Current Live Time Context: Today is ${nowFormatted} at ${currentTimeFormatted} PKT.

LANGUAGE RULE (STRICT MANDATORY):
- You must speak EXCLUSIVELY in fluent, professional, and clear English at all times.
- DO NOT speak in Urdu, Roman Urdu, Hindi, or any other language under any circumstance.

${conversationalHumanStyle}

${amzKnowledgeBase}

CALL CONTEXT & STEP-BY-STEP FLOW:
1. GREETING & TWO-STEP OPENER:
   - The call starts with: "${dynamicFirstMessage}"
   - When the prospect responds to your greeting (e.g., "Good", "I'm fine", "Who is this?", "Doing well, how are you?"), respond warmly:
     "Glad to hear! My name is Alex and I'm calling from AMZ Solutions Hub. I noticed you recently visited our website at amzsolutionshub.com regarding our eCommerce automation and store management services. Are you still looking to build or scale an automated store on Amazon, Shopify, or Walmart?"

2. KNOWLEDGE & QUESTIONS:
   - Answer any questions about our services (Amazon FBA, Shopify, Walmart, TikTok Shop, etc.) accurately and concisely (1-2 sentences) based on the company knowledge.

3. OBJECTION HANDLING & PERSUASION:
   - If the prospect is hesitant, skeptical, busy, or says they are not interested:
     * Inquire briefly with empathy: "Totally understand! Just curious, were you looking into Amazon FBA, Shopify, or Walmart specifically?"
     * Address their concern: Explain that our team handles 100% of the day-to-day operations hands-off with dedicated account managers and transparent reporting.
     * Persuade with a Senior Specialist consultation: "I won't take much of your time right now. How about I set up a quick 15-minute 1-on-1 Zoom strategy session with our Senior E-Commerce Specialist? They will show you live client store performance and share a custom roadmap for your budget with zero commitment."

4. DATE, TIME & TIMEZONE NEGOTIATION AND REAL-TIME BOOKING (CRITICAL):
   - When they agree to the 15-minute 1-on-1 Zoom strategy session:
     * Ask: "Awesome! Which day works best for your schedule — tomorrow, or another day this week?"
     * Negotiate a convenient time.
     * If the prospect gives only a time (e.g. "at 2 PM") without mentioning the day, ASK: "Which day works best for you — tomorrow, or another day this week?"
     * If the prospect mentions a time earlier today that has already passed, POLITELY SAY: "Since [time] today has already passed, did you mean tomorrow at [time] or a different upcoming day?"
     * TIMEZONE INQUIRY (MANDATORY): Always ask or verify their timezone: "And just so our calendar invite matches your exact clock, what timezone are you in?" (e.g. Eastern/EST, Pacific/PST, Central/CST, UK London time/BST, etc.)
     * IMMEDIATELY call the bookStrategySession tool:
       bookStrategySession({
         email: "${cleanLeadEmail}",
         bookingDate: "<agreed day or date>",
         bookingTime: "<agreed time>",
         timezone: "<agreed timezone>"
       })

5. NO NEED TO ASK FOR EMAIL:
   DO NOT ask for their email address since we already have ${cleanLeadEmail} on file!

6. CLOSING & DISCONNECT FLOW (MANDATORY EXACT WORDS & 2-SECOND PAUSE):
   Once bookStrategySession has been called, say EXACTLY:
   "Thank you! Your strategy session with our Senior Specialist is confirmed for [Day] at [Time] [Timezone]. I have sent your calendar invite and Zoom meeting link to your email on file (${cleanLeadEmail}). When it's time for the meeting, simply click the Zoom link to connect with our team. Have a wonderful day, goodbye!"
   After saying this, allow 2 seconds for the prospect to say "Thank you / Okay / Goodbye", and then trigger the endCall tool to disconnect.

7. IF PROSPECT FIRMLY DECLINES AFTER ATTEMPTS:
   Politely say: "No problem at all! Thank you so much for your time today. Have a wonderful day, goodbye!" and trigger endCall tool.`;
      } else {
        customSystemPrompt = `You are Alex, a top-tier Senior Sales Executive at AMZ Solutions Hub (amzsolutionshub.com).
${hasRealName ? `The prospect's name is ${customerName}.` : "The prospect's name is not specified."}
The prospect does NOT have an email on file yet.
Current Live Time Context: Today is ${nowFormatted} at ${currentTimeFormatted} PKT.

LANGUAGE RULE (STRICT MANDATORY):
- You must speak EXCLUSIVELY in fluent, professional, and clear English at all times.
- DO NOT speak in Urdu, Roman Urdu, Hindi, or any other language under any circumstance.

${conversationalHumanStyle}

${amzKnowledgeBase}

CALL CONTEXT & STEP-BY-STEP FLOW:
1. GREETING & TWO-STEP OPENER:
   - The call starts with: "${dynamicFirstMessage}"
   - When the prospect responds to your greeting (e.g., "Good", "I'm fine", "Who is this?", "Doing well, how are you?"), respond warmly:
     "Glad to hear! My name is Alex and I'm calling from AMZ Solutions Hub. I noticed you recently visited our website at amzsolutionshub.com regarding our eCommerce automation and store management services. Are you still looking to build or scale an automated store on Amazon, Shopify, or Walmart?"

2. KNOWLEDGE & QUESTIONS:
   - Answer any questions about our services (Amazon FBA, Shopify, Walmart, TikTok Shop, etc.) accurately and concisely (1-2 sentences) based on the company knowledge.

3. OBJECTION HANDLING & PERSUASION:
   - If the prospect is hesitant, skeptical, busy, or says they are not interested:
     * Inquire briefly with empathy: "Totally understand! Just curious, were you looking into Amazon FBA, Shopify, or Walmart specifically?"
     * Address their concern: Explain that our team handles 100% of the day-to-day operations hands-off with dedicated account managers and transparent reporting.
     * Persuade with a Senior Specialist consultation: "I won't take much of your time right now. How about I set up a quick 15-minute 1-on-1 Zoom strategy session with our Senior E-Commerce Specialist? They will show you live client store performance and share a custom roadmap for your budget with zero commitment."

4. DATE, TIME & TIMEZONE NEGOTIATION (CRITICAL):
   - When they agree to the 15-minute 1-on-1 Zoom strategy session:
     * Ask: "Awesome! Which day works best for your schedule — tomorrow, or another day this week?"
     * Negotiate a convenient time.
     * If the prospect gives only a time (e.g. "at 2 PM") without mentioning the day, ASK: "Which day works best for you — tomorrow, or another day this week?"
     * If the prospect mentions a time earlier today that has already passed, POLITELY SAY: "Since [time] today has already passed, did you mean tomorrow at [time] or a different upcoming day?"
     * TIMEZONE INQUIRY (MANDATORY): Always ask or verify their timezone: "And just so our calendar invite matches your exact clock, what timezone are you in?" (e.g. Eastern/EST, Pacific/PST, Central/CST, UK London time/BST, etc.)

5. SEAMLESS EMAIL CAPTURE & REAL-TIME STRATEGY SESSION BOOKING (CRITICAL):
   - Ask: "And what's the best email address to send your calendar invite and Zoom link to?"
   - FIRST-TRY COMPREHENSION (STRICT RULE):
     * When the caller speaks their email (e.g. "john@gmail.com", "rafay at gmail dot com", "j-o-h-n at yahoo dot com"):
       1. Instantly parse and capture the exact email address on their very first attempt!
       2. NEVER ask them to spell it out letter-by-letter if they already said it clearly! Only ask to spell if a single character is truly inaudible.
       3. IMMEDIATELY call BOTH saveLeadEmail({ email: "<cleaned email>" }) AND bookStrategySession({ email: "<cleaned email>", bookingDate: "<day or date>", bookingTime: "<time>", timezone: "<timezone>" }) so the email is saved in CRM and the Zoom strategy session is confirmed on the spot!
       4. Confirm cleanly in one short, pleasant sentence:
          "Got it, [say the full email clearly, e.g. john@gmail.com]. Is that correct?"
     * If the caller says "Yes" / "Correct" / "Right":
       Say: "Perfect, all set!"
     * If the caller corrects a letter or domain (e.g. "No, it's yahoo, not gmail"):
       Immediately acknowledge smoothly: "Ah, got it! [corrected email]." and call saveLeadEmail and bookStrategySession with the updated email.

6. CLOSING & DISCONNECT FLOW (MANDATORY EXACT WORDS & 2-SECOND PAUSE):
   Once day, time, timezone, and email are verified and bookStrategySession has been triggered, say EXACTLY:
   "Thank you! Your strategy session with our Senior Specialist is confirmed for [Day] at [Time] [Timezone]. I have sent your calendar invite and Zoom meeting link to [spelled email address]. When it's time for the meeting, simply click the Zoom link to connect with our team. Have a wonderful day, goodbye!"
   After saying this, allow 2 seconds for the prospect to say "Thank you / Okay / Goodbye", and then trigger the endCall tool to disconnect.

7. IF PROSPECT FIRMLY DECLINES AFTER ATTEMPTS:
   Politely say: "No problem at all! Thank you so much for your time today. Have a wonderful day, goodbye!" and trigger endCall tool.`;
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
            name: hasRealName ? customerName : undefined,
          },
          assistantOverrides: {
            firstMessage: dynamicFirstMessage,
            firstMessageInterruptionsEnabled: true,
            serverUrl: "https://salesflow-ai-main.vercel.app/api/vapi-webhook",
            serverMessages: ["end-of-call-report", "status-update", "tool-calls"],
            stopSpeakingPlan: {
              numWords: 2,
              voiceSeconds: 0.35,
              backoffSeconds: 1.0,
            },
            startSpeakingPlan: {
              waitSeconds: 0.4,
              smartEndpointingEnabled: "livekit",
            },
            backgroundSound: "office",
            backchannelingEnabled: true,
            voicemailDetection: {
              provider: "vapi",
            },
            transcriber: {
              provider: "deepgram",
              model: "nova-2",
              language: "en",
              smartFormat: true,
              keywords: [
                "Teals:2",
                "AMZ:2",
              ],
            },
            variableValues: {
              customerName: customerName || "there",
              customerEmail: cleanLeadEmail,
              agentEmail: agentEmail,
            },
            voice: CARTESIA_VOICE_CONFIG,
            model: {
              provider: "google",
              model: "gemini-2.5-flash",
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
                {
                  type: "function",
                  function: {
                    name: "saveLeadEmail",
                    description: "Call this immediately as soon as the user speaks, spells, or provides their email address, to instantly save and record their email in the CRM database.",
                    parameters: {
                      type: "object",
                      properties: {
                        email: {
                          type: "string",
                          description: "The cleaned, valid email address provided by the user (e.g. john@gmail.com).",
                        },
                      },
                      required: ["email"],
                    },
                  },
                },
                {
                  type: "function",
                  function: {
                    name: "bookStrategySession",
                    description: "Call this tool immediately when the prospect agrees to book the 1-on-1 Zoom Strategy Session and provides their day, time, timezone, and email. This schedules the session directly in the calendar, sends the Zoom confirmation email to the prospect with their exact local time, and notifies the Pakistan operations team.",
                    parameters: {
                      type: "object",
                      properties: {
                        email: {
                          type: "string",
                          description: "The prospect's confirmed email address (e.g. john@gmail.com).",
                        },
                        bookingDate: {
                          type: "string",
                          description: "The agreed day or date for the meeting (e.g. 'tomorrow', 'Thursday', 'Friday', '2026-10-15').",
                        },
                        bookingTime: {
                          type: "string",
                          description: "The agreed time for the meeting (e.g. '2:00 PM', '11:00 AM', '3 PM', '14:00').",
                        },
                        timezone: {
                          type: "string",
                          description: "The prospect's timezone or location (e.g. 'EST', 'EDT', 'PST', 'PDT', 'CST', 'CDT', 'MST', 'UK', 'London', 'GMT', 'BST', 'Eastern', etc.).",
                        },
                      },
                      required: ["email", "bookingDate", "bookingTime"],
                    },
                  },
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
 * 10b. Start Teals Web Design & AI Receptionist Call (Alex from Teals - https://teals.co/)
 */
export const startTealsWebDesignCallFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      leadId?: string;
      businessName: string;
      businessType?: string;
      phoneNumber: string;
      city?: string;
      contactPerson?: string;
      leadEmail?: string;
      whatsappNumber?: string;
      googleRating?: string;
      reviewsCount?: string;
      agentEmail?: string;
      website?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      const e164Phone = formatE164Phone(data.phoneNumber, data.city);
      if (!e164Phone || e164Phone.length < 7) {
        throw new Error(`Invalid phone number: ${data.phoneNumber}. Must be a valid phone number with country code.`);
      }

      const businessName = (data.businessName || "").trim() || "there";
      const businessType = (data.businessType || "local business").trim();
      const city = (data.city || "").trim();
      const contactPerson = (data.contactPerson || "").trim();
      const cleanEmail = (data.leadEmail || "").trim().toLowerCase();
      const cleanWhatsapp = (data.whatsappNumber || "").trim();

      // Sanitize website (exclude Google Maps URLs from being treated as their business website)
      const rawWebsite = (data.website || "").trim();
      const isGoogleMapLink =
        rawWebsite.toLowerCase().includes("google.com/map") ||
        rawWebsite.toLowerCase().includes("maps.google") ||
        rawWebsite.toLowerCase().includes("goo.gl");

      const hasWebsite = Boolean(
        rawWebsite &&
        !isGoogleMapLink &&
        rawWebsite.toLowerCase() !== "no website" &&
        rawWebsite.toLowerCase() !== "n/a" &&
        rawWebsite.toLowerCase() !== "none" &&
        rawWebsite.includes(".")
      );

      // Sanitize Business Category (resolve "No Website Leads" to actual niche)
      let resolvedCategory = (data.businessType || "").trim();
      if (!resolvedCategory || resolvedCategory.toLowerCase().includes("no website") || resolvedCategory.toLowerCase() === "lead") {
        if (/clinic|dental|doctor|medical|aesthetic|physio|chiro|health|optician|care|diagnostic|practice/i.test(businessName)) {
          resolvedCategory = "Clinic";
        } else if (/nail|spa|salon|beauty|lash|brow/i.test(businessName)) {
          resolvedCategory = "Nail Salon & Spa";
        } else if (/barber/i.test(businessName)) {
          resolvedCategory = "Barbershop";
        } else if (/fitness|gym|yoga|pilates/i.test(businessName)) {
          resolvedCategory = "Fitness & Wellness";
        } else if (/roof/i.test(businessName)) {
          resolvedCategory = "Roofing Contractor";
        } else if (/plumb/i.test(businessName)) {
          resolvedCategory = "Plumber";
        } else if (/auto|repair|garage/i.test(businessName)) {
          resolvedCategory = "Auto Repair";
        } else if (/restaurant|cafe|bar/i.test(businessName)) {
          resolvedCategory = "Restaurant";
        } else {
          resolvedCategory = "Local Business";
        }
      }

      const isClinic =
        /clinic|dental|doctor|medical|aesthetic|physio|chiro|health|optician|care|diagnostic|practice/i.test(resolvedCategory) ||
        /clinic|dental|doctor|medical|aesthetic|physio|chiro|health|optician|care|diagnostic|practice/i.test(businessName);
      const isSalon =
        /nail|spa|salon|beauty|lash|brow|barber/i.test(resolvedCategory) ||
        /nail|spa|salon|beauty|lash|brow|barber/i.test(businessName);
      const isContractor =
        /roof|plumb|electric|hvac|construct|contract|paint|remodel|auto|garage|repair/i.test(resolvedCategory) ||
        /roof|plumb|electric|hvac|construct|contract|paint|remodel|auto|garage|repair/i.test(businessName);

      const openerGreeting = contactPerson && contactPerson.toLowerCase() !== "unknown"
        ? `Hey there! How's it going? Quick question — is ${contactPerson} around by chance?`
        : isClinic
        ? `Hey there! How's it going? Quick question — is the owner or practice manager of ${businessName} around by chance?`
        : `Hey there! How's it going? Quick question — is the owner of ${businessName} around by chance?`;

      const voicemailScript = `Hey ${businessName}! This is Alex over at Teals — teals.co. Saw your great reviews online and wanted to reach out because we built a 24/7 AI phone receptionist and automated booking website setup for ${isSalon ? "salons" : isClinic ? "clinics" : "local businesses"} so you never miss a client call while you're busy working. If you'd like to check out a free 1-minute demo, shoot us a message on WhatsApp at +1 (825) 254-7471, or email careers@teals.co — that's c-a-r-e-e-r-s at t-e-a-l-s dot c-o. Have a great day!`;

      const nicheHookQuestion = isSalon
        ? `Oh awesome, hey! My name's Alex with Teals — I saw ${businessName} has great reviews, and I know when you guys have gloves on doing nails or hair it's tough to stop and grab the phone. We actually set up a 24/7 AI phone receptionist that answers callers in a real human voice, quotes your prices, and books appointments straight into your calendar${hasWebsite ? " — plus an AI booking assistant on your website" : " — and we even pair it with a modern booking website"}. Do you guys ever miss calls when the shop gets super busy?`
        : isClinic
        ? `Oh awesome, hey! My name's Alex with Teals — I saw ${businessName} online and noticed your great patient reviews. We set up a 24/7 AI front-desk receptionist for clinics that answers patient calls during peak rush hours or after closing, answers common questions, and books appointments straight into your schedule. Do you guys ever get overflow calls when the front desk is tied up with patients?`
        : isContractor
        ? `Oh awesome, hey! My name's Alex with Teals — I saw ${businessName} online and noticed your great reviews. We set up a 24/7 AI phone receptionist that answers customer calls while you're out on a job or after hours and books estimates straight into your calendar${hasWebsite ? "" : ", plus we build a modern website for you"}. Do you ever miss calls when you're tied up on a job?`
        : `Oh awesome, hey! My name's Alex with Teals — I saw ${businessName} online and noticed your great reviews. We set up a 24/7 AI phone receptionist that answers customer calls whenever you're busy or closed and books appointments straight into your calendar${hasWebsite ? " — plus an AI booking chatbot for your website" : " — and we pair it with a custom modern website"}. Do you guys ever miss calls during busy hours or after closing?`;

      const systemPrompt = `You are Alex, a warm, laid-back, ultra-natural human Account Director calling from Teals (teals.co).
You are calling ${businessName}${city ? ` in ${city}` : ""} (${resolvedCategory}).
${contactPerson ? `Owner / Contact Name: ${contactPerson}.` : ""}
${hasWebsite ? `Website Status: They have an existing website (${rawWebsite}).` : "Website Status: They DO NOT have a website right now (they only show up on Google Maps)."}

====================================================================
RULE #1 — LISTEN FIRST: HUMAN vs. VOICEMAIL vs. AUTOMATED IVR MENU
====================================================================
When the call connects, you WAIT for the other side to speak first so you know who or what answered:
1. IF IT IS AN AUTOMATED RECORDING / IVR MENU (e.g., "Thank you for calling...", "Press 1 for...", "Para español...", "Flu shots, vaccines...", "Our office hours are..."):
   - DO NOT talk to an automated recording! NEVER say "How are you doing today?" or "Gotcha" to a machine!
   - If it is a big store/pharmacy automated phone tree (like Walgreens/CVS) where no human answered, immediately call endCall without saying anything.
2. IF IT IS A VOICEMAIL GREETING (e.g., "Your call has been forwarded to voicemail", "is not available", "Please leave a message after the tone/beep"):
   - Stay completely quiet while the greeting plays.
   - Once the greeting finishes / beeps, speak this exact voicemail message once:
     "${voicemailScript}"
   - Then immediately call endCall.
3. IF A REAL HUMAN ANSWERS (e.g., "Hello?", "${businessName}, how can I help you?", "Hi, who's this?"):
   - Follow the natural human conversation flow below!

====================================================================
RULE #2 — SOUND 100% LIKE A REAL HUMAN ON A CELL PHONE (NO AI HABITS)
====================================================================
- SHORT TURNS ONLY: Speak 1 to 2 short sentences at a time, then STOP and let them talk. Never give a long speech.
- BANNED AI PHRASES (NEVER SAY THESE):
  * NEVER say "Thanks for confirming" or "Thank you for confirming"
  * NEVER say "Thanks for letting me know" or "Thanks for sharing"
  * NEVER say "Certainly!", "Absolutely!", "I understand", or "How may I assist you?"
  * NEVER say "I promise I won't waste your time" (sounds like a scripted telemarketer)
- NATURAL HUMAN CADENCE:
  * Use everyday contractions ("I'm", "we've", "don't", "it's", "that's", "you're").
  * Use natural conversational connectors ("Oh hey!", "Oh awesome,", "Yeah totally —", "Oh no worries at all!").
  * Use "..." or "—" for slight natural breathing pauses between thoughts.

====================================================================
RULE #3 — THE 3-STEP CONVERSATION FLOW THAT GETS PEOPLE TO LISTEN
====================================================================

STEP 1: WHEN A HUMAN ANSWERS ("Hello?" / "[Business Name], how can I help?")
- Do NOT launch into a pitch yet! First, acknowledge them warmly and ask for the owner in ONE casual sentence:
  "Oh hey! How's it going? ... Quick question — is ${contactPerson && contactPerson.toLowerCase() !== "unknown" ? contactPerson : `the owner of ${businessName}`} around by chance?"
- Wait for their answer!

STEP 2A: IF THEY SAY THEY ARE THE OWNER / MANAGER ("Yes, speaking", "This is him/her", "Yeah, what's up?", "How can I help you?")
- Deliver this conversational hook (2 short sentences + a super easy question that gets them talking):
  "${nicheHookQuestion}"
- Wait for them to reply!

STEP 2B: IF THEY ARE A RECEPTIONIST / STAFF & OWNER IS BUSY OR NOT IN ("No, he's not here", "She's busy with a client", "What is this about?")
- Be super friendly and low-pressure — never argue with staff! Pivot immediately to sending a 1-minute sample for the owner:
  "Oh no worries at all! Hey, my name's Alex — we actually put together a quick 1-minute sample of a 24/7 AI phone receptionist${hasWebsite ? " and website booking assistant" : " and custom booking website"} for ${businessName} so you guys don't have to stop working to answer price and booking calls. What's a good WhatsApp number or email I can text that sample to so the owner can check it out later?"

STEP 3: HANDLING THEIR RESPONSE & CLOSING FOR WHATSAPP OR EMAIL
- If they say "Yeah sometimes we miss calls" / "How does it work?" / "How much does it cost?":
  * Keep it simple and real:
    "Yeah totally — basically whenever you're busy with a client or closed for the night, the AI picks up in a natural human voice, answers their questions about your services and prices, and books them right into your calendar${hasWebsite ? ", plus we put an AI booking chat on your website." : ", and we also build you a clean modern website so people finding you on Google can book online."} Honestly the coolest way to see it is a quick 1-minute demo we put together for ${businessName} — is it easier if I text that link to your WhatsApp, or is email better?"
- If they say "We're fine / We don't need a website / We already take our own calls":
  * Stay super chill and disarming:
    "Oh yeah totally fair! Most shops we talk to handle calls themselves too — they mainly just use the AI for after-hours or when everyone's hands are full with clients so callers don't hang up and call the next shop down the street. Tell you what, let me just shoot you a 60-second sample link on WhatsApp or email with zero pressure, and if you ever want it you've got it. Which one's easier for you?"

====================================================================
RULE #4 — CAPTURING WHATSAPP / EMAIL & ENDING THE CALL CLEANLY
====================================================================
- Only ask for WhatsApp or Email when you are at Step 2B or Step 3 — NEVER randomly ask for an email out of nowhere if they didn't mention it!
- As soon as they give a WhatsApp number, call saveLeadDetails({ whatsapp: "<number>" }).
- As soon as they give an Email address, call saveLeadDetails({ email: "<email>" }).
- If they ask to hop on a Zoom call, confirm the day/time and call bookZoomMeeting.
- Once you've saved their WhatsApp or Email, wrap up warmly:
  "Awesome, got that down! I'll shoot that sample over to you right now so you can check it out whenever you have a breather. Appreciate you, have a great rest of your day!" and call endCall.
- If they firmly say "Not interested, take me off your list":
  "Oh no problem at all, won't bug you again! Have a great rest of your day." and call endCall.`;

      const assistantConfig = {
        firstMessage: "",
        firstMessageMode: "assistant-waits-for-user",
        firstMessageInterruptionsEnabled: true,
        voicemailDetection: {
          provider: "vapi",
        },
        voicemailMessage: voicemailScript,
        endCallMessage: "Have a wonderful day!",
        backgroundSound: "office",
        backchannelingEnabled: true,
        hooks: [
          {
            on: "customer.speech.timeout",
            options: {
              timeoutSeconds: 3.5,
              triggerMaxCount: 2,
              triggerResetMode: "onUserSpeech",
            },
            do: [
              {
                type: "say",
                exact: openerGreeting,
              },
            ],
          },
        ],
        serverUrl: "https://salesflow-ai-main.vercel.app/api/vapi-webhook",
        serverMessages: ["end-of-call-report", "status-update", "tool-calls"],
        silenceTimeoutSeconds: 15,
        maxDurationSeconds: 600,
        stopSpeakingPlan: {
          numWords: 1,
          voiceSeconds: 0.2,
          backoffSeconds: 1.0,
        },
        startSpeakingPlan: {
          waitSeconds: 0.4,
          smartEndpointingEnabled: "livekit",
        },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
          smartFormat: true,
          keywords: [
            "Teals:2",
          ],
        },
        voice: CARTESIA_VOICE_CONFIG,
        model: {
          provider: "google",
          model: "gemini-2.5-flash",
          temperature: 0.6,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
          ],
          tools: [
            {
              type: "endCall",
            },
            {
              type: "function",
              function: {
                name: "saveLeadDetails",
                description: "Call immediately whenever the prospect mentions their WhatsApp number, email address, or notes so it gets recorded in real-time.",
                parameters: {
                  type: "object",
                  properties: {
                    whatsapp: { type: "string", description: "The WhatsApp phone number provided." },
                    email: { type: "string", description: "The email address provided." },
                    notes: { type: "string", description: "Any key notes or requirements." },
                  },
                },
              },
            },
            {
              type: "function",
              function: {
                name: "bookZoomMeeting",
                description: "Call when the prospect agrees to a Zoom walkthrough session.",
                parameters: {
                  type: "object",
                  properties: {
                    email: { type: "string", description: "Email address." },
                    whatsapp: { type: "string", description: "WhatsApp number." },
                    bookingDate: { type: "string", description: "Agreed date or day." },
                    bookingTime: { type: "string", description: "Agreed time." },
                    timezone: { type: "string", description: "Timezone." },
                  },
                  required: ["bookingDate", "bookingTime"],
                },
              },
            },
          ],
        },
      };

      // Multi-Account Round-Robin & Auto-Failover
      const startIndex = vapiCallRotationIndex % VAPI_ACCOUNTS_POOL.length;
      vapiCallRotationIndex++;
      const accountsToTry = [
        ...VAPI_ACCOUNTS_POOL.slice(startIndex),
        ...VAPI_ACCOUNTS_POOL.slice(0, startIndex),
      ];

      let lastError = "";

      for (const account of accountsToTry) {
        try {
          console.log(`[VAPI-DIAL] Attempting call to ${e164Phone} (${businessName}) via ${account.name} [${account.phoneNumber}]...`);

          const bodyPayload: any = {
            phoneNumberId: account.phoneNumberId,
            customer: {
              number: e164Phone,
              name: businessName,
            },
            assistant: assistantConfig,
          };

          const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${account.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bodyPayload),
          });

          const responseData = await vapiResponse.json();
          if (vapiResponse.ok && responseData?.id) {
            console.log(`[VAPI-DIAL] SUCCESS via ${account.name} (${account.phoneNumber})! Call ID: ${responseData.id}`);
            return {
              success: true,
              callId: responseData.id,
              phone: e164Phone,
              accountUsed: account.name,
              callerNumber: account.phoneNumber,
              apiKeyUsed: account.apiKey,
              message: `Dialed from ${account.name} (${account.phoneNumber})!`,
            };
          }

          lastError = responseData?.message || responseData?.error || "Account dial failed";
          console.warn(`[VAPI-DIAL] ${account.name} failed: ${lastError}. Auto-failing over to next account in pool...`);
        } catch (accErr: any) {
          lastError = accErr?.message || "Dial exception";
          console.warn(`[VAPI-DIAL] ${account.name} exception: ${lastError}. Failing over...`);
        }
      }

      throw new Error(`All accounts in rotation pool failed. Last error: ${lastError}`);
    } catch (err: any) {
      console.error("Start Teals Web Design call error:", err);
      return { success: false, error: err?.message || "Failed to start call" };
    }
  });

export function computeCallDurationSecs(callObj: any): number {
  if (!callObj) return 0;
  if (typeof callObj.duration === "number" && callObj.duration > 0) {
    return Math.round(callObj.duration);
  }
  if (typeof callObj.durationSeconds === "number" && callObj.durationSeconds > 0) {
    return Math.round(callObj.durationSeconds);
  }
  if (typeof callObj.artifact?.duration === "number" && callObj.artifact.duration > 0) {
    return Math.round(callObj.artifact.duration);
  }
  if (typeof callObj.artifact?.recordingDuration === "number" && callObj.artifact.recordingDuration > 0) {
    return Math.round(callObj.artifact.recordingDuration);
  }
  if (callObj.startedAt && callObj.endedAt) {
    const start = new Date(callObj.startedAt).getTime();
    const end = new Date(callObj.endedAt).getTime();
    if (!isNaN(start) && !isNaN(end) && end > start) {
      return Math.round((end - start) / 1000);
    }
  }
  if (Array.isArray(callObj.costs)) {
    const vapiCost = callObj.costs.find((co: any) => co?.type === "vapi" && typeof co?.minutes === "number" && co.minutes > 0);
    if (vapiCost) return Math.round(vapiCost.minutes * 60);
    const minCost = callObj.costs.find((co: any) => typeof co?.minutes === "number" && co.minutes > 0);
    if (minCost) return Math.round(minCost.minutes * 60);
  }
  const messages = callObj.artifact?.messages || callObj.messages || [];
  if (Array.isArray(messages) && messages.length > 2) {
    return Math.max(15, messages.length * 6);
  }
  if (typeof callObj.transcript === "string" && callObj.transcript.trim().length > 30) {
    return 30;
  }
  return 0;
}

/**
 * 11. Fetch Call Logs, Audio Recordings & Transcripts from Vapi
 */
export const getVapiCallLogsFn = createServerFn({ method: "POST" })
  .validator((data: { limit?: number; phoneNumber?: string } = {}) => data)
  .handler(async ({ data }) => {
    try {
      const limit = data?.limit || 25;
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
        calls.slice(0, 20).map(async (c: any) => {
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

            const durationSec =
              computeCallDurationSecs(single) || computeCallDurationSecs(c);

            return {
              ...c,
              ...single,
              duration: durationSec,
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

      const validCalls = enrichedCalls.filter(
        (c: any) =>
          c &&
          c.endedReason !== "call-deleted" &&
          c.status !== "deleted" &&
          (c.duration > 0 || c.transcript || c.recordingUrl || c.status === "ended")
      );

      return { success: true, calls: validCalls };
    } catch (err: any) {
      console.error("Fetch Vapi calls error:", err);
      return { success: false, error: err?.message, calls: [] };
    }
  });

/**
 * 12. Get Specific Call Status, Duration, Recording, Live Messages & Transcript by Call ID
 */
export const getVapiCallStatusFn = createServerFn({ method: "POST" })
  .validator((data: { callId: string; apiKey?: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (!data?.callId) return { success: false, status: "ended" };

      const keysToTry = data.apiKey
        ? [data.apiKey, ...VAPI_ACCOUNTS_POOL.map((a) => a.apiKey).filter((k) => k !== data.apiKey)]
        : VAPI_ACCOUNTS_POOL.map((a) => a.apiKey);

      for (const key of keysToTry) {
        try {
          const res = await fetch(`https://api.vapi.ai/call/${data.callId}`, {
            headers: {
              Authorization: `Bearer ${key}`,
            },
          });

          if (!res.ok) continue;

          const call = await res.json();
          const presignedAudio =
            call.artifact?.presignedMonoUrl ||
            call.artifact?.presignedStereoUrl ||
            call.recordingUrl ||
            call.stereoRecordingUrl ||
            "";

          const durationSec = computeCallDurationSecs(call);

          return {
            success: true,
            status: call.status,
            endedReason: call.endedReason,
            duration: durationSec,
            recordingUrl: presignedAudio,
            transcript: call.transcript || call.artifact?.transcript || "",
            summary: call.summary || call.analysis?.summary || "",
            messages: call.messages || [],
            listenUrl: call.monitor?.listenUrl || "",
            controlUrl: call.monitor?.controlUrl || "",
          };
        } catch {}
      }

      return { success: false, status: "ended" };
    } catch (err: any) {
      return { success: false, status: "ended" };
    }
  });

/**
 * 12B. Manually Stop/Hangup a Vapi Phone Call
 */
export const stopVapiCallFn = createServerFn({ method: "POST" })
  .validator((data: { callId: string; apiKey?: string }) => data)
  .handler(async ({ data }) => {
    try {
      if (!data?.callId) return { success: false };

      const keysToTry = data.apiKey
        ? [data.apiKey, ...VAPI_ACCOUNTS_POOL.map((a) => a.apiKey).filter((k) => k !== data.apiKey)]
        : VAPI_ACCOUNTS_POOL.map((a) => a.apiKey);

      for (const key of keysToTry) {
        try {
          const res = await fetch(`https://api.vapi.ai/call/${data.callId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${key}`,
            },
          });
          if (res.ok) return { success: true };
        } catch {}
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  });

/**
 * 12C. Get Configured Vapi Accounts & Phone Numbers in Pool
 */
export const getVapiAccountsPoolFn = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    return {
      success: true,
      totalLines: VAPI_ACCOUNTS_POOL.length,
      accounts: VAPI_ACCOUNTS_POOL.map((a, idx) => ({
        id: a.id,
        index: idx + 1,
        name: a.name,
        email: a.email,
        phoneNumber: a.phoneNumber,
        phoneNumberId: a.phoneNumberId,
        maskedKey: a.apiKey ? `${a.apiKey.slice(0, 6)}...${a.apiKey.slice(-4)}` : "",
        isPrimary: Boolean(a.isPrimary),
      })),
    };
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
      const { data: existingMeetings } = await supabase
        .from("meetings")
        .select("id, scheduled_time, created_at, title")
        .gte("created_at", tenMinutesAgo);

      const isDuplicate = (existingMeetings || []).some(
        (m: any) => m.title && m.title.includes(clientEmail)
      );

      if (isDuplicate) {
        console.log(`Meeting for ${clientEmail} already booked recently. Skipping duplicate confirmation email.`);
        return {
          success: true,
          booked: true,
          clientEmail,
          bookingDate: bookingDateStr,
          bookingTime: bookingTimeStr,
          scheduledIso,
        };
      }

      // 2. Insert Meeting into Supabase (Correct Schema: lead_id, agent_email, title, scheduled_time, completed)
      const zoomUrl = "https://zoom.us/j/5539578967";
      const meetingTitle = `Sales Meeting with ${clientName} (${clientEmail}) on ${scheduleInfo.clientFormattedDate} @ ${scheduleInfo.clientFormattedTime} || PKT: ${scheduleInfo.agentFormattedTime} || ZOOM: ${zoomUrl}`;

      await supabase.from("meetings").insert({
        lead_id: data.leadId || null,
        agent_email: assignedAgent,
        title: meetingTitle,
        scheduled_time: scheduledIso,
        completed: false,
        reminder_24h_sent: false,
        reminder_1h_sent: false,
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
