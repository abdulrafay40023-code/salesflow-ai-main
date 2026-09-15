const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

const targetOld = `                        {/* Stack of Previous Call History Badges */}
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
                        )}`;

const targetNew = `                        {/* Stack of Previous Call History Badges */}
                        {(callHistoryMap[l.id] || []).length > 0 && (
                          <div className="flex flex-col gap-1">
                            {(callHistoryMap[l.id] || []).map((h, idx) => (
                              <div
                                key={idx}
                                className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border shadow-xs \${
                                  h.status === "no_answer" || h.duration === 0
                                    ? "bg-amber-950/40 text-amber-300 border-amber-500/30"
                                    : "bg-slate-800/80 text-slate-300 border-slate-700/60"
                                }\`}
                                title={\`Call #\${idx + 1} status\`}
                              >
                                {h.status === "no_answer" || h.duration === 0 ? (
                                  <>
                                    <PhoneOff className="size-3 text-amber-400 shrink-0" />
                                    <span>No Answer</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                                    <span>Ended ({formatDuration(h.duration)})</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}`;

code = code.replace(targetOld, targetNew);
fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Updated badge rendering in _app.leads.tsx!');