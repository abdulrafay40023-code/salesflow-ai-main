const fs = require('fs');

const serverActionsPath = 'src/lib/server-actions.ts';
let code = fs.readFileSync(serverActionsPath, 'utf8');

// Ensure spoken email is saved to lead in Supabase even if not yet booked
const targetSearch = `      if (!isBooked && !clientEmail) {
        return {
          success: true,
          booked: false,
          message: "Call finished without booking.",
        };
      }`;

const targetReplacement = `      if (clientEmail && data.leadId) {
        // Always save the spoken / provided email into Supabase lead record
        await supabase
          .from("leads")
          .update({ email: clientEmail })
          .eq("id", data.leadId);
      }

      if (!isBooked && !clientEmail) {
        return {
          success: true,
          booked: false,
          message: "Call finished without booking.",
        };
      }`;

if (!code.includes('// Always save the spoken / provided email into Supabase lead record')) {
  code = code.replace(targetSearch, targetReplacement);
  fs.writeFileSync(serverActionsPath, code, 'utf8');
  console.log('Updated server-actions.ts: Spoken email is saved to Supabase lead on all calls!');
} else {
  console.log('Already had spoken email saver in server-actions.ts');
}