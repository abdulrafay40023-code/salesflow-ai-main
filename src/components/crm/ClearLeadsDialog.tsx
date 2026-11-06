import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { type Lead, ADMIN_EMAILS, isAdminEmail } from "@/lib/crm-data";
import { notifyAdminLeadsClearedFn } from "@/lib/server-actions";
import {
  Trash2,
  AlertTriangle,
  Calendar,
  Filter,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Users,
  UserCheck,
  Download,
  Info,
  UserX,
} from "lucide-react";

export type ClearScope =
  | "today"
  | "yesterday"
  | "today_and_yesterday"
  | "older_7_days"
  | "only_new"
  | "only_unresponsive"
  | "all";

export type AgentLeadType = "all_leads" | "assigned_leads" | "imported_leads";

const DEFAULT_ADMINS = [
  { name: "Garry Amelia", email: "garryamelia6265@gmail.com" },
  { name: "T Zafar", email: "tzafar04@gmail.com" },
  { name: "Annus Raees", email: "annusraees@gmail.com" },
];

export function ClearLeadsDialog({
  open,
  onOpenChange,
  leads,
  isAdmin,
  userEmail,
  onCleared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  isAdmin: boolean;
  userEmail?: string;
  onCleared: () => void;
}) {
  // NOTHING is auto-selected by default. User must explicitly choose.
  const [selectedOption, setSelectedOption] = useState<ClearScope | "">("");
  const [adminTargetScope, setAdminTargetScope] = useState<string>("ALL_CRM");
  const [agentLeadType, setAgentLeadType] = useState<AgentLeadType>("all_leads");
  const [isDeleting, setIsDeleting] = useState(false);
  const [registeredWorkingAgents, setRegisteredWorkingAgents] = useState<{ name: string; email: string }[]>([]);
  const [registeredAdmins, setRegisteredAdmins] = useState<{ name: string; email: string }[]>([]);

  // Fetch registered working agents and admins from profiles
  useEffect(() => {
    if (!open) return;
    setSelectedOption("");
    setAdminTargetScope("ALL_CRM");
    setAgentLeadType("all_leads");

    supabase
      .from("profiles")
      .select("*")
      .then(({ data }) => {
        if (data) {
          const agents: { name: string; email: string }[] = [];
          const admins: { name: string; email: string }[] = [];
          data.forEach((p: any) => {
            const em = (p.email || "").toLowerCase().trim();
            if (!em) return;
            if (isAdminEmail(em) || p.role === "admin") {
              admins.push({
                name: p.full_name || em.split("@")[0],
                email: p.email,
              });
              return;
            }

            let isApproved = false;
            if (p.avatar_url) {
              try {
                const parsed = JSON.parse(p.avatar_url);
                isApproved = Boolean(parsed.approved);
              } catch {}
            }
            if (isApproved || p.role === "agent") {
              agents.push({
                name: p.full_name || em.split("@")[0],
                email: p.email,
              });
            }
          });
          setRegisteredWorkingAgents(agents);
          setRegisteredAdmins(admins);
        }
      });
  }, [open]);

  // Extract distinct working agents that exist in current leads as fallback
  const allWorkingAgents = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();

    // 1. Add approved agents from profiles
    registeredWorkingAgents.forEach((a) => {
      const em = a.email.toLowerCase().trim();
      if (!isAdminEmail(em)) {
        map.set(em, a);
      }
    });

    // 2. Add any working agents found in leads
    leads.forEach((l) => {
      const ag = (l.agent || "").trim();
      const imp = (l.imported_by || "").trim();
      [ag, imp].forEach((val) => {
        if (
          val &&
          val !== "Unassigned" &&
          val !== "Garry Amelia" &&
          val !== "Admin" &&
          !isAdminEmail(val)
        ) {
          const clean = val.toLowerCase();
          if (!map.has(clean)) {
            map.set(clean, {
              name: val.includes("@") ? val.split("@")[0] : val,
              email: val,
            });
          }
        }
      });
    });

    return Array.from(map.values());
  }, [registeredWorkingAgents, leads]);

  // All distinct Admins
  const allAdmins = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();
    DEFAULT_ADMINS.forEach((adm) => map.set(adm.email.toLowerCase().trim(), adm));
    registeredAdmins.forEach((adm) => map.set(adm.email.toLowerCase().trim(), adm));
    return Array.from(map.values());
  }, [registeredAdmins]);

  const isAdminMatch = (val?: string | null, targetEmail?: string): boolean => {
    if (!val) return false;
    const clean = val.trim().toLowerCase();
    if (targetEmail) {
      const targetClean = targetEmail.trim().toLowerCase();
      if (clean === targetClean) return true;
      if (targetClean === "garryamelia6265@gmail.com" && (clean === "garry amelia" || clean === "admin")) return true;
      return false;
    }
    return isAdminEmail(clean) || clean === "garry amelia" || clean === "admin";
  };

  // Count metrics for selected scope (Admin, Working Agent, or All CRM)
  const selectedAgentStats = useMemo(() => {
    if (adminTargetScope === "ALL_CRM" || adminTargetScope === "NO_AGENT") {
      return { total: 0, assigned: 0, imported: 0 };
    }

    if (adminTargetScope === "ALL_ADMINS") {
      let assignedCount = 0;
      let importedCount = 0;
      let totalCount = 0;

      leads.forEach((l) => {
        const isAgent = isAdminMatch(l.agent);
        const isImport = isAdminMatch(l.imported_by);

        if (isAgent || isImport) totalCount++;
        if (isImport) importedCount++;
        else if (isAgent) assignedCount++;
      });

      return { total: totalCount, assigned: assignedCount, imported: importedCount };
    }

    const em = adminTargetScope.trim().toLowerCase();
    const isTargetAdmin = isAdminEmail(em);

    let assignedCount = 0;
    let importedCount = 0;
    let totalCount = 0;

    leads.forEach((l) => {
      const isAgent = isTargetAdmin ? isAdminMatch(l.agent, em) : (l.agent || "").trim().toLowerCase() === em;
      const isImport = isTargetAdmin ? isAdminMatch(l.imported_by, em) : (l.imported_by || "").trim().toLowerCase() === em;

      if (isAgent || isImport) {
        totalCount++;
      }

      if (isImport) {
        importedCount++;
      } else if (isAgent) {
        assignedCount++;
      }
    });

    return {
      total: totalCount,
      assigned: assignedCount,
      imported: importedCount,
    };
  }, [leads, adminTargetScope]);

  // Filter leads based on agent permission, scope, and selected rule
  const targetLeads = useMemo(() => {
    if (!selectedOption) return [];

    let baseLeads = [...leads];

    // 1. Permission Scope Filtering
    if (!isAdmin && userEmail) {
      // Working Agent: strictly lock to user's assigned leads
      const myEm = userEmail.trim().toLowerCase();
      baseLeads = baseLeads.filter(
        (l) => (l.agent || "").trim().toLowerCase() === myEm
      );
    } else if (isAdmin) {
      if (adminTargetScope === "NO_AGENT") {
        return [];
      } else if (adminTargetScope === "ALL_ADMINS") {
        baseLeads = baseLeads.filter((l) => {
          const isAgent = isAdminMatch(l.agent);
          const isImport = isAdminMatch(l.imported_by);

          if (agentLeadType === "assigned_leads") {
            return isAgent && !isImport;
          } else if (agentLeadType === "imported_leads") {
            return isImport;
          } else {
            return isAgent || isImport;
          }
        });
      } else if (adminTargetScope !== "ALL_CRM") {
        const em = adminTargetScope.trim().toLowerCase();
        const isTargetAdmin = isAdminEmail(em);

        baseLeads = baseLeads.filter((l) => {
          const isAgent = isTargetAdmin ? isAdminMatch(l.agent, em) : (l.agent || "").trim().toLowerCase() === em;
          const isImport = isTargetAdmin ? isAdminMatch(l.imported_by, em) : (l.imported_by || "").trim().toLowerCase() === em;

          if (agentLeadType === "assigned_leads") {
            return isAgent && !isImport;
          } else if (agentLeadType === "imported_leads") {
            return isImport;
          } else {
            return isAgent || isImport;
          }
        });
      }
    }

    // 2. Date / Rule Filtering
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysAgo = todayStart - 7 * 86400000;

    return baseLeads.filter((l) => {
      const rawDate = l.source_date || l.lastContact || "";
      const parsed = rawDate ? new Date(rawDate).getTime() : 0;
      const d = isNaN(parsed) || parsed === 0 ? todayStart : parsed;

      switch (selectedOption) {
        case "today":
          return d >= todayStart && d < tomorrowStart;
        case "yesterday":
          return d >= yesterdayStart && d < todayStart;
        case "today_and_yesterday":
          return d >= yesterdayStart && d < tomorrowStart;
        case "older_7_days":
          return d < sevenDaysAgo;
        case "only_new":
          return l.status === "new";
        case "only_unresponsive":
          return (
            l.status === "no_answer" ||
            l.status === "contacted" ||
            l.status === "booking_cancelled"
          );
        case "all":
          return true;
        default:
          return false;
      }
    });
  }, [
    leads,
    isAdmin,
    userEmail,
    adminTargetScope,
    agentLeadType,
    allWorkingAgents,
    selectedOption,
  ]);

  async function handleExecuteClear() {
    if (!selectedOption) {
      toast.info("Please select a deletion rule first.");
      return;
    }

    if (!targetLeads.length) {
      toast.info("No leads match the selected rule to delete.");
      return;
    }

    setIsDeleting(true);
    try {
      const targetIds = targetLeads.map((l) => l.id);
      const targetEmails = targetLeads
        .map((l) => l.email)
        .filter((em) => em && em !== "—");

      // 1. Delete matching leads from Supabase
      const { error: leadsErr } = await supabase
        .from("leads")
        .delete()
        .in("id", targetIds);
      if (leadsErr) throw leadsErr;

      // 2. Clean up scheduled emails / reminders so NO emails are sent
      if (targetEmails.length > 0) {
        await supabase
          .from("emails_sent")
          .delete()
          .in("lead_email", targetEmails);
        for (const em of targetEmails) {
          await supabase
            .from("meetings")
            .update({ completed: true, title: "[DELETED] Meeting Cancelled" })
            .ilike("title", `%${em}%`);
        }
      }

      toast.success(
        `🗑️ Successfully deleted ${targetLeads.length} lead(s)! Pending emails/reminders cancelled.`
      );

      // If working agent is clearing leads, notify Admin via Email Alert
      if (!isAdmin && userEmail) {
        const currentOpt = options.find((o) => o.id === selectedOption);
        const scopeTitle = currentOpt ? currentOpt.title : selectedOption;
        notifyAdminLeadsClearedFn({
          data: {
            agentName: userEmail.split("@")[0],
            agentEmail: userEmail,
            scopeTitle,
            deletedCount: targetLeads.length,
          },
        }).catch((err) =>
          console.error("Failed to trigger admin clear alert:", err)
        );
      }

      onCleared();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to clear leads:", err);
      toast.error("Failed to delete leads: " + (err?.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
    }
  }

  const options: { id: ClearScope; title: string; desc: string; icon: any }[] = [
    {
      id: "today",
      title: "Today's Leads Only",
      desc: "Deletes only leads imported or created today",
      icon: Calendar,
    },
    {
      id: "yesterday",
      title: "Yesterday's Leads Only",
      desc: "Deletes leads from yesterday",
      icon: Calendar,
    },
    {
      id: "today_and_yesterday",
      title: "Today & Yesterday (Last 48 Hours)",
      desc: "Deletes leads from the past 2 days",
      icon: Calendar,
    },
    {
      id: "older_7_days",
      title: "Older than 7 Days",
      desc: "Deletes stale or expired leads older than a week",
      icon: Filter,
    },
    {
      id: "only_new",
      title: "Only 'New' / Uncalled Leads",
      desc: "Clears uncalled leads while keeping your Booked and Won deals safe",
      icon: Sparkles,
    },
    {
      id: "only_unresponsive",
      title: "Only Unresponsive Leads (No Answer / Contacted)",
      desc: "Cleans up cold leads that did not convert",
      icon: Filter,
    },
    {
      id: "all",
      title: "💥 Delete ALL Leads in Selected Scope",
      desc: "Deletes every lead matching the selected scope. Use with caution!",
      icon: AlertTriangle,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 rounded-2xl bg-surface-1 border-border shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Clear Leads from Pipeline
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isAdmin ? (
                  <span>Select the target scope and deletion rule below.</span>
                ) : (
                  <span className="text-amber-300 font-semibold">
                    🔒 Working Agent Mode: Only leads assigned to your dashboard will be deleted.
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Admin Scope Selector: Entire CRM vs Working Agent (name & email) */}
        {isAdmin && (
          <div className="space-y-2.5 p-3 rounded-xl bg-surface-2/70 border border-border/80 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-violet-400 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">Target Pipeline Scope:</span>
                  <p className="text-[10px] text-muted-foreground">Choose which pool to clear</p>
                </div>
              </div>
              <Select value={adminTargetScope} onValueChange={setAdminTargetScope}>
                <SelectTrigger className="h-8 w-full sm:min-w-[210px] sm:max-w-[260px] rounded-xl text-xs bg-surface-1 border-border font-medium truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_CRM">🌐 Entire CRM Pipeline</SelectItem>
                  <SelectItem value="ALL_ADMINS">🛡️ All Admin Leads (Admins Pool)</SelectItem>
                  {allAdmins.map((adm) => (
                    <SelectItem key={adm.email} value={adm.email}>
                      🛡️ {adm.name} ({adm.email})
                    </SelectItem>
                  ))}
                  {allWorkingAgents.length === 0 ? (
                    <SelectItem value="NO_AGENT">👤 Working Agent</SelectItem>
                  ) : (
                    allWorkingAgents.map((ag) => (
                      <SelectItem key={ag.email} value={ag.email}>
                        👤 {ag.name} ({ag.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Empty state when NO working agent is on CRM and Working Agent is selected */}
            {adminTargetScope === "NO_AGENT" && (
              <div className="pt-2 border-t border-border/40">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <UserX className="size-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <p className="font-semibold text-xs text-amber-200">
                      No working agent is available on CRM.
                    </p>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      When available, you can delete their leads.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Working Agent Specific Sub-Options (All, Assigned, Imported) */}
            {adminTargetScope !== "ALL_CRM" && adminTargetScope !== "NO_AGENT" && (
              <div className="pt-2 border-t border-border/40 space-y-2.5">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-1 border border-border/80">
                  <Button
                    type="button"
                    size="sm"
                    variant={agentLeadType === "all_leads" ? "secondary" : "ghost"}
                    onClick={() => setAgentLeadType("all_leads")}
                    className={`flex-1 h-7 text-[11px] rounded-lg font-semibold transition-all ${
                      agentLeadType === "all_leads"
                        ? "bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Leads ({selectedAgentStats.total})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={agentLeadType === "assigned_leads" ? "secondary" : "ghost"}
                    onClick={() => setAgentLeadType("assigned_leads")}
                    className={`flex-1 h-7 text-[11px] rounded-lg font-semibold transition-all ${
                      agentLeadType === "assigned_leads"
                        ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <UserCheck className="size-3 mr-1" />
                    Assigned ({selectedAgentStats.assigned})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={agentLeadType === "imported_leads" ? "secondary" : "ghost"}
                    onClick={() => setAgentLeadType("imported_leads")}
                    className={`flex-1 h-7 text-[11px] rounded-lg font-semibold transition-all ${
                      agentLeadType === "imported_leads"
                        ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Download className="size-3 mr-1" />
                    Imported ({selectedAgentStats.imported})
                  </Button>
                </div>

                {/* Sub-Option Empty State Notices */}
                {agentLeadType === "assigned_leads" && selectedAgentStats.assigned === 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px]">
                    <Info className="size-3.5 shrink-0" />
                    <span>No leads have been assigned to this agent.</span>
                  </div>
                )}
                {agentLeadType === "imported_leads" && selectedAgentStats.imported === 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                    <Info className="size-3.5 shrink-0" />
                    <span>This agent has not imported any leads.</span>
                  </div>
                )}
                {agentLeadType === "all_leads" && selectedAgentStats.total === 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-1 border border-border text-muted-foreground text-[11px]">
                    <Info className="size-3.5 shrink-0" />
                    <span>This agent currently has no leads in the pipeline.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Working Agent Scope Notice */}
        {!isAdmin && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <ShieldAlert className="size-4 shrink-0" />
            <span>
              Admin leads &amp; other agents' leads are protected and will NOT be touched.
            </span>
          </div>
        )}

        <div className="py-1 space-y-2.5">
          <p className="text-xs font-semibold text-foreground">
            Choose Deletion Rule:{" "}
            <span className="text-rose-400 font-normal text-[11px]">
              * (Click an option to select)
            </span>
          </p>
          <RadioGroup
            value={selectedOption}
            onValueChange={(v) => setSelectedOption(v as ClearScope)}
            className="space-y-2 max-h-52 overflow-y-auto pr-1"
          >
            {options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              const Icon = opt.icon;
              return (
                <Label
                  key={opt.id}
                  htmlFor={opt.id}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-rose-500/60 bg-rose-500/10 shadow-sm"
                      : "border-border/60 bg-surface-2/40 hover:bg-surface-2/80"
                  }`}
                >
                  <RadioGroupItem value={opt.id} id={opt.id} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? "text-rose-300" : "text-foreground"
                        }`}
                      >
                        {opt.title}
                      </span>
                      <Icon
                        className={`size-3.5 ${
                          isSelected ? "text-rose-400" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {opt.desc}
                    </p>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        </div>

        {/* Delete Impact Summary Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2/80 border border-border/80 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-violet-400" />
            <span className="text-muted-foreground font-medium">Selected for Deletion:</span>
          </div>
          <Badge
            variant="outline"
            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg ${
              selectedOption && targetLeads.length > 0
                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                : "border-border text-muted-foreground"
            }`}
          >
            {!selectedOption
              ? "None (Please select a rule above)"
              : `${targetLeads.length} lead${targetLeads.length !== 1 ? "s" : ""}`}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExecuteClear}
            disabled={isDeleting || !selectedOption || targetLeads.length === 0}
            className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="size-3.5" />
            {isDeleting
              ? "Deleting..."
              : !selectedOption
              ? "Select an Option Above"
              : `Delete ${targetLeads.length} Lead${targetLeads.length !== 1 ? "s" : ""} Now`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

