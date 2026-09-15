const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

// 1. Add CallRecord type and callHistoryMap state
const oldStateAnchor = `  // ⚡ 1-Click Power Dialer State (LeadId -> CallState)
  const [activeCalls, setActiveCalls] = useState<
    Record<string, { callId: string; status: "dialing" | "ringing" | "connected" | "ended"; duration: number }>
  >({});`;

const newStateAnchor = `  // ⚡ 1-Click Power Dialer State & History (LeadId -> CallState & History list)
  type CallHistoryItem = { callId: string; duration: number; timestamp: number };
  const [activeCalls, setActiveCalls] = useState<
    Record<string, { callId: string; status: "dialing" | "ringing" | "connected" | "ended"; duration: number }>
  >({});
  const [callHistoryMap, setCallHistoryMap] = useState<Record<string, CallHistoryItem[]>>({});`;

code = code.replace(oldStateAnchor, newStateAnchor);

// 2. In poller call completion, append to callHistoryMap
const oldPollerEndAnchor = `            const finalDuration = statusRes.duration ? Math.round(statusRes.duration) : 0;

            setActiveCalls((prev) => ({
              ...prev,
              [leadId]: {
                callId,
                status: "ended",
                duration: finalDuration || prev[leadId]?.duration || 0,
              },
            }));`;

const newPollerEndAnchor = `            const finalDuration = (statusRes.duration ? Math.round(statusRes.duration) : 0) || prevDuration;

            // Save to call history stack (Ended badges stack underneath each other)
            setCallHistoryMap((prev) => ({
              ...prev,
              [leadId]: [
                ...(prev[leadId] || []),
                { callId, duration: finalDuration, timestamp: Date.now() },
              ],
            }));

            setActiveCalls((prev) => ({
              ...prev,
              [leadId]: {
                callId,
                status: "ended",
                duration: finalDuration,
              },
            }));`;

// Note: Ensure prevDuration is available
const oldPollerStart = `          if (statusRes.status === "ended" || statusRes.endedReason || pollCount > 240) {
            clearInterval(activePollersRef.current[leadId]);
            delete activePollersRef.current[leadId];

            clearInterval(activeTimersRef.current[leadId]);
            delete activeTimersRef.current[leadId];`;

const newPollerStart = `          if (statusRes.status === "ended" || statusRes.endedReason || pollCount > 240) {
            clearInterval(activePollersRef.current[leadId]);
            delete activePollersRef.current[leadId];

            clearInterval(activeTimersRef.current[leadId]);
            delete activeTimersRef.current[leadId];

            const prevDuration = activeCalls[leadId]?.duration || 0;`;

code = code.replace(oldPollerStart, newPollerStart);
code = code.replace(oldPollerEndAnchor, newPollerEndAnchor);

// 3. In manual hangup, also record history
const oldHangupAnchor = `    setActiveCalls((prev) => ({
      ...prev,
      [leadId]: { ...prev[leadId], status: "ended" },
    }));`;

const newHangupAnchor = `    const finalDur = callState.duration || 0;
    setCallHistoryMap((prev) => ({
      ...prev,
      [leadId]: [
        ...(prev[leadId] || []),
        { callId: callState.callId, duration: finalDur, timestamp: Date.now() },
      ],
    }));

    setActiveCalls((prev) => ({
      ...prev,
      [leadId]: { ...prev[leadId], status: "ended" },
    }));`;

code = code.replace(oldHangupAnchor, newHangupAnchor);

// 4. Update the TableCell rendering with Redial button and stacked Ended (X:XX) badges
const oldCellTarget = `                  {/* ⚡ 1-Click AI Call Action Button (No Popup Modal) */}
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

const newCellTarget = `                  {/* ⚡ 1-Click AI Call Action Button & Stacked Call History */}
                  <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {l.phone && l.phone.trim().length > 3 && l.phone !== "—" ? (
                      <div className="flex items-center gap-2">
                        {/* Call Action Button */}
                        {(() => {
                          const call = activeCalls[l.id];
                          if (!call || call.status === "ended") {
                            const hasHistory = (callHistoryMap[l.id] || []).length > 0;
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartInlineCall(l)}
                                className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-semibold bg-violet-600/10 hover:bg-violet-600 hover:text-white text-violet-400 border-violet-500/30 transition-all active:scale-95 shadow-sm shrink-0"
                                title={hasHistory ? "Click to redial this lead" : "Click to start 1-click AI outbound call"}
                              >
                                <PhoneCall className="size-3.5" />
                                <span>{hasHistory ? "Redial" : "Call"}</span>
                              </Button>
                            );
                          }

                          if (call.status === "ringing") {
                            return (
                              <div className="flex items-center gap-1 shrink-0">
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
                              <div className="flex items-center gap-1 shrink-0">
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

                          return null;
                        })()}

                        {/* Stack of Previous Call History Badges */}
                        {(callHistoryMap[l.id] || []).length > 0 && (
                          <div className="flex flex-col gap-1">
                            {(callHistoryMap[l.id] || []).map((h, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-800/80 text-slate-300 border border-slate-700/60 shadow-xs"
                                title={\`Call #\${idx + 1} duration\`}
                              >
                                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                                <span>Ended ({formatDuration(h.duration)})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs select-none">—</span>
                    )}
                  </TableCell>`;

code = code.replace(oldCellTarget, newCellTarget);
fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Successfully updated _app.leads.tsx with call history badges and Redial button!');