import nodemailer from "nodemailer";

// Main Gmail credentials provided by user
export const GMAIL_USER = "garryamelia6265@gmail.com";
export const GMAIL_APP_PASS = "mchfrzwrftifihnl";

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

const SITE_URL = "https://salesflow-ai-main.vercel.app";

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
    from: `"Nexa CRM" <${GMAIL_USER}>`,
    to: toEmail,
    subject: "Welcome to Nexa CRM - Automated Sales Solution",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px; background-color: #ffffff;">
        <div style="background-color: #4f46e5; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Nexa CRM</h1>
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
          &copy; ${new Date().getFullYear()} Nexa CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
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
    "Following up on our previous note — Nexa CRM",
    "Tailored sales automation for your team",
    "Final follow-up regarding your inquiry",
  ];
  const subject = subjects[reminderNumber - 1] || "Quick Follow-up regarding your inquiry";

  const mailOptions = {
    from: `"Nexa CRM" <${GMAIL_USER}>`,
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

  return await transporter.sendMail(mailOptions);
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
    from: `"Nexa CRM" <${GMAIL_USER}>`,
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

  return await transporter.sendMail(mailOptions);
}

/**
 * 4. Meeting Confirmation Email (Sent immediately upon booking to BOTH Lead & Agent)
 */
export async function sendMeetingConfirmationEmail({
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
    from: `"Nexa CRM Meetings" <${GMAIL_USER}>`,
    to: recipients,
    subject: `✅ Meeting Confirmed: ${meetingDate} at ${meetingTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Meeting Confirmed</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Your sales meeting has been successfully booked!</p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Date:</strong> ${meetingDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${meetingTime}</p>
            <p style="margin: 4px 0;"><strong>Attendees:</strong> ${leadEmail} & Sales Agent (${agentEmail})</p>
          </div>
          <p>Reminders will be sent 1 day and 1 hour before the scheduled meeting.</p>
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
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
    from: `"Nexa CRM Reminders" <${GMAIL_USER}>`,
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
          &copy; ${new Date().getFullYear()} Nexa CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
}

/**
 * 6. Meeting Reminder — 1 Hour Before (Sent to BOTH Lead & Agent)
 */
export async function send1HourMeetingReminderEmail({
  leadEmail,
  agentEmail,
  meetingTime,
}: {
  leadEmail: string;
  agentEmail: string;
  meetingTime: string;
}) {
  const recipients = Array.from(new Set([leadEmail, agentEmail].filter(Boolean))).join(", ");

  const mailOptions = {
    from: `"Nexa CRM Reminders" <${GMAIL_USER}>`,
    to: recipients,
    subject: `⏰ 1-Hour Reminder: Your Sales Meeting Starts in 60 Minutes (${meetingTime})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
        <div style="background-color: #f59e0b; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⏰ Meeting Starts in 1 Hour!</h2>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Hello,</p>
          <p>Your sales meeting is starting in 1 hour at <strong>${meetingTime}</strong>!</p>
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 4px 0; color: #92400e;"><strong>Scheduled Time:</strong> ${meetingTime}</p>
            <p style="margin: 4px 0; color: #92400e;"><strong>Participants:</strong> ${leadEmail} & Sales Representative (${agentEmail})</p>
          </div>
          <p>Please ensure you are ready to join the session on time.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} Nexa CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
}

/**
 * 7. Meeting Started NOW — Meeting Time Arrived (Sent to BOTH Lead & Agent)
 */
export async function sendMeetingStartedNowEmail({
  leadEmail,
  agentEmail,
  meetingTime,
}: {
  leadEmail: string;
  agentEmail: string;
  meetingTime: string;
}) {
  const recipients = Array.from(new Set([leadEmail, agentEmail].filter(Boolean))).join(", ");

  const mailOptions = {
    from: `"Nexa CRM Live Session" <${GMAIL_USER}>`,
    to: recipients,
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
          <p>Please join the meeting or connect with your sales representative now.</p>
          <p style="font-size: 13px; color: #64748b;">Thank you for choosing Nexa CRM for your sales automation.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} Nexa CRM. All rights reserved.
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
}

