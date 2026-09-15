import nodemailer from "nodemailer";

// Main Gmail credentials provided by user (supports Vercel env variables with fallback)
export const GMAIL_USER = process.env["GMAIL_USER"] || "garryamelia6265@gmail.com";
export const GMAIL_APP_PASS = process.env["GMAIL_APP_PASS"] || "vlnzgybqvbmapxnn";

// SMTP Transporter using official Gmail SMTP
export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASS,
  },
});

export function getPktRfcDate(): string {
  const now = new Date();
  const pktMs = now.getTime() + 5 * 60 * 60 * 1000;
  const d = new Date(pktMs);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[d.getUTCDay()];
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = d.getUTCHours().toString().padStart(2, "0");
  const mins = d.getUTCMinutes().toString().padStart(2, "0");
  const secs = d.getUTCSeconds().toString().padStart(2, "0");
  return `${dayName}, ${day} ${month} ${year} ${hours}:${mins}:${secs} +0500`;
}

export async function sendMailWithPktDate(mailOptions: any) {
  return await transporter.sendMail({
    ...mailOptions,
    headers: {
      ...(mailOptions.headers || {}),
      Date: getPktRfcDate(),
    },
  });
}

const SITE_URL = "https://salesflow-ai-main.vercel.app";

function getTrackingPixel(leadId?: string, email?: string): string {
  if (!email && !leadId) return "";
  const params = new URLSearchParams();
  if (leadId) params.set("leadId", leadId);
  if (email) params.set("email", email);
  return `<img src="${SITE_URL}/api/track-open?${params.toString()}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`;
}


/**
 * 1. Welcome Email — Sent immediately when a new lead is imported
 */
