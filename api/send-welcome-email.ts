import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const GMAIL_USER = process.env["GMAIL_USER"] || "garryamelia6265@gmail.com";
const GMAIL_APP_PASS = process.env["GMAIL_APP_PASS"] || "vlnzgybqvbmapxnn";
const SITE_URL = "https://salesflow-ai-main.vercel.app";

const SUPABASE_URL =
  process.env["VITE_SUPABASE_URL"] ||
  process.env["SUPABASE_URL"] ||
  "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";

const SERVICE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASS,
  },
});

function getPktRfcDate(): string {
  const now = new Date();
  const pktMs = now.getTime() + 5 * 60 * 60 * 1000;
  const d = new Date(pktMs);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[d.getUTCDay()];
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = d.getUTCHours().toString().padStart(2, "0");
  const mins = d.getUTCMinutes().toString().padStart(2, "0");
  const secs = d.getUTCSeconds().toString().padStart(2, "0");
  return `${dayName}, ${day} ${month} ${year} ${hours}:${mins}:${secs} +0500`;
}

export default async function handler(req: any, res: any) {
  // CORS headers
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    return res.status ? res.status(200).end() : new Response("OK");
  }

  if (req.method !== "POST") {
    const errObj = { error: "Method not allowed" };
    return res.status
      ? res.status(405).json(errObj)
      : new Response(JSON.stringify(errObj), { status: 405 });
  }

  // Parse body
  let body: any = {};
  try {
    if (req.body) {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } else if (typeof req.json === "function") {
      body = await req.json();
    }
  } catch {}

  // Support both single lead and batch array
  // body = { leads: [{ email, leadId, agentEmail }] }
  // OR body = { email, leadId, agentEmail }
  const leads: { email: string; leadId?: string; agentEmail?: string }[] = [];

  if (Array.isArray(body.leads)) {
    leads.push(...body.leads);
  } else if (body.email) {
    leads.push({ email: body.email, leadId: body.leadId, agentEmail: body.agentEmail });
  }

  if (!leads.length) {
    const errObj = { error: "No leads provided" };
    return res.status
      ? res.status(400).json(errObj)
      : new Response(JSON.stringify(errObj), { status: 400 });
  }

  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const lead of leads) {
    const { email, leadId, agentEmail } = lead;

    if (!email || !email.includes("@")) {
      results.push({ email: email || "", success: false, error: "Invalid email" });
      continue;
    }

    try {
      const bookingUrl = agentEmail
        ? `${SITE_URL}/book?email=${encodeURIComponent(email)}&agent=${encodeURIComponent(agentEmail)}`
        : `${SITE_URL}/book?email=${encodeURIComponent(email)}`;

      const mailOptions = {
        from: `"Teals CRM" <${GMAIL_USER}>`,
        to: email,
        subject: "Welcome to Teals CRM - Automated Sales Solution",
        headers: {
          Date: getPktRfcDate(),
        },
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="background-color: #4f46e5; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Teals CRM</h1>
              <p style="color: #e0e7ff; margin: 4px 0 0 0; font-size: 14px;">AI-Powered Sales Workspace</p>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.6;">
              <h2 style="color: #1e293b; margin-top: 0;">Welcome!</h2>
              <p>Thank you for reaching out to us. We have received your information and are excited to assist you with your sales and business goals.</p>
              <p>Our team is reviewing your details to provide you with the best tailored solution.</p>
              <div style="margin: 30px 0; text-align: center;">
                <a href="${bookingUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Book a Meeting Slot Now
                </a>
              </div>
              <p style="font-size: 13px; color: #64748b;">If you have any questions, feel free to reply directly to this email.</p>
            </div>
            <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-radius: 0 0 8px 8px;">
              &copy; ${new Date().getFullYear()} Teals CRM. All rights reserved.
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      // Log to emails_sent table
      if (leadId) {
        await supabaseAdmin.from("emails_sent").insert({
          lead_id: leadId,
          lead_email: email,
          subject: "Welcome to Teals CRM",
          sequence_type: "welcome",
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      results.push({ email, success: true });
    } catch (err: any) {
      console.error(`Welcome email failed for ${email}:`, err?.message);
      results.push({ email, success: false, error: err?.message });
    }
  }

  const allSuccess = results.every((r) => r.success);
  const anySuccess = results.some((r) => r.success);

  const responseObj = {
    success: anySuccess,
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };

  return res.status
    ? res.status(allSuccess ? 200 : anySuccess ? 207 : 500).json(responseObj)
    : new Response(JSON.stringify(responseObj), {
        status: allSuccess ? 200 : anySuccess ? 207 : 500,
        headers: { "Content-Type": "application/json" },
      });
}
