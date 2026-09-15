const fs = require('fs');

const emailServicePath = 'src/lib/email-service.ts';
let code = fs.readFileSync(emailServicePath, 'utf8');

const targetOldWelcome = `    html: \`
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
            <a href="\${bookingUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Book a Meeting Slot Now
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b;">If you have any questions, feel free to reply directly to this email.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
          &copy; \${new Date().getFullYear()} Teals CRM. All rights reserved.
        </div>
        \${getTrackingPixel(undefined, toEmail)}
      </div>
    \`,`;

const targetNewWelcome = `    html: \`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f1f5f9;">
        <a href="\${bookingUrl}" target="_blank" style="text-decoration: none; color: inherit; display: block; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800;">Teals CRM</h1>
            <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 14px;">AI-Powered Sales Workspace</p>
          </div>
          <div style="padding: 28px 24px; color: #334155; line-height: 1.6;">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700;">Welcome! 👋</h2>
            <p style="font-size: 15px; color: #334155; margin: 12px 0;">Thank you for reaching out to us. We have received your information and are excited to assist you with your sales and business goals.</p>
            <p style="font-size: 15px; color: #334155; margin: 12px 0;">Our team is reviewing your details to provide you with the best tailored solution.</p>
            <div style="margin: 32px 0 20px 0; text-align: center;">
              <span style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
                📅 Book a Meeting Slot Now &rarr;
              </span>
            </div>
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 10px 0 0 0;">Click anywhere on this card to select your preferred meeting time.</p>
          </div>
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9;">
            &copy; \${new Date().getFullYear()} Teals CRM. All rights reserved. &bull; <span style="color: #4f46e5; font-weight: 600;">Visit Booking Page</span>
          </div>
        </a>
        \${getTrackingPixel(undefined, toEmail)}
      </div>
    \`,`;

code = code.replace(targetOldWelcome, targetNewWelcome);
fs.writeFileSync(emailServicePath, code, 'utf8');
console.log('Updated src/lib/email-service.ts: Clickable card zone applied!');