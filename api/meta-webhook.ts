import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const ADMIN_EMAIL = "garryamelia6265@gmail.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & Security headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 1. GET: Meta Webhook Verification Challenge
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "salesflow_meta_secret_token";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("META WEBHOOK VERIFIED SUCCESSFULLY!");
      return res.status(200).send(challenge);
    } else {
      console.warn("Meta Webhook verification failed. Token mismatch.");
      return res.status(403).json({ error: "Verification failed. Token mismatch." });
    }
  }

  // 2. POST: Incoming Lead Ads Event
  if (req.method === "POST") {
    try {
      const body = req.body || {};
      console.log("Incoming Meta Lead Webhook Payload:", JSON.stringify(body));

      const entry = body.entry || [];
      const insertedLeads: any[] = [];

      for (const e of entry) {
        const changes = e.changes || [];
        for (const change of changes) {
          if (change.field === "leadgen") {
            const value = change.value || {};
            const leadgenId = value.leadgen_id;
            const formId = value.form_id;
            const pageId = value.page_id;

            // Direct payload fields or mock fallback for testing
            const name = value.name || value.full_name || `Meta Lead #${leadgenId || Date.now().toString().slice(-4)}`;
            const email = value.email || value.lead_email || `meta_lead_${leadgenId || Date.now()}@meta.lead`;
            const phone = value.phone_number || value.phone || "+1 (555) 019-meta";

            const newLead = {
              name,
              email: email.toLowerCase().trim(),
              phone,
              company: "Meta Lead Ads",
              status: "new",
              assigned_agent_name: ADMIN_EMAIL,
              notes: [
                `Source: Meta Lead Ads`,
                `Form ID: ${formId || "N/A"}`,
                `Page ID: ${pageId || "N/A"}`,
                `Leadgen ID: ${leadgenId || "N/A"}`,
              ],
              created_at: new Date().toISOString(),
            };

            const { data, error } = await supabase.from("leads").insert(newLead).select();
            if (error) {
              console.error("Error inserting Meta lead to Supabase:", error.message);
            } else if (data) {
              insertedLeads.push(data[0]);
            }
          }
        }
      }

      // Fallback: If POST payload is direct JSON lead object (e.g. Zapier / Make / Meta Graph Test Tool)
      if (insertedLeads.length === 0 && (body.email || body.name)) {
        const directLead = {
          name: body.name || "Meta Test Lead",
          email: (body.email || `meta_lead_${Date.now()}@meta.lead`).toLowerCase().trim(),
          phone: body.phone || body.phone_number || "+1 (555) 019-meta",
          company: body.company || "Meta Lead Ads",
          status: "new",
          assigned_agent_name: ADMIN_EMAIL,
          notes: ["Source: Meta Lead Ads Direct Webhook"],
          created_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from("leads").insert(directLead).select();
        if (!error && data) {
          insertedLeads.push(data[0]);
        }
      }

      return res.status(200).json({
        status: "success",
        message: `Processed ${insertedLeads.length} Meta leads`,
        leads: insertedLeads,
      });
    } catch (err: any) {
      console.error("Meta Webhook error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
