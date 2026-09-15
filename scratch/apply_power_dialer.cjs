const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

// 1. Add imports: PhoneOff, CheckCircle2, startVapiPhoneCallFn, getVapiCallStatusFn, stopVapiCallFn, processVapiCallBookingFn, useRef
if (!code.includes('PhoneOff')) {
  code = code.replace(
    'ArrowUpDown, Filter, RefreshCw, Search, SlidersHorizontal, Users, UserCheck, Calendar, Trash2, PhoneCall',
    'ArrowUpDown, Filter, RefreshCw, Search, SlidersHorizontal, Users, UserCheck, Calendar, Trash2, PhoneCall, PhoneOff, CheckCircle2'
  );
}

if (!code.includes('useRef')) {
  code = code.replace(
    'import { useEffect, useMemo, useState }',
    'import { useEffect, useMemo, useState, useRef }'
  );
}

if (!code.includes('startVapiPhoneCallFn')) {
  code = code.replace(
    'import { CountryCombobox } from "@/components/crm/CountryCombobox";',
    'import { CountryCombobox } from "@/components/crm/CountryCombobox";\nimport { startVapiPhoneCallFn, getVapiCallStatusFn, stopVapiCallFn, processVapiCallBookingFn } from "@/lib/server-actions";'
  );
}

// 2. Add activeCalls state and handlers inside LeadsPage()
const stateTarget = '  const [callingLead, setCallingLead] = useState<Lead | null>(null);';
const stateAddition = `  const [callingLead, setCallingLead] = useState<Lead | null>(null);

  // ⚡ 1-Click Power Dialer State (LeadId -> CallState)
  const [activeCalls, setActiveCalls] = useState<
    Record<string, { callId: string; status: "dialing" | "ringing" | "connected" | "ended"; duration: number }>
  >({});

  const activePollersRef = useRef<Record<string, any>>({});
  const activeTimersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    return () => {
      Object.values(activePollersRef.current).forEach((p) => clearInterval(p));
      Object.values(activeTimersRef.current).forEach((t) => clearInterval(t));
    };
  }, []);

  function formatDuration(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return \`\${mins}:\${secs.toString().padStart(2, "0")}\`;
  }

  async function handleStartInlineCall(lead: Lead) {
    const leadId = lead.id;
    if (activeCalls[leadId]?.status === "ringing" || activeCalls[leadId]?.status === "connected") {
      return;
    }

    setActiveCalls((prev) => ({
      ...prev,
      [leadId]: { callId: "", status: "ringing", duration: 0 },
    }));

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

      setActiveCalls((prev) => ({
        ...prev,
        [leadId]: { callId, status: "ringing", duration: 0 },
      }));

      let pollCount = 0;
      activePollersRef.current[leadId] = setInterval(async () => {
        pollCount++;
        try {
          const statusRes = await getVapiCallStatusFn({ data: { callId } });
          if (!statusRes?.success) return;

          if (statusRes.status === "in-progress") {
            setActiveCalls((prev) => {
              if (prev[leadId]?.status === "connected") return prev;
              return { ...prev, [leadId]: { ...prev[leadId], status: "connected" } };
            });

            if (!activeTimersRef.current[leadId]) {
              activeTimersRef.current[leadId] = setInterval(() => {
                setActiveCalls((prev) => {
                  if (!prev[leadId]) return prev;
                  return {
                    ...prev,
                    [leadId]: {
                      ...prev[leadId],
                      duration: (prev[leadId].duration || 0) + 1,
                    },
                  };
                });
              }, 1000);
            }
          }

          if (statusRes.status === "ended" || statusRes.endedReason || pollCount > 240) {
            clearInterval(activePollersRef.current[leadId]);
            delete activePollersRef.current[leadId];

            clearInterval(activeTimersRef.current[leadId]);
            delete activeTimersRef.current[leadId];

            const finalDuration = statusRes.duration ? Math.round(statusRes.duration) : 0;

            setActiveCalls((prev) => ({
              ...prev,
              [leadId]: {
                callId,
                status: "ended",
                duration: finalDuration || prev[leadId]?.duration || 0,
              },
            }));

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
              } else {
                toast.info(\`📞 Call with \${lead.name} completed.\`);
              }
            } catch (bErr) {
              console.error("Auto booking check error:", bErr);
            }

            fetchLeads();

            setTimeout(() => {
              setActiveCalls((prev) => {
                const copy = { ...prev };
                delete copy[leadId];
                return copy;
              });
            }, 6000);
          }
        } catch (e) {
          console.error("Poller error:", e);
        }
      }, 1500);
    } catch (err: any) {
      console.error("Inline call error:", err);
      toast.error(\`Call failed: \${err.message || "Unknown error"}\`);
      setActiveCalls((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
    }
  }

  async function handleHangupInlineCall(leadId: string) {
    const callState = activeCalls[leadId];
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

    setActiveCalls((prev) => ({
      ...prev,
      [leadId]: { ...prev[leadId], status: "ended" },
    }));

    toast.info("Call disconnected.");
    fetchLeads();

    setTimeout(() => {
      setActiveCalls((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
    }, 4000);
  }`;

