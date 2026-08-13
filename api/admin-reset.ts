import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "garryamelia6265@gmail.com";
const SECRET = "salesflow-reset-2026";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { secret } = req.body as { secret?: string };
  if (secret !== SECRET) return res.status(403).json({ error: "Forbidden" });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: string[] = [];

  // Delete all non-admin profiles
  const { error: profErr } = await supabase.from("profiles").delete().neq("email", ADMIN_EMAIL);
  results.push(profErr ? `profiles: ${profErr.message}` : "profiles: cleared");

  // Delete all leads
  await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  results.push("leads: cleared");

  // Delete all emails_sent
  await supabase.from("emails_sent").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  results.push("emails_sent: cleared");

  // Delete all non-admin auth users
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const toDelete = (usersData?.users || []).filter((u) => u.email !== ADMIN_EMAIL);
  for (const u of toDelete) {
    await supabase.auth.admin.deleteUser(u.id);
    results.push(`auth deleted: ${u.email}`);
  }

  return res.status(200).json({ ok: true, results });
}
