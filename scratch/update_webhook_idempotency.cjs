const fs = require('fs');

const webhookPath = 'api/vapi-webhook.ts';
let code = fs.readFileSync(webhookPath, 'utf8');

const oldWebhookBooking = `        let scheduledIso: string;
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

        // 2. Insert Meeting Record into Supabase
        await supabase.from("meetings").insert({
          title: \`AI Sales Demo with \${clientName}\`,
          scheduled_time: scheduledIso,
          lead_email: clientEmail,
          agent_email: assignedAgent,
          status: "confirmed",
          completed: false,
          created_at: nowIso,
        });

        // 3. Send Official Meeting Confirmation Email to Client & Assigned Agent
        try {
          await sendMeetingConfirmationEmail({
            leadEmail: clientEmail,
            agentEmail: assignedAgent,
            meetingDate: bookingDateStr,
            meetingTime: bookingTimeStr,
          });
          console.log(\`Confirmation email sent successfully to \${clientEmail} & \${assignedAgent}\`);
        } catch (emailErr) {
          console.error("Failed to send meeting confirmation email:", emailErr);
        }`;

const newWebhookBooking = `        // Smart Future Time Calculation:
        let scheduledDate = new Date(\`\${bookingDateStr} \${bookingTimeStr}\`);
        if (isNaN(scheduledDate.getTime())) {
          scheduledDate = new Date(\`\${tomorrow.toISOString().split("T")[0]} \${bookingTimeStr}\`);
        }
        if (scheduledDate.getTime() <= now.getTime()) {
          bookingDateStr = tomorrow.toISOString().split("T")[0];
          scheduledDate = new Date(\`\${bookingDateStr} \${bookingTimeStr}\`);
        }
        const scheduledIso = scheduledDate.toISOString();
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
          console.log(\`Webhook: Meeting for \${clientEmail} already booked recently (\${existingMeeting.id}). Skipping duplicate confirmation email.\`);
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
          title: \`AI Sales Demo with \${clientName}\`,
          scheduled_time: scheduledIso,
          lead_email: clientEmail,
          agent_email: assignedAgent,
          status: "confirmed",
          completed: false,
          created_at: nowIso,
        });

        // 3. Send Official Meeting Confirmation Email to Client & Assigned Agent
        try {
          await sendMeetingConfirmationEmail({
            leadEmail: clientEmail,
            agentEmail: assignedAgent,
            meetingDate: bookingDateStr,
            meetingTime: bookingTimeStr,
          });
          console.log(\`Confirmation email sent successfully to \${clientEmail} & \${assignedAgent}\`);
        } catch (emailErr) {
          console.error("Failed to send meeting confirmation email:", emailErr);
        }`;

code = code.replace(oldWebhookBooking, newWebhookBooking);
fs.writeFileSync(webhookPath, code, 'utf8');
console.log('vapi-webhook.ts updated with single email idempotency lock and future date handling!');