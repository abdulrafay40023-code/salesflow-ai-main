const fs = require('fs');

// ==========================================
// 1. UPDATE src/lib/country-helper.ts with rich global country list
// ==========================================
const countryHelperPath = 'src/lib/country-helper.ts';
const fullCountryHelperCode = `/**
 * Smart Country & Phone Parser
 * Detects country, flag emoji, and formats phone numbers with country codes.
 */

export type CountryInfo = {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
};

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { name: "United States", code: "US", flag: "🇺🇸", dialCode: "+1" },
  { name: "Pakistan", code: "PK", flag: "🇵🇰", dialCode: "+92" },
  { name: "United Kingdom", code: "GB", flag: "🇬🇧", dialCode: "+44" },
  { name: "UAE", code: "AE", flag: "🇦🇪", dialCode: "+971" },
  { name: "Saudi Arabia", code: "SA", flag: "🇸🇦", dialCode: "+966" },
  { name: "Canada", code: "CA", flag: "🇨🇦", dialCode: "+1" },
  { name: "Australia", code: "AU", flag: "🇦🇺", dialCode: "+61" },
  { name: "New Zealand", code: "NZ", flag: "🇳🇿", dialCode: "+64" },
  { name: "India", code: "IN", flag: "🇮🇳", dialCode: "+91" },
  { name: "Germany", code: "DE", flag: "🇩🇪", dialCode: "+49" },
  { name: "France", code: "FR", flag: "🇫🇷", dialCode: "+33" },
  { name: "Italy", code: "IT", flag: "🇮🇹", dialCode: "+39" },
  { name: "Spain", code: "ES", flag: "🇪🇸", dialCode: "+34" },
  { name: "Netherlands", code: "NL", flag: "🇳🇱", dialCode: "+31" },
  { name: "Switzerland", code: "CH", flag: "🇨🇭", dialCode: "+41" },
  { name: "Singapore", code: "SG", flag: "🇸🇬", dialCode: "+65" },
  { name: "Malaysia", code: "MY", flag: "🇲🇾", dialCode: "+60" },
  { name: "Philippines", code: "PH", flag: "🇵🇭", dialCode: "+63" },
  { name: "Qatar", code: "QA", flag: "🇶🇦", dialCode: "+974" },
  { name: "Kuwait", code: "KW", flag: "🇰🇼", dialCode: "+965" },
  { name: "Oman", code: "OM", flag: "🇴🇲", dialCode: "+968" },
  { name: "Bahrain", code: "BH", flag: "🇧🇭", dialCode: "+973" },
  { name: "South Africa", code: "ZA", flag: "🇿🇦", dialCode: "+27" },
  { name: "Nigeria", code: "NG", flag: "🇳🇬", dialCode: "+234" },
  { name: "Brazil", code: "BR", flag: "🇧🇷", dialCode: "+55" },
  { name: "Mexico", code: "MX", flag: "🇲🇽", dialCode: "+52" },
  { name: "Turkey", code: "TR", flag: "🇹🇷", dialCode: "+90" },
  { name: "Japan", code: "JP", flag: "🇯🇵", dialCode: "+81" },
  { name: "South Korea", code: "KR", flag: "🇰🇷", dialCode: "+82" },
  { name: "International", code: "UN", flag: "🌐", dialCode: "" },
];

export function getCountryByCode(code: string): CountryInfo {
  return (
    SUPPORTED_COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) || {
      name: "International",
      code: "UN",
      flag: "🌐",
      dialCode: "",
    }
  );
}

export function getCountryByName(name: string): CountryInfo {
  return (
    SUPPORTED_COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase()) || {
      name: "International",
      code: "UN",
      flag: "🌐",
      dialCode: "",
    }
  );
}

/**
 * Parse any country name, abbreviation, or alias into standard CountryInfo
 */
export function parseCountryString(str?: string | null): CountryInfo | null {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (["us", "usa", "united states", "united states of america", "america"].includes(s)) return getCountryByCode("US");
  if (["pk", "pak", "pakistan"].includes(s)) return getCountryByCode("PK");
  if (["gb", "uk", "united kingdom", "england", "britain", "great britain"].includes(s)) return getCountryByCode("GB");
  if (["ae", "uae", "united arab emirates", "dubai", "abu dhabi"].includes(s)) return getCountryByCode("AE");
  if (["sa", "ksa", "saudi", "saudi arabia"].includes(s)) return getCountryByCode("SA");
  if (["ca", "canada"].includes(s)) return getCountryByCode("CA");
  if (["au", "australia"].includes(s)) return getCountryByCode("AU");
  if (["nz", "new zealand"].includes(s)) return getCountryByCode("NZ");
  if (["in", "india"].includes(s)) return getCountryByCode("IN");
  if (["de", "germany"].includes(s)) return getCountryByCode("DE");
  if (["fr", "france"].includes(s)) return getCountryByCode("FR");
  if (["it", "italy"].includes(s)) return getCountryByCode("IT");
  if (["es", "spain"].includes(s)) return getCountryByCode("ES");
  if (["nl", "netherlands", "holland"].includes(s)) return getCountryByCode("NL");
  if (["ch", "switzerland"].includes(s)) return getCountryByCode("CH");
  if (["sg", "singapore"].includes(s)) return getCountryByCode("SG");
  if (["my", "malaysia"].includes(s)) return getCountryByCode("MY");
  if (["ph", "philippines"].includes(s)) return getCountryByCode("PH");
  if (["qa", "qatar"].includes(s)) return getCountryByCode("QA");
  if (["kw", "kuwait"].includes(s)) return getCountryByCode("KW");
  if (["om", "oman"].includes(s)) return getCountryByCode("OM");
  if (["bh", "bahrain"].includes(s)) return getCountryByCode("BH");
  if (["za", "south africa"].includes(s)) return getCountryByCode("ZA");
  if (["ng", "nigeria"].includes(s)) return getCountryByCode("NG");
  if (["br", "brazil"].includes(s)) return getCountryByCode("BR");
  if (["mx", "mexico"].includes(s)) return getCountryByCode("MX");
  if (["tr", "turkey"].includes(s)) return getCountryByCode("TR");
  if (["jp", "japan"].includes(s)) return getCountryByCode("JP");
  if (["kr", "korea", "south korea"].includes(s)) return getCountryByCode("KR");
  return null;
}

/**
 * Detect Country from raw phone number
 */
export function detectCountryFromPhone(rawPhone?: string | null): CountryInfo {
  if (!rawPhone) {
    return { name: "International", code: "UN", flag: "🌐", dialCode: "" };
  }

  const clean = rawPhone.trim().replace(/[^\\d]/g, "");
  if (!clean || clean.length < 5) {
    return { name: "International", code: "UN", flag: "🌐", dialCode: "" };
  }

  // 1. Explicit Leading + or 00
  if (rawPhone.trim().startsWith("+") || rawPhone.trim().startsWith("00")) {
    if (clean.startsWith("92")) return getCountryByCode("PK");
    if (clean.startsWith("1")) return getCountryByCode("US");
    if (clean.startsWith("44")) return getCountryByCode("GB");
    if (clean.startsWith("971")) return getCountryByCode("AE");
    if (clean.startsWith("966")) return getCountryByCode("SA");
    if (clean.startsWith("91")) return getCountryByCode("IN");
    if (clean.startsWith("61")) return getCountryByCode("AU");
    if (clean.startsWith("64")) return getCountryByCode("NZ");
    if (clean.startsWith("49")) return getCountryByCode("DE");
    if (clean.startsWith("33")) return getCountryByCode("FR");
    if (clean.startsWith("39")) return getCountryByCode("IT");
    if (clean.startsWith("34")) return getCountryByCode("ES");
    if (clean.startsWith("31")) return getCountryByCode("NL");
    if (clean.startsWith("41")) return getCountryByCode("CH");
    if (clean.startsWith("65")) return getCountryByCode("SG");
    if (clean.startsWith("60")) return getCountryByCode("MY");
    if (clean.startsWith("63")) return getCountryByCode("PH");
    if (clean.startsWith("974")) return getCountryByCode("QA");
    if (clean.startsWith("965")) return getCountryByCode("KW");
    if (clean.startsWith("968")) return getCountryByCode("OM");
    if (clean.startsWith("973")) return getCountryByCode("BH");
    if (clean.startsWith("27")) return getCountryByCode("ZA");
    if (clean.startsWith("234")) return getCountryByCode("NG");
    if (clean.startsWith("55")) return getCountryByCode("BR");
    if (clean.startsWith("52")) return getCountryByCode("MX");
    if (clean.startsWith("90")) return getCountryByCode("TR");
    if (clean.startsWith("81")) return getCountryByCode("JP");
    if (clean.startsWith("82")) return getCountryByCode("KR");
  }

  // 2. Pakistan standard 11 digits (03xx-xxxxxxx) or 12 digits (923xx...)
  if (clean.startsWith("03") && clean.length === 11) {
    return getCountryByCode("PK");
  }
  if (clean.startsWith("923") && clean.length === 12) {
    return getCountryByCode("PK");
  }

  // 3. Pakistan 10 digits when Excel strips leading 0 (e.g. 3301035196)
  if (clean.length === 10 && /^3[0-5]/.test(clean)) {
    return getCountryByCode("PK");
  }

  // 4. US / Canada 10 digits standard (e.g. 7282887071, 6508801126)
  if (clean.length === 10) {
    return getCountryByCode("US");
  }
  if (clean.length === 11 && clean.startsWith("1")) {
    return getCountryByCode("US");
  }

  // 5. UK standard (07xxx or 447xxx)
  if ((clean.startsWith("07") && clean.length === 11) || (clean.startsWith("44") && clean.length === 12)) {
    return getCountryByCode("GB");
  }

  // 6. UAE standard (05x or 9715x)
  if ((clean.startsWith("05") && clean.length === 10) || (clean.startsWith("971") && clean.length === 12)) {
    return getCountryByCode("AE");
  }

  return { name: "International", code: "UN", flag: "🌐", dialCode: "" };
}

/**
 * Format raw phone number into standard international format
 */
export function formatPhoneWithCountryCode(rawPhone?: string | null, targetCountryCode?: string): string {
  if (!rawPhone) return "—";
  let clean = rawPhone.trim();
  if (clean === "—" || clean === "-") return "—";

  const digits = clean.replace(/[^\\d]/g, "");
  if (!digits || digits.length < 5) return rawPhone;

  // Determine country info
  const country = targetCountryCode ? getCountryByCode(targetCountryCode) : detectCountryFromPhone(clean);

  // Format by Target Country:
  if (country.code === "PK") {
    let localDigits = digits;
    if (localDigits.startsWith("92")) localDigits = localDigits.slice(2);
    if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);
    if (localDigits.length === 10) {
      return \`+92 \${localDigits.slice(0, 3)} \${localDigits.slice(3)}\`;
    }
    return \`+92 \${localDigits}\`;
  }

  if (country.code === "US" || country.code === "CA") {
    let localDigits = digits;
    if (localDigits.length === 11 && localDigits.startsWith("1")) localDigits = localDigits.slice(1);
    if (localDigits.length === 10) {
      return \`+1 (\${localDigits.slice(0, 3)}) \${localDigits.slice(3, 6)}-\${localDigits.slice(6)}\`;
    }
    return \`+1 \${localDigits}\`;
  }

  if (country.code === "GB") {
    let localDigits = digits;
    if (localDigits.startsWith("44")) localDigits = localDigits.slice(2);
    if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);
    return \`+44 \${localDigits}\`;
  }

  if (country.code === "AE") {
    let localDigits = digits;
    if (localDigits.startsWith("971")) localDigits = localDigits.slice(3);
    if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);
    return \`+971 \${localDigits}\`;
  }

  if (country.code === "SA") {
    let localDigits = digits;
    if (localDigits.startsWith("966")) localDigits = localDigits.slice(3);
    if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);
    return \`+966 \${localDigits}\`;
  }

  if (country.dialCode && !digits.startsWith(country.dialCode.replace("+", ""))) {
    return \`\${country.dialCode} \${digits}\`;
  }

  return clean.startsWith("+") ? clean : \`+\${digits}\`;
}

/**
 * Re-format a phone when user switches Country from dropdown
 */
export function changeCountryOnPhone(currentPhone: string, newCountryCode: string): string {
  if (!currentPhone || currentPhone === "—") return "—";
  return formatPhoneWithCountryCode(currentPhone, newCountryCode);
}
`;

