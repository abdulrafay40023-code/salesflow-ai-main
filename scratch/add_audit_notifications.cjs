const fs = require('fs');

// ==========================================
// 1. UPDATE src/lib/email-service.ts
// ==========================================
const emailServicePath = 'src/lib/email-service.ts';
let emailServiceCode = fs.readFileSync(emailServicePath, 'utf8');

const auditEmailFn = `
/**
 * Security Audit Email — Sent to Admin whenever a Working Agent clears/deletes leads
 */
export async function sendLeadClearAuditEmail({
  agentName,
  agentEmail,
  scopeTitle,
  deletedCount,
}: {
  agentName: string;
  agentEmail: string;
  scopeTitle: string;
  deletedCount: number;
}) {
  const adminRecipients = ["garryamelia6265@gmail.com", "tzafar04@gmail.com"];

  const html = \`
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #334155;">
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 32px;">⚠️</span>
      <h2 style="color: #f43f5e; margin: 8px 0 4px 0; font-size: 20px;">Security Alert: Working Agent Cleared Leads</h2>
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">Automated CRM Audit Notification</p>
    </div>

    <div style="background-color: #1e293b; border-radius: 12px; padding: 18px; border: 1px solid #334155; margin-bottom: 20px;">
      <table style="width: 100%; font-size: 13px; color: #e2e8f0; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #94a3b8; width: 40%;">👤 Working Agent:</td>
          <td style="padding: 6px 0; font-weight: bold; color: #38bdf8;">\${agentName} (\${agentEmail})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #94a3b8;">🗑️ Deletion Rule:</td>
          <td style="padding: 6px 0; font-weight: bold; color: #f43f5e;">\${scopeTitle}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #94a3b8;">📊 Total Leads Deleted:</td>
          <td style="padding: 6px 0; font-weight: bold; color: #fbbf24;">\${deletedCount} Lead(s)</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #94a3b8;">⏱️ Timestamp (PKT):</td>
          <td style="padding: 6px 0; font-family: monospace; color: #a7f3d0;">\${getPktRfcDate()}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #090d16; border-radius: 8px; padding: 12px; border-left: 4px solid #38bdf8; font-size: 12px; color: #94a3b8; margin-bottom: 20px;">
      ℹ️ <strong>System Protection Note:</strong> Only leads assigned to \${agentName}'s personal dashboard were deleted. Admin leads and other working agents' leads were completely protected. All pending scheduled emails and reminders for these deleted leads have been cancelled.
    </div>

    <div style="text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 12px;">
      Teals CRM • Automated Security & Audit Engine
    </div>
  </div>
  \`;

  for (const adminEmail of adminRecipients) {
    try {
      await sendMailWithPktDate({
        from: \`"Teals CRM Security" <\${GMAIL_USER}>\`,
        to: adminEmail,
        subject: \`⚠️ [Security Alert] Agent \${agentName} cleared \${deletedCount} lead(s) (\${scopeTitle})\`,
        html,
      });
    } catch (e) {
      console.error(\`Failed to send audit email to \${adminEmail}:\`, e);
    }
  }
}
`;

if (!emailServiceCode.includes('sendLeadClearAuditEmail')) {
  emailServiceCode += `\n${auditEmailFn}`;
  fs.writeFileSync(emailServicePath, emailServiceCode, 'utf8');
  console.log('src/lib/email-service.ts updated with sendLeadClearAuditEmail!');
}

// ==========================================
// 2. UPDATE src/lib/server-actions.ts
// ==========================================
const serverActionsPath = 'src/lib/server-actions.ts';
let serverActionsCode = fs.readFileSync(serverActionsPath, 'utf8');

// Ensure sendLeadClearAuditEmail is imported
if (!serverActionsCode.includes('sendLeadClearAuditEmail')) {
  serverActionsCode = serverActionsCode.replace(
    'import {\n  sendWelcomeEmail,\n  sendMeetingBookedEmail,\n  sendGeneralEmail,\n  sendMeetingReminderEmail,\n  sendRescheduledMeetingEmail,\n} from "./email-service";',
    'import {\n  sendWelcomeEmail,\n  sendMeetingBookedEmail,\n  sendGeneralEmail,\n  sendMeetingReminderEmail,\n  sendRescheduledMeetingEmail,\n  sendLeadClearAuditEmail,\n} from "./email-service";'
  );
}

const notifyAdminServerFn = `
/**
 * 16. Notify Admin when Working Agent clears leads
 */
export const notifyAdminLeadsClearedFn = createServerFn({ method: "POST" })
  .validator((data: {
    agentName: string;
    agentEmail: string;
    scopeTitle: string;
    deletedCount: number;
  }) => data)
  .handler(async ({ data }) => {
    try {
      await sendLeadClearAuditEmail({
        agentName: data.agentName,
        agentEmail: data.agentEmail,
        scopeTitle: data.scopeTitle,
        deletedCount: data.deletedCount,
      });
      return { success: true };
    } catch (err: any) {
      console.error("notifyAdminLeadsClearedFn error:", err);
      return { success: false, error: err?.message };
    }
  });
`;

if (!serverActionsCode.includes('notifyAdminLeadsClearedFn')) {
  serverActionsCode += `\n${notifyAdminServerFn}`;
  fs.writeFileSync(serverActionsPath, serverActionsCode, 'utf8');
  console.log('src/lib/server-actions.ts updated with notifyAdminLeadsClearedFn!');
}

// ==========================================
// 3. UPDATE src/components/crm/ClearLeadsDialog.tsx
// ==========================================
const clearDialogPath = 'src/components/crm/ClearLeadsDialog.tsx';
let clearDialogCode = fs.readFileSync(clearDialogPath, 'utf8');

if (!clearDialogCode.includes('notifyAdminLeadsClearedFn')) {
  clearDialogCode = clearDialogCode.replace(
    'import { type Lead } from "@/lib/crm-data";',
    `import { type Lead } from "@/lib/crm-data";
import { notifyAdminLeadsClearedFn } from "@/lib/server-actions";`
  );

  // Trigger notification if not admin
  const deleteExecution = `toast.success(
        \`🗑️ Successfully deleted \${targetLeads.length} lead(s)! Pending emails/reminders cancelled.\`
      );`;

  const notifyExecution = `toast.success(
        \`🗑️ Successfully deleted \${targetLeads.length} lead(s)! Pending emails/reminders cancelled.\`
      );

      // If working agent is clearing leads, notify Admin via Email Alert
      if (!isAdmin && userEmail) {
        const currentOpt = options.find((o) => o.id === selectedOption);
        const scopeTitle = currentOpt ? currentOpt.title : selectedOption;
        notifyAdminLeadsClearedFn({
          data: {
            agentName: userEmail.split("@")[0],
            agentEmail: userEmail,
            scopeTitle,
            deletedCount: targetLeads.length,
          },
        }).catch((err) => console.error("Failed to trigger admin clear alert:", err));
      }`;

  clearDialogCode = clearDialogCode.replace(deleteExecution, notifyExecution);
  fs.writeFileSync(clearDialogPath, clearDialogCode, 'utf8');
  console.log('src/components/crm/ClearLeadsDialog.tsx updated with admin email alert trigger!');
}