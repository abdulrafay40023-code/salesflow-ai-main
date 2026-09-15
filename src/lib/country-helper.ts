/**
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
  
  // Pakistan & Major Cities / Provinces
  if ([
    "pk", "pak", "pakistan", "sindh", "punjab", "karachi", "lahore",
    "islamabad", "rawalpindi", "peshawar", "quetta", "kpk", "balochistan", "sd"
  ].includes(s)) return getCountryByCode("PK");

  // United States & Major States
  if ([
    "us", "usa", "united states", "united states of america", "america",
    "california", "ca", "texas", "tx", "florida", "fl", "new york", "ny",
    "illinois", "il", "ohio", "oh", "georgia", "ga", "north carolina", "nc",
    "michigan", "mi", "new jersey", "nj", "virginia", "va", "washington", "wa",
    "arizona", "az", "massachusetts", "ma", "tennessee", "tn", "indiana", "in"
  ].includes(s)) return getCountryByCode("US");

  // United Kingdom & Cities
  if ([
    "gb", "uk", "united kingdom", "england", "britain", "great britain",
    "london", "manchester", "birmingham", "scotland", "wales"
  ].includes(s)) return getCountryByCode("GB");

  // UAE & Emirates
  if (["ae", "uae", "united arab emirates", "dubai", "abu dhabi", "sharjah"].includes(s)) return getCountryByCode("AE");

  // Saudi Arabia
  if (["sa", "ksa", "saudi", "saudi arabia", "riyadh", "jeddah", "mecca", "medina", "dammam"].includes(s)) return getCountryByCode("SA");

  // Canada & Provinces
  if (["ca", "canada", "ontario", "toronto", "quebec", "montreal", "vancouver", "british columbia", "alberta", "calgary"].includes(s)) return getCountryByCode("CA");

  // Australia & States
  if (["au", "australia", "sydney", "melbourne", "brisbane", "perth", "queensland", "new south wales", "victoria"].includes(s)) return getCountryByCode("AU");

  // New Zealand
  if (["nz", "new zealand"].includes(s)) return getCountryByCode("NZ");

  // India
  if (["in", "india", "delhi", "mumbai", "bangalore", "hyderabad", "chennai"].includes(s)) return getCountryByCode("IN");

  // Germany
  if (["de", "germany", "deutschland", "berlin", "munich", "frankfurt", "hamburg"].includes(s)) return getCountryByCode("DE");

  // France
  if (["fr", "france", "paris"].includes(s)) return getCountryByCode("FR");

  // Italy
  if (["it", "italy", "italia", "rome", "milan"].includes(s)) return getCountryByCode("IT");

  // Spain
  if (["es", "spain", "españa", "madrid", "barcelona"].includes(s)) return getCountryByCode("ES");

  // Netherlands
  if (["nl", "netherlands", "holland", "amsterdam"].includes(s)) return getCountryByCode("NL");

  // Switzerland
  if (["ch", "switzerland", "zurich", "geneva"].includes(s)) return getCountryByCode("CH");

  // Singapore
  if (["sg", "singapore"].includes(s)) return getCountryByCode("SG");

  // Malaysia
  if (["my", "malaysia", "kuala lumpur"].includes(s)) return getCountryByCode("MY");

  // Philippines
  if (["ph", "philippines", "manila"].includes(s)) return getCountryByCode("PH");

  // Qatar, Kuwait, Oman, Bahrain
  if (["qa", "qatar", "doha"].includes(s)) return getCountryByCode("QA");
  if (["kw", "kuwait"].includes(s)) return getCountryByCode("KW");
  if (["om", "oman", "muscat"].includes(s)) return getCountryByCode("OM");
  if (["bh", "bahrain", "manama"].includes(s)) return getCountryByCode("BH");

  // South Africa & Nigeria
  if (["za", "south africa", "johannesburg", "cape town"].includes(s)) return getCountryByCode("ZA");
  if (["ng", "nigeria", "lagos", "abuja"].includes(s)) return getCountryByCode("NG");

  // Brazil & Mexico
  if (["br", "brazil", "brasil", "sao paulo", "rio de janeiro"].includes(s)) return getCountryByCode("BR");
  if (["mx", "mexico", "mexico city"].includes(s)) return getCountryByCode("MX");

  // Turkey, Japan, South Korea
  if (["tr", "turkey", "türkiye", "istanbul", "ankara"].includes(s)) return getCountryByCode("TR");
  if (["jp", "japan", "tokyo", "osaka"].includes(s)) return getCountryByCode("JP");
  if (["kr", "korea", "south korea", "seoul"].includes(s)) return getCountryByCode("KR");

  return null;
}

/**
 * Detect Country from raw phone number
 */
export function detectCountryFromPhone(rawPhone?: string | null): CountryInfo {
  if (!rawPhone) {
    return { name: "International", code: "UN", flag: "🌐", dialCode: "" };
  }

  const clean = rawPhone.trim().replace(/[^\d]/g, "");
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

  const digits = clean.replace(/[^\d]/g, "");
  if (!digits || digits.length < 5) return rawPhone;

  // Determine country info
  const country = targetCountryCode ? getCountryByCode(targetCountryCode) : detectCountryFromPhone(clean);

  // Format by Target Country:
  if (country.code === "PK") {
    let localDigits = digits;
    if (localDigits.startsWith("92")) localDigits = localDigits.slice(2);
    if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);
    if (localDigits.length === 10) {
      return `+92 ${localDigits.slice(0, 3)} ${localDigits.slice(3)}`;
    }
    return `+92 ${localDigits}`;
  }

  if (country.code === "US" || country.code === "CA") {
    let localDigits = digits;
    if (localDigits.length === 11 && localDigits.startsWith("1")) localDigits = localDigits.slice(1);
    if (localDigits.length === 10) {
      return `+1 (${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
    }
    return `+1 ${localDigits}`;
  }

  if (country.code === "GB") {
    let localDigits = digits;
    if (localDigits.startsWith("44")) localDigits = localDigits.slice(2);
    if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);
    return `+44 ${localDigits}`;
  }

  if (country.code === "AE") {
    let localDigits = digits;
    if (localDigits.startsWith("971")) localDigits = localDigits.slice(3);
    if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);
    return `+971 ${localDigits}`;
  }

  if (country.code === "SA") {
    let localDigits = digits;
    if (localDigits.startsWith("966")) localDigits = localDigits.slice(3);
    if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);
    return `+966 ${localDigits}`;
  }

  if (country.dialCode && !digits.startsWith(country.dialCode.replace("+", ""))) {
    return `${country.dialCode} ${digits}`;
  }

  return clean.startsWith("+") ? clean : `+${digits}`;
}

/**
 * Re-format a phone when user switches Country from dropdown
 */
export function changeCountryOnPhone(currentPhone: string, newCountryCode: string): string {
  if (!currentPhone || currentPhone === "—") return "—";
  return formatPhoneWithCountryCode(currentPhone, newCountryCode);
}