fs.writeFileSync(countryHelperPath, fullCountryHelperCode, 'utf8');
console.log('src/lib/country-helper.ts updated with full international country list!');

// ==========================================
// 2. UPDATE src/components/crm/ImportLeadsDialog.tsx to show full country dropdown
// ==========================================
const importDialogPath = 'src/components/crm/ImportLeadsDialog.tsx';
let importCode = fs.readFileSync(importDialogPath, 'utf8');

// Ensure SUPPORTED_COUNTRIES is imported
if (!importCode.includes('SUPPORTED_COUNTRIES')) {
  importCode = importCode.replace(
    'import { detectCountryFromPhone, formatPhoneWithCountryCode, parseCountryString } from "@/lib/country-helper";',
    'import { detectCountryFromPhone, formatPhoneWithCountryCode, parseCountryString, SUPPORTED_COUNTRIES } from "@/lib/country-helper";'
  );
}

// Add Country UI directly below row count banner
const targetHeaderBanner = `<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span className="truncate text-sm font-medium">{fileName}</span>
                <Badge variant="secondary" className="rounded-full">
                  {rows.length} rows found
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setRows([]);
                  setFileName(null);
                  setRowAgents({});
                  setSelectedRowIndexes([]);
                }}
              >
                <X className="size-4" /> Clear
              </Button>
            </div>`;

