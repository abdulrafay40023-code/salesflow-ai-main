const fs = require('fs');

// 1. Restore api/send-welcome-email.ts
const welcomeEmailPath = 'api/send-welcome-email.ts';
let code1 = fs.readFileSync(welcomeEmailPath, 'utf8');

const originalWelcomeHtml = `        html: \`
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
          </div>
        \`,`;

// Replace whatever html is currently inside mailOptions in api/send-welcome-email.ts
code1 = code1.replace(/html:\s*`[\s\S]*?`,\s*};/m, originalWelcomeHtml + '\n      };');
fs.writeFileSync(welcomeEmailPath, code1, 'utf8');
console.log('Restored exact original welcome email template in api/send-welcome-email.ts!');

// 2. Restore src/lib/email-service.ts
const emailServicePath = 'src/lib/email-service.ts';
let code2 = fs.readFileSync(emailServicePath, 'utf8');

const originalServiceWelcomeHtml = `    html: \`
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
      </div>
    \`,`;

code2 = code2.replace(/html:\s*`[\s\S]*?`,\s*};\s*return await sendMailWithPktDate/m, originalServiceWelcomeHtml + '\n  };\n\n  return await sendMailWithPktDate');
fs.writeFileSync(emailServicePath, code2, 'utf8');
console.log('Restored exact original welcome email template in src/lib/email-service.ts!');