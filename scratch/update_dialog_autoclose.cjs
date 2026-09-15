const fs = require('fs');

const dialogPath = 'src/components/crm/AiCallDialog.tsx';
let dialog = fs.readFileSync(dialogPath, 'utf8');

// Update the call ended handler in the polling useEffect
dialog = dialog.replace(
  /\/\/ Trigger automated booking & confirmation email check[\s\S]*?if \(onCallComplete\) onCallComplete\(\);\s*\/\/ FIX: Auto-close REMOVED[^\n]*/,
  `// Trigger automated booking & confirmation email check
          try {
            const bookRes = await processVapiCallBookingFn({
              data: {
                callId,
                ...(lead?.id ? { leadId: lead.id } : {}),
                ...(lead?.email ? { leadEmail: lead.email } : {}),
              },
            });
            if (bookRes?.booked && bookRes?.clientEmail) {
              setBookingInfo(bookRes);
              setEmailSent(true);
              toast.success(
                \`🎉 Demo Booked! Confirmation email sent to \${bookRes.clientEmail}\`
              );
            } else {
              setBookingInfo({ booked: false });
              toast.info("Call ended (Status: Contacted).");
            }
          } catch (bErr) {
            console.error("Auto-booking check error:", bErr);
            setBookingInfo({ booked: false });
          }

          if (onCallComplete) onCallComplete();

          // 100% Fully Automated: Auto-close dialer after 2.5s and refresh dashboard/leads list
          setTimeout(() => {
            handleCloseDialog();
            if (onCallComplete) onCallComplete();
          }, 2600);`
);

// Add returning to dashboard indicator in the ended UI
dialog = dialog.replace(
  /<Button\s+onClick=\{handleCloseDialog\}\s+className="w-full h-9 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white"\s*>\s*Close & Return to Leads\s*<\/Button>/g,
  `<div className="text-[11px] text-muted-foreground/80 animate-pulse text-center pt-1">
                  Returning to dashboard in a moment...
                </div>
                <Button
                  onClick={handleCloseDialog}
                  className="w-full h-9 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white"
                >
                  ✅ Return to Leads Now
                </Button>`
);

fs.writeFileSync(dialogPath, dialog, 'utf8');
console.log('AiCallDialog.tsx updated with fully automated auto-close and refresh!');