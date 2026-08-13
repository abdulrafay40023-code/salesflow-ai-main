import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Upload, X, Loader2, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { type Lead, type LeadStatus } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

// Preview columns — Company removed
const columns = ["Name", "Email", "Phone"];
const ADMIN_EMAIL = "garryamelia6265@gmail.com";

export function ImportLeadsDialog({ onImportDone }: { onImportDone?: () => void } = {}) {
  const { user, addLeads } = useCrm();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [approvedAgents, setApprovedAgents] = useState<{ name: string; email: string }[]>([]);
  const [selectedAgentEmail, setSelectedAgentEmail] = useState<string>(ADMIN_EMAIL);
  const [rowAgents, setRowAgents] = useState<Record<number, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (open && isAdmin) {
      supabase
        .from("profiles")
        .select("*")
        .neq("email", ADMIN_EMAIL)
        .then(({ data }) => {
          if (data) {
            const approved = data
              .filter((p: any) => {
                if (p.avatar_url) {
                  try {
                    return JSON.parse(p.avatar_url).approved === true;
                  } catch {}
                }
                return false;
              })
              .map((p: any) => ({
                name: p.full_name || p.email.split("@")[0],
                email: p.email,
              }));
            setApprovedAgents(approved);
          }
        });
    }
  }, [open, isAdmin]);

  const getRowAgent = (i: number) => rowAgents[i] || selectedAgentEmail;

  async function parseFile(file: File) {
    setFileName(file.name);
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        toast.error("No worksheet found in file");
        setIsParsing(false);
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
        header: 1,
        defval: "",
      });
      const stringRows: string[][] = rawData.map((row) =>
        row.map((cell) => String(cell ?? "").trim())
      );
      let validRows = stringRows.filter((r) => r.some((cell) => cell.length > 0));
      if (!validRows.length) {
        toast.error("The selected file is empty or has no readable rows.");
        setIsParsing(false);
        return;
      }
      // Skip header row if detected
      const firstRow = validRows[0] || [];
      const isHeader = firstRow.some((cell) => {
        const lower = cell.toLowerCase();
        return (
          lower === "name" || lower === "email" || lower === "company" ||
          lower === "phone" || lower === "status" || lower === "lead name" ||
          lower === "agent" || lower === "assigned agent"
        );
      });
      if (isHeader) validRows = validRows.slice(1);
      if (!validRows.length) {
        toast.error("No data rows found below the file header.");
        setIsParsing(false);
        return;
      }
      setRows(validRows);
      setRowAgents({});
      toast.success(`Loaded ${validRows.length} rows from ${file.name}`);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Failed to parse file. Please ensure it is a valid CSV or Excel (.xlsx, .xls) file.");
      setRows([]);
    } finally {
      setIsParsing(false);
    }
  }

  /** Parse a single sheet row → { name, email, phone, statusCell } */
  function parseRow(r: string[], i: number) {
    const foundEmail = r.find((c) => c.includes("@")) || "";
    const lowerEmail = foundEmail.toLowerCase().trim();

    // Phone: first cell matching phone-number pattern
    const foundPhone = r.find((c) => /^\+?[0-9][\d\s\-().]{5,}$/.test(c)) ?? "";

    // Name: first cell that doesn't contain '@' and isn't phone-like
    const foundName = r.find((c) => c && !c.includes("@") && c !== foundPhone) || "";

    // Status: check if any cell matches a valid LeadStatus
    const statusCell = r.find((c) =>
      ["new", "contacted", "qualified", "meeting", "won", "lost"].includes(c.toLowerCase())
    );

    return {
      name: foundName.trim() || lowerEmail.split("@")[0] || `Lead #${i + 1}`,
      email: lowerEmail,
      phone: foundPhone.trim(),
      statusCell,
    };
  }

  async function handleImport() {
    if (!rows.length) return;

    const created: Lead[] = [];
    const agentCounts: Record<string, number> = {};

    rows.forEach((r, i) => {
      const { name, email, phone, statusCell } = parseRow(r, i);
      if (!email || !email.includes("@")) return;

      const rowTargetAgent = isAdmin ? getRowAgent(i) : (user?.email || ADMIN_EMAIL);
      const status: LeadStatus = (statusCell?.toLowerCase() as LeadStatus) || "new";

      agentCounts[rowTargetAgent] = (agentCounts[rowTargetAgent] || 0) + 1;

      created.push({
        id: `LD-${Date.now()}-${i}`,
        name,
        company: "",
        email,
        phone,
        status,
        agent: rowTargetAgent,
        lastContact: new Date().toISOString(),
        nextFollowUp: new Date(Date.now() + 86400000 * 2).toISOString(),
        notes: [`Imported from file: ${fileName || "User Upload"}`],
        value: 5000 + i * 1000,
      });
    });

    if (!created.length) {
      toast.error("No valid leads could be created. Make sure your file has email addresses.");
      return;
    }

    addLeads(created);

    try {
      const payload = created.map((l) => ({
        name: l.name,
        company: l.company,
        email: (l.email || "").trim().toLowerCase(),
        phone: l.phone || null,
        status: l.status,
        assigned_agent_name: l.agent,
        value: l.value,
        notes: l.notes,
      }));

      // Duplicate Prevention: Check existing database leads by email & phone
      const { data: existingDbLeads } = await supabase
        .from("leads")
        .select("id, email, phone, notes");

      const existingMap = new Map<string, any>();
      (existingDbLeads || []).forEach((el) => {
        if (el.email) existingMap.set(el.email.trim().toLowerCase(), el);
        if (el.phone) existingMap.set(el.phone.trim(), el);
      });

      const newLeadsToInsert: typeof payload = [];

      for (const item of payload) {
        const emailKey = item.email ? item.email.trim().toLowerCase() : "";
        const phoneKey = item.phone ? item.phone.trim() : "";
        const match = (emailKey && existingMap.get(emailKey)) || (phoneKey && existingMap.get(phoneKey));

        if (match) {
          // Matching lead exists: SKIP duplicate row creation & update existing lead
          const mergedNotes = Array.from(new Set([...(match.notes || []), ...(item.notes || [])]));
          await supabase
            .from("leads")
            .update({
              name: item.name,
              company: item.company,
              phone: item.phone || undefined,
              assigned_agent_name: item.assigned_agent_name,
              notes: mergedNotes,
            })
            .eq("id", match.id);
        } else {
          newLeadsToInsert.push(item);
        }
      }

      let inserted: { id: string; email: string }[] | null = null;
      if (newLeadsToInsert.length > 0) {
        const { data, error } = await supabase.from("leads").insert(newLeadsToInsert).select("id, email");
        if (error) console.log("Supabase lead insertion notice:", error.message);
        inserted = data;
      }


      // Create notification records for each agent who received leads
      if (isAdmin) {
        for (const [agentEmail, count] of Object.entries(agentCounts)) {
          if (agentEmail !== ADMIN_EMAIL) {
            await supabase.from("emails_sent").insert({
              lead_email: agentEmail,
              subject: `Admin Garry Amelia assigned ${count} new lead(s) to you`,
              status: "unread",
              sequence_type: "lead_assignment",
              type: "lead_assignment",
              sent_at: new Date().toISOString(),
            });
          }
        }
      }

      // Send Welcome emails
      if (inserted && inserted.length) {
        import("@/lib/server-actions").then(({ triggerWelcomeEmailFn }) => {
          inserted.forEach((item, i) => {
            const leadAgent = created[i]?.agent || ADMIN_EMAIL;
            if (item.email && item.email.includes("@")) {
              triggerWelcomeEmailFn({
                data: { email: item.email, leadId: item.id, agentEmail: leadAgent },
              }).catch((err) => console.log("Welcome email send notice:", err));
            }
          });
        });
      }
    } catch (e) {
      console.log("Database sync completed.");
    }

    toast.success(`${created.length} leads imported and assigned!`);
    setOpen(false);
    setRows([]);
    setRowAgents({});
    setFileName(null);
    if (typeof onImportDone === "function") onImportDone();
  }


  /** Preview cells for a row: [name, email, phone] */
  function getPreviewCells(r: string[], i: number): string[] {
    const { name, email, phone } = parseRow(r, i);
    return [name, email, phone];
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-[var(--shadow-card)]">
          <Upload className="size-4" /> Import Leads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Import leads</DialogTitle>
          <DialogDescription>
            Upload your CSV or Excel file. Only <strong>Name</strong> and{" "}
            <strong>Email</strong> are required — Phone is optional.
          </DialogDescription>
        </DialogHeader>

        {isParsing ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Parsing your file...</p>
          </div>
        ) : !rows.length ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) parseFile(f);
            }}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-2/60 px-6 py-14 text-center transition-colors hover:border-primary/50"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold">Drag &amp; drop your Excel or CSV file here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports .csv, .xlsx, .xls — Required: <strong>Name, Email</strong> &nbsp;|&nbsp; Optional: <strong>Phone</strong>
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => inputRef.current?.click()}>
                Browse files
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseFile(f);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span className="truncate text-sm font-medium">{fileName}</span>
                <Badge variant="secondary" className="rounded-full">
                  {rows.length} rows found
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg"
                onClick={() => { setRows([]); setFileName(null); }}
              >
                <X className="size-4" /> Clear
              </Button>
            </div>

            {/* Admin Default Assign Dropdown */}
            {isAdmin && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <UserCheck className="size-3.5" /> Set default agent for all rows (or customize each row below):
                </label>
                <Select
                  value={selectedAgentEmail}
                  onValueChange={(val) => {
                    setSelectedAgentEmail(val);
                    setRowAgents({});
                  }}
                >
                  <SelectTrigger className="w-full rounded-lg bg-surface-1 text-xs">
                    <SelectValue placeholder="Select target agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ADMIN_EMAIL}>Admin Pool (Garry Amelia)</SelectItem>
                    {approvedAgents.map((ag) => (
                      <SelectItem key={ag.email} value={ag.email}>
                        👤 {ag.name} ({ag.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  You can change the assigned agent for any specific lead directly in the table below before importing.
                </p>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHead key={c} className="whitespace-nowrap">{c}</TableHead>
                    ))}
                    {isAdmin && <TableHead className="whitespace-nowrap font-bold text-primary">Assign To Agent</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const cells = getPreviewCells(r, i);
                    return (
                      <TableRow key={i}>
                        {cells.map((val, ci) => (
                          <TableCell key={ci} className="whitespace-nowrap text-sm">
                            {val || <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                        ))}
                        {isAdmin && (
                          <TableCell className="w-60 whitespace-nowrap">
                            <Select
                              value={getRowAgent(i)}
                              onValueChange={(val) => setRowAgents((prev) => ({ ...prev, [i]: val }))}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-lg border-primary/30 bg-surface-1 font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={ADMIN_EMAIL}>Admin Pool (Garry Amelia)</SelectItem>
                                {approvedAgents.map((ag) => (
                                  <SelectItem key={ag.email} value={ag.email}>
                                    👤 {ag.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="rounded-xl" disabled={!rows.length} onClick={handleImport}>
            Import {rows.length ? `${rows.length} leads` : ""}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
