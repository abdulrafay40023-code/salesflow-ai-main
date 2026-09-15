const fs = require('fs');

// ==========================================
// 1. UPDATE src/lib/crm-data.ts
// ==========================================
const crmDataPath = 'src/lib/crm-data.ts';
let crmData = fs.readFileSync(crmDataPath, 'utf8');
if (!crmData.includes("ip_address?: string;")) {
  crmData = crmData.replace(
    /source_date\?: string; \/\/ Original lead date from spreadsheet/,
    `source_date?: string; // Original lead date from spreadsheet
  country?: string;
  country_code?: string;
  country_flag?: string;
  ip_address?: string;
  location?: string;`
  );
  fs.writeFileSync(crmDataPath, crmData, 'utf8');
  console.log('crm-data.ts updated with country, ip_address, and location fields!');
}

// ==========================================
// 2. UPDATE src/components/crm/LeadDetailSheet.tsx
// ==========================================
const detailSheetPath = 'src/components/crm/LeadDetailSheet.tsx';
let detailSheet = fs.readFileSync(detailSheetPath, 'utf8');

const oldFetchCalls = `  async function fetchLeadCalls() {
    setLoadingCalls(true);
    try {
      const res = await getVapiCallLogsFn();
      if (res?.success && Array.isArray(res.calls)) {
        const leadPhoneClean = (lead?.phone || "").replace(/[^\\d]/g, "");
        const matched = res.calls.filter((c: any) => {
          const customerNum = (c?.customer?.number || "").replace(/[^\\d]/g, "");
          if (leadPhoneClean && customerNum && (customerNum.includes(leadPhoneClean) || leadPhoneClean.includes(customerNum))) {
            return true;
          }
          if (c?.assistantId) return true; // show recent calls
          return false;
        });
        setCallLogs(matched.slice(0, 10));
      }
    } catch (err) {
      console.error("Failed to load call recordings:", err);
    }
    setLoadingCalls(false);
  }`;

const newFetchCalls = `  async function fetchLeadCalls() {
    setLoadingCalls(true);
    try {
      const res = await getVapiCallLogsFn();
      if (res?.success && Array.isArray(res.calls)) {
        const leadPhoneClean = (lead?.phone || "").replace(/[^\\d]/g, "");
        const leadEmailClean = (lead?.email || "").trim().toLowerCase();

        const matched = res.calls.filter((c: any) => {
          const customerNum = (c?.customer?.number || "").replace(/[^\\d]/g, "");
          // 1. Strict Phone Match
          if (leadPhoneClean && customerNum) {
            if (
              customerNum.endsWith(leadPhoneClean) ||
              leadPhoneClean.endsWith(customerNum) ||
              customerNum.includes(leadPhoneClean) ||
              leadPhoneClean.includes(customerNum)
            ) {
              return true;
            }
          }
          // 2. Strict Email Match in Transcript / Structured Data
          const transcript = (c?.transcript || "").toLowerCase();
          const summary = (c?.analysis?.summary || "").toLowerCase();
          const emailExtracted = (c?.analysis?.structuredData?.clientEmail || "").toLowerCase();
          if (leadEmailClean && leadEmailClean.length > 4 && leadEmailClean !== "—") {
            if (
              emailExtracted.includes(leadEmailClean) ||
              transcript.includes(leadEmailClean) ||
              summary.includes(leadEmailClean)
            ) {
              return true;
            }
          }
          return false;
        });
        setCallLogs(matched);
      }
    } catch (err) {
      console.error("Failed to load call recordings:", err);
    }
    setLoadingCalls(false);
  }`;

detailSheet = detailSheet.replace(oldFetchCalls, newFetchCalls);
fs.writeFileSync(detailSheetPath, detailSheet, 'utf8');
console.log('LeadDetailSheet.tsx updated to show ONLY this specific lead calls!');

// ==========================================
// 3. UPDATE src/lib/email-service.ts to add tracking pixel
// ==========================================
const emailServicePath = 'src/lib/email-service.ts';
let emailCode = fs.readFileSync(emailServicePath, 'utf8');

const trackingHelper = `
function getTrackingPixel(leadId?: string, email?: string): string {
  if (!email && !leadId) return "";
  const params = new URLSearchParams();
  if (leadId) params.set("leadId", leadId);
  if (email) params.set("email", email);
  return \`<img src="\${SITE_URL}/api/track-open?\${params.toString()}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />\`;
}
`;

if (!emailCode.includes("getTrackingPixel")) {
  emailCode = emailCode.replace(
    /const SITE_URL = "https:\/\/salesflow-ai-main\.vercel\.app";/,
    `const SITE_URL = "https://salesflow-ai-main.vercel.app";\n${trackingHelper}`
  );

  // Add pixel to Welcome Email
  emailCode = emailCode.replace(
    /&copy; \$\{new Date\(\)\.getFullYear\(\)\} Teals CRM\. All rights reserved\.\s*<\/div>\s*<\/div>/,
    `&copy; \${new Date().getFullYear()} Teals CRM. All rights reserved.
        </div>
        \${getTrackingPixel(undefined, toEmail)}
      </div>`
  );

  // Add pixel to Meeting Confirmation Email
  emailCode = emailCode.replace(
    /Reminders will be sent 1 day and 1 hour before the scheduled meeting\. Your Zoom meeting join link will be delivered at the exact start time\.\s*<\/p>\s*<\/div>\s*<\/div>/,
    `Reminders will be sent 1 day and 1 hour before the scheduled meeting. Your Zoom meeting join link will be delivered at the exact start time.
            </p>
          </div>
          \${getTrackingPixel(undefined, leadEmail)}
        </div>`
  );

  fs.writeFileSync(emailServicePath, emailCode, 'utf8');
  console.log('email-service.ts updated with invisible IP & Location tracking pixel!');
}

// ==========================================
// 4. UPDATE src/components/crm/ImportLeadsDialog.tsx
// ==========================================
const importDialogPath = 'src/components/crm/ImportLeadsDialog.tsx';
let importCode = fs.readFileSync(importDialogPath, 'utf8');

if (!importCode.includes("formatPhoneWithCountryCode")) {
  importCode = `import { detectCountryFromPhone, formatPhoneWithCountryCode } from "@/lib/country-helper";\n` + importCode;
  
  // Update created lead item creation
  importCode = importCode.replace(
    /phone: cleanPhone,/,
    `phone: cleanPhone ? formatPhoneWithCountryCode(cleanPhone) : "",`
  );

  // Update Supabase payload
  importCode = importCode.replace(
    /phone: l\.phone \|\| null,\s*status: l\.status,/,
    `phone: l.phone || null,
          country: l.phone ? detectCountryFromPhone(l.phone).name : "International",
          status: l.status,`
  );

  fs.writeFileSync(importDialogPath, importCode, 'utf8');
  console.log('ImportLeadsDialog.tsx updated with smart auto phone formatting and country detection!');
}