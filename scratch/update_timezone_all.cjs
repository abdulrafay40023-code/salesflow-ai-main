const fs = require('fs');

// ==========================================
// 1. UPDATE src/lib/email-service.ts
// ==========================================
const emailServicePath = 'src/lib/email-service.ts';
let emailCode = fs.readFileSync(emailServicePath, 'utf8');

const oldSendConfirmation = `export async function sendMeetingConfirmationEmail({
  leadEmail,
  agentEmail,
  meetingDate,
  meetingTime,
}: {
  leadEmail: string;
  agentEmail: string;
  meetingDate: string;
  meetingTime: string;
}) {
  const recipients = Array.from(new Set([leadEmail, agentEmail].filter(Boolean))).join(", ");

  const mailOptions = {
    from: \`"Teals CRM Meetings" <\${GMAIL_USER}>\`,
    to: recipients,
    subject: \`✅ Meeting Confirmed: \${meetingDate} at \${meetingTime}\`,
    html: \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Meeting Confirmed</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Your sales meeting has been successfully booked!</p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> \${meetingDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> \${meetingTime}</p>
            <p style="margin: 4px 0;"><strong>Attendees:</strong> \${leadEmail} & Sales Agent (\${agentEmail})</p>
          </div>
          <p>Reminders will be sent 1 day and 1 hour before the scheduled meeting. Zoom meeting link will be delivered at the exact meeting start time.</p>
        </div>
      </div>
    \`,
  };

  return await sendMailWithPktDate(mailOptions);
}`;

const newSendConfirmation = `export async function sendMeetingConfirmationEmail({
  leadEmail,
  agentEmail,
  meetingDate,
  meetingTime,
  agentTime,
  agentDate,
  clientTime,
  clientDate,
}: {
  leadEmail: string;
  agentEmail: string;
  meetingDate: string;
  meetingTime: string;
  agentTime?: string;
  agentDate?: string;
  clientTime?: string;
  clientDate?: string;
}) {
  const displayClientDate = clientDate || meetingDate;
  const displayClientTime = clientTime || meetingTime;
  const displayAgentDate = agentDate || meetingDate;
  const displayAgentTime = agentTime || meetingTime;

  // Send personalized email to Client in their local time
  if (leadEmail && leadEmail.includes("@")) {
    const clientMailOptions = {
      from: \`"Teals CRM Meetings" <\${GMAIL_USER}>\`,
      to: leadEmail,
      subject: \`✅ Meeting Confirmed: \${displayClientDate} at \${displayClientTime}\`,
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
          <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Meeting Confirmed</h2>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Your sales demo meeting has been successfully booked!</p>
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> \${displayClientDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> \${displayClientTime}</p>
              <p style="margin: 4px 0;"><strong>Attendees:</strong> \${leadEmail} & Sales Agent (\${agentEmail})</p>
            </div>
            <p>Reminders will be sent 1 day and 1 hour before the scheduled meeting. Your Zoom meeting join link will be delivered at the exact start time.</p>
          </div>
        </div>
      \`,
    };
    await sendMailWithPktDate(clientMailOptions).catch((e) => console.log("Client email notice:", e?.message));
  }

  // Send personalized email to Agent with Pakistan Time (PKT) and client local time
  if (agentEmail && agentEmail.includes("@") && agentEmail.toLowerCase() !== leadEmail.toLowerCase()) {
    const agentMailOptions = {
      from: \`"Teals CRM Meetings" <\${GMAIL_USER}>\`,
      to: agentEmail,
      subject: \`✅ New Meeting Booked: \${displayAgentDate} at \${displayAgentTime} [PKT]\`,
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
          <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">New Sales Meeting Booked</h2>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>A new AI sales demo meeting has been scheduled with a client!</p>
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 4px 0; color: #1e1b4b;"><strong>🇵🇰 Pakistan Time [PKT]:</strong> \${displayAgentDate} at \${displayAgentTime}</p>
              <p style="margin: 4px 0; color: #4338ca;"><strong>🌐 Client Local Time:</strong> \${displayClientDate} at \${displayClientTime}</p>
              <p style="margin: 4px 0;"><strong>Client Email:</strong> \${leadEmail}</p>
              <p style="margin: 4px 0;"><strong>Assigned Agent:</strong> \${agentEmail}</p>
            </div>
            <p>Reminders will be automatically delivered 24h and 1h prior. Zoom join link will be delivered at the exact meeting time.</p>
          </div>
        </div>
      \`,
    };
    await sendMailWithPktDate(agentMailOptions).catch((e) => console.log("Agent email notice:", e?.message));
  }

  return { success: true };
}`;

emailCode = emailCode.replace(oldSendConfirmation, newSendConfirmation);
fs.writeFileSync(emailServicePath, emailCode, 'utf8');
console.log('email-service.ts updated with dual personalized timezone confirmation emails!');

