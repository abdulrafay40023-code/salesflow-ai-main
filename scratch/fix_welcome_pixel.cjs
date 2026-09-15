const fs = require('fs');

const welcomeEmailPath = 'api/send-welcome-email.ts';
let code = fs.readFileSync(welcomeEmailPath, 'utf8');

const targetOldHtml = `<div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
              &copy; \${new Date().getFullYear()} Teals CRM. All rights reserved.
            </div>
          </div>`;

const targetNewHtml = `<div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
              &copy; \${new Date().getFullYear()} Teals CRM. All rights reserved.
            </div>
            <img src="\${SITE_URL}/api/track-open?email=\${encodeURIComponent(email)}\${leadId ? \`&leadId=\${encodeURIComponent(leadId)}\` : ""}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />
          </div>`;

if (!code.includes('/api/track-open')) {
  code = code.replace(targetOldHtml, targetNewHtml);
  fs.writeFileSync(welcomeEmailPath, code, 'utf8');
  console.log('Added tracking pixel to api/send-welcome-email.ts!');
} else {
  console.log('Already had tracking pixel');
}