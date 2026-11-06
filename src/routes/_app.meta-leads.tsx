import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Facebook, UserCheck, Mail, RefreshCw, X, ChevronDown, CheckCircle2, Clock, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/crm/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { isAdminEmail, ADMIN_EMAILS } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/meta-leads")({
  head: () => ({
    meta: [{ title: "Meta Leads — Teals CRM" }],
  }),
  component: MetaLeadsPage,
});

type MetaLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  assigned_agent_name: string | null;
  created_at: string;
  notes: string[];
};

type ApprovedAgent = {
  name: string;
  email: string;
};

const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";

function MetaLeadsPage() {
  const { user } = useCrm();
  const navigate = useNavigate();

  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  // Redirect non-admins away
  useEffect(() => {
    if (user && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [user, isAdmin, navigate]);

  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [approvedAgents, setApprovedAgents] = useState<ApprovedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Assign dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [targetAgentEmail, setTargetAgentEmail] = useState(PRIMARY_ADMIN_EMAIL);
  const [isAssigning, setIsAssigning] = useState(false);

  // Welcome email state
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);
  const [emailSentIds, setEmailSentIds] = useState<Set<string>>(new Set());

  // ── Fetch Meta Leads ───────────────────────────────────────────────────────
  const fetchLeads = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("company", "Meta Lead Ads")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setLeads(data);
      }
    } catch (err) {
      console.error("Error fetching Meta leads:", err);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  // ── Fetch Approved Agents ──────────────────────────────────────────────────
  const fetchAgents = useCallback(async () => {
    try {
      const { data } = await supabase.from("profiles").select("*");
      if (data) {
        const approved: ApprovedAgent[] = data
          .filter((p: any) => {
            if (isAdminEmail(p.email)) return false;
            if (!p.avatar_url) return false;
            try {
              return JSON.parse(p.avatar_url).approved === true;
            } catch {
              return false;
            }
          })
          .map((p: any) => ({
            name: p.full_name || p.email.split("@")[0],
            email: p.email,
          }));
        setApprovedAgents(approved);
      }
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  }, []);

  // ── Initial Fetch & Realtime Subscription ──────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;

    fetchLeads(true);
    fetchAgents();

    // Supabase Realtime channel for live updates when Meta webhooks insert leads
    const channel = supabase
      .channel("meta-leads-live-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        () => {
          fetchLeads(false);
        }
      )
      .subscribe();

    // Secondary live polling fallback every 8 seconds
    const interval = setInterval(() => {
      fetchLeads(false);
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isAdmin, fetchLeads, fetchAgents]);

  // ── Compute Live Counts and Separate Unassigned vs Assigned ────────────────
  const { unassigned, assigned, totalCount, unassignedCount, assignedCount } = useMemo(() => {
    const totalCount = leads.length;
    const allUnassigned = leads.filter((l) => isAdminEmail(l.assigned_agent_name || ""));
    const allAssigned = leads.filter((l) => !isAdminEmail(l.assigned_agent_name || ""));

    const unassignedCount = allUnassigned.length;
    const assignedCount = allAssigned.length;

    const query = search.trim().toLowerCase();
    const filterFn = (l: MetaLead) =>
      !query ||
      l.name.toLowerCase().includes(query) ||
      l.email.toLowerCase().includes(query) ||
      (l.phone || "").includes(query);

    const unassigned = allUnassigned.filter(filterFn);
    const assigned = allAssigned.filter(filterFn);

    return { unassigned, assigned, totalCount, unassignedCount, assignedCount };
  }, [leads, search]);

  // ── Row selection helpers ──────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openAssignDialog = (leadIds: string[]) => {
    if (!leadIds.length) {
      toast.warning("Please select at least one lead to assign.");
      return;
    }
    setSelectedLeadIds(leadIds);
    setTargetAgentEmail(PRIMARY_ADMIN_EMAIL);
    setAssignDialogOpen(true);
  };

  // ── Assign leads to agent ──────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!selectedLeadIds.length || !targetAgentEmail) return;
    setIsAssigning(true);

    try {
      // 1. Update assigned_agent_name in DB for all selected leads
      const { error } = await supabase
        .from("leads")
        .update({ assigned_agent_name: targetAgentEmail })
        .in("id", selectedLeadIds);

      if (error) {
        toast.error("Assignment failed: " + error.message);
        setIsAssigning(false);
        return;
      }

      const leadsToAssign = leads.filter((l) => selectedLeadIds.includes(l.id));

      // 2. Send welcome emails for each assigned lead
      const leadsPayload = leadsToAssign
        .filter((l) => l.email && l.email.includes("@"))
        .map((l) => ({
          email: l.email,
          leadId: l.id,
          agentEmail: targetAgentEmail,
        }));

      if (leadsPayload.length > 0) {
        fetch("/api/send-welcome-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: leadsPayload }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.sent > 0) {
              toast.success(`✉️ Sent ${res.sent} welcome email(s) successfully.`);
            }
          })
          .catch(() => {});
      }

      // 3. If assigned to a working agent, create active notification
      if (!isAdminEmail(targetAgentEmail)) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        const notifSubject = `Admin assigned ${selectedLeadIds.length} new Meta lead(s) to you — at ${timeStr}`;

        await supabase.from("emails_sent").insert({
          lead_email: targetAgentEmail,
          subject: notifSubject,
          status: "unread",
          sequence_type: "assignment_notification",
          type: "assignment_notification",
          sent_at: now.toISOString(),
        });
      }

      const agentDisplay = isAdminEmail(targetAgentEmail)
        ? `Admin Pool`
        : approvedAgents.find((a) => a.email === targetAgentEmail)?.name || targetAgentEmail;

      toast.success(`✅ ${selectedLeadIds.length} lead(s) assigned to ${agentDisplay}!`);

      setAssignDialogOpen(false);
      setSelectedLeadIds([]);
      await fetchLeads(false);
    } catch (e: any) {
      toast.error("Error assigning leads: " + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  // ── Send welcome email for a single lead ───────────────────────────────────
  const handleSendWelcomeEmail = async (lead: MetaLead) => {
    if (sendingEmailFor === lead.id) return;
    setSendingEmailFor(lead.id);
    try {
      const res = await fetch("/api/send-welcome-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: [
            {
              email: lead.email,
              leadId: lead.id,
              agentEmail: user?.email || PRIMARY_ADMIN_EMAIL,
            },
          ],
        }),
      });
      const result = await res.json();
      if (result.sent > 0 || result.status === "ok") {
        toast.success(`✉️ Welcome email sent to ${lead.name}!`);
        setEmailSentIds((prev) => new Set([...prev, lead.id]));
      } else {
        toast.warning("Failed to send welcome email. Check email configuration.");
      }
    } catch {
      toast.error("An error occurred while sending the email.");
    } finally {
      setSendingEmailFor(null);
    }
  };

  if (!isAdmin) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Meta Leads"
        description="Incoming leads from Facebook / Instagram Lead Ads — Assign to agents or send welcome emails."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => fetchLeads(true)}
              disabled={isLoading}
            >
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {selectedLeadIds.length > 0 && (
              <Button
                size="sm"
                className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => openAssignDialog(selectedLeadIds)}
              >
                <UserCheck className="size-4" />
                Assign Selected ({selectedLeadIds.length})
              </Button>
            )}
          </div>
        }
      />

      {/* Live Stats Row */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-border bg-surface-1 p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Meta Leads</p>
            <span className="flex size-2 rounded-full bg-blue-400 animate-pulse" title="Live Counter" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{totalCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Live synced from Meta Ads</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-1 p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Unassigned (Admin Pool)</p>
            <Clock className="size-3.5 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-amber-400">{unassignedCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Retained by Admins</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-1 p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-green-400 uppercase tracking-wider">Assigned to Agents</p>
            <UserCheck className="size-3.5 text-green-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-green-400">{assignedCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Actively assigned to team</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-9 rounded-xl"
          placeholder="Search by name, email, or phone number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && leads.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="size-6 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-blue-500/10 text-blue-400 mb-4">
            <Facebook className="size-7" />
          </div>
          <p className="text-base font-semibold text-foreground">No Meta Leads Found</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            When leads arrive via your connected Meta / Facebook Lead Ads forms, they will automatically appear here in realtime.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── UNASSIGNED LEADS (Admin Pool) ── */}
          {unassigned.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-amber-400">
                    Unassigned Leads ({unassigned.length}) — Admin Pool
                  </h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-8 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => openAssignDialog(unassigned.map((l) => l.id))}
                >
                  <UserCheck className="size-3.5" /> Assign All ({unassigned.length})
                </Button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden bg-surface-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={unassigned.length > 0 && unassigned.every((l) => selectedLeadIds.includes(l.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...unassigned.map((l) => l.id)])));
                            } else {
                              setSelectedLeadIds((prev) => prev.filter((id) => !unassigned.find((l) => l.id === id)));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Lead Name</TableHead>
                      <TableHead>Email Address</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Date Received</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassigned.map((lead) => (
                      <TableRow key={lead.id} className={selectedLeadIds.includes(lead.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{lead.email}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{lead.phone || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(lead.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-lg text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                              onClick={() => openAssignDialog([lead.id])}
                            >
                              <UserCheck className="size-3" /> Assign
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-7 rounded-lg text-xs ${
                                emailSentIds.has(lead.id)
                                  ? "border-green-500/30 text-green-400"
                                  : "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              }`}
                              onClick={() => handleSendWelcomeEmail(lead)}
                              disabled={sendingEmailFor === lead.id || emailSentIds.has(lead.id)}
                            >
                              {emailSentIds.has(lead.id) ? (
                                <><CheckCircle2 className="size-3" /> Sent</>
                              ) : sendingEmailFor === lead.id ? (
                                <><RefreshCw className="size-3 animate-spin" /> Sending...</>
                              ) : (
                                <><Mail className="size-3" /> Welcome Email</>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── ASSIGNED LEADS ── */}
          {assigned.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-400" />
                <h2 className="text-sm font-bold text-green-400">
                  Assigned Leads ({assigned.length})
                </h2>
              </div>
              <div className="rounded-xl border border-border overflow-hidden bg-surface-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead Name</TableHead>
                      <TableHead>Email Address</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Date Received</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assigned.map((lead) => {
                      const agentInfo = approvedAgents.find((a) => a.email === lead.assigned_agent_name);
                      return (
                        <TableRow key={lead.id} className="hover:bg-surface-2/50 transition-colors">
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{lead.email}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{lead.phone || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(lead.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-green-400 border border-green-500/25 w-fit">
                                <UserCheck className="size-3" />
                                {agentInfo?.name || lead.assigned_agent_name?.split("@")[0] || "Working Agent"}
                              </span>
                              <span className="text-[10px] text-muted-foreground pl-1">{lead.assigned_agent_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => openAssignDialog([lead.id])}
                            >
                              <ChevronDown className="size-3" /> Re-assign
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ASSIGN DIALOG ─────────────────────────────────────────────────────── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Assign Meta Leads</DialogTitle>
            <DialogDescription>
              Assign {selectedLeadIds.length} lead(s) to a team member.
              Assigned leads will receive a welcome email automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="rounded-xl bg-surface-2/60 border border-border p-3 text-xs text-muted-foreground">
              Selected: <strong className="text-foreground">{selectedLeadIds.length} lead(s)</strong> ready to assign.
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assign To:</label>
              <Select value={targetAgentEmail} onValueChange={setTargetAgentEmail}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PRIMARY_ADMIN_EMAIL}>
                    👑 Admin Pool — Garry Amelia
                  </SelectItem>
                  <SelectItem value="tzafar04@gmail.com">
                    👑 Admin Pool — T Zafar
                  </SelectItem>
                  {approvedAgents.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Working Agents
                      </div>
                      {approvedAgents.map((ag) => (
                        <SelectItem key={ag.email} value={ag.email}>
                          👤 {ag.name} — {ag.email}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {!isAdminEmail(targetAgentEmail) && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300">
                ✉️ Automatic welcome email and in-app assignment notification will be dispatched to the selected agent.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleAssign}
              disabled={isAssigning}
            >
              {isAssigning ? (
                <><RefreshCw className="size-4 animate-spin" /> Assigning...</>
              ) : (
                <><UserCheck className="size-4" /> Confirm Assignment</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
