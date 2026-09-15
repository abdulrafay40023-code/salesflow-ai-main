const fs = require('fs');

// 1. Update Lead type in src/lib/crm-data.ts
const crmDataPath = 'src/lib/crm-data.ts';
let crmData = fs.readFileSync(crmDataPath, 'utf8');
crmData = crmData.replace(
  /source_date\?: string; \/\/ Original lead date from spreadsheet/,
  `source_date?: string; // Original lead date from spreadsheet
  updated_at?: string; // Status update timestamp
  booked_at?: string;
  contacted_at?: string;`
);
fs.writeFileSync(crmDataPath, crmData, 'utf8');
console.log('crm-data.ts updated!');

// 2. Update src/routes/_app.leads.tsx
const leadsPath = 'src/routes/_app.leads.tsx';
let leadsCode = fs.readFileSync(leadsPath, 'utf8');

// Update DbLead type
leadsCode = leadsCode.replace(
  /value\?: number;\s*\};/,
  `value?: number;
  updated_at?: string;
  booked_at?: string;
  contacted_at?: string;
  won_at?: string;
};`
);

// Update mapping in fetchLeads
leadsCode = leadsCode.replace(
  /source_date: leadDate,\s*\};/,
  `source_date: leadDate,
            updated_at: l.updated_at || l.booked_at || l.contacted_at || l.won_at || (validStatus !== "new" ? leadDate : undefined),
          };`
);

// Update handleStatusChange to set updated_at
leadsCode = leadsCode.replace(
  /setDbLeads\(\(prev\) =>\s*prev\.map\(\(l\) => \(l\.id === leadId \? \{ \.\.\.l, status: newStatus \} : l\)\)\s*\);/,
  `setDbLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus, updated_at: nowIso, lastContact: nowIso } : l))
    );`
);

// Update rows sort logic in useMemo
const oldRowsSorting = `    // Always sort by date and time
    return [...filtered].sort((a, b) => {
      const av = a.source_date || a.lastContact;
      const bv = b.source_date || b.lastContact;
      const timeA = new Date(av).getTime();
      const timeB = new Date(bv).getTime();
      const cmp = (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
      return asc ? cmp : -cmp; // asc=false -> Newest First (default)
    });`;

const newRowsSorting = `    // Smart Status & Date Sorting:
    // 1. "New" fresh leads always stay at the TOP (ready to call).
    // 2. Status-changed leads (Booked, Contacted, Won, No Answer) automatically move to the BOTTOM.
    // 3. Among status-changed leads, sorted chronologically so earlier handled leads appear first, and most recently handled goes to the bottom.
    return [...filtered].sort((a, b) => {
      const aIsNew = a.status === "new";
      const bIsNew = b.status === "new";

      if (aIsNew && !bIsNew) return -1; // a (New) stays on top
      if (!aIsNew && bIsNew) return 1;  // b (New) stays on top

      if (aIsNew && bIsNew) {
        // Both New: Sort by lead creation / import date (Newest First by default)
        const timeA = new Date(a.source_date || a.lastContact).getTime() || 0;
        const timeB = new Date(b.source_date || b.lastContact).getTime() || 0;
        return asc ? timeA - timeB : timeB - timeA;
      }

      // Both are processed / status changed:
      // Sort chronologically by status update time (earlier handled leads first, newly handled at the bottom)
      const updateA = new Date(a.updated_at || a.lastContact || a.source_date).getTime() || 0;
      const updateB = new Date(b.updated_at || b.lastContact || b.source_date).getTime() || 0;
      return updateA - updateB;
    });`;

leadsCode = leadsCode.replace(oldRowsSorting, newRowsSorting);

fs.writeFileSync(leadsPath, leadsCode, 'utf8');
console.log('src/routes/_app.leads.tsx updated with smart New-on-Top / Processed-to-Bottom sorting!');