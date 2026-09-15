const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

const targetSearch = `      const callId = res.callId;
      const ringingCall = { callId, status: "ringing" as const, duration: 0 };
      activeCallsRef.current[leadId] = ringingCall;
      setActiveCalls((prev) => ({ ...prev, [leadId]: ringingCall }));

      let pollCount = 0;
      activePollersRef.current[leadId] = setInterval(async () => {
        pollCount++;
        try {
          const statusRes = await getVapiCallStatusFn({ data: { callId } });
          if (!statusRes?.success) return;`;

const targetReplacement = `      const callId = res.callId;
      const dialStartTime = Date.now();
      const ringingCall = { callId, status: "ringing" as const, duration: 0 };
      activeCallsRef.current[leadId] = ringingCall;
      setActiveCalls((prev) => ({ ...prev, [leadId]: ringingCall }));

      let pollCount = 0;
      activePollersRef.current[leadId] = setInterval(async () => {
        pollCount++;
        try {
          // ⏱️ 15-Second Max Ringing Timeout Check
          const curRing = activeCallsRef.current[leadId];
          if (curRing?.status === "ringing") {
            const ringElapsed = Math.floor((Date.now() - dialStartTime) / 1000);
            if (ringElapsed >= 15) {
              clearInterval(activePollersRef.current[leadId]);
              delete activePollersRef.current[leadId];

              if (activeTimersRef.current[leadId]) {
                clearInterval(activeTimersRef.current[leadId]);
                delete activeTimersRef.current[leadId];
              }

              if (callId) {
                stopVapiCallFn({ data: { callId } }).catch(() => {});
              }

              const prevHistory = callHistoryMapRef.current[leadId] || [];
              const filteredHistory = prevHistory.filter((h) => h.callId !== callId);
              const updatedHistory = [
                ...filteredHistory,
                { callId: callId || \`no-ans-\${Date.now()}\`, duration: 0, status: "no_answer" as const, timestamp: Date.now() },
              ];
              callHistoryMapRef.current[leadId] = updatedHistory;
              setCallHistoryMap((prev) => ({ ...prev, [leadId]: updatedHistory }));

              const endedCall = { callId, status: "ended" as const, duration: 0 };
              activeCallsRef.current[leadId] = endedCall;
              setActiveCalls((prev) => ({ ...prev, [leadId]: endedCall }));

              toast.info(\`📞 15s Ringing: No answer from \${lead.name} (Status: No Answer).\`);

              await supabase.from("leads").update({ status: "no_answer" }).eq("id", lead.id);
              fetchLeads();

              setTimeout(() => {
                delete activeCallsRef.current[leadId];
                setActiveCalls((prev) => {
                  const copy = { ...prev };
                  delete copy[leadId];
                  return copy;
                });
              }, 3000);
              return;
            }
          }

          const statusRes = await getVapiCallStatusFn({ data: { callId } });
          if (!statusRes?.success) return;`;

code = code.replace(targetSearch, targetReplacement);
fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Successfully added 15-second ringing timeout in _app.leads.tsx!');