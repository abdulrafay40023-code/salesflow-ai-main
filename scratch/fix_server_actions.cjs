const fs = require('fs');

const serverActionsPath = 'src/lib/server-actions.ts';
let sa = fs.readFileSync(serverActionsPath, 'utf8');

// Remove duplicate cancelMeetingBookingFn
sa = sa.replace(
  /\/\*\*[\s\S]*?14\. Cancel Meeting Booking[\s\S]*?export const cancelMeetingBookingFn[\s\S]*?return \{ success: false, error: err\?\.message \};\s*\}\s*\}\);/,
  ''
);

// Move normalizeSpokenEmail out of handler
if (!sa.includes('function normalizeSpokenEmail(raw: string)')) {
  sa = sa.replace(
    'const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";',
    `const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";

// Robust Spoken Email Normalizer
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
}`
  );
}

// Remove inner function normalizeSpokenEmail in processVapiCallBookingFn
sa = sa.replace(
  /\/\/ Robust Spoken Email Normalizer[\s\S]*?return s\.includes\("@"\) && s\.includes\("\."\) \? s : null;\s*\}/,
  ''
);

fs.writeFileSync(serverActionsPath, sa, 'utf8');
console.log('Fixed duplicate and scope errors in server-actions.ts');