// ==========================================
// 2. UPDATE src/lib/server-actions.ts
// ==========================================
const serverActionsPath = 'src/lib/server-actions.ts';
let saCode = fs.readFileSync(serverActionsPath, 'utf8');

// Insert timezone helper functions near top
const tzHelperCode = `
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
      timeStr = num >= 9 && num <= 11 ? \`\${num}:00 AM\` : \`\${num}:00 PM\`;
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
  const timeMatch = timeStr.match(/(\\d+)(?::(\\d+))?\\s*(am|pm)?/i);
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
  }) + \` \${tzAbbr}\`;

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
`;

if (!saCode.includes("normalizeClientTimezone")) {
  saCode = tzHelperCode + "\n" + saCode;
}

// Update startVapiPhoneCallFn dynamic prompts
const updatedPromptSection = `      // Dynamic System Prompt customized for whether lead has email or needs email collection
      let customSystemPrompt = "";
      if (hasKnownEmail) {
        customSystemPrompt = \`You are Alex, a top-tier Senior Sales Executive at Teals CRM.
The prospect's name is \${customerName}.
The prospect's email is ALREADY verified and on file: \${cleanLeadEmail}.
Current Live Time Context: Today is \${nowFormatted} at \${currentTimeFormatted} PKT.

YOUR MISSION & CONVERSATION FLOW:
1. Greet warmly and ask how they currently manage their sales leads and follow-ups.
2. Listen to their challenges, then pitch how Teals CRM automates lead capture and timely follow-ups.
3. Offer a quick 15-minute demo: "Would you be open to a quick 15-minute demo to see how it works?"
4. When they agree, ask: "Awesome! What day and time works best for your schedule for a quick 15-minute demo?"
5. DATE, TIME & TIMEZONE NEGOTIATION RULES (CRITICAL):
   - If the prospect gives only a time (e.g. "at 2 PM") without mentioning the day, ASK: "Which day works best for you — tomorrow, or another day this week?"
   - If the prospect mentions a time earlier today that has already passed, POLITELY SAY: "Since [time] today has already passed, did you mean tomorrow at [time] or a different upcoming day?"
   - TIMEZONE INQUIRY (MANDATORY FOR INTERNATIONAL CLIENTS): Always ask or verify their timezone: "And just so our calendar invite matches your exact clock, what timezone are you in?" (e.g. Eastern/EST, Pacific/PST, Central/CST, UK/GMT, etc.)
6. DO NOT ASK FOR THEIR EMAIL ADDRESS since we already have \${cleanLeadEmail} on file!
7. CLOSING & DISCONNECT:
   Once the day, time, and timezone are clear, say:
   "Awesome! Your demo is confirmed for [Day] at [Time] [Timezone]. I have sent your calendar invite and meeting link to your email on file (\${cleanLeadEmail}). Looking forward to speaking with you then. Have a wonderful day, goodbye!"
8. IMMEDIATELY trigger the endCall tool in this turn to hang up the phone.\`;
      } else {
        customSystemPrompt = \`You are Alex, a top-tier Senior Sales Executive at Teals CRM.
The prospect's name is \${customerName}.
The prospect does NOT have an email on file yet.
Current Live Time Context: Today is \${nowFormatted} at \${currentTimeFormatted} PKT.

YOUR MISSION & CONVERSATION FLOW:
1. Greet warmly and ask how they currently manage their sales leads and follow-ups.
2. Listen to their challenges, then pitch how Teals CRM automates lead capture and timely follow-ups.
3. Offer a quick 15-minute demo: "Would you be open to a quick 15-minute demo to see how it works?"
4. When they agree, ask: "Awesome! What day and time works best for your schedule for a quick 15-minute demo?"
5. DATE, TIME & TIMEZONE NEGOTIATION RULES (CRITICAL):
   - If the prospect gives only a time (e.g. "at 2 PM") without mentioning the day, ASK: "Which day works best for you — tomorrow, or another day this week?"
   - If the prospect mentions a time earlier today that has already passed, POLITELY SAY: "Since [time] today has already passed, did you mean tomorrow at [time] or a different upcoming day?"
   - TIMEZONE INQUIRY (MANDATORY FOR INTERNATIONAL CLIENTS): Always ask or verify their timezone: "And just so our calendar invite matches your exact clock, what timezone are you in?" (e.g. Eastern/EST, Pacific/PST, Central/CST, UK/GMT, etc.)
6. STEP TO GET EMAIL:
   Ask: "And what is the best email address to send your calendar invite and meeting link to?"
7. VERIFY EMAIL SWIFTLY & NATURALLY:
   Listen carefully to their email address. Repeat it back cleanly to confirm:
   "Just to make sure I have that exact, is that [clean email address] — is that correct?"
   Wait for the prospect to say "Yes", "Correct", "That is right", or "Haan".
   If they correct any part, acknowledge smoothly, adjust it, and confirm.
8. CLOSING & DISCONNECT:
   Once confirmed, say:
   "Awesome! Your demo is confirmed for [Day] at [Time] [Timezone]. I have sent the confirmation email and calendar invite to [email]. Looking forward to speaking with you then. Have a wonderful day, goodbye!"
9. IMMEDIATELY trigger the endCall tool in this turn to hang up the phone.\`;
      }`;

saCode = saCode.replace(
  /\/\/ Dynamic System Prompt customized for whether lead has email[\s\S]*?IMMEDIATELY trigger the endCall tool in this turn to hang up the phone\.\`;\s*\}/,
  updatedPromptSection
);

// Update processVapiCallBookingFn to use calculateMeetingSchedule and new dual email params
const oldProcessScheduleSection = `      // Smart Future Time Calculation:
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
      const nowIso = new Date().toISOString();`;

const newProcessScheduleSection = `      // Smart Future Time & Timezone Calculation:
      const tzExtracted = structuredData.timezone || transcript.match(/\\b(est|edt|pst|pdt|cst|cdt|mst|mdt|gmt|bst|pkt|ist|aest|aedt|eastern|pacific|central|mountain|london|pakistan)\\b/i)?.[0] || "EST";
      const scheduleInfo = calculateMeetingSchedule(rawDate || structuredData.bookingDate, structuredData.bookingTime, tzExtracted);
      const scheduledIso = scheduleInfo.scheduledIso;
      const nowIso = new Date().toISOString();`;

saCode = saCode.replace(oldProcessScheduleSection, newProcessScheduleSection);

// Update insert and sendMeetingConfirmationEmail call in processVapiCallBookingFn
saCode = saCode.replace(
  /await supabase\.from\("meetings"\)\.insert\(\{[\s\S]*?\}\);\s*\/\/ 3\. Send Exactly ONE Meeting Confirmation Email to BOTH Lead & Assigned Agent\s*try \{\s*await sendMeetingConfirmationEmail\(\{[\s\S]*?\}\);\s*\} catch \(e\) \{/,
  `await supabase.from("meetings").insert({
        title: \`AI Sales Demo with \${clientName} (\${scheduleInfo.clientFormattedTime} / PKT \${scheduleInfo.agentFormattedTime})\`,
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
      } catch (e) {`
);

fs.writeFileSync(serverActionsPath, saCode, 'utf8');
console.log('server-actions.ts updated with full international timezone support & conversational prompt!');

// ==========================================
// 3. UPDATE api/vapi-webhook.ts
// ==========================================
const webhookPath = 'api/vapi-webhook.ts';
let whCode = fs.readFileSync(webhookPath, 'utf8');

// Insert calculateMeetingSchedule in webhook if not present
if (!whCode.includes("calculateMeetingSchedule")) {
  whCode = tzHelperCode + "\n" + whCode;
}

const oldWhScheduleSection = `        // Smart Future Time Calculation:
        let scheduledDate = new Date(\`\${bookingDateStr} \${bookingTimeStr}\`);
        if (isNaN(scheduledDate.getTime())) {
          scheduledDate = new Date(\`\${tomorrow.toISOString().split("T")[0]} \${bookingTimeStr}\`);
        }
        if (scheduledDate.getTime() <= now.getTime()) {
          bookingDateStr = tomorrow.toISOString().split("T")[0];
          scheduledDate = new Date(\`\${bookingDateStr} \${bookingTimeStr}\`);
        }
        const scheduledIso = scheduledDate.toISOString();
        const nowIso = new Date().toISOString();`;

const newWhScheduleSection = `        // Smart Future Time & Timezone Calculation:
        const tzExtracted = structuredData.timezone || transcript.match(/\\b(est|edt|pst|pdt|cst|cdt|mst|mdt|gmt|bst|pkt|ist|aest|aedt|eastern|pacific|central|mountain|london|pakistan)\\b/i)?.[0] || "EST";
        const scheduleInfo = calculateMeetingSchedule(rawDate || structuredData.bookingDate, structuredData.bookingTime, tzExtracted);
        const scheduledIso = scheduleInfo.scheduledIso;
        const nowIso = new Date().toISOString();`;

whCode = whCode.replace(oldWhScheduleSection, newWhScheduleSection);

whCode = whCode.replace(
  /await supabase\.from\("meetings"\)\.insert\(\{[\s\S]*?\}\);\s*\/\/ 3\. Send Official Meeting Confirmation Email to Client & Assigned Agent\s*try \{\s*await sendMeetingConfirmationEmail\(\{[\s\S]*?\}\);\s*console\.log\([^)]+\);\s*\} catch \(emailErr\) \{/,
  `await supabase.from("meetings").insert({
          title: \`AI Sales Demo with \${clientName} (\${scheduleInfo.clientFormattedTime} / PKT \${scheduleInfo.agentFormattedTime})\`,
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
          console.log(\`Confirmation email sent successfully to \${clientEmail} & \${assignedAgent}\`);
        } catch (emailErr) {`
);

fs.writeFileSync(webhookPath, whCode, 'utf8');
console.log('vapi-webhook.ts updated with full international timezone support!');