const fs = require('fs');

// ==========================================
// 1. UPGRADE src/lib/country-helper.ts
// ==========================================
const countryHelperPath = 'src/lib/country-helper.ts';
let helperCode = fs.readFileSync(countryHelperPath, 'utf8');

const updatedParseCountryString = `export function parseCountryString(str?: string | null): CountryInfo | null {
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
}`;

helperCode = helperCode.replace(
  /export function parseCountryString[\s\S]*?return null;\n\}/,
  updatedParseCountryString
);

fs.writeFileSync(countryHelperPath, helperCode, 'utf8');
console.log('src/lib/country-helper.ts updated with extensive city & state matching!');

// ==========================================
// 2. UPGRADE src/routes/_app.leads.tsx (Auto Country from IP Location)
// ==========================================
const leadsPath = 'src/routes/_app.leads.tsx';
let leadsCode = fs.readFileSync(leadsPath, 'utf8');

const targetOldMapping = `          const leadDate = l.source_date || l.last_contact || l.created_at || new Date().toISOString();
          const countryInfo = detectCountryFromPhone(l.phone);
          const formattedPhone = l.phone && l.phone !== "—" ? formatPhoneWithCountryCode(l.phone) : (l.phone || "—");

          // Extract IP & Location from notes if captured
          let extractedIp: string | undefined = undefined;
          let extractedLocation: string | undefined = undefined;
          if (Array.isArray(l.notes)) {
            const ipNote = l.notes.find((n: string) => n.startsWith("🌐 IP:"));
            if (ipNote) {
              const match = ipNote.match(/🌐 IP:\\s*([^|]+)\\s*\\|\\s*Location:\\s*([^|]+)/i);
              if (match) {
                extractedIp = match[1]?.trim();
                extractedLocation = match[2]?.trim();
              }
            }
          }

          const cleanNotes = l.notes && l.notes.length 
            ? l.notes.filter((n: string) => !n.startsWith("🌐 IP:")) 
            : ["Imported lead."];

          return {
            id: l.id,
            name: l.name || "Unnamed",
            company: l.company || "—",
            email: l.email || "—",
            phone: formattedPhone,
            country: countryInfo.name,
            country_code: countryInfo.code,
            country_flag: countryInfo.flag,`;

const targetNewMapping = `          const leadDate = l.source_date || l.last_contact || l.created_at || new Date().toISOString();
          let countryInfo = detectCountryFromPhone(l.phone);
          const formattedPhone = l.phone && l.phone !== "—" ? formatPhoneWithCountryCode(l.phone) : (l.phone || "—");

          // Extract IP & Location from notes if captured
          let extractedIp: string | undefined = undefined;
          let extractedLocation: string | undefined = undefined;
          if (Array.isArray(l.notes)) {
            const ipNote = l.notes.find((n: string) => n.startsWith("🌐 IP:"));
            if (ipNote) {
              const match = ipNote.match(/🌐 IP:\\s*([^|]+)\\s*\\|\\s*Location:\\s*([^|]+)/i);
              if (match) {
                extractedIp = match[1]?.trim();
                extractedLocation = match[2]?.trim();
              }
            }
          }

          // ⚡ Smart Auto Country: If phone is International/Missing, detect country from IP Geolocation!
          if ((!countryInfo || countryInfo.code === "UN" || countryInfo.name === "International") && extractedLocation) {
            const parts = extractedLocation.split("/").map((p) => p.trim());
            for (const part of parts) {
              const parsed = parseCountryString(part);
              if (parsed && parsed.code !== "UN") {
                countryInfo = parsed;
                break;
              }
            }
            if (countryInfo.code === "UN" || countryInfo.name === "International") {
              const parsedWhole = parseCountryString(extractedLocation);
              if (parsedWhole && parsedWhole.code !== "UN") {
                countryInfo = parsedWhole;
              }
            }
          }

          const cleanNotes = l.notes && l.notes.length 
            ? l.notes.filter((n: string) => !n.startsWith("🌐 IP:")) 
            : ["Imported lead."];

          return {
            id: l.id,
            name: l.name || "Unnamed",
            company: l.company || "—",
            email: l.email || "—",
            phone: formattedPhone,
            country: countryInfo.name,
            country_code: countryInfo.code,
            country_flag: countryInfo.flag,`;

