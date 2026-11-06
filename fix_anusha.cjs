const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(
  'https://nyjhbeqpjfdhhvqvjzyy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk'
);

async function fixAnusha() {
  const nowIso = new Date().toISOString();
  const clientEmail = 'sophia.harris003@directgmail.com';

  // 1. Update lead status and email
  const { data: updatedLead, error: lErr } = await supabase
    .from('leads')
    .update({
      email: clientEmail,
      status: 'booked',
      booked_at: nowIso,
      contacted_at: nowIso,
    })
    .ilike('name', '%Anusha%')
    .select();
  console.log('Lead updated:', updatedLead, lErr);

  // 2. Insert Meeting record
  const { data: meeting, error: mErr } = await supabase
    .from('meetings')
    .insert({
      title: 'AI Sales Strategy Session with Anusha (Fri 9:00 AM PDT / Sat 9:00 PM PKT)',
      scheduled_time: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
      lead_email: clientEmail,
      agent_email: 'garryamelia6265@gmail.com',
      status: 'confirmed',
      completed: false,
      created_at: nowIso,
    })
    .select();
  console.log('Meeting inserted:', meeting, mErr);

  // 3. Send email via Gmail SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'garryamelia6265@gmail.com',
      pass: 'vlnzgybqvbmapxnn',
    },
  });

  const mailOptions = {
    from: '"AMZ Solutions Hub" <garryamelia6265@gmail.com>',
    to: `${clientEmail}, garryamelia6265@gmail.com`,
    subject: '🎉 Meeting Confirmed: 1-on-1 E-Commerce Strategy Session with Senior Specialist',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="background-color: #ff9900; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">AMZ Solutions Hub</h1>
          <p style="color: #fff3e0; margin: 4px 0 0 0; font-size: 14px;">1-on-1 E-Commerce Strategy Session</p>
        </div>
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <h2 style="color: #1e293b; margin-top: 0;">Your Meeting is Confirmed!</h2>
          <p>Hi Anusha,</p>
          <p>Thank you for speaking with Alex today. Your 1-on-1 Zoom Strategy Session with our Senior E-Commerce Specialist has been successfully confirmed.</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>📅 Date:</strong> Friday</p>
            <p style="margin: 4px 0;"><strong>⏰ Time:</strong> 9:00 AM (Pacific Time) / 9:00 PM (PKT)</p>
            <p style="margin: 4px 0;"><strong>📍 Location:</strong> Zoom Video Meeting</p>
            <p style="margin: 4px 0;"><strong>📧 Email:</strong> ${clientEmail}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://salesflow-ai-main.vercel.app/book" style="background-color: #ff9900; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Meeting Details
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b;">Looking forward to speaking with you! If you need to reschedule, simply reply directly to this email.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} AMZ Solutions Hub. All rights reserved.
        </div>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Email sent successfully:', info.messageId);
}

fixAnusha();
