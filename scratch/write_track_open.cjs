const fs = require('fs');

const code = `import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://bcfxovomjcvgczqfubqf.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZnhvdm9tamN2Z2N6cWZ1YnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwNjIxMzUsImV4cCI6MjA1NTYzODEzNX0.3gQ_yF5x8x4p_y5Z5y5Z5y5Z5y5Z5y5Z5y5Z5y5Z5y0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1x1 Transparent GIF buffer
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const leadId = req.query.leadId as string;
    const email = req.query.email as string;

    // 1. Extract Real Client IP Address
    const rawForwarded = req.headers["x-forwarded-for"];
    const ip = (typeof rawForwarded === "string" ? rawForwarded.split(",")[0]?.trim() : "") ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "";

    // 2. Extract Geolocation from Vercel edge headers
    const countryCode = (req.headers["x-vercel-ip-country"] as string) || "";
    const countryRegion = (req.headers["x-vercel-ip-country-region"] as string) || "";
    const city = (req.headers["x-vercel-ip-city"] as string) || "";

    let locationParts: string[] = [];
    if (countryCode) locationParts.push(countryCode);
    if (countryRegion) locationParts.push(countryRegion);
    if (city) locationParts.push(city);
    
    let locationStr = locationParts.join(" / ");
    if (!locationStr && ip) {
      locationStr = "Detected Online";
    }

    // 3. Update Lead in Supabase if found
    if ((leadId || email) && ip) {
      const updateData: Record<string, any> = {
        ip_address: ip,
        location: locationStr,
      };

      if (leadId) {
        await supabase.from("leads").update(updateData).eq("id", leadId);
      } else if (email) {
        await supabase.from("leads").update(updateData).ilike("email", email);
      }
    }
  } catch (err) {
    console.error("Track open error:", err);
  }

  // 4. Always return 1x1 transparent GIF without caching
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.status(200).send(TRANSPARENT_GIF);
}
`;

fs.writeFileSync('api/track-open.ts', code, 'utf8');
console.log('api/track-open.ts created successfully!');