import type { VercelRequest, VercelResponse } from "@vercel/node";
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
    const userAgent = ((req.headers["user-agent"] as string) || "").toLowerCase();

    const rawForwarded = req.headers["x-forwarded-for"];
    let ip = (typeof rawForwarded === "string" ? rawForwarded.split(",")[0]?.trim() : "") ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "";

    if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

    // Ignore automated Google / Yahoo / Cloud proxy bots from overwriting real user location
    const isBotProxy =
      userAgent.includes("googleimageproxy") ||
      userAgent.includes("googlebot") ||
      userAgent.includes("yahoo! slurp") ||
      ip.startsWith("66.249.") ||
      ip.startsWith("64.233.") ||
      ip.startsWith("72.14.") ||
      ip.startsWith("209.85.");

    if (!isBotProxy && (leadId || email) && ip && ip !== "127.0.0.1" && !ip.startsWith("192.168")) {
      let countryCode = (req.headers["x-vercel-ip-country"] as string) || "";
      let countryRegion = (req.headers["x-vercel-ip-country-region"] as string) || "";
      let city = (req.headers["x-vercel-ip-city"] as string) || "";

      try {
        const geoRes = await fetch(`https://ipwho.is/${ip}`);
        const geoData = (await geoRes.json()) as any;
        if (geoData?.success) {
          countryCode = geoData.country || countryCode;
          countryRegion = geoData.region || countryRegion;
          city = geoData.city || city;
        }
      } catch (e) {}

      let locationParts: string[] = [];
      if (countryCode) locationParts.push(countryCode);
      if (countryRegion && countryRegion !== countryCode) locationParts.push(countryRegion);
      if (city && city !== countryRegion) locationParts.push(city);

      let locationStr = locationParts.join(" / ") || "Online";

      const query = leadId
        ? supabase.from("leads").select("id, notes").eq("id", leadId).maybeSingle()
        : supabase.from("leads").select("id, notes").ilike("email", email).maybeSingle();

      const { data: lead } = await query;

      if (lead) {
        const existingNotes = Array.isArray(lead.notes) ? lead.notes : [];
        const filteredNotes = existingNotes.filter((n: string) => !n.startsWith("🌐 IP:"));
        const newNote = `🌐 IP: ${ip} | Location: ${locationStr} | Viewed: ${new Date().toISOString()}`;
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
