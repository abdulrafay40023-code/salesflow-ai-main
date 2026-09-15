const fs = require('fs');

// ==========================================
// 1. UPDATE src/components/crm/ImportLeadsDialog.tsx
// ==========================================
const importPath = 'src/components/crm/ImportLeadsDialog.tsx';
let importCode = fs.readFileSync(importPath, 'utf8');

// Remove `country: ...` from payload
importCode = importCode.replace(
  /country:\s*l\.phone\s*\?\s*detectCountryFromPhone\(l\.phone\)\.name\s*:\s*"International",\s*/,
  ""
);

// Fix error handling in handleImport
const oldInsertBlock = `      let inserted: { id: string; email: string }[] | null = null;
      if (newLeadsToInsert.length > 0) {
        const { data, error } = await supabase.from("leads").insert(newLeadsToInsert).select("id, email");
        if (error) console.log("Supabase lead insertion notice:", error.message);
        inserted = data;
      }`;

const newInsertBlock = `      let inserted: { id: string; email: string }[] | null = null;
      if (newLeadsToInsert.length > 0) {
        const { data, error } = await supabase.from("leads").insert(newLeadsToInsert).select("id, email");
        if (error) {
          console.error("Supabase lead insertion error:", error);
          toast.error("Database lead insertion failed: " + error.message);
          setIsImporting(false);
          return;
        }
        inserted = data;
      }`;

importCode = importCode.replace(oldInsertBlock, newInsertBlock);
fs.writeFileSync(importPath, importCode, 'utf8');
console.log('ImportLeadsDialog.tsx fixed cleanly!');

// ==========================================
// 2. UPDATE api/track-open.ts
// ==========================================
const trackOpenPath = 'api/track-open.ts';
const trackOpenCode = `import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const leadId = req.query["leadId"] as string;
    const email = req.query["email"] as string;

    const rawForwarded = req.headers["x-forwarded-for"];
    const ip = (typeof rawForwarded === "string" ? rawForwarded.split(",")[0]?.trim() : "") ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "";

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

    if ((leadId || email) && ip) {
      const { data: lead } = leadId
        ? await supabase.from("leads").select("id, notes").eq("id", leadId).maybeSingle()
        : await supabase.from("leads").select("id, notes").ilike("email", email).maybeSingle();

      if (lead) {
        const existingNotes = Array.isArray(lead.notes) ? lead.notes : [];
        const filteredNotes = existingNotes.filter((n: string) => !n.startsWith("🌐 IP:"));
        const newNote = \`🌐 IP: \${ip} | Location: \${locationStr} | Viewed: \${new Date().toISOString()}\`;
        await supabase.from("leads").update({ notes: [...filteredNotes, newNote] }).eq("id", lead.id);
      }
    }
  } catch (err) {
    console.error("Track open error:", err);
  }

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.status(200).send(TRANSPARENT_GIF);
}
`;
fs.writeFileSync(trackOpenPath, trackOpenCode, 'utf8');
console.log('api/track-open.ts updated with Supabase notes storage!');

// ==========================================
// 3. UPDATE src/routes/_app.leads.tsx to parse IP from notes
// ==========================================
const leadsPath = 'src/routes/_app.leads.tsx';
let leadsCode = fs.readFileSync(leadsPath, 'utf8');

const oldMapReturn = `          return {
            id: l.id,
            name: l.name || "Unnamed",
            company: l.company || "—",
            email: l.email || "—",
            phone: formattedPhone,
            country: l.country || countryInfo.name,
            country_code: countryInfo.code,
            country_flag: countryInfo.flag,
            ip_address: l.ip_address || undefined,
            location: l.location || undefined,
            status: validStatus,
            agent: l.assigned_agent_name || "Unassigned",
            lastContact: leadDate,
            nextFollowUp: l.next_follow_up || l.created_at || new Date().toISOString(),
            notes: l.notes && l.notes.length ? l.notes : ["Imported lead."],
            value: l.value || 0,
            source_date: leadDate,
            updated_at: l.updated_at || l.booked_at || l.contacted_at || l.won_at || (validStatus !== "new" ? leadDate : undefined),
          };`;

const newMapReturn = `          // Extract IP & Location from notes if captured
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
            country_flag: countryInfo.flag,
            ip_address: extractedIp,
            location: extractedLocation,
            status: validStatus,
            agent: l.assigned_agent_name || "Unassigned",
            lastContact: leadDate,
            nextFollowUp: l.next_follow_up || l.created_at || new Date().toISOString(),
            notes: cleanNotes.length > 0 ? cleanNotes : ["Imported lead."],
            value: l.value || 0,
            source_date: leadDate,
            updated_at: l.updated_at || l.booked_at || l.contacted_at || l.won_at || (validStatus !== "new" ? leadDate : undefined),
          };`;

leadsCode = leadsCode.replace(oldMapReturn, newMapReturn);
fs.writeFileSync(leadsPath, leadsCode, 'utf8');
console.log('src/routes/_app.leads.tsx updated to parse IP & Location from notes!');