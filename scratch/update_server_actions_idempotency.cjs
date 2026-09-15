const fs = require('fs');

const serverActionsPath = 'src/lib/server-actions.ts';
let code = fs.readFileSync(serverActionsPath, 'utf8');

// 1. Add current date & time to system prompt in startVapiPhoneCallFn
code = code.replace(
  /const customerName = data\.leadName \|\| "Valued Prospect";\s*const agentEmail = data\.agentEmail \|\| PRIMARY_ADMIN_EMAIL;/,
  `const customerName = data.leadName || "Valued Prospect";
      const agentEmail = data.agentEmail || PRIMARY_ADMIN_EMAIL;
      const nowFormatted = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      const currentTimeFormatted = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });`
);

code = code.replace(
  /The prospect's name is \$\{customerName\}\.\s*The prospect's email is ALREADY verified and on file: \$\{cleanLeadEmail\}\./,
  `The prospect's name is \${customerName}.
The prospect's email is ALREADY verified and on file: \${cleanLeadEmail}.
Current Reference Time: Today is \${nowFormatted} at \${currentTimeFormatted}. Always book demo slots for future upcoming times (e.g. tomorrow or upcoming weekdays).`
);

code = code.replace(
  /The prospect's name is \$\{customerName\}\.\s*The prospect does NOT have an email on file yet\./,
  `The prospect's name is \${customerName}.
The prospect does NOT have an email on file yet.
Current Reference Time: Today is \${nowFormatted} at \${currentTimeFormatted}. Always book demo slots for future upcoming times (e.g. tomorrow or upcoming weekdays).`
);

// 2. Add future date rollover & single email idempotency lock in processVapiCallBookingFn
const oldBookingLogic = `      let scheduledIso: string;
      try {
        const testDate = new Date(\`\${bookingDateStr} \${bookingTimeStr}\`);
        if (isNaN(testDate.getTime())) {
          scheduledIso = tomorrow.toISOString();
        } else {
          scheduledIso = testDate.toISOString();
        }
      } catch {
        scheduledIso = tomorrow.toISOString();
      }
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

      // 2. Insert Meeting into Supabase (checked by check-reminders cron for automated 24h, 1h, 5m Zoom link reminders)
      await supabase.from("meetings").insert({
        title: \`AI Sales Demo with \${clientName}\`,
        scheduled_time: scheduledIso,
        lead_email: clientEmail,
        agent_email: assignedAgent,
        status: "confirmed",
        completed: false,
        created_at: nowIso,
      });

      // 3. Send Meeting Confirmation Email to BOTH Lead & Assigned Agent
      try {
        await sendMeetingConfirmationEmail({
          leadEmail: clientEmail,
          agentEmail: assignedAgent,
          meetingDate: bookingDateStr,
          meetingTime: bookingTimeStr,
        });
      } catch (e) {
        console.error("Confirmation email error:", e);
      }`;

const newBookingLogic = `      // Smart Future Time Calculation:
      let scheduledDate = new Date(\`\${bookingDateStr} \${bookingTimeStr}\`);
      if (isNaN(scheduledDate.getTime())) {
        scheduledDate = new Date(\`\${tomorrow.toISOString().split("T")[0]} \${bookingTimeStr}\`);
      }
      // If requested time is already in the past (e.g. today 12 PM when call is 8 PM), schedule for tomorrow!
      if (scheduledDate.getTime() <= now.getTime()) {
        bookingDateStr = tomorrow.toISOString().split("T")[0];
        scheduledDate = new Date(\`\${bookingDateStr} \${bookingTimeStr}\`);
      }
      const scheduledIso = scheduledDate.toISOString();
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
        console.log(\`Meeting for \${clientEmail} already booked recently (\${existingMeeting.id}). Skipping duplicate confirmation email.\`);
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
        title: \`AI Sales Demo with \${clientName}\`,
        scheduled_time: scheduledIso,
        lead_email: clientEmail,
        agent_email: assignedAgent,
        status: "confirmed",
        completed: false,
        created_at: nowIso,
      });

      // 3. Send Exactly ONE Meeting Confirmation Email to BOTH Lead & Assigned Agent
      try {
        await sendMeetingConfirmationEmail({
          leadEmail: clientEmail,
          agentEmail: assignedAgent,
          meetingDate: bookingDateStr,
          meetingTime: bookingTimeStr,
        });
      } catch (e) {
        console.error("Confirmation email error:", e);
      }`;

code = code.replace(oldBookingLogic, newBookingLogic);

fs.writeFileSync(serverActionsPath, code, 'utf8');
console.log('server-actions.ts updated with single email idempotency and future date calculation!');