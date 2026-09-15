const fs = require('fs');

// ==========================================
// 1. UPDATE src/components/crm/ImportLeadsDialog.tsx
// ==========================================
const importPath = 'src/components/crm/ImportLeadsDialog.tsx';
let importCode = fs.readFileSync(importPath, 'utf8');

const oldLoop = `    rows.forEach((r, i) => {
      const { name, email, phone, statusCell, sourceDate } = parseRow(r, i);
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPhone = (phone || "").trim();
      const cleanName = (name || "").trim();`;

const newLoop = `    const importStartTime = Date.now();

    rows.forEach((r, i) => {
      const { name, email, phone, statusCell, sourceDate } = parseRow(r, i);
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPhone = (phone || "").trim();
      const cleanName = (name || "").trim();
      // Row 0 has newest time, row 1 has 1s older, etc. So Row 0 (top of sheet) is ALWAYS on top of the CRM table!
      const sequentialDate = sourceDate || new Date(importStartTime - i * 1000).toISOString();`;

if (importCode.includes(oldLoop)) {
  importCode = importCode.replace(oldLoop, newLoop);
}

importCode = importCode.replace(
  'lastContact: sourceDate || new Date().toISOString(),',
  'lastContact: sequentialDate,'
);
importCode = importCode.replace(
  'source_date: sourceDate || new Date().toISOString(),',
  'source_date: sequentialDate,'
);

// In payload mapping:
importCode = importCode.replace(
  'last_contact: l.source_date || l.lastContact || nowIso,',
  'last_contact: l.source_date || l.lastContact || (new Date(Date.now() - i * 1000).toISOString()),'
);
importCode = importCode.replace(
  'created_at: l.source_date || nowIso,',
  'created_at: l.source_date || l.lastContact || (new Date(Date.now() - i * 1000).toISOString()),'
);

fs.writeFileSync(importPath, importCode, 'utf8');
console.log('ImportLeadsDialog.tsx row sequencing updated cleanly!');

// ==========================================
// 2. UPDATE src/routes/_app.leads.tsx with Country Dropdown & Sorting
// ==========================================
const leadsPath = 'src/routes/_app.leads.tsx';
let leadsCode = fs.readFileSync(leadsPath, 'utf8');

// Add SUPPORTED_COUNTRIES import
const oldImport = 'import { detectCountryFromPhone, formatPhoneWithCountryCode } from "@/lib/country-helper";';
const newImport = 'import { detectCountryFromPhone, formatPhoneWithCountryCode, SUPPORTED_COUNTRIES, getCountryByCode, changeCountryOnPhone } from "@/lib/country-helper";';

if (leadsCode.includes(oldImport)) {
  leadsCode = leadsCode.replace(oldImport, newImport);
}

// Add handleCountryChange function inside LeadsPage component
const countryHandlerCode = `  // Change Country and format phone dynamically
  async function handleCountryChange(leadId: string, newCountryCode: string) {
    const lead = dbLeads.find((l) => l.id === leadId);
    if (!lead) return;

    const newCountry = getCountryByCode(newCountryCode);
    const updatedPhone = lead.phone && lead.phone !== "—" ? changeCountryOnPhone(lead.phone, newCountryCode) : lead.phone;

    setDbLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              country: newCountry.name,
              country_code: newCountry.code,
              country_flag: newCountry.flag,
              phone: updatedPhone,
            }
          : l
      )
    );

    try {
      await supabase
        .from("leads")
        .update({
          phone: updatedPhone && updatedPhone !== "—" ? updatedPhone : undefined,
        })
        .eq("id", leadId);

      toast.success(\`Updated \${lead.name} to \${newCountry.flag} \${newCountry.name} (\${updatedPhone})\`);
    } catch (e: any) {
      toast.error("Failed to update country: " + (e?.message || "Error"));
    }
  }`;

const oldStatusFunc = 'async function handleStatusChange(id: string, newStatus: LeadStatus) {';
if (leadsCode.includes(oldStatusFunc) && !leadsCode.includes('handleCountryChange')) {
  leadsCode = leadsCode.replace(oldStatusFunc, `${countryHandlerCode}\n\n  async function handleStatusChange(id: string, newStatus: LeadStatus) {`);
}

// Update Country TableCell to be an interactive Select Dropdown
const oldCountryCell = `<TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{l.country_flag || "🌐"}</span>
                      <span className="text-xs font-semibold text-foreground/90">{l.country || "International"}</span>
                    </div>
                  </TableCell>`;

const newCountryCell = `<TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={l.country_code || "US"}
                      onValueChange={(val) => handleCountryChange(l.id, val)}
                    >
                      <SelectTrigger
                        className="h-7 w-auto min-w-[125px] rounded-lg border border-border/60 bg-surface-2/60 text-xs font-medium px-2 py-0.5 gap-1"
                        style={{ boxShadow: "none" }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="text-xs">
                            <span className="mr-1.5">{c.flag}</span>
                            <span>{c.name}</span>
                            {c.dialCode && <span className="ml-1 text-[10px] text-muted-foreground font-mono">({c.dialCode})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>`;

if (leadsCode.includes(oldCountryCell)) {
  leadsCode = leadsCode.replace(oldCountryCell, newCountryCell);
}

fs.writeFileSync(leadsPath, leadsCode, 'utf8');
console.log('src/routes/_app.leads.tsx updated cleanly!');