const newHeaderBannerWithCountry = `<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span className="truncate text-sm font-medium">{fileName}</span>
                <Badge variant="secondary" className="rounded-full">
                  {rows.length} rows found
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setRows([]);
                  setFileName(null);
                  setRowAgents({});
                  setSelectedRowIndexes([]);
                }}
              >
                <X className="size-4" /> Clear
              </Button>
            </div>

            {/* Default Phone Country Setting for entire sheet */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-violet-950/20 border border-violet-500/30 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-violet-600/20 text-violet-300 shrink-0">
                  <Globe className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <span>Default Sheet Phone Country:</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-violet-500/40 text-violet-300">
                      {defaultPhoneCountry === "AUTO" ? "Smart Auto-Detect" : defaultPhoneCountry}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Applied to numbers in sheet that don't have a '+' sign or country column
                  </p>
                </div>
              </div>
              <Select value={defaultPhoneCountry} onValueChange={setDefaultPhoneCountry}>
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
              </Select>
            </div>`;

if (importCode.includes(targetHeaderBanner)) {
  importCode = importCode.replace(targetHeaderBanner, newHeaderBannerWithCountry);
}

fs.writeFileSync(importDialogPath, importCode, 'utf8');
console.log('ImportLeadsDialog.tsx updated with full global country selector!');