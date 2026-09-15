import { detectCountryFromPhone, formatPhoneWithCountryCode, parseCountryString, SUPPORTED_COUNTRIES } from "@/lib/country-helper";
import { CountryCombobox } from "@/components/crm/CountryCombobox";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Upload, X, Loader2, UserCheck, ShieldAlert, Sparkles, Shuffle, Users, Globe } from "lucide-react";
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
import { ADMIN_EMAILS, isAdminEmail, type Lead, type LeadStatus } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

// Preview columns — Company removed
const columns = ["Name", "Email", "Phone"];
const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";

export function ImportLeadsDialog({ onImportDone }: { onImportDone?: () => void } = {}) {
  const { user, addLeads } = useCrm();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [approvedAgents, setApprovedAgents] = useState<{ name: string; email: string }[]>([]);
  const [selectedAgentEmail, setSelectedAgentEmail] = useState<string>(PRIMARY_ADMIN_EMAIL);
  const [rowAgents, setRowAgents] = useState<Record<number, string>>({});
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const [bulkTargetAgent, setBulkTargetAgent] = useState<string>(PRIMARY_ADMIN_EMAIL);
  const [customBatchInput, setCustomBatchInput] = useState<string>("");
  const [defaultPhoneCountry, setDefaultPhoneCountry] = useState<string>("AUTO");
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply target agent to all selected checkbox rows
  function handleApplyBulkAgentToSelected() {
    if (!selectedRowIndexes.length) return;
    setRowAgents((prev) => {
      const next = { ...prev };
      selectedRowIndexes.forEach((idx) => {
        next[idx] = bulkTargetAgent;
      });
      return next;
    });
    const agentName = approvedAgents.find((a) => a.email === bulkTargetAgent)?.name || bulkTargetAgent;
    toast.success(`Assigned ${selectedRowIndexes.length} selected row(s) to ${agentName}!`);
    setSelectedRowIndexes([]);
  }

  // ⚡ Auto-Distribute leads evenly across all approved Working Agents (Round-Robin or Equal Chunks)
  function handleAutoDistribute(mode: "round-robin" | "chunks" = "chunks") {
    if (!approvedAgents.length) {
      toast.error("No approved Working Agents found to distribute leads to.");
      return;
    }
    if (!rows.length) return;

    const nextRowAgents: Record<number, string> = {};
    const agentCount = approvedAgents.length;
    const chunkSize = Math.ceil(rows.length / agentCount);

    rows.forEach((_, index) => {
      let targetAgent = PRIMARY_ADMIN_EMAIL;
      if (mode === "round-robin") {
        const ag = approvedAgents[index % agentCount];
        if (ag?.email) targetAgent = ag.email;
      } else {
        const agentIndex = Math.min(Math.floor(index / chunkSize), agentCount - 1);
        const ag = approvedAgents[agentIndex];
        if (ag?.email) targetAgent = ag.email;
      }
      nextRowAgents[index] = targetAgent;
    });

    setRowAgents(nextRowAgents);
    setSelectedRowIndexes([]);
    toast.success(
      `⚡ ${rows.length} leads split across ${agentCount} agent(s) (~${chunkSize} leads each)!`
    );
  }

  // Helper to check if a row is already assigned to a Working Agent (not Admin Pool)
  function isRowAssignedToWorkingAgent(i: number): boolean {
    const currentAg = rowAgents[i];
    return Boolean(currentAg && !isAdminEmail(currentAg) && currentAg !== PRIMARY_ADMIN_EMAIL);
  }

  // Quick Select Next X Rows (Selects next UNASSIGNED leads first, additive accumulation)
  function handleSelectBatch(count: number) {
    if (!rows.length || count <= 0) return;

    const currentSelectedSet = new Set(selectedRowIndexes);

    // 1. Find unselected rows that are NOT yet assigned to a working agent
    const unassignedUnselectedIndices: number[] = [];
    // 2. Fallback: unselected rows even if previously assigned
    const otherUnselectedIndices: number[] = [];

    rows.forEach((_, i) => {
      if (!currentSelectedSet.has(i)) {
        if (!isRowAssignedToWorkingAgent(i)) {
          unassignedUnselectedIndices.push(i);
        } else {
          otherUnselectedIndices.push(i);
        }
      }
    });

    const candidatePool =
      unassignedUnselectedIndices.length > 0
        ? unassignedUnselectedIndices
        : otherUnselectedIndices;

    if (!candidatePool.length) {
      toast.info("All leads in this file are already assigned to working agents!");
      return;
    }

    const toAdd = candidatePool.slice(0, count);
    const newSelected = [...selectedRowIndexes, ...toAdd];
    setSelectedRowIndexes(newSelected);

    toast.success(
      `+${toAdd.length} unassigned lead(s) selected! (Total: ${newSelected.length} / ${rows.length} selected)`
    );
  }

  // Add custom quantity of leads to selection (e.g. 200, 250, 450)
  function handleAddCustomBatch() {
    const parsed = parseInt(customBatchInput.trim(), 10);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid positive number of leads.");
      return;
    }
    handleSelectBatch(parsed);
    setCustomBatchInput("");
  }

  // Live breakdown of how many leads each agent is receiving
  const agentDistributionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((_, i) => {
      const ag = rowAgents[i] || selectedAgentEmail;
      counts[ag] = (counts[ag] || 0) + 1;
    });
    return counts;
  }, [rows, rowAgents, selectedAgentEmail]);

  // System staff lists to prevent importing ANY admin or working agent as a lead
  const [allStaffEmails, setAllStaffEmails] = useState<Map<string, "Admin" | "Working Agent">>(new Map());
  const [allStaffPhones, setAllStaffPhones] = useState<Map<string, "Admin" | "Working Agent">>(new Map());

  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  useEffect(() => {
    if (!open) return;

    // Fetch all staff (admins and working agents) from profiles
    supabase
      .from("profiles")
      .select("*")
      .then(({ data }) => {
        const emailMap = new Map<string, "Admin" | "Working Agent">();
        const phoneMap = new Map<string, "Admin" | "Working Agent">();

        // Register hardcoded admins
        ADMIN_EMAILS.forEach((adm) => {
          emailMap.set(adm.toLowerCase().trim(), "Admin");
        });

        if (data) {
          const approved: { name: string; email: string }[] = [];

          data.forEach((p: any) => {
            const em = (p.email || "").toLowerCase().trim();
            let phone = "";
            let isApproved = false;

            if (p.avatar_url) {
              try {
                const parsed = JSON.parse(p.avatar_url);
                phone = (parsed.phone || "").trim();
                isApproved = Boolean(parsed.approved);
              } catch {}
            }

            const role: "Admin" | "Working Agent" = isAdminEmail(em) || p.role === "admin" ? "Admin" : "Working Agent";
            if (em) emailMap.set(em, role);
            if (phone) phoneMap.set(phone, role);

            if (isApproved && !isAdminEmail(em)) {
              approved.push({
                name: p.full_name || em.split("@")[0],
                email: p.email,
              });
            }
          });

          setApprovedAgents(approved);
        }

        // Also add currently logged in user
        if (user?.email) {
          const myRole = isAdmin ? "Admin" : "Working Agent";
          emailMap.set(user.email.toLowerCase().trim(), myRole);
          if (user.phone) phoneMap.set(user.phone.trim(), myRole);
        }

        setAllStaffEmails(emailMap);
        setAllStaffPhones(phoneMap);
      });
  }, [open, isAdmin, user?.email, user?.phone]);

  const getRowAgent = (i: number) => rowAgents[i] || selectedAgentEmail;

  // Helper to check if an email or phone belongs to an Admin or Working Agent
  function checkStaffMatch(email: string, phone?: string): { isStaff: boolean; role?: "Admin" | "Working Agent"; label?: string } {
    const cleanEm = (email || "").toLowerCase().trim();
    const cleanPh = (phone || "").trim();

    if (cleanEm && allStaffEmails.has(cleanEm)) {
      const r = allStaffEmails.get(cleanEm)!;
      return { isStaff: true, role: r, label: `${cleanEm} (${r})` };
    }
    if (cleanEm && isAdminEmail(cleanEm)) {
      return { isStaff: true, role: "Admin", label: `${cleanEm} (Admin)` };
    }
    if (cleanPh && allStaffPhones.has(cleanPh)) {
      const r = allStaffPhones.get(cleanPh)!;
      return { isStaff: true, role: r, label: `Phone ${cleanPh} (${r})` };
    }
    return { isStaff: false };
  }

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
      if (!worksheet) {
        toast.error("Worksheet is invalid or empty");
        setIsParsing(false);
        return;
      }
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
          lower === "agent" || lower === "assigned agent" || lower === "date"
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
      setSelectedRowIndexes([]);
      toast.success(`Loaded ${validRows.length} rows from ${file.name}`);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Failed to parse file. Please ensure it is a valid CSV or Excel (.xlsx, .xls) file.");
      setRows([]);
      setSelectedRowIndexes([]);
    } finally {
      setIsParsing(false);
    }
  }

  /** Detect a date value from a cell string — returns ISO date string or null */
  function detectDate(cell: string): string | null {
    if (!cell || !cell.trim()) return null;
    const s = cell.trim();
    // Excel numeric serial date (e.g. 45000)
    if (/^\d{4,5}$/.test(s)) {
      const serial = parseInt(s, 10);
      if (serial > 30000 && serial < 60000) {
        const date = new Date((serial - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) return date.toISOString();
      }
      return null;
    }
    // Common date formats: 2026-08-18, 08/18/2026, 18-08-2026, Aug 18 2026, etc.
    const datePatterns = [
      /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY-MM-DD
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, // MM/DD/YYYY or DD-MM-YYYY
      /^[A-Za-z]{3}\s+\d{1,2}[,\s]+\d{4}/,    // Aug 18, 2026
    ];
    if (datePatterns.some((p) => p.test(s))) {
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return null;
  }

  /** Parse a single sheet row → { name, email, phone, statusCell, sourceDate } */
  function parseRow(r: string[], i: number) {
    const foundEmail = r.find((c) => c.includes("@")) || "";
    const lowerEmail = foundEmail.toLowerCase().trim();

    // Phone: first cell matching phone-number pattern
    const foundPhone = r.find((c) => /^\+?[0-9][\d\s\-().]{5,}$/.test(c)) ?? "";

    // Name: first cell that doesn't contain '@' and isn't phone-like and isn't a date
    const foundName = r.find((c) => c && !c.includes("@") && c !== foundPhone && !detectDate(c)) || "";

    // Status: check if any cell matches a valid LeadStatus
    const statusCell = r.find((c) =>
      ["new", "no_answer", "contacted", "booked", "won"].includes(c.toLowerCase().replace(/ /g, "_"))
    );

    // Source date: first cell that looks like a date
    let sourceDate: string | null = null;
    for (const cell of r) {
      if (cell === foundEmail || cell === foundPhone || cell === foundName) continue;
      const d = detectDate(cell);
      if (d) { sourceDate = d; break; }
    }

    // Country: check if any cell matches a country name or alias
    let rowCountryInfo: ReturnType<typeof parseCountryString> = null;
    for (const cell of r) {
      if (cell === foundEmail || cell === foundPhone || cell === foundName) continue;
      const parsedC = parseCountryString(cell);
      if (parsedC) {
        rowCountryInfo = parsedC;
        break;
      }
    }

    return {
      name: foundName.trim() || (lowerEmail ? lowerEmail.split("@")[0] : "") || (foundPhone.trim() ? `Lead ${foundPhone.trim()}` : `Lead #${i + 1}`),
      email: lowerEmail,
      phone: foundPhone.trim(),
      statusCell,
      sourceDate,
      rowCountryInfo,
    };
  }

  async function handleImport() {
    if (!rows.length) return;

    const created: Lead[] = [];
    const agentCounts: Record<string, number> = {};
    const blockedStaffDetails: string[] = [];
    const seenFileEmails = new Set<string>();
    const seenFilePhones = new Set<string>();
    let duplicateFileSkippedCount = 0;

    const importStartTime = Date.now();

    rows.forEach((r, i) => {
      const { name, email, phone, statusCell, sourceDate, rowCountryInfo } = parseRow(r, i);
      const cleanEmail = (email || "").trim().toLowerCase();
      const cleanPhone = (phone || "").trim();
      const cleanName = (name || "").trim();

      // Prioritize: 1. Row-level Country column -> 2. Modal Default Dropdown -> 3. Auto-detect
      const effectiveCountryCode = rowCountryInfo 
        ? rowCountryInfo.code 
        : (defaultPhoneCountry !== "AUTO" ? defaultPhoneCountry : undefined);
      // Row 0 has newest time, row 1 has 1s older, etc. So Row 0 (top of sheet) is ALWAYS on top of the CRM table!
      const sequentialDate = sourceDate || new Date(importStartTime - i * 1000).toISOString();

      // Lead is valid if it has at least one of Name, Phone, or Email!
      if (!cleanEmail && !cleanPhone && !cleanName) return;

      // ── INTRA-FILE DUPLICATE PREVENTION ──────────────────────────────
      // If same email or same phone appears multiple times, import only ONCE
      if (cleanEmail && seenFileEmails.has(cleanEmail)) {
        duplicateFileSkippedCount++;
        return;
      }
      if (cleanPhone && seenFilePhones.has(cleanPhone)) {
        duplicateFileSkippedCount++;
        return;
      }
      if (cleanEmail) seenFileEmails.add(cleanEmail);
      if (cleanPhone) seenFilePhones.add(cleanPhone);
      // ─────────────────────────────────────────────────────────────────

      // ── STRICT ADMIN & WORKING AGENT PREVENTION ──────────────────────
      // Block ANY email or phone that belongs to an Admin or Working Agent!
      const staffCheck = checkStaffMatch(cleanEmail, cleanPhone);
      if (staffCheck.isStaff) {
        blockedStaffDetails.push(staffCheck.label || `${cleanEmail} (${staffCheck.role})`);
        return; // strictly skip this row!
      }
      // ─────────────────────────────────────────────────────────────────

      const rowTargetAgent = isAdmin ? getRowAgent(i) : (user?.email || PRIMARY_ADMIN_EMAIL);
      const rawStatus = statusCell?.toLowerCase().replace(/ /g, "_") || "new";
      const status: LeadStatus = rawStatus as LeadStatus;

      agentCounts[rowTargetAgent] = (agentCounts[rowTargetAgent] || 0) + 1;

      created.push({
        id: `LD-${Date.now()}-${i}`,
        name,
        company: "",
        email: cleanEmail,
        phone: cleanPhone 
          ? formatPhoneWithCountryCode(cleanPhone, effectiveCountryCode) 
          : "",
        status,
        agent: rowTargetAgent,
        lastContact: sequentialDate,
        nextFollowUp: new Date(Date.now() + 86400000 * 2).toISOString(),
        notes: [`Imported from file: ${fileName || "User Upload"}`],
        value: 5000 + i * 1000,
        source_date: sequentialDate,
      });
    });

    // Notify user if duplicate rows were deduplicated
    if (duplicateFileSkippedCount > 0) {
      toast.info(`ℹ️ ${duplicateFileSkippedCount} duplicate row(s) in spreadsheet were automatically skipped (imported only once).`, {
        duration: 7000,
      });
    }

    // Notify user with clear error if any admin/agent emails were blocked
    if (blockedStaffDetails.length > 0) {
      toast.error(
        `🚫 ${blockedStaffDetails.length} row(s) blocked: ${blockedStaffDetails.join(", ")} belong to an Admin or Working Agent and CANNOT be imported as a lead!`,
        { duration: 10000 }
      );
    }

    if (!created.length) {
      if (blockedStaffDetails.length > 0) {
        toast.error("Import failed: All provided email(s) belong to Admin or Working Agents.");
      } else {
        toast.error("No valid leads could be created from the file. Make sure your file has names, phone numbers, or emails.");
      }
      setOpen(false);
      setRows([]);
      setRowAgents({});
      setFileName(null);
      return;
    }

    addLeads(created);

    try {
      const nowIso = new Date().toISOString();
      const payload = created.map((l) => {
        // Reporting fields — strict separation between agent-imported and admin-assigned:
        // - Working Agent importing for themselves → imported_by = agent email, no assigned_at
        // - Admin importing and assigning to a Working Agent → assigned_at = now(), no imported_by
        // - Admin importing to admin pool → neither field set
        const isAgentImportingForSelf = !isAdmin;
        const isAdminAssigningToAgent = isAdmin && !isAdminEmail(l.agent);
        const leadStatus = (l.status || "new").toLowerCase();

        let contactedAt: string | null = null;
        let bookedAt: string | null = null;
        let wonAt: string | null = null;

        const effectiveDate = l.source_date || nowIso;
        if (leadStatus === "contacted" || leadStatus === "replied") {
          contactedAt = effectiveDate;
        } else if (leadStatus === "booked") {
          contactedAt = effectiveDate;
          bookedAt = effectiveDate;
        } else if (leadStatus === "won") {
          contactedAt = effectiveDate;
          wonAt = effectiveDate;
        }

        return {
          name: l.name,
          company: l.company,
          email: (l.email || "").trim().toLowerCase(),
          phone: l.phone || null,
          status: l.status,
          assigned_agent_name: l.agent,
          value: l.value,
          notes: l.notes,
          last_contact: l.source_date || l.lastContact || (new Date(Date.now() - i * 1000).toISOString()),
          created_at: l.source_date || l.lastContact || (new Date(Date.now() - i * 1000).toISOString()),
          imported_by: isAgentImportingForSelf ? (user?.email ?? null) : null,
          assigned_at: isAdminAssigningToAgent ? nowIso : null,
          contacted_at: contactedAt,
          booked_at: bookedAt,
          won_at: wonAt,
        };
      });

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
        if (error) {
          console.error("Supabase lead insertion error:", error);
          toast.error("Database lead insertion failed: " + error.message);
          setIsImporting(false);
          return;
        }
        inserted = data;
      }

      // Create notification records for each agent who received leads
      if (isAdmin) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        for (const [agentEmail, count] of Object.entries(agentCounts)) {
          if (!isAdminEmail(agentEmail)) {
            await supabase.from("emails_sent").insert({
              lead_email: agentEmail,
              subject: `Admin ne aapko ${count} new lead(s) assign ki hain — ${timeStr} bajay`,
              status: "unread",
              sequence_type: "lead_assignment",
              type: "lead_assignment",
              sent_at: now.toISOString(),
            });
          }
        }
      }

      // Send Welcome emails via API route (server-side nodemailer)
      if (inserted && inserted.length) {
        const emailAgentMap = new Map<string, string>();
        created.forEach((l) => {
          if (l.email) emailAgentMap.set(l.email.trim().toLowerCase(), l.agent || PRIMARY_ADMIN_EMAIL);
        });

        const leadsPayload = inserted
          .filter((item) => item.email && item.email.includes("@"))
          .map((item) => {
            const agentForLead = emailAgentMap.get((item.email || "").trim().toLowerCase()) || PRIMARY_ADMIN_EMAIL;
            return { email: item.email, leadId: item.id, agentEmail: agentForLead };
          });

        if (leadsPayload.length > 0) {
          fetch("/api/send-welcome-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leads: leadsPayload }),
          })
            .then((r) => r.json())
            .then((result) => {
              if (result.sent > 0) {
                console.log(`Welcome emails sent: ${result.sent}/${leadsPayload.length}`);
              }
            })
            .catch((err) => console.log("Welcome email notice:", err));
        }
      }
    } catch (e) {
      console.log("Database sync completed.");
    }

    toast.success(`${created.length} leads imported and assigned!`);
    setOpen(false);
    setRows([]);
    setRowAgents({});
    setSelectedRowIndexes([]);
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
              Supports .csv, .xlsx, .xls — Supports: <strong>Name, Phone, Email</strong>
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
                  setRowAgents({});
                  setSelectedRowIndexes([]);
                }}
              >
                <X className="size-4" /> Clear
              </Button>
            </div>

            {/* Default Phone Country Setting for entire sheet */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-violet-950/20 border border-violet-500/30 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-violet-600/20 text-violet-300 shrink-0">
                  <Globe className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <span>Default Sheet Phone Country:</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-violet-500/40 text-violet-300">
                      {defaultPhoneCountry === "AUTO" ? "Smart Auto-Detect" : defaultPhoneCountry}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Applied to numbers in sheet that don't have a '+' sign or country column
                  </p>
                </div>
              </div>
              <CountryCombobox
                value={defaultPhoneCountry}
                onValueChange={setDefaultPhoneCountry}
                includeAuto
                className="h-8 w-52 rounded-xl text-xs bg-surface-2 border-border/80 shrink-0"
              />
            </div>

            {/* Admin Lead Assignment Control Suite */}
            {isAdmin && (
              <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                {/* 1. Default Agent Dropdown */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <UserCheck className="size-3.5" /> 1. Set Default Agent (or distribute across team):
                    </label>
                    {approvedAgents.length > 0 && (
                      <span className="text-[11px] text-violet-300 font-semibold">
                        {approvedAgents.length} Working Agent{approvedAgents.length !== 1 ? "s" : ""} Available
                      </span>
                    )}
                  </div>
                  <Select
                    value={selectedAgentEmail}
                    onValueChange={(val) => {
                      setSelectedAgentEmail(val);
                      setRowAgents({});
                    }}
                  >
                    <SelectTrigger className="w-full rounded-lg bg-surface-1 text-xs font-medium">
                      <SelectValue placeholder="Select target agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PRIMARY_ADMIN_EMAIL}>Admin Pool (Garry Amelia)</SelectItem>
                      <SelectItem value="tzafar04@gmail.com">Admin Pool (T Zafar)</SelectItem>
                      {approvedAgents.map((ag) => (
                        <SelectItem key={ag.email} value={ag.email}>
                          👤 {ag.name} ({ag.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. ⚡ Auto-Distribute Toolbar for Large Datasets (1000 - 5000 leads) */}
                {approvedAgents.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-primary/10">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Sparkles className="size-3.5 text-violet-400" />
                      <span className="font-semibold text-white">Large Batch Tools:</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAutoDistribute("chunks")}
                        className="h-7 text-xs rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 font-semibold gap-1"
                        title="Split total leads into equal batches per agent (e.g. 500 each)"
                      >
                        <Shuffle className="size-3" />
                        ⚡ Split Evenly ({approvedAgents.length} Agents)
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAutoDistribute("round-robin")}
                        className="h-7 text-xs rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 font-semibold gap-1"
                        title="Distribute leads 1-by-1 in circular order across agents"
                      >
                        <Users className="size-3" />
                        Round-Robin
                      </Button>
                    </div>
                  </div>
                )}

                {/* 3. Quick Batch Selectors (Additive Accumulation) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-primary/10 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-300 font-semibold flex items-center gap-1">
                      <span>Quick Select Next Leads:</span>
                      {selectedRowIndexes.length > 0 && (
                        <span className="text-violet-300 font-bold">
                          ({selectedRowIndexes.length} selected)
                        </span>
                      )}
                    </span>
                    {selectedRowIndexes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedRowIndexes([])}
                        className="text-[11px] text-rose-400 hover:text-rose-300 underline underline-offset-2"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[5, 10, 50, 100, 500, 1000].map((count) => {
                      const isDisabled = rows.length === 0 || selectedRowIndexes.length >= rows.length;
                      return (
                        <button
                          key={count}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleSelectBatch(count)}
                          className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-violet-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          title={`Add next ${count} leads to selection`}
                        >
                          Next {count}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setSelectedRowIndexes(rows.map((_, i) => i))}
                      className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-violet-600 hover:text-white transition-all"
                    >
                      All ({rows.length})
                    </button>

                    {/* Custom Batch Input for any number (e.g. 200, 250, 450) */}
                    <div className="flex items-center gap-1 ml-auto">
                      <input
                        type="number"
                        min="1"
                        max={rows.length}
                        placeholder="Custom (e.g. 250)"
                        value={customBatchInput}
                        onChange={(e) => setCustomBatchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomBatch();
                          }
                        }}
                        className="h-7 w-28 rounded-md bg-slate-900 border border-slate-700 px-2 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomBatch}
                        className="h-7 rounded-md bg-violet-600 px-2 text-[11px] font-bold text-white hover:bg-violet-500 transition-colors"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Live Assignment Distribution Summary Badges */}
                <div className="pt-2 border-t border-primary/10">
                  <p className="text-[11px] font-semibold text-slate-400 mb-1.5">Distribution Preview:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {Object.entries(agentDistributionCounts).map(([email, count]) => {
                      const name = approvedAgents.find((a) => a.email === email)?.name || (isAdminEmail(email) ? "Admin Pool" : email);
                      return (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-300 border border-violet-500/20"
                        >
                          👤 <strong>{name}:</strong> {count} leads
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Assignment Bar for Selected Checkbox Rows */}
            {isAdmin && selectedRowIndexes.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/40 bg-violet-950/50 p-3 shadow-lg backdrop-blur animate-fade-in">
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 text-xs px-2.5 py-0.5 font-bold rounded-full">
                    {selectedRowIndexes.length} rows selected
                  </Badge>
                  <span className="text-xs text-slate-300 font-medium">Assign selected to:</span>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={bulkTargetAgent} onValueChange={setBulkTargetAgent}>
                    <SelectTrigger className="w-52 h-8 rounded-lg bg-slate-900 text-xs font-semibold border-slate-700 text-white">
                      <SelectValue placeholder="Choose agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PRIMARY_ADMIN_EMAIL}>Admin Pool (Garry Amelia)</SelectItem>
                      <SelectItem value="tzafar04@gmail.com">Admin Pool (T Zafar)</SelectItem>
                      {approvedAgents.map((ag) => (
                        <SelectItem key={ag.email} value={ag.email}>
                          👤 {ag.name} ({ag.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    onClick={handleApplyBulkAgentToSelected}
                    className="h-8 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold gap-1 px-3 shadow-md"
                  >
                    <UserCheck className="size-3.5" />
                    Assign {selectedRowIndexes.length} Rows
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs text-slate-400 hover:text-white px-2"
                    onClick={() => setSelectedRowIndexes([])}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-10 px-3">
                        <input
                          type="checkbox"
                          className="rounded accent-violet-600 size-4 cursor-pointer align-middle"
                          checked={rows.length > 0 && selectedRowIndexes.length === rows.length}
                          onChange={() => {
                            if (selectedRowIndexes.length === rows.length) {
                              setSelectedRowIndexes([]);
                            } else {
                              setSelectedRowIndexes(rows.map((_, idx) => idx));
                            }
                          }}
                          title="Select / Deselect all rows"
                        />
                      </TableHead>
                    )}
                    {columns.map((c) => (
                      <TableHead key={c} className="whitespace-nowrap">{c}</TableHead>
                    ))}
                    {isAdmin && <TableHead className="whitespace-nowrap font-bold text-primary">Assign To Agent</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const cells = getPreviewCells(r, i);
                    const { email: rowEmail, phone: rowPhone } = parseRow(r, i);
                    const staffMatch = checkStaffMatch(rowEmail, rowPhone);
                    const isSelected = selectedRowIndexes.includes(i);

                    return (
                      <TableRow
                        key={i}
                        className={`${staffMatch.isStaff ? "bg-rose-500/10 border-rose-500/30" : ""} ${isSelected ? "bg-violet-500/15" : ""}`}
                      >
                        {isAdmin && (
                          <TableCell className="w-10 px-3">
                            <input
                              type="checkbox"
                              className="rounded accent-violet-600 size-4 cursor-pointer align-middle"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedRowIndexes((prev) =>
                                  prev.includes(i) ? prev.filter((idx) => idx !== i) : [...prev, i]
                                );
                              }}
                            />
                          </TableCell>
                        )}
                        {cells.map((val, ci) => (
                          <TableCell key={ci} className="whitespace-nowrap text-sm">
                            {val || <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                        ))}

                        {/* Staff match warning badge */}
                        {staffMatch.isStaff && (
                          <TableCell className="whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300 border border-rose-500/30">
                              <ShieldAlert className="size-3 text-rose-400" /> {staffMatch.role} Account — cannot be imported!
                            </span>
                          </TableCell>
                        )}

                        {isAdmin && !staffMatch.isStaff && (
                          <TableCell className="w-60 whitespace-nowrap">
                            <Select
                              value={getRowAgent(i)}
                              onValueChange={(val) => setRowAgents((prev) => ({ ...prev, [i]: val }))}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-lg border-primary/30 bg-surface-1 font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={PRIMARY_ADMIN_EMAIL}>Admin Pool (Garry Amelia)</SelectItem>
                                <SelectItem value="tzafar04@gmail.com">Admin Pool (T Zafar)</SelectItem>
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
