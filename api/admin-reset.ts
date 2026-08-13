import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "garryamelia6265@gmail.com";
const SECRET = "salesflow-reset-2026";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body as { secret?: string };
  if (body?.secret !== SECRET) return res.status(403).json({ error: "Forbidden" });

  const supabase = createClient(
    process.env["VITE_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!
  );

  const results: string[] = [];

  try {
    const { error: profErr } = await supabase.from("profiles").delete().neq("email", ADMIN_EMAIL);
    results.push(profErr ? `profiles error: ${profErr.message}` : "profiles: cleared");
  } catch (e: any) { results.push(`profiles catch: ${e.message}`); }

  try {
    await supabase.from("leads").delete().gte("id", "00000000-0000-0000-0000-000000000000");
    results.push("leads: cleared");
  } catch (e: any) { results.push(`leads catch: ${e.message}`); }

  try {
    await supabase.from("emails_sent").delete().gte("id", "00000000-0000-0000-0000-000000000000");
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
