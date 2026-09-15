const fs = require('fs');

const leadsPath = 'src/routes/_app.leads.tsx';
let code = fs.readFileSync(leadsPath, 'utf8');

// 1. Add imports
code = code.replace(
  /import \{ isAdminEmail, ADMIN_EMAILS, ALL_STATUSES, statusLabels, type Lead, type LeadStatus \} from "@/lib/crm-data";/,
  `import { isAdminEmail, ADMIN_EMAILS, ALL_STATUSES, statusLabels, type Lead, type LeadStatus } from "@/lib/crm-data";
import { detectCountryFromPhone, formatPhoneWithCountryCode } from "@/lib/country-helper";
import { AllCallRecordingsDialog } from "@/components/crm/AllCallRecordingsDialog";
import { Globe, MapPin, Headphones } from "lucide-react";`
);

// 2. Add isRecordingsDialogOpen state
code = code.replace(
  /const \[isCallDialogOpen, setIsCallDialogOpen\] = useState\(false\);/,
  `const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [isRecordingsDialogOpen, setIsRecordingsDialogOpen] = useState(false);`
);

// 3. Add All Call Recordings button in Header
code = code.replace(
  /<ImportLeadsDialog onImportDone=\{fetchLeads\} \/>/,
  `<Button
                onClick={() => setIsRecordingsDialogOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 bg-violet-600/10 text-violet-300 border-violet-500/30 hover:bg-violet-600/20 hover:text-white"
              >
                <Headphones className="h-3.5 w-3.5" />
                All Call Recordings
              </Button>
              <ImportLeadsDialog onImportDone={fetchLeads} />`
);

// 4. Update DbLead type with ip_address & location
code = code.replace(
  /won_at\?: string;\s*\};/,
  `won_at?: string;
  country?: string;
  ip_address?: string;
  location?: string;
};`
);

// 5. Update fetchLeads mapping
code = code.replace(
  /const leadDate = l\.source_date \|\| l\.last_contact \|\| l\.created_at \|\| new Date\(\)\.toISOString\(\);/,
  `const leadDate = l.source_date || l.last_contact || l.created_at || new Date().toISOString();
          const countryInfo = detectCountryFromPhone(l.phone);
          const formattedPhone = l.phone && l.phone !== "—" ? formatPhoneWithCountryCode(l.phone) : (l.phone || "—");`
);

code = code.replace(
  /phone: l\.phone \|\| "—",/,
  `phone: formattedPhone,
            country: l.country || countryInfo.name,
            country_code: countryInfo.code,
            country_flag: countryInfo.flag,
            ip_address: l.ip_address || undefined,
            location: l.location || undefined,`
);

// 6. Update Table Headers to include Country and IP / Location
const oldHeader = `                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">Company</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
                <TableHead className="whitespace-nowrap">Phone</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>`;

const newHeader = `                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">Company</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
                <TableHead className="whitespace-nowrap">Phone</TableHead>
                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Globe className="size-3.5 text-muted-foreground" />
                    <span>Country</span>
                  </div>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span>IP / Location</span>
                  </div>
                </TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>`;

code = code.replace(oldHeader, newHeader);

// 7. Update Table Rows to render Country and IP / Location cells
const oldRowCells = `                  <TableCell className="whitespace-nowrap font-medium">{l.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.company}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{l.email}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{l.phone}</TableCell>

                  {/* Status Dropdown (Always editable with all 5 statuses) */}`;

const newRowCells = `                  <TableCell className="whitespace-nowrap font-medium">{l.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.company}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground font-mono text-xs">{l.email}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground font-mono text-xs">{l.phone}</TableCell>

                  {/* Country Flag & Name */}
                  <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{l.country_flag || "🌐"}</span>
                      <span className="text-xs font-semibold text-foreground/90">{l.country || "International"}</span>
                    </div>
                  </TableCell>

                  {/* IP Address & Real-time Location */}
                  <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        Pending email open
                      </div>
                    )}
                  </TableCell>

                  {/* Status Dropdown (Always editable with all 5 statuses) */}`;

code = code.replace(oldRowCells, newRowCells);

// 8. Add AllCallRecordingsDialog to the footer
code = code.replace(
  /<AiCallDialog\s*open=\{isCallDialogOpen\}[\s\S]*?\/>\s*<\/div>/,
  `<AiCallDialog
        open={isCallDialogOpen}
        onOpenChange={setIsCallDialogOpen}
        lead={callingLead}
        onCallComplete={() => fetchLeads()}
      />

      <AllCallRecordingsDialog
        open={isRecordingsDialogOpen}
        onOpenChange={setIsRecordingsDialogOpen}
      />
    </div>`
);

fs.writeFileSync(leadsPath, code, 'utf8');
console.log('src/routes/_app.leads.tsx updated with Country, IP/Location, and All Call Recordings modal!');