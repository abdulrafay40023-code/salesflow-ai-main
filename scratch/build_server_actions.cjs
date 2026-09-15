const fs = require('fs');

const serverActionsPath = 'src/lib/server-actions.ts';
let sa = fs.readFileSync(serverActionsPath, 'utf8');

// Ensure imports at top include vapi-client and sendMeetingCancellationEmail
if (!sa.includes('sendMeetingCancellationEmail')) {
  sa = sa.replace('sendWelcomeEmail,', 'sendWelcomeEmail,\n  sendMeetingCancellationEmail,');
}

if (!sa.includes('vapi-client')) {
  sa = sa.replace(
    'import { createZoomMeeting } from "./zoom-service";',
    `import { createZoomMeeting } from "./zoom-service";
import {
  VAPI_PRIVATE_KEY,
  VAPI_ASSISTANT_ID,
  VAPI_PHONE_NUMBER_ID,
  formatE164Phone,
} from "./vapi-client";

const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";`
  );
}

const vapiFunctions = `
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
        throw new Error(\`Invalid phone number: \${data.phoneNumber}. Must be a valid phone number with country code.\`);
      }

      const cleanLeadEmail = (data.leadEmail || "").trim().toLowerCase();
      const hasKnownEmail = Boolean(cleanLeadEmail && cleanLeadEmail.includes("@") && cleanLeadEmail.includes("."));
      const customerName = data.leadName || "Valued Prospect";
      const agentEmail = data.agentEmail || PRIMARY_ADMIN_EMAIL;

      // Dynamic System Prompt customized for whether lead has email or needs email collection
      let customSystemPrompt = "";
      if (hasKnownEmail) {
        customSystemPrompt = \`You are Alex, a top-tier Senior Sales Executive at Teals CRM.
The prospect's name is \${customerName}.
The prospect's email is ALREADY verified and on file: \${cleanLeadEmail}.

YOUR MISSION & CONVERSATION FLOW:
1. Connect warmly and ask how they currently manage leads and follow-ups.
2. Listen to their challenges, then pitch how Teals CRM automates lead capture and timely follow-ups.
3. Offer a quick 15-minute demo: "Would you be open to a quick 15-minute demo to see how it works?"
4. When they agree, ask an open-ended question: "Awesome! What day and time works best for your schedule for a quick 15-minute demo?"
5. DO NOT ASK FOR THEIR EMAIL ADDRESS since we already have \${cleanLeadEmail} on file!
6. Once they choose their day and time (e.g. tomorrow at 2 PM, Thursday 11 AM, etc.):
   Say: "Awesome! Your demo is confirmed for [Day] at [Time]. I have sent your calendar invite and meeting link to your email on file (\${cleanLeadEmail}). Looking forward to speaking with you then. Have a wonderful day, goodbye!"
7. IMMEDIATELY trigger the endCall tool in this turn to hang up the phone.\`;
      } else {
        customSystemPrompt = \`You are Alex, a top-tier Senior Sales Executive at Teals CRM.
The prospect's name is \${customerName}.
The prospect does NOT have an email on file yet.

YOUR MISSION & CONVERSATION FLOW:
1. Connect warmly and ask how they currently manage leads and follow-ups.
2. Listen to their challenges, then pitch how Teals CRM automates lead capture and timely follow-ups.
3. Offer a quick 15-minute demo: "Would you be open to a quick 15-minute demo to see how it works?"
4. When they agree, ask an open-ended question: "Awesome! What day and time works best for your schedule for a quick 15-minute demo?"
5. Confirm their chosen time: "Got it! [Day & Time] works great."
6. STEP TO GET EMAIL:
   Ask: "And what is the best email address to send your calendar invite and meeting link to?"
7. VERIFY EMAIL SWIFTLY & NATURALLY:
   Listen carefully to their email address. Repeat it back cleanly to confirm:
   "Just to make sure I have that exact, is that [clean email address] — is that correct?"
   Wait for the prospect to say "Yes", "Correct", "That is right", or "Haan".
   If they correct any part, acknowledge smoothly, adjust it, and confirm.
8. CLOSING & IMMEDIATE HANGUP:
   Once confirmed, say:
   "Awesome! Your demo is confirmed for [Day] at [Time]. I have sent the confirmation email and calendar invite to [email]. Looking forward to speaking with you then. Have a wonderful day, goodbye!"
9. IMMEDIATELY trigger the endCall tool in this turn to hang up the phone.\`;
      }

      console.log(\`Initiating Vapi Outbound Call to \${e164Phone} via Assistant \${VAPI_ASSISTANT_ID} (hasKnownEmail: \${hasKnownEmail})\`);

      const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          Authorization: \`Bearer \${VAPI_PRIVATE_KEY}\`,
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
        subject: \`📞 AI Outbound Call Initiated to \${e164Phone} (\${customerName})\`,
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
        \`https://api.vapi.ai/call?limit=\${limit}&assistantId=\${VAPI_ASSISTANT_ID}\`,
        {
          headers: {
            Authorization: \`Bearer \${VAPI_PRIVATE_KEY}\`,
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
            const singleRes = await fetch(\`https://api.vapi.ai/call/\${c.id}\`, {
              headers: {
                Authorization: \`Bearer \${VAPI_PRIVATE_KEY}\`,
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
      const res = await fetch(\`https://api.vapi.ai/call/\${data.callId}\`, {
        headers: {
          Authorization: \`Bearer \${VAPI_PRIVATE_KEY}\`,
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
      const res = await fetch(\`https://api.vapi.ai/call/\${data.callId}\`, {
        method: "DELETE",
        headers: {
          Authorization: \`Bearer \${VAPI_PRIVATE_KEY}\`,
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
        const res = await fetch(\`https://api.vapi.ai/call/\${data.callId}\`, {
          headers: {
            Authorization: \`Bearer \${VAPI_PRIVATE_KEY}\`,
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

      // Robust Spoken Email Normalizer (handles "at", "dot", spaces, and spoken punctuation)
      function normalizeSpokenEmail(raw: string): string | null {
        if (!raw) return null;
        let s = raw.toLowerCase().trim();
        s = s
          .replace(/\\bat\\s+the\\s+rate\\s+(?:of\\s+)?/gi, "@")
          .replace(/\\bat\\b/gi, "@")
          .replace(/\\bdot\\b/gi, ".")
          .replace(/\\bunderscore\\b/gi, "_")
          .replace(/\\b(?:dash|hyphen)\\b/gi, "-");
        s = s.replace(/\\s*@\\s*/g, "@").replace(/\\s*\\.\\s*/g, ".");
        s = s.replace(/\\s+/g, "");
        s = s.replace(/\\.+@/g, "@").replace(/@\\.+/g, "@").replace(/\\.+$/, "").replace(/^\\.+/, "");
        const match = s.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/);
        if (match) return match[1].toLowerCase().trim();
        return s.includes("@") && s.includes(".") ? s : null;
      }

      const emailMatches = transcript.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/g);
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

      let scheduledIso: string;
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
      }

      // 4. Log in emails_sent
      await supabase.from("emails_sent").insert({
        lead_id: data.leadId || null,
        lead_email: clientEmail,
        subject: \`Meeting Confirmed via AI Voice Call: \${bookingDateStr} at \${bookingTimeStr}\`,
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
        message: \`Meeting successfully booked! Confirmation email sent to \${clientEmail}\`,
      };
    } catch (err: any) {
      console.error("Process Vapi booking error:", err);
      return { success: false, booked: false, error: err?.message };
    }
  });

/**
 * 14. Cancel Meeting Booking
 */
export const cancelMeetingBookingFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      meetingId: string;
      leadEmail: string;
      agentEmail?: string;
      reason?: string;
    }) => data
  )
  .handler(async ({ data }) => {
    try {
      await supabase
        .from("meetings")
        .update({ completed: true, status: "cancelled" })
        .eq("id", data.meetingId);

      await sendMeetingCancellationEmail({
        leadEmail: data.leadEmail,
        agentEmail: data.agentEmail || PRIMARY_ADMIN_EMAIL,
        reason: data.reason || "Meeting slot cancelled by host.",
      });

      return { success: true };
    } catch (err: any) {
      console.error("Cancel meeting error:", err);
      return { success: false, error: err?.message };
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
`;

fs.writeFileSync(serverActionsPath, sa + '\n' + vapiFunctions, 'utf8');
console.log('Complete server-actions.ts assembled successfully');