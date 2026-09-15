const fs = require('fs');

const bookPath = 'src/routes/book.tsx';
let bookCode = fs.readFileSync(bookPath, 'utf8');

// Ensure supabase is imported
if (!bookCode.includes('import { supabase }')) {
  bookCode = bookCode.replace(
    'import { confirmMeetingBookingFn, cancelMeetingBookingFn, getAgentBookedSlotsFn } from "@/lib/server-actions";',
    `import { confirmMeetingBookingFn, cancelMeetingBookingFn, getAgentBookedSlotsFn } from "@/lib/server-actions";
import { supabase } from "@/lib/supabase";`
  );
}

// Replace the buggy hook with the clean one
const oldHook = `  // Capture client real IP & location when visiting booking page
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
  }, [clientEmail, searchParams?.email]);`;

const newHook = `  // Capture client real IP & location when visiting booking page
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

if (bookCode.includes(oldHook)) {
  bookCode = bookCode.replace(oldHook, newHook);
} else {
  // Try replacement by regex or fallback
  bookCode = bookCode.replace(
    /(\/\/ Capture client real IP & location[\s\S]*?\[clientEmail, searchParams\?\.email\];\n)/,
    `${newHook}\n`
  );
}

fs.writeFileSync(bookPath, bookCode, 'utf8');
console.log('Fixed book.tsx!');