code = code.replace(stateTarget, stateAddition);

// 3. Replace TableCell for AI Call with inline 1-click button
const oldCell = `                  {/* AI Call Action Button */}
                  <TableCell className="whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                    {l.phone && l.phone.trim().length > 3 && l.phone !== "—" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCallingLead(l);
                          setIsCallDialogOpen(true);
                        }}
                        className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-semibold bg-violet-600/10 hover:bg-violet-600 hover:text-white text-violet-400 border-violet-500/30 transition-all active:scale-95 shadow-sm"
                      >
                        <PhoneCall className="size-3.5" />
                        <span>Call</span>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs select-none">—</span>
                    )}
                  </TableCell>`;

const newCell = `                  {/* ⚡ 1-Click AI Call Action Button (No Popup Modal) */}
                  <TableCell className="whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                    {l.phone && l.phone.trim().length > 3 && l.phone !== "—" ? (
                      (() => {
                        const call = activeCalls[l.id];
                        if (!call) {
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartInlineCall(l)}
                              className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-semibold bg-violet-600/10 hover:bg-violet-600 hover:text-white text-violet-400 border-violet-500/30 transition-all active:scale-95 shadow-sm"
                              title="Click to start 1-click AI outbound phone call"
                            >
                              <PhoneCall className="size-3.5" />
                              <span>Call</span>
                            </Button>
                          );
                        }

                        if (call.status === "ringing") {
                          return (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-bold bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse pointer-events-none"
                              >
                                <PhoneCall className="size-3.5 animate-bounce" />
                                <span>Ringing...</span>
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleHangupInlineCall(l.id)}
                                className="h-7 w-7 rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                                title="Cancel / Hang up"
                              >
                                <PhoneOff className="size-3.5" />
                              </Button>
                            </div>
                          );
                        }

                        if (call.status === "connected") {
                          return (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-bold bg-emerald-500/15 text-emerald-300 border-emerald-500/40 pointer-events-none shadow-sm shadow-emerald-950/40"
                              >
                                <span className="size-2 rounded-full bg-emerald-400 animate-ping"></span>
                                <span>In Call {formatDuration(call.duration)}</span>
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleHangupInlineCall(l.id)}
                                className="h-7 w-7 rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                                title="Hang up call"
                              >
                                <PhoneOff className="size-3.5" />
                              </Button>
                            </div>
                          );
                        }

                        if (call.status === "ended") {
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartInlineCall(l)}
                              className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-bold bg-slate-500/20 text-slate-300 border-slate-500/30"
                              title="Call completed. Click to call again."
                            >
                              <CheckCircle2 className="size-3.5 text-emerald-400" />
                              <span>Ended ({formatDuration(call.duration)})</span>
                            </Button>
                          );
                        }

                        return null;
                      })()
                    ) : (
                      <span className="text-muted-foreground/40 text-xs select-none">—</span>
                    )}
                  </TableCell>`;

code = code.replace(oldCell, newCell);

fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Successfully integrated 1-Click Power Dialer into _app.leads.tsx!');