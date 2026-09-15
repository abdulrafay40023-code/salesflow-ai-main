const fs = require('fs');

const code = `/**
 * Smart Country & Phone Parser
 * Detects country, flag emoji, and formats phone numbers with country codes.
 */

export type CountryInfo = {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
};

const COUNTRY_MAP: { prefix: string; name: string; code: string; flag: string; dialCode: string; defaultLen?: number }[] = [
  { prefix: "92", name: "Pakistan", code: "PK", flag: "🇵🇰", dialCode: "+92", defaultLen: 11 },
  { prefix: "1", name: "United States", code: "US", flag: "🇺🇸", dialCode: "+1", defaultLen: 10 },
  { prefix: "44", name: "United Kingdom", code: "GB", flag: "🇬🇧", dialCode: "+44", defaultLen: 11 },
  { prefix: "971", name: "UAE", code: "AE", flag: "🇦🇪", dialCode: "+971", defaultLen: 9 },
  { prefix: "966", name: "Saudi Arabia", code: "SA", flag: "🇸🇦", dialCode: "+966", defaultLen: 9 },
  { prefix: "91", name: "India", code: "IN", flag: "🇮🇳", dialCode: "+91", defaultLen: 10 },
  { prefix: "61", name: "Australia", code: "AU", flag: "🇦🇺", dialCode: "+61", defaultLen: 9 },
  { prefix: "49", name: "Germany", code: "DE", flag: "🇩🇪", dialCode: "+49" },
  { prefix: "33", name: "France", code: "FR", flag: "🇫🇷", dialCode: "+33" },
  { prefix: "880", name: "Bangladesh", code: "BD", flag: "🇧🇩", dialCode: "+880" },
  { prefix: "234", name: "Nigeria", code: "NG", flag: "🇳🇬", dialCode: "+234" },
  { prefix: "55", name: "Brazil", code: "BR", flag: "🇧🇷", dialCode: "+55" },
  { prefix: "65", name: "Singapore", code: "SG", flag: "🇸🇬", dialCode: "+65" },
  { prefix: "81", name: "Japan", code: "JP", flag: "🇯🇵", dialCode: "+81" },
  { prefix: "82", name: "South Korea", code: "KR", flag: "🇰🇷", dialCode: "+82" },
  { prefix: "60", name: "Malaysia", code: "MY", flag: "🇲🇾", dialCode: "+60" },
  { prefix: "63", name: "Philippines", code: "PH", flag: "🇵🇭", dialCode: "+63" },
  { prefix: "974", name: "Qatar", code: "QA", flag: "🇶🇦", dialCode: "+974" },
  { prefix: "968", name: "Oman", code: "OM", flag: "🇴🇲", dialCode: "+968" },
  { prefix: "965", name: "Kuwait", code: "KW", flag: "🇰🇼", dialCode: "+965" },
  { prefix: "20", name: "Egypt", code: "EG", flag: "🇪🇬", dialCode: "+20" },
  { prefix: "27", name: "South Africa", code: "ZA", flag: "🇿🇦", dialCode: "+27" },
  { prefix: "39", name: "Italy", code: "IT", flag: "🇮🇹", dialCode: "+39" },
  { prefix: "34", name: "Spain", code: "ES", flag: "🇪🇸", dialCode: "+34" },
  { prefix: "31", name: "Netherlands", code: "NL", flag: "🇳🇱", dialCode: "+31" },
  { prefix: "41", name: "Switzerland", code: "CH", flag: "🇨🇭", dialCode: "+41" },
  { prefix: "46", name: "Sweden", code: "SE", flag: "🇸🇪", dialCode: "+46" },
  { prefix: "47", name: "Norway", code: "NO", flag: "🇳🇴", dialCode: "+47" },
  { prefix: "45", name: "Denmark", code: "DK", flag: "🇩🇰", dialCode: "+45" },
  { prefix: "64", name: "New Zealand", code: "NZ", flag: "🇳🇿", dialCode: "+64" },
  { prefix: "52", name: "Mexico", code: "MX", flag: "🇲🇽", dialCode: "+52" },
  { prefix: "90", name: "Turkey", code: "TR", flag: "🇹🇷", dialCode: "+90" },
];

export function detectCountryFromPhone(rawPhone?: string | null): CountryInfo {
  if (!rawPhone) {
    return { name: "International", code: "UN", flag: "🌐", dialCode: "" };
  }

  const clean = rawPhone.trim().replace(/[^\\d]/g, "");
  if (!clean || clean.length < 5) {
    return { name: "International", code: "UN", flag: "🌐", dialCode: "" };
  }

  // Check 1: Explicit leading + or 00
  if (rawPhone.trim().startsWith("+") || rawPhone.trim().startsWith("00")) {
    for (const c of COUNTRY_MAP) {
      if (clean.startsWith(c.prefix)) {
        return { name: c.name, code: c.code, flag: c.flag, dialCode: c.dialCode };
      }
    }
  }

  // Check 2: Pakistan local format (03xx-xxxxxxx, 11 digits)
  if (clean.startsWith("03") && clean.length === 11) {
    return { name: "Pakistan", code: "PK", flag: "🇵🇰", dialCode: "+92" };
  }
  if (clean.startsWith("92") && clean.length >= 12) {
    return { name: "Pakistan", code: "PK", flag: "🇵🇰", dialCode: "+92" };
  }

  // Check 3: US / North America 10 digits standard (e.g. 7282887071, 5615921404)
  if (clean.length === 10) {
    return { name: "United States", code: "US", flag: "🇺🇸", dialCode: "+1" };
  }
  if (clean.length === 11 && clean.startsWith("1")) {
    return { name: "United States", code: "US", flag: "🇺🇸", dialCode: "+1" };
  }

  // Check 4: UK local format (07xxx xxxxxx, 11 digits)
  if (clean.startsWith("07") && clean.length === 11) {
    return { name: "United Kingdom", code: "GB", flag: "🇬🇧", dialCode: "+44" };
  }

  // Check 5: UAE local format (05x xxx xxxx, 10 digits)
  if (clean.startsWith("05") && (clean.length === 10 || clean.length === 9)) {
    return { name: "UAE", code: "AE", flag: "🇦🇪", dialCode: "+971" };
  }

  // Check 6: Check standard prefixes in clean digits
  for (const c of COUNTRY_MAP) {
    if (clean.startsWith(c.prefix) && clean.length >= c.prefix.length + 7) {
      return { name: c.name, code: c.code, flag: c.flag, dialCode: c.dialCode };
    }
  }

  // Default fallback
  return { name: "International", code: "UN", flag: "🌐", dialCode: "" };
}

/**
 * Format any raw phone number into standard international format with dial code
 */
export function formatPhoneWithCountryCode(rawPhone?: string | null): string {
  if (!rawPhone) return "—";
  let clean = rawPhone.trim();
  if (clean === "—" || clean === "-") return "—";

  const digits = clean.replace(/[^\\d]/g, "");
  if (!digits || digits.length < 5) return rawPhone;

  // If already starts with +, format nicely
  if (clean.startsWith("+")) {
    return clean;
  }

  // Pakistan local format
  if (digits.startsWith("03") && digits.length === 11) {
    return \`+92 \${digits.slice(1, 4)} \${digits.slice(4)}\`;
  }
  if (digits.startsWith("92") && digits.length === 12) {
    return \`+92 \${digits.slice(2, 5)} \${digits.slice(5)}\`;
  }

  // US 10 digits format (e.g. 7282887071 -> +1 728-288-7071)
  if (digits.length === 10) {
    return \`+1 (\${digits.slice(0, 3)}) \${digits.slice(3, 6)}-\${digits.slice(6)}\`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return \`+1 (\${digits.slice(1, 4)}) \${digits.slice(4, 7)}-\${digits.slice(7)}\`;
  }

  // UK local format
  if (digits.startsWith("07") && digits.length === 11) {
    return \`+44 \${digits.slice(1, 5)} \${digits.slice(5)}\`;
  }

  // UAE local format
  if (digits.startsWith("05") && (digits.length === 10 || digits.length === 9)) {
    return \`+971 \${digits.slice(1, 3)} \${digits.slice(3)}\`;
  }

  // Default prefix detection
  const detected = detectCountryFromPhone(clean);
  if (detected.dialCode && !digits.startsWith(detected.dialCode.replace("+", ""))) {
    return \`\${detected.dialCode} \${digits}\`;
  }

  return \`+\${digits}\`;
}
`;

fs.writeFileSync('src/lib/country-helper.ts', code, 'utf8');
console.log('src/lib/country-helper.ts written cleanly!');