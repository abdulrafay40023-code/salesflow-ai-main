const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

// 1. Table Header: "IP Address" instead of "IP / Location"
code = code.replace(
  `                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span>IP / Location</span>
                  </div>
                </TableHead>`,
  `                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span>IP Address</span>
                  </div>
                </TableHead>`
);

// 2. Table Cell: Remove location subtext from under IP
const oldCellTarget = `                  {/* IP & Location Tracking */}
                  <TableCell className="whitespace-nowrap">
                    {l.ip_address ? (
                      <div className="space-y-0.5">
                        <div className="font-mono text-[11px] font-bold text-foreground flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          {l.ip_address}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium">{l.location || "Online"}</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 italic">
                        <span className="size-1.5 rounded-full bg-slate-500/50"></span>
                        Pending open
                      </div>
                    )}
                  </TableCell>`;

const newCellTarget = `                  {/* IP Address Only */}
                  <TableCell className="whitespace-nowrap">
                    {l.ip_address ? (
                      <div className="font-mono text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-400"></span>
                        {l.ip_address}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 italic">
                        <span className="size-1.5 rounded-full bg-slate-500/50"></span>
                        Pending open
                      </div>
                    )}
                  </TableCell>`;

code = code.replace(oldCellTarget, newCellTarget);

fs.writeFileSync(leadsPath, code, 'utf8');
console.log('Updated _app.leads.tsx: Clean IP Address column without location subtext!');