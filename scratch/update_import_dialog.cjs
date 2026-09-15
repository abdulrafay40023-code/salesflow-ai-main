const fs = require('fs');

const importDialogPath = 'src/components/crm/ImportLeadsDialog.tsx';
let content = fs.readFileSync(importDialogPath, 'utf8');

// 1. Update parseRow
content = content.replace(
  /name:\s*foundName\.trim\(\)\s*\|\|\s*lowerEmail\.split\("@"\)\[0\]\s*\|\|\s*`Lead #\$\{i \+ 1\}`/,
  `name: foundName.trim() || (lowerEmail ? lowerEmail.split("@")[0] : "") || (foundPhone.trim() ? \`Lead \${foundPhone.trim()}\` : \`Lead #\${i + 1}\`)`
);

// 2. Update handleImport row filtering & deduplication
const oldImportLoop = `rows.forEach((r, i) => {
      const { name, email, phone, statusCell, sourceDate } = parseRow(r, i);
      if (!email || !email.includes("@")) return;

      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = (phone || "").trim();

      // ── INTRA-FILE DUPLICATE PREVENTION ──────────────────────────────
      // If same email or same phone appears multiple times (2, 4, 6 times), import only ONCE
      if (seenFileEmails.has(cleanEmail) || (cleanPhone && seenFilePhones.has(cleanPhone))) {
        duplicateFileSkippedCount++;
        return; // skip duplicate row
      }
      seenFileEmails.add(cleanEmail);
      if (cleanPhone) seenFilePhones.add(cleanPhone);`;

const newImportLoop = `rows.forEach((r, i) => {
      const { name, email, phone, statusCell, sourceDate } = parseRow(r, i);
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPhone = (phone || "").trim();
      const cleanName = (name || "").trim();

      // Lead is valid if it has at least one of Name, Phone, or Email!
      if (!cleanEmail && !cleanPhone && !cleanName) return;

      // ── INTRA-FILE DUPLICATE PREVENTION ──────────────────────────────
      // If same email or same phone appears multiple times, import only ONCE
      if (cleanEmail && seenFileEmails.has(cleanEmail)) {
        duplicateFileSkippedCount++;
        return;
      }
      if (cleanPhone && seenFilePhones.has(cleanPhone)) {
        duplicateFileSkippedCount++;
        return;
      }
      if (cleanEmail) seenFileEmails.add(cleanEmail);
      if (cleanPhone) seenFilePhones.add(cleanPhone);`;

if (content.includes(oldImportLoop)) {
  content = content.replace(oldImportLoop, newImportLoop);
  console.log('handleImport loop updated');
} else {
  console.log('WARNING: oldImportLoop pattern not found exactly, doing regex replacement');
  content = content.replace(
    /rows\.forEach\(\(r, i\) => \{[\s\S]*?if \(!email \|\| !email\.includes\("@"\)\) return;[\s\S]*?if \(cleanPhone\) seenFilePhones\.add\(cleanPhone\);/,
    newImportLoop
  );
}

// 3. Update error message if no leads created
content = content.replace(
  'toast.error("No valid leads could be created. Make sure your file has email addresses.");',
  'toast.error("No valid leads could be created from the file. Make sure your file has names, phone numbers, or emails.");'
);

// 4. Update Dialog description
content = content.replace(
  'Only <strong>Name</strong> and <strong>Email</strong> are required — Phone is optional.',
  'Supports <strong>Name</strong>, <strong>Phone</strong>, and <strong>Email</strong>.'
);
content = content.replace(
  'Required: <strong>Name, Email</strong> &nbsp;|&nbsp; Optional: <strong>Phone</strong>',
  'Supports: <strong>Name, Phone, Email</strong>'
);

// 5. Update welcome email filter
content = content.replace(
  /const leadsPayload = inserted[\s\S]*?\.filter\(Boolean\);/,
  `const leadsPayload = inserted
          .filter((item) => item.email && item.email.includes("@"))
          .map((item) => {
            const agentForLead = emailAgentMap.get((item.email || "").trim().toLowerCase()) || PRIMARY_ADMIN_EMAIL;
            return { email: item.email, leadId: item.id, agentEmail: agentForLead };
          });`
);

fs.writeFileSync(importDialogPath, content, 'utf8');
console.log('ImportLeadsDialog.tsx updated to support leads with NO email!');