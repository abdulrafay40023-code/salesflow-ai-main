const fs = require('fs');

const dialogPath = 'src/components/crm/AiCallDialog.tsx';
let dialog = fs.readFileSync(dialogPath, 'utf8');

// Update StartCallPayload to include agentEmail
dialog = dialog.replace(
  /type StartCallPayload = \{[\s\S]*?leadEmail\?: string;\s*\};/,
  `type StartCallPayload = {
        phoneNumber: string;
        leadId?: string;
        leadName?: string;
        leadEmail?: string;
        agentEmail?: string;
      };`
);

// Update callData population
dialog = dialog.replace(
  /if \(lead\?\.email\) callData\.leadEmail = lead\.email;/,
  `if (lead?.email) callData.leadEmail = lead.email;
      if ((lead as any)?.assigned_agent_name || (lead as any)?.agent) {
        callData.agentEmail = (lead as any).assigned_agent_name || (lead as any).agent;
      }`
);

// Update handleHangupPhoneCall to auto-trigger processVapiCallBookingFn
dialog = dialog.replace(
  /\/\/ Manually Hang Up Phone Call[\s\S]*?if \(!bookingInfo\?\.booked\) setBookingInfo\(\{ booked: false \}\);\s*if \(onCallComplete\) onCallComplete\(\);\s*\}/,
  `// Manually Hang Up Phone Call
  async function handleHangupPhoneCall() {
    const callId = activeCallIdRef.current;
    if (callId) {
      toast.info("Disconnecting call...");
      await stopVapiCallFn({ data: { callId } });
    }
    stopLiveAudioStream();
    setIsListeningLive(false);
    isListeningLiveRef.current = false;
    setOutboundCallStatus("ended");

    // Automatically check for booking even on manual hangup
    if (callId) {
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
          toast.success(\`🎉 Demo Booked! Confirmation email sent to \${bookRes.clientEmail}\`);
        } else {
          setBookingInfo({ booked: false });
        }
      } catch (e) {
        setBookingInfo({ booked: false });
      }
    } else {
      if (!bookingInfo?.booked) setBookingInfo({ booked: false });
    }
    if (onCallComplete) onCallComplete();
  }`
);

fs.writeFileSync(dialogPath, dialog, 'utf8');
console.log('AiCallDialog.tsx updated successfully');