leadsCode = leadsCode.replace(targetOldMapping, targetNewMapping);
fs.writeFileSync(leadsPath, leadsCode, 'utf8');
console.log('src/routes/_app.leads.tsx updated to auto-detect country from IP location!');

// ==========================================
// 3. UPGRADE src/routes/book.tsx (Use ipwho.is HTTPS)
// ==========================================
const bookPath = 'src/routes/book.tsx';
let bookCode = fs.readFileSync(bookPath, 'utf8');

const oldBookHook = `  // Capture client real IP & location when visiting booking page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetEmail = params.get("email") || email;
    if (!targetEmail) return;

    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then(async (ipData) => {
        const clientIp = ipData?.ip;
        if (!clientIp) return;

        let loc = "Online";
        try {
          const geoRes = await fetch(\`http://ip-api.com/json/\${clientIp}?fields=status,country,regionName,city\`);
          const geoData = await geoRes.json();
          if (geoData && geoData.status === "success") {
            loc = [geoData.country, geoData.regionName, geoData.city].filter(Boolean).join(" / ");
          }
        } catch (e) {}

        const { data: lead } = await supabase
          .from("leads")
          .select("id, notes")
          .ilike("email", targetEmail)
          .maybeSingle();

        if (lead) {
          const existingNotes = Array.isArray(lead.notes) ? lead.notes : [];
          const filteredNotes = existingNotes.filter((n: string) => !n.startsWith("🌐 IP:"));
          const newNote = \`🌐 IP: \${clientIp} | Location: \${loc} | Viewed: \${new Date().toISOString()}\`;
          await supabase
            .from("leads")
            .update({ notes: [...filteredNotes, newNote] })
            .eq("id", lead.id);
        }
      })
      .catch(() => {});
  }, [email]);`;

const newBookHook = `  // Capture client real IP & location when visiting booking page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetEmail = params.get("email") || email;
    if (!targetEmail) return;

    fetch("https://ipwho.is/")
      .then((r) => r.json())
      .then(async (geoData) => {
        const clientIp = geoData?.ip;
        if (!clientIp) return;

        let locParts: string[] = [];
        if (geoData.country) locParts.push(geoData.country);
        if (geoData.region && geoData.region !== geoData.country) locParts.push(geoData.region);
        if (geoData.city && geoData.city !== geoData.region) locParts.push(geoData.city);

        const loc = locParts.length > 0 ? locParts.join(" / ") : "Online";

        const { data: lead } = await supabase
          .from("leads")
          .select("id, notes")
          .ilike("email", targetEmail)
          .maybeSingle();

        if (lead) {
          const existingNotes = Array.isArray(lead.notes) ? lead.notes : [];
          const filteredNotes = existingNotes.filter((n: string) => !n.startsWith("🌐 IP:"));
          const newNote = \`🌐 IP: \${clientIp} | Location: \${loc} | Viewed: \${new Date().toISOString()}\`;
          await supabase
            .from("leads")
            .update({ notes: [...filteredNotes, newNote] })
            .eq("id", lead.id);
        }
      })
      .catch(() => {});
  }, [email]);`;

bookCode = bookCode.replace(oldBookHook, newBookHook);
fs.writeFileSync(bookPath, bookCode, 'utf8');
console.log('src/routes/book.tsx updated with HTTPS ipwho.is geolocation!');

// ==========================================
// 4. UPGRADE api/track-open.ts (Use ipwho.is HTTPS)
// ==========================================
const trackOpenPath = 'api/track-open.ts';
let trackCode = fs.readFileSync(trackOpenPath, 'utf8');

trackCode = trackCode.replace(
  /fetch\(`http:\/\/ip-api\.com[\s\S]*?\)\s*;\s*const geoData = \(await geoRes\.json\(\)\) as any;[\s\S]*?city = geoData\.city \|\| city;\s*\}/,
  `fetch(\`https://ipwho.is/\${ip}\`);
        const geoData = (await geoRes.json()) as any;
        if (geoData?.success) {
          countryCode = geoData.country || countryCode;
          countryRegion = geoData.region || countryRegion;
          city = geoData.city || city;
        }`
);

fs.writeFileSync(trackOpenPath, trackCode, 'utf8');
console.log('api/track-open.ts updated with HTTPS ipwho.is geolocation!');