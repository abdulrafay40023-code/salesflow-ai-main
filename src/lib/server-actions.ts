import { createServerFn } from "@tanstack/react-start";
import {
  send1DayMeetingReminderEmail,
  send1HourMeetingReminderEmail,
  sendBookingFormEmail,
  sendMeetingConfirmationEmail,
  sendMeetingStartedNowEmail,
  sendReminderEmail,
  sendWelcomeEmail,
} from "./email-service";
import { supabase } from "./supabase";

/**
 * 1. Trigger Welcome Email
 */
export const triggerWelcomeEmailFn = createServerFn({ method: "POST" })
  .validator((data: { email: string; leadId?: string }) => data)
  .handler(async ({ data }) => {
    try {
      await sendWelcomeEmail({ toEmail: data.email });

      if (data.leadId) {
        await supabase.from("emails_sent").insert({
          lead_id: data.leadId,
          lead_email: data.email,
          subject: "Welcome to Nexa CRM",
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
      leadId?: string;
      leadName?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const agentEmail = data.agentEmail || "garryamelia6265@gmail.com";

      // 1. Send immediate Confirmation Email to BOTH Lead & Agent
      await sendMeetingConfirmationEmail({
        leadEmail: data.leadEmail,
        agentEmail: agentEmail,
        meetingDate: data.date,
        meetingTime: data.time,
      });

      // 2. Log confirmation email in emails_sent
      await supabase.from("emails_sent").insert({
        lead_id: data.leadId || null,
        lead_email: data.leadEmail,
        subject: `Meeting Confirmed: ${data.date} at ${data.time}`,
        sequence_type: "meeting_confirmed",
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      // 3. Insert record into Supabase meetings table
      if (data.leadId) {
        const scheduledTime = new Date(`${data.date}T${data.time}`).toISOString();
        await supabase.from("meetings").insert({
          lead_id: data.leadId,
          title: `Sales Meeting with ${data.leadName || data.leadEmail}`,
          scheduled_time: scheduledTime,
        });

        // Update lead status to 'meeting'
        await supabase.from("leads").update({ status: "meeting" }).eq("id", data.leadId);
      }

      return { success: true };
    } catch (err: any) {
      console.error("Confirm meeting server error:", err);
      return { success: false, error: err?.message };
    }
  });

/**
 * 5. Automated Background Check for 24-Hour, 1-Hour, and Meeting Starting NOW Emails
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
        .select("id, lead_id, scheduled_time, reminder_24h_sent, reminder_1h_sent, reminder_started_sent")
        .eq("completed", false);

      if (!upcomingMeetings) return { success: true, processed: 0 };

      let count = 0;
      for (const m of upcomingMeetings) {
        const meetingTime = new Date(m.scheduled_time);

        // Fetch lead email AND assigned agent name
        const { data: lead } = await supabase
          .from("leads")
          .select("email, assigned_agent_name, agent")
          .eq("id", m.lead_id)
          .single();

        if (!lead || !lead.email) continue;
        const agentEmail = lead.assigned_agent_name || lead.agent || "garryamelia6265@gmail.com";
        const formattedTimeStr = meetingTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        // Stage 1: 24-Hour Reminder (Sent 1 day before)
        if (!m.reminder_24h_sent && meetingTime <= oneDayLater && meetingTime > oneHourLater) {
          await send1DayMeetingReminderEmail({
            leadEmail: lead.email,
            agentEmail: agentEmail,
            meetingDate: meetingTime.toLocaleDateString(),
            meetingTime: formattedTimeStr,
          });
          await supabase.from("meetings").update({ reminder_24h_sent: true }).eq("id", m.id);
          count++;
        }

        // Stage 2: 1-Hour Reminder (Sent 60 minutes before)
        if (!m.reminder_1h_sent && meetingTime <= oneHourLater && meetingTime > now) {
          await send1HourMeetingReminderEmail({
            leadEmail: lead.email,
            agentEmail: agentEmail,
            meetingTime: formattedTimeStr,
          });
          await supabase.from("meetings").update({ reminder_1h_sent: true }).eq("id", m.id);
          count++;
        }

        // Stage 3: Meeting Starting NOW (Sent right at the scheduled meeting time)
        if (!m.reminder_started_sent && now >= meetingTime) {
          await sendMeetingStartedNowEmail({
            leadEmail: lead.email,
            agentEmail: agentEmail,
            meetingTime: formattedTimeStr,
          });
          await supabase
            .from("meetings")
            .update({ reminder_started_sent: true, completed: true })
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

