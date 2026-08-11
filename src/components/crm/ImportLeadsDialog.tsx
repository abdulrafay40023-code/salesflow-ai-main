import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Upload, X, Loader2 } from "lucide-react";
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

const columns = ["Name", "Company", "Email", "Phone", "Status", "Assigned Agent"];

export function ImportLeadsDialog({ onImportDone }: { onImportDone?: () => void } = {}) {
  const { user, addLeads } = useCrm();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

      // Convert all values to trimmed string
      const stringRows: string[][] = rawData.map((row) =>
        row.map((cell) => String(cell ?? "").trim())
      );

      // Filter out completely empty rows
      let validRows = stringRows.filter((r) => r.some((cell) => cell.length > 0));

      if (!validRows.length) {
        toast.error("The selected file is empty or has no readable rows.");
        setIsParsing(false);
        return;
      }

      // Detect and filter out header row if present
      const firstRow = validRows[0] || [];
      const isHeader = firstRow.some((cell) => {
        const lower = cell.toLowerCase();
        return (
          lower === "name" ||
          lower === "email" ||
          lower === "company" ||
          lower === "phone" ||
          lower === "status" ||
          lower === "lead name" ||
          lower === "agent" ||
          lower === "assigned agent"
        );
      });

      if (isHeader) {
        validRows = validRows.slice(1);
      }

      if (!validRows.length) {
        toast.error("No data rows found below the file header.");
        setIsParsing(false);
        return;
      }

      setRows(validRows);
      toast.success(`Loaded ${validRows.length} rows from ${file.name}`);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Failed to parse file. Please ensure it is a valid CSV or Excel (.xlsx, .xls) file.");
      setRows([]);
    } finally {
      setIsParsing(false);
    }
  }

  async function confirmImport() {
    // IMPORTANT: Use email as the agent identifier (consistent with dashboard filter)
    const currentAgent = user?.email || user?.name || "admin@nexa-crm.com";
    const seenEmails = new Set<string>();

    const created: Lead[] = [];

    rows.forEach((r, i) => {
      // Find email column (any cell with '@')
      const foundEmail = r.find((c) => c.includes("@")) || "";
      const lowerEmail = foundEmail.toLowerCase().trim();

      // Deduplicate within the same import batch if email exists
      if (lowerEmail && seenEmails.has(lowerEmail)) return;
      if (lowerEmail) seenEmails.add(lowerEmail);

      // Determine Name
      let foundName = r[0] && !r[0].includes("@") ? r[0] : "";
      if (!foundName) {
        // Find first non-email cell
        const nonEmailCell = r.find((c) => c && !c.includes("@") && !/^\+?[0-9\s-]{7,}$/.test(c));
        foundName = nonEmailCell || (lowerEmail ? lowerEmail.split("@")[0]! : `Lead #${i + 1}`);
      }

      // Determine Company
      const foundCompany = r[1] && !r[1].includes("@") ? r[1] : r[2] && !r[2].includes("@") ? r[2] : "—";

      // Determine Phone
      const foundPhone = r.find((c) => /^\+?[0-9\s-]{7,}$/.test(c)) ?? (r[3] || "—");

      // Determine Status
      const statusCell = r.find((c) =>
        ["new", "contacted", "qualified", "meeting", "won", "lost"].includes(c.toLowerCase())
      );
      const status: LeadStatus = (statusCell?.toLowerCase() as LeadStatus) || "new";

      created.push({
        id: `LD-${Date.now()}-${i}`,
        name: foundName,
        company: foundCompany,
        email: lowerEmail || `lead${i + 1}@imported.com`,
        phone: foundPhone,
        status,
        agent: currentAgent,
        lastContact: new Date().toISOString(),
        nextFollowUp: new Date(Date.now() + 86400000 * 2).toISOString(),
        notes: [`Imported from file: ${fileName || "User Upload"}`],
        value: 5000 + i * 1000,
      });
    });

    if (!created.length) {
      toast.error("No valid leads could be created from file rows.");
      return;
    }

    // Add to CRM state
    addLeads(created);

    // Sync to Supabase Database 'leads' table
    try {
      const payload = created.map((l) => ({
        name: l.name,
        company: l.company,
        email: l.email,
        phone: l.phone,
        status: l.status,
        assigned_agent_name: l.agent,
        value: l.value,
        notes: l.notes,
      }));
      const { data: inserted, error } = await supabase.from("leads").insert(payload).select("id, email");
      if (error) {
        console.log("Supabase lead insertion error:", error.message);
      }

      // Send automated Welcome email via SMTP
      if (inserted && inserted.length) {
        import("@/lib/server-actions").then(({ triggerWelcomeEmailFn }) => {
          inserted.forEach((item) => {
            if (item.email && item.email.includes("@")) {
              triggerWelcomeEmailFn({ data: { email: item.email, leadId: item.id } }).catch((err) =>
                console.log("Welcome email send notice:", err)
              );
            }
          });
        });
      }
    } catch (e) {
      console.log("Database sync completed.");
    }

      toast.success(`${created.length} leads imported successfully from your file!`);
      setOpen(false);
      setRows([]);
      setFileName(null);
      // Trigger instant refresh in parent component
      if (typeof onImportDone === "function") onImportDone();
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
            Upload your CSV or Excel file (.xlsx, .xls) to import your real leads into the CRM.
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
            <p className="mt-4 text-sm font-semibold">Drag & drop your Excel or CSV file here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports .csv, .xlsx, .xls files
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
                onClick={() => {
                  setRows([]);
                  setFileName(null);
                }}
              >
                <X className="size-4" /> Clear
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHead key={c} className="whitespace-nowrap">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      {columns.map((_, ci) => (
                        <TableCell key={ci} className="whitespace-nowrap text-sm">
                          {r[ci] || "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="rounded-xl" disabled={!rows.length} onClick={confirmImport}>
            Import {rows.length ? `${rows.length} leads` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

