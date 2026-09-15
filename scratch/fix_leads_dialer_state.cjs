const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

// Replace the entire inline calling block with robust ref-backed state manager
const startBlock = '  // ⚡ 1-Click Power Dialer State & History (LeadId -> CallState & History list)';
const endBlock = '  async function handleHangupInlineCall(leadId: string) {';

// Find where handleHangupInlineCall ends
const hangupEndIndex = code.indexOf('    setTimeout(() => {', code.indexOf(endBlock));
const hangupFullEnd = code.indexOf('  }', hangupEndIndex + 30) + 3;

const oldCallManagerCode = code.substring(code.indexOf(startBlock), hangupFullEnd);

const newCallManagerCode = `  // ⚡ 1-Click Power Dialer State & History (LeadId -> CallState & History list)
  type CallHistoryItem = { callId: string; duration: number; status: "completed" | "no_answer"; timestamp: number };
  
  const [activeCalls, setActiveCalls] = useState<
    Record<string, { callId: string; status: "dialing" | "ringing" | "connected" | "ended"; duration: number; startTime?: number }>
  >({});
  const activeCallsRef = useRef<
    Record<string, { callId: string; status: "dialing" | "ringing" | "connected" | "ended"; duration: number; startTime?: number }>
  >({});

  const [callHistoryMap, setCallHistoryMap] = useState<Record<string, CallHistoryItem[]>>({});
  const callHistoryMapRef = useRef<Record<string, CallHistoryItem[]>>({});

  const activePollersRef = useRef<Record<string, any>>({});
  const activeTimersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    return () => {
      Object.values(activePollersRef.current).forEach((p) => clearInterval(p));
      Object.values(activeTimersRef.current).forEach((t) => clearInterval(t));
    };
  }, []);

  function formatDuration(sec: number) {
    if (!sec || sec < 0) return "0:00";
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return \`\${mins}:\${secs.toString().padStart(2, "0")}\`;
  }

  async function handleStartInlineCall(lead: Lead) {
    const leadId = lead.id;
    const existing = activeCallsRef.current[leadId];
    if (existing?.status === "ringing" || existing?.status === "connected") {
      return;
    }

    const initCall = { callId: "", status: "ringing" as const, duration: 0 };
    activeCallsRef.current[leadId] = initCall;
    setActiveCalls((prev) => ({ ...prev, [leadId]: initCall }));

    toast.info(\`📞 Dialing \${lead.name} (\${lead.phone})...\`);

    try {
      const res = await startVapiPhoneCallFn({
        data: {
          leadId: lead.id,
          leadName: lead.name,
          phoneNumber: lead.phone,
          leadEmail: lead.email !== "—" ? lead.email : undefined,
          agentEmail: lead.agent !== "Unassigned" ? lead.agent : user?.email || PRIMARY_ADMIN_EMAIL,
        },
      });

      if (!res?.success || !res.callId) {
        throw new Error(res?.error || "Failed to initiate outbound call");
      }

      const callId = res.callId;
      const ringingCall = { callId, status: "ringing" as const, duration: 0 };
      activeCallsRef.current[leadId] = ringingCall;
      setActiveCalls((prev) => ({ ...prev, [leadId]: ringingCall }));

      let pollCount = 0;
      activePollersRef.current[leadId] = setInterval(async () => {
        pollCount++;
        try {
          const statusRes = await getVapiCallStatusFn({ data: { callId } });
          if (!statusRes?.success) return;

          // 1. Client answered (Status in-progress)
          if (statusRes.status === "in-progress") {
            const current = activeCallsRef.current[leadId];
            if (current && current.status !== "connected") {
              const startTime = Date.now();
              const connectedCall = { callId, status: "connected" as const, duration: 0, startTime };
              activeCallsRef.current[leadId] = connectedCall;
              setActiveCalls((prev) => ({ ...prev, [leadId]: connectedCall }));

              // Live second-by-second timer based on actual timestamp
              if (activeTimersRef.current[leadId]) clearInterval(activeTimersRef.current[leadId]);
              activeTimersRef.current[leadId] = setInterval(() => {
                const cur = activeCallsRef.current[leadId];
                if (cur && cur.status === "connected" && cur.startTime) {
                  const elapsed = Math.floor((Date.now() - cur.startTime) / 1000);
                  activeCallsRef.current[leadId] = { ...cur, duration: elapsed };
                  setActiveCalls((prev) => ({
                    ...prev,
                    [leadId]: { ...cur, duration: elapsed },
                  }));
                }
              }, 1000);
            }
          }

          // 2. Call Ended or No Answer
          const isEnded = statusRes.status === "ended" || Boolean(statusRes.endedReason) || pollCount > 200;
          if (isEnded) {
            clearInterval(activePollersRef.current[leadId]);
            delete activePollersRef.current[leadId];

            if (activeTimersRef.current[leadId]) {
              clearInterval(activeTimersRef.current[leadId]);
              delete activeTimersRef.current[leadId];
            }

            const current = activeCallsRef.current[leadId];
            let finalDuration = 0;
            if (statusRes.duration && statusRes.duration > 0) {
              finalDuration = Math.round(statusRes.duration);
            } else if (current?.startTime) {
              finalDuration = Math.floor((Date.now() - current.startTime) / 1000);
            } else if (current?.duration) {
              finalDuration = current.duration;
            }

            const endedReason = statusRes.endedReason || "";
            const isNoAnswer =
              finalDuration === 0 ||
              endedReason === "customer-did-not-answer" ||
              endedReason === "customer-busy" ||
              endedReason === "no-answer";

            const itemStatus: "completed" | "no_answer" = isNoAnswer ? "no_answer" : "completed";

            // Add or update call in history list (deduplicated by callId)
            const prevHistory = callHistoryMapRef.current[leadId] || [];
            const filteredHistory = prevHistory.filter((h) => h.callId !== callId);
            const updatedHistory = [
              ...filteredHistory,
              { callId, duration: finalDuration, status: itemStatus, timestamp: Date.now() },
            ];
            callHistoryMapRef.current[leadId] = updatedHistory;
            setCallHistoryMap((prev) => ({ ...prev, [leadId]: updatedHistory }));

            const endedCall = { callId, status: "ended" as const, duration: finalDuration };
            activeCallsRef.current[leadId] = endedCall;
            setActiveCalls((prev) => ({ ...prev, [leadId]: endedCall }));

            // Trigger backend booking process & email extraction
            try {
              const bookRes = await processVapiCallBookingFn({
                data: {
                  callId,
                  leadId: lead.id,
                  leadEmail: lead.email !== "—" ? lead.email : undefined,
                },
              });

              if (bookRes?.booked) {
                toast.success(
                  \`🎉 Demo Booked with \${lead.name}! Meeting confirmed\${
                    bookRes.clientEmail ? \` & sent to \${bookRes.clientEmail}\` : ""
                  }\`
                );
              } else if (isNoAnswer) {
                toast.info(\`📞 No answer from \${lead.name} (Status: No Answer).\`);
              } else {
                toast.info(\`📞 Call with \${lead.name} completed (\${formatDuration(finalDuration)}).\`);
              }
            } catch (bErr) {
              console.error("Auto booking check error:", bErr);
            }

            // Sync Leads Table from Supabase
            fetchLeads();

            setTimeout(() => {
              const cur = activeCallsRef.current[leadId];
              if (cur?.status === "ended" && cur.callId === callId) {
                delete activeCallsRef.current[leadId];
                setActiveCalls((prev) => {
                  const copy = { ...prev };
                  delete copy[leadId];
                  return copy;
                });
              }
            }, 3000);
          }
        } catch (e) {
          console.error("Poller error:", e);
        }
      }, 1500);
    } catch (err: any) {
      console.error("Inline call error:", err);
      toast.error(\`Call failed: \${err.message || "Unknown error"}\`);
      delete activeCallsRef.current[leadId];
      setActiveCalls((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
    }
  }

  async function handleHangupInlineCall(leadId: string) {
    const callState = activeCallsRef.current[leadId];
    if (!callState) return;

    if (activePollersRef.current[leadId]) {
      clearInterval(activePollersRef.current[leadId]);
      delete activePollersRef.current[leadId];
    }
    if (activeTimersRef.current[leadId]) {
      clearInterval(activeTimersRef.current[leadId]);
      delete activeTimersRef.current[leadId];
    }

    if (callState.callId) {
      stopVapiCallFn({ data: { callId: callState.callId } }).catch(() => {});
    }

    let finalDur = 0;
    if (callState.startTime) {
      finalDur = Math.floor((Date.now() - callState.startTime) / 1000);
    } else if (callState.duration) {
      finalDur = callState.duration;
    }

    const itemStatus: "completed" | "no_answer" = finalDur > 0 ? "completed" : "no_answer";

    const prevHistory = callHistoryMapRef.current[leadId] || [];
    const filteredHistory = prevHistory.filter((h) => h.callId !== callState.callId);
    const updatedHistory = [
      ...filteredHistory,
      { callId: callState.callId, duration: finalDur, status: itemStatus, timestamp: Date.now() },
    ];
    callHistoryMapRef.current[leadId] = updatedHistory;
    setCallHistoryMap((prev) => ({ ...prev, [leadId]: updatedHistory }));

    const endedCall = { ...callState, status: "ended" as const, duration: finalDur };
    activeCallsRef.current[leadId] = endedCall;
    setActiveCalls((prev) => ({ ...prev, [leadId]: endedCall }));

    toast.info("Call disconnected.");
    fetchLeads();

    setTimeout(() => {
      delete activeCallsRef.current[leadId];
      setActiveCalls((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
    }, 3000);
  }`;

code = code.replace(oldCallManagerCode, newCallManagerCode);
fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Successfully replaced call manager in _app.leads.tsx!');