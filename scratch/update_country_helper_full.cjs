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

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { name: "United States", code: "US", flag: "🇺🇸", dialCode: "+1" },
  { name: "Pakistan", code: "PK", flag: "🇵🇰", dialCode: "+92" },
  { name: "United Kingdom", code: "GB", flag: "🇬🇧", dialCode: "+44" },
  { name: "UAE", code: "AE", flag: "🇦🇪", dialCode: "+971" },
  { name: "Saudi Arabia", code: "SA", flag: "🇸🇦", dialCode: "+966" },
  { name: "Canada", code: "CA", flag: "🇨🇦", dialCode: "+1" },
  { name: "Australia", code: "AU", flag: "🇦🇺", dialCode: "+61" },
  { name: "India", code: "IN", flag: "🇮🇳", dialCode: "+91" },
  { name: "Germany", code: "DE", flag: "🇩🇪", dialCode: "+49" },
  { name: "France", code: "FR", flag: "🇫🇷", dialCode: "+33" },
  { name: "Nigeria", code: "NG", flag: "🇳🇬", dialCode: "+234" },
  { name: "Singapore", code: "SG", flag: "🇸🇬", dialCode: "+65" },
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
    if (clean.startsWith("49")) return getCountryByCode("DE");
    if (clean.startsWith("33")) return getCountryByCode("FR");
    if (clean.startsWith("234")) return getCountryByCode("NG");
  }

  // 2. Pakistan standard 11 digits (03xx-xxxxxxx) or 12 digits (923xx...)
  if (clean.startsWith("03") && clean.length === 11) {
    return getCountryByCode("PK");
  }
  if (clean.startsWith("923") && clean.length === 12) {
    return getCountryByCode("PK");
  }

  // 3. Pakistan 10 digits when Excel strips leading 0 (e.g. 3301035196, 3001234567, 3421234567)
  // Pakistan mobile network prefixes: 30, 31, 32, 33, 34, 35
  if (clean.length === 10 && /^3[0-5]/.test(clean)) {
    // Check if user has other Pakistan numbers or Ufone/Jazz pattern
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
    // Extract local 10 digits
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

fs.writeFileSync('src/lib/country-helper.ts', code, 'utf8');
console.log('src/lib/country-helper.ts updated with full country switcher and Pakistan/US detection!');