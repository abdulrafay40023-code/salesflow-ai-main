import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "garryamelia6265@gmail.com";
const SECRET = "salesflow-reset-2026";

// Hardcoded credentials for admin-only reset operation
const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";


export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body: any = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch {}
  if (body?.secret !== SECRET) return res.status(403).json({ error: "Forbidden" });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const results: string[] = [];

  try {
    const { error } = await supabase.from("profiles").delete().neq("email", ADMIN_EMAIL);
    results.push(error ? `profiles error: ${error.message}` : "profiles: cleared");
  } catch (e: any) { results.push(`profiles catch: ${e.message}`); }

  try {
    await supabase.from("leads").delete().not("id", "is", null);
    results.push("leads: cleared");
  } catch (e: any) { results.push(`leads catch: ${e.message}`); }

  try {
    await supabase.from("emails_sent").delete().not("id", "is", null);
    results.push("emails_sent: cleared");
  } catch (e: any) { results.push(`emails_sent catch: ${e.message}`); }

  try {
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const toDelete = (usersData?.users || []).filter((u: any) => u.email !== ADMIN_EMAIL);
    for (const u of toDelete) {
      await supabase.auth.admin.deleteUser(u.id);
      results.push(`auth deleted: ${u.email}`);
    }
  } catch (e: any) { results.push(`auth catch: ${e.message}`); }

  return res.status(200).json({ ok: true, results });
}
