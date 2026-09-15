const fs = require('fs');

// ==========================================
// 1. UPDATE api/track-open.ts
// ==========================================
const trackOpenPath = 'api/track-open.ts';
const fullTrackOpenCode = `import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const leadId = (req.query["leadId"] as string)?.trim();
    const email = (req.query["email"] as string)?.trim();

    const rawForwarded = req.headers["x-forwarded-for"];
    let ip = (typeof rawForwarded === "string" ? rawForwarded.split(",")[0]?.trim() : "") ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "";

    if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

    let countryCode = (req.headers["x-vercel-ip-country"] as string) || "";
    let countryRegion = (req.headers["x-vercel-ip-country-region"] as string) || "";
    let city = (req.headers["x-vercel-ip-city"] as string) || "";

    // If headers missing, do Geo lookup
    if ((!countryCode || !city) && ip && ip !== "127.0.0.1" && !ip.startsWith("192.168")) {
      try {
        const geoRes = await fetch(\`http://ip-api.com/json/\${ip}?fields=status,country,regionName,city\`);
        const geoData = (await geoRes.json()) as any;
        if (geoData?.status === "success") {
          countryCode = geoData.country || countryCode;
          countryRegion = geoData.regionName || countryRegion;
          city = geoData.city || city;
        }
      } catch (e) {}
    }

    let locationParts: string[] = [];
    if (countryCode) locationParts.push(countryCode);
    if (countryRegion && countryRegion !== countryCode) locationParts.push(countryRegion);
    if (city && city !== countryRegion) locationParts.push(city);

    let locationStr = locationParts.join(" / ");
    if (!locationStr && ip) {
      locationStr = "Online";
    }

    if ((leadId || email) && ip) {
      const query = leadId
        ? supabase.from("leads").select("id, notes").eq("id", leadId).maybeSingle()
        : supabase.from("leads").select("id, notes").ilike("email", email).maybeSingle();

      const { data: lead } = await query;

      if (lead) {
        const existingNotes = Array.isArray(lead.notes) ? lead.notes : [];
        const filteredNotes = existingNotes.filter((n: string) => !n.startsWith("🌐 IP:"));
        const newNote = \`🌐 IP: \${ip} | Location: \${locationStr} | Viewed: \${new Date().toISOString()}\`;
        await supabase
          .from("leads")
          .update({ notes: [...filteredNotes, newNote] })
          .eq("id", lead.id);
      }
    }
  } catch (err) {
    console.error("Track open error:", err);
  }

  return res.status(200).send(TRANSPARENT_GIF);
}
`;

fs.writeFileSync(trackOpenPath, fullTrackOpenCode, 'utf8');
console.log('api/track-open.ts updated!');

// ==========================================
// 2. UPDATE src/routes/book.tsx to capture IP on booking page visit
// ==========================================
const bookPath = 'src/routes/book.tsx';
let bookCode = fs.readFileSync(bookPath, 'utf8');

const bookGeoTrackingHook = `
  // Capture client real IP & location when visiting booking page
  useEffect(() => {
    const targetEmail = clientEmail || searchParams?.email;
    if (!targetEmail) return;

    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then(async (ipData) => {
        const clientIp = ipData?.ip;
        if (!clientIp) return;

        let loc = "Online";
        try {
          const geoRes = await fetch(\`https://ipapi.co/\${clientIp}/json/\`);
          const geoData = await geoRes.json();
          if (geoData && geoData.country_name) {
            loc = [geoData.country_name, geoData.region, geoData.city].filter(Boolean).join(" / ");
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
  }, [clientEmail, searchParams?.email]);
`;

if (!bookCode.includes('// Capture client real IP & location')) {
  bookCode = bookCode.replace(
    '  // Fetch booked slots for the selected agent and date',
    `${bookGeoTrackingHook}\n  // Fetch booked slots for the selected agent and date`
  );
  fs.writeFileSync(bookPath, bookCode, 'utf8');
  console.log('src/routes/book.tsx updated with IP geolocation tracking!');
}