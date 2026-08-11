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
  .validator((data: { email: string; leadId?: string; agentEmail?: string }) => data)
  .handler(async ({ data }) => {
    try {
      await sendWelcomeEmail({ toEmail: data.email, agentEmail: data.agentEmail });

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

      // 1. Case-insensitive lookup for existing lead in Supabase leads table
      const { data: leadRows } = await supabase
        .from("leads")
        .select("id, assigned_agent_name, agent, email")
        .ilike("email", cleanLeadEmail);

      const existingLead = leadRows && leadRows.length > 0 ? leadRows[0] : null;

      if (existingLead) {
        if (existingLead.id) leadId = existingLead.id;
        const agentField = existingLead.assigned_agent_name || existingLead.agent;
        if (agentField && agentField !== "Unassigned" && agentField.trim() !== "") {
          realAgentEmail = agentField.trim();
        }
      }

      if (!realAgentEmail || realAgentEmail === "Unassigned" || !realAgentEmail.includes("@")) {
        realAgentEmail = "garryamelia6265@gmail.com";
      }

      // 2. Send immediate Confirmation Email to Lead, Working Agent & Admin
      await sendMeetingConfirmationEmail({
        leadEmail: data.leadEmail,
        agentEmail: realAgentEmail,
        meetingDate: data.date,
        meetingTime: data.time,
      });

      // 3. Update existing lead or create only if truly new
      if (leadId) {
        await supabase
          .from("leads")
          .update({ status: "meeting", assigned_agent_name: realAgentEmail })
          .eq("id", leadId);
      } else {
        const { data: newLead } = await supabase
          .from("leads")
          .insert({
            name: data.leadName || data.leadEmail.split("@")[0],
            email: cleanLeadEmail,
            status: "meeting",
            assigned_agent_name: realAgentEmail,
          })
          .select("id")
          .single();
        leadId = newLead?.id;
      }

      // 4. Log confirmation email in emails_sent
      await supabase.from("emails_sent").insert({
        lead_id: leadId || null,
        lead_email: data.leadEmail,
        subject: `Meeting Confirmed: ${data.date} at ${data.time}`,
        sequence_type: "meeting_confirmed",
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      // 5. Calculate exact scheduled ISO timestamp & short-notice flags
      const now = new Date();
      const rawTime = data.rawTime || "10:00";
      const isoStr = data.scheduledIso || `${data.date}T${rawTime}:00+05:00`;
      const meetingDateTime = new Date(isoStr);

      const scheduledIso = isNaN(meetingDateTime.getTime())
        ? now.toISOString()
        : meetingDateTime.toISOString();

      const diffMs = meetingDateTime.getTime() - now.getTime();
      const isWithin24h = diffMs <= 24 * 60 * 60 * 1000;
      const isWithin1h = diffMs <= 60 * 60 * 1000;

      // 6. Insert meeting into Supabase meetings table
      const { data: insertedMeeting } = await supabase
        .from("meetings")
        .insert({
          lead_id: leadId || null,
          title: `Sales Meeting with ${data.leadName || data.leadEmail} (${data.leadEmail})`,
          scheduled_time: scheduledIso,
          reminder_24h_sent: isWithin24h ? true : false,
          reminder_1h_sent: isWithin1h ? true : false,
          completed: false,
        })
        .select("id")
        .single();

      // 7. If scheduled meeting time is starting right now or already past, fire immediately!
      if (diffMs <= 0) {
        await sendMeetingStartedNowEmail({
          leadEmail: data.leadEmail,
          agentEmail: realAgentEmail,
          meetingTime: data.time,
        });

        if (insertedMeeting?.id) {
          await supabase
            .from("meetings")
            .update({ completed: true })
            .eq("id", insertedMeeting.id);
        }
      } else if (diffMs > 0 && diffMs <= 45 * 60 * 1000 && insertedMeeting?.id) {
        // Schedule precise server-side timer to fire at the EXACT minute when meeting time arrives!
        const meetingId = insertedMeeting.id;
        setTimeout(async () => {
          try {
            const { data: freshMeeting } = await supabase
              .from("meetings")
              .select("completed")
              .eq("id", meetingId)
              .single();

            if (freshMeeting && !freshMeeting.completed) {
              await sendMeetingStartedNowEmail({
                leadEmail: data.leadEmail,
                agentEmail: realAgentEmail,
                meetingTime: data.time,
              });
              await supabase
                .from("meetings")
                .update({ completed: true })
                .eq("id", meetingId);
            }
          } catch (e) {
            console.error("Scheduled meeting email trigger error:", e);
          }
        }, diffMs);
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
        .select("id, lead_id, scheduled_time, reminder_24h_sent, reminder_1h_sent, completed")
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
        if (!m.reminder_1h_sent && meetingTime <= oneHourLater && meetingTime > now) {
          await send1HourMeetingReminderEmail({
            leadEmail: leadEmail,
            agentEmail: agentEmail,
            meetingTime: formattedTimeStr,
          });
          await supabase.from("meetings").update({ reminder_1h_sent: true }).eq("id", m.id);
          count++;
        }

        // Stage 3: Meeting Starting NOW (Sent right at the scheduled meeting time)
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

