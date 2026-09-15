const fs = require('fs');

// ==========================================
// 1. UPDATE src/routes/_app.leads.tsx
// ==========================================
const leadsPath = 'src/routes/_app.leads.tsx';
let leadsCode = fs.readFileSync(leadsPath, 'utf8');

// Add import
if (!leadsCode.includes('CountryCombobox')) {
  leadsCode = leadsCode.replace(
    'import { detectCountryFromPhone, formatPhoneWithCountryCode, SUPPORTED_COUNTRIES, getCountryByCode, changeCountryOnPhone } from "@/lib/country-helper";',
    `import { detectCountryFromPhone, formatPhoneWithCountryCode, SUPPORTED_COUNTRIES, getCountryByCode, changeCountryOnPhone } from "@/lib/country-helper";
import { CountryCombobox } from "@/components/crm/CountryCombobox";`
  );
}

// Replace Select in TableCell with CountryCombobox
const oldCountrySelect = `<TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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

const newCountryCombobox = `<TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <CountryCombobox
                      value={l.country_code || "US"}
                      onValueChange={(val) => handleCountryChange(l.id, val)}
                      className="min-w-[135px]"
                    />
                  </TableCell>`;

if (leadsCode.includes(oldCountrySelect)) {
  leadsCode = leadsCode.replace(oldCountrySelect, newCountryCombobox);
}

fs.writeFileSync(leadsPath, leadsCode, 'utf8');
console.log('src/routes/_app.leads.tsx updated with CountryCombobox!');

// ==========================================
// 2. UPDATE src/components/crm/ImportLeadsDialog.tsx
// ==========================================
const importPath = 'src/components/crm/ImportLeadsDialog.tsx';
let importCode = fs.readFileSync(importPath, 'utf8');

if (!importCode.includes('CountryCombobox')) {
  importCode = importCode.replace(
    'import { detectCountryFromPhone, formatPhoneWithCountryCode, parseCountryString, SUPPORTED_COUNTRIES } from "@/lib/country-helper";',
    `import { detectCountryFromPhone, formatPhoneWithCountryCode, parseCountryString, SUPPORTED_COUNTRIES } from "@/lib/country-helper";
import { CountryCombobox } from "@/components/crm/CountryCombobox";`
  );
}

// Replace Select in Import Modal with CountryCombobox
const oldImportSelect = `<Select value={defaultPhoneCountry} onValueChange={setDefaultPhoneCountry}>
                <SelectTrigger className="h-8 w-52 rounded-xl text-xs bg-surface-2 border-border/80 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="AUTO" className="text-xs font-semibold text-violet-400">
                    🤖 Smart Auto-Detect
                  </SelectItem>
                  {SUPPORTED_COUNTRIES.filter(c => c.code !== "UN").map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">
                      <span className="mr-1.5">{c.flag}</span>
                      <span>{c.name}</span>
                      {c.dialCode && <span className="ml-1 text-[10px] text-muted-foreground font-mono">({c.dialCode})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>`;

const newImportCombobox = `<CountryCombobox
                value={defaultPhoneCountry}
                onValueChange={setDefaultPhoneCountry}
                includeAuto
                className="h-8 w-52 rounded-xl text-xs bg-surface-2 border-border/80 shrink-0"
              />`;

if (importCode.includes(oldImportSelect)) {
  importCode = importCode.replace(oldImportSelect, newImportCombobox);
}

fs.writeFileSync(importPath, importCode, 'utf8');
console.log('src/components/crm/ImportLeadsDialog.tsx updated with CountryCombobox!');