export async function sendWelcomeEmail({
  toEmail,
  agentEmail,
}: {
  toEmail: string;
  agentEmail?: string;
}) {
  const bookingUrl = agentEmail
    ? `${SITE_URL}/book?email=${encodeURIComponent(toEmail)}&agent=${encodeURIComponent(agentEmail)}`
    : `${SITE_URL}/book?email=${encodeURIComponent(toEmail)}`;

  const mailOptions = {
    from: `"Teals CRM" <${GMAIL_USER}>`,
    to: toEmail,
    subject: "Welcome to Teals CRM - Automated Sales Solution",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #4f46e5; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Teals CRM</h1>
          <p style="color: #e0e7ff; margin: 4px 0 0 0; font-size: 14px;">AI-Powered Sales Workspace</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <h2 style="color: #1e293b; margin-top: 0;">Welcome!</h2>
          <p>Thank you for reaching out to us. We have received your information and are excited to assist you with your sales and business goals.</p>
          <p>Our team is reviewing your details to provide you with the best tailored solution.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${bookingUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Book a Meeting Slot Now
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b;">If you have any questions, feel free to reply directly to this email.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} Teals CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  return await sendMailWithPktDate(mailOptions);
}

/**
 * 2. Automatic 24-Hour Follow-up Reminder Email
 */
export async function sendReminderEmail({
  toEmail,
  reminderNumber,
}: {
  toEmail: string;
  reminderNumber: number;
}) {
  const subjects = [
    "Quick Follow-up: Checking in on your inquiry",
    "Following up on our previous note — Teals CRM",
    "Tailored sales automation for your team",
    "Final follow-up regarding your inquiry",
  ];
  const subject = subjects[reminderNumber - 1] || "Quick Follow-up regarding your inquiry";

  const mailOptions = {
    from: `"Teals CRM" <${GMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <h2 style="color: #1e293b; margin-top: 0;">Checking In</h2>
          <p>We are following up on our previous message to see if you have any questions or if you'd like to schedule a quick discussion with our team.</p>
          <p>We help businesses automate their pipeline, streamline follow-ups, and boost response rates.</p>
          <div style="margin: 25px 0; text-align: center;">
            <a href="${SITE_URL}/book" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Schedule a Meeting
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b;">You can also reply directly to this email to get in touch with a team representative.</p>
        </div>
      </div>
    `,
  };

  return await sendMailWithPktDate(mailOptions);
}

/**
 * 3. Auto Booking Form Email (Sent upon Lead Reply / Intent)
 */
export async function sendBookingFormEmail({
  toEmail,
  agentEmail,
  leadName,
}: {
  toEmail: string;
  agentEmail?: string;
  leadName?: string;
}) {
  const bookingUrl = agentEmail
    ? `${SITE_URL}/book?email=${encodeURIComponent(toEmail)}&name=${encodeURIComponent(leadName || "")}&agent=${encodeURIComponent(agentEmail)}`
    : `${SITE_URL}/book?email=${encodeURIComponent(toEmail)}`;

  const mailOptions = {
    from: `"Teals CRM" <${GMAIL_USER}>`,
    to: toEmail,
    subject: "Meeting Booking Link — Select Your Convenient Slot",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="background-color: #10b981; padding: 16px; text-align: center; border-radius: 8px 8px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 20px;">Ready to Connect!</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Thank you for your reply! We would love to get a meeting scheduled at a time that works best for you.</p>
          <p>Please click the button below to open our interactive booking calendar and select your preferred date &amp; time:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${bookingUrl}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              📅 Open Booking Form
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b;">Once selected, a confirmation email with all details will be sent immediately.</p>
        </div>
      </div>
    `,
  };

  return await sendMailWithPktDate(mailOptions);
}

/**
 * 4. Meeting Confirmation Email (Sent immediately upon booking to BOTH Lead & Agent)
 */
export async function sendMeetingConfirmationEmail({
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
      from: `"Teals CRM Meetings" <${GMAIL_USER}>`,
      to: leadEmail,
      subject: `✅ Meeting Confirmed: ${displayClientDate} at ${displayClientTime}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
          <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Meeting Confirmed</h2>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Your sales demo meeting has been successfully booked!</p>
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${displayClientDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${displayClientTime}</p>
              <p style="margin: 4px 0;"><strong>Attendees:</strong> ${leadEmail} & Sales Agent (${agentEmail})</p>
            </div>
            <p>Reminders will be sent 1 day and 1 hour before the scheduled meeting. Your Zoom meeting join link will be delivered at the exact start time.
            </p>
          </div>
          ${getTrackingPixel(undefined, leadEmail)}
        </div>
      `,
    };
    await sendMailWithPktDate(clientMailOptions).catch((e) => console.log("Client email notice:", e?.message));
  }

  // Send personalized email to Agent with Pakistan Time (PKT) and client local time
  if (agentEmail && agentEmail.includes("@") && agentEmail.toLowerCase() !== leadEmail.toLowerCase()) {
    const agentMailOptions = {
      from: `"Teals CRM Meetings" <${GMAIL_USER}>`,
      to: agentEmail,
      subject: `✅ New Meeting Booked: ${displayAgentDate} at ${displayAgentTime} [PKT]`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
          <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">New Sales Meeting Booked</h2>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>A new AI sales demo meeting has been scheduled with a client!</p>
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 4px 0; color: #1e1b4b;"><strong>🇵🇰 Pakistan Time [PKT]:</strong> ${displayAgentDate} at ${displayAgentTime}</p>
              <p style="margin: 4px 0; color: #4338ca;"><strong>🌐 Client Local Time:</strong> ${displayClientDate} at ${displayClientTime}</p>
              <p style="margin: 4px 0;"><strong>Client Email:</strong> ${leadEmail}</p>
              <p style="margin: 4px 0;"><strong>Assigned Agent:</strong> ${agentEmail}</p>
            </div>
            <p>Reminders will be automatically delivered 24h and 1h prior. Zoom join link will be delivered at the exact meeting time.</p>
          </div>
        </div>
      `,
    };
    await sendMailWithPktDate(agentMailOptions).catch((e) => console.log("Agent email notice:", e?.message));
  }

  return { success: true };
}

/**
 * 5. Meeting Reminder — 1 Day Before (Sent to BOTH Lead & Agent)
 */
export async function send1DayMeetingReminderEmail({
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
    from: `"Teals CRM Reminders" <${GMAIL_USER}>`,
    to: recipients,
    subject: `📌 24-Hour Reminder: Upcoming Sales Meeting Tomorrow (${meetingTime})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📌 24-Hour Meeting Reminder</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Hello,</p>
          <p>This is your 24-hour advance reminder for your scheduled sales meeting with our team tomorrow.</p>
          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0; color: #3730a3;"><strong>Date:</strong> ${meetingDate}</p>
            <p style="margin: 4px 0; color: #3730a3;"><strong>Time:</strong> ${meetingTime}</p>
            <p style="margin: 4px 0; color: #3730a3;"><strong>Participants:</strong> ${leadEmail} & Sales Representative (${agentEmail})</p>
          </div>
          <p>Please review any documents or questions before the meeting. We look forward to speaking with you tomorrow!</p>
          <p style="font-size: 13px; color: #64748b;">Need to reschedule? Reply directly to this email.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} Teals CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  return await sendMailWithPktDate(mailOptions);
}

/**
 * 6. Meeting Reminder — 1 Hour Before (Sent to BOTH Lead & Agent)
 */
export async function send1HourMeetingReminderEmail({
  leadEmail,
  agentEmail,
  meetingTime,
  durationText = "1 hour",
}: {
  leadEmail: string;
  agentEmail: string;
  meetingTime: string;
  durationText?: string;
}) {
  const isOneHour = durationText.toLowerCase().includes("1 hour") || durationText.toLowerCase().includes("60");
  const displayDuration = isOneHour ? "1 Hour" : durationText;

  const mailOptions = {
    from: `"Teals CRM Reminders" <${GMAIL_USER}>`,
    subject: `⏰ Reminder: Your Sales Meeting Starts in ${displayDuration} (${meetingTime})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="background-color: #f59e0b; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⏰ Meeting Starts in ${displayDuration}!</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Hello,</p>
          <p>Your sales meeting is scheduled at <strong>${meetingTime}</strong> — starting in ${durationText}!</p>
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0; color: #92400e;"><strong>Scheduled Time:</strong> ${meetingTime}</p>
            <p style="margin: 4px 0; color: #92400e;"><strong>Participants:</strong> ${leadEmail} & Sales Representative (${agentEmail})</p>
          </div>
          <p>Please ensure you are ready to join the session on time.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} Teals CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  if (leadEmail) await sendMailWithPktDate({ ...mailOptions, to: leadEmail });
  if (agentEmail && agentEmail.toLowerCase() !== leadEmail.toLowerCase()) {
    await sendMailWithPktDate({ ...mailOptions, to: agentEmail });
  }
}

/**
 * 6b. Meeting Reminder — 5 Minutes Before (Sent to BOTH Lead & Agent)
 */
export async function send5MinMeetingReminderEmail({
  leadEmail,
  agentEmail,
  meetingTime,
}: {
  leadEmail: string;
  agentEmail: string;
  meetingTime: string;
}) {
  const mailOptions = {
    from: `"Teals CRM Reminders" <${GMAIL_USER}>`,
    subject: `⚡ 5-Minute Reminder: Your Sales Meeting Starts Soon (${meetingTime})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="background-color: #ef4444; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⚡ Meeting Starts in 5 Minutes!</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Hello,</p>
          <p>Your sales meeting is starting in 5 minutes at <strong>${meetingTime}</strong>!</p>
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0; color: #991b1b;"><strong>Scheduled Time:</strong> ${meetingTime}</p>
            <p style="margin: 4px 0; color: #991b1b;"><strong>Participants:</strong> ${leadEmail} & Sales Representative (${agentEmail})</p>
          </div>
          <p>Please log in and get ready to connect.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} Teals CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  if (leadEmail) await sendMailWithPktDate({ ...mailOptions, to: leadEmail });
  if (agentEmail && agentEmail.toLowerCase() !== leadEmail.toLowerCase()) {
    await sendMailWithPktDate({ ...mailOptions, to: agentEmail });
  }
}

/**
 * 7. Meeting Started NOW — Meeting Time Arrived (Sent to BOTH Lead & Agent)
 */
export async function sendMeetingStartedNowEmail({
  leadEmail,
  agentEmail,
  meetingTime,
  zoomJoinUrl,
}: {
  leadEmail: string;
  agentEmail: string;
  meetingTime: string;
  zoomJoinUrl?: string;
}) {
  const zoomBtn = zoomJoinUrl
    ? `
    <div style="margin: 25px 0; text-align: center;">
      <a href="${zoomJoinUrl}" style="background-color: #dc2626; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(220,38,38,0.3);">
        🔴 Click Here to Join Zoom Meeting NOW
      </a>
      <p style="margin-top: 8px; font-size: 12px; color: #64748b;">Direct Link: <a href="${zoomJoinUrl}" style="color: #dc2626;">${zoomJoinUrl}</a></p>
    </div>`
    : "";

  const mailOptions = {
    from: `"Teals CRM Live Session" <${GMAIL_USER}>`,
    subject: `🔔 Meeting Time Arrived! Your Sales Session is Starting Now (${meetingTime})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="background-color: #10b981; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🎉 Your Meeting is Starting Now!</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Hello,</p>
          <p>It's <strong>${meetingTime}</strong> and your scheduled sales meeting is starting right now!</p>
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0; color: #065f46;"><strong>Status:</strong> Live Session Started</p>
            <p style="margin: 4px 0; color: #065f46;"><strong>Scheduled Time:</strong> ${meetingTime}</p>
            <p style="margin: 4px 0; color: #065f46;"><strong>Participants:</strong> ${leadEmail} & Sales Representative (${agentEmail})</p>
          </div>
          ${zoomBtn}
          <p style="font-size: 13px; color: #64748b;">Thank you for choosing Teals CRM for your sales automation.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} Teals CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  if (leadEmail) {
    await sendMailWithPktDate({ ...mailOptions, to: leadEmail });
  }
  if (agentEmail && agentEmail.toLowerCase() !== leadEmail.toLowerCase()) {
    await sendMailWithPktDate({ ...mailOptions, to: agentEmail });
  }
}

/**
 * 8. Meeting Cancellation Email — Sent when either Client or Working Agent cancels a scheduled meeting
 */
export async function sendMeetingCancellationEmail({
  leadEmail,
  leadName,
  agentEmail,
  meetingDate,
  meetingTime,
  cancelledBy,
}: {
  leadEmail: string;
  leadName?: string;
  agentEmail: string;
  meetingDate?: string;
  meetingTime?: string;
  cancelledBy: "client" | "agent";
}) {
  const isClientCancel = cancelledBy === "client";
  const dateStr = meetingDate || "Scheduled Date";
  const timeStr = meetingTime || "Scheduled Time";
  const clientDisplayName = leadName || leadEmail.split("@")[0] || "Client";
  const rescheduleUrl = agentEmail
    ? `${SITE_URL}/book?email=${encodeURIComponent(leadEmail)}&agent=${encodeURIComponent(agentEmail)}`
    : `${SITE_URL}/book?email=${encodeURIComponent(leadEmail)}`;

  // Email 1: Sent to Client
  const clientSubject = isClientCancel
    ? `🚫 Meeting Cancelled: Sales Session on ${dateStr}`
    : `🚫 Notice: Your Sales Meeting on ${dateStr} was Cancelled by Agent`;

  const clientHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff; border-radius: 12px;">
      <div style="background-color: #e11d48; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 20px;">Meeting Session Cancelled</h2>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p>Hello <strong>${clientDisplayName}</strong>,</p>
        <p>
          ${
            isClientCancel
              ? "Your scheduled sales meeting has been <strong>cancelled as requested by you</strong>."
              : `Your scheduled sales meeting has been <strong>cancelled by your assigned sales representative (${agentEmail})</strong>.`
          }
        </p>
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0; color: #9f1239;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 4px 0; color: #9f1239;"><strong>Time:</strong> ${timeStr}</p>
          <p style="margin: 4px 0; color: #9f1239;"><strong>Cancelled By:</strong> ${isClientCancel ? "Client (You)" : `Working Agent (${agentEmail})`}</p>
          <p style="margin: 4px 0; color: #9f1239;"><strong>Status:</strong> All upcoming reminder emails have been stopped.</p>
        </div>
        <p>If you would like to pick a new date and reschedule your session, please click the button below:</p>
        <div style="margin: 25px 0; text-align: center;">
          <a href="${rescheduleUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            📅 Reschedule Meeting Now
          </a>
        </div>
        <p style="font-size: 13px; color: #64748b;">If you have any questions, feel free to reply directly to this email.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
        &copy; ${new Date().getFullYear()} Teals CRM. All rights reserved.
      </div>
    </div>
  `;

  // Email 2: Sent to Working Agent
  const agentSubject = isClientCancel
    ? `⚠️ Alert: Meeting Cancelled by Client (${clientDisplayName} - ${leadEmail})`
    : `🚫 Confirmation: You Cancelled Meeting with ${clientDisplayName} (${leadEmail})`;

  const agentHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff; border-radius: 12px;">
      <div style="background-color: #475569; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 20px;">Meeting Cancellation Alert</h2>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p>Hello,</p>
        <p>
          ${
            isClientCancel
              ? `Client <strong>${clientDisplayName}</strong> (${leadEmail}) has <strong>cancelled their scheduled sales meeting</strong>.`
              : `You have <strong>cancelled the meeting with client ${clientDisplayName}</strong> (${leadEmail}).`
          }
        </p>
        <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0; color: #1e293b;"><strong>Client:</strong> ${clientDisplayName} (${leadEmail})</p>
          <p style="margin: 4px 0; color: #1e293b;"><strong>Scheduled Date:</strong> ${dateStr}</p>
          <p style="margin: 4px 0; color: #1e293b;"><strong>Scheduled Time:</strong> ${timeStr}</p>
          <p style="margin: 4px 0; color: #1e293b;"><strong>Cancelled By:</strong> ${isClientCancel ? "Client" : "Working Agent (You)"}</p>
          <p style="margin: 4px 0; color: #1e293b;"><strong>Lead Status:</strong> Updated to 'booking_cancelled' in CRM.</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">The lead status in your CRM dashboard and reports has been updated accordingly.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
        &copy; ${new Date().getFullYear()} Teals CRM. All rights reserved.
      </div>
    </div>
  `;

  // Send to Lead/Client
  if (leadEmail) {
    try {
      await sendMailWithPktDate({
        from: `"Teals CRM Meetings" <${GMAIL_USER}>`,
        to: leadEmail,
        subject: clientSubject,
        html: clientHtml,
      });
    } catch (e) {
      console.error("Failed to send cancellation email to client:", e);
    }
  }

  // Send to Working Agent
  if (agentEmail && agentEmail.toLowerCase() !== (leadEmail || "").toLowerCase()) {
    try {
      await sendMailWithPktDate({
        from: `"Teals CRM Alerts" <${GMAIL_USER}>`,
        to: agentEmail,
        subject: agentSubject,
        html: agentHtml,
      });
    } catch (e) {
      console.error("Failed to send cancellation email to agent:", e);
    }
  }
}



/**
 * Security Audit Email — Sent to Admin whenever a Working Agent clears/deletes leads
 */
export async function sendLeadClearAuditEmail({
  agentName,
  agentEmail,
  scopeTitle,
  deletedCount,
}: {
  agentName: string;
  agentEmail: string;
  scopeTitle: string;
  deletedCount: number;
}) {
  const adminRecipients = ["garryamelia6265@gmail.com", "tzafar04@gmail.com"];

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #334155;">
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 32px;">⚠️</span>
      <h2 style="color: #f43f5e; margin: 8px 0 4px 0; font-size: 20px;">Security Alert: Working Agent Cleared Leads</h2>
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">Automated CRM Audit Notification</p>
    </div>

    <div style="background-color: #1e293b; border-radius: 12px; padding: 18px; border: 1px solid #334155; margin-bottom: 20px;">
      <table style="width: 100%; font-size: 13px; color: #e2e8f0; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #94a3b8; width: 40%;">👤 Working Agent:</td>
          <td style="padding: 6px 0; font-weight: bold; color: #38bdf8;">${agentName} (${agentEmail})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #94a3b8;">🗑️ Deletion Rule:</td>
          <td style="padding: 6px 0; font-weight: bold; color: #f43f5e;">${scopeTitle}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #94a3b8;">📊 Total Leads Deleted:</td>
          <td style="padding: 6px 0; font-weight: bold; color: #fbbf24;">${deletedCount} Lead(s)</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #94a3b8;">⏱️ Timestamp (PKT):</td>
          <td style="padding: 6px 0; font-family: monospace; color: #a7f3d0;">${getPktRfcDate()}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #090d16; border-radius: 8px; padding: 12px; border-left: 4px solid #38bdf8; font-size: 12px; color: #94a3b8; margin-bottom: 20px;">
      ℹ️ <strong>System Protection Note:</strong> Only leads assigned to ${agentName}'s personal dashboard were deleted. Admin leads and other working agents' leads were completely protected. All pending scheduled emails and reminders for these deleted leads have been cancelled.
    </div>

    <div style="text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 12px;">
      Teals CRM • Automated Security & Audit Engine
    </div>
  </div>
  `;

  for (const adminEmail of adminRecipients) {
    try {
      await sendMailWithPktDate({
        from: `"Teals CRM Security" <${GMAIL_USER}>`,
        to: adminEmail,
        subject: `⚠️ [Security Alert] Agent ${agentName} cleared ${deletedCount} lead(s) (${scopeTitle})`,
        html,
      });
    } catch (e) {
      console.error(`Failed to send audit email to ${adminEmail}:`, e);
    }
  }
}
