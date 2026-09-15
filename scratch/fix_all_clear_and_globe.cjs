const fs = require('fs');

// ==========================================
// 1. FIX Globe import in src/components/crm/ImportLeadsDialog.tsx
// ==========================================
const importDialogPath = 'src/components/crm/ImportLeadsDialog.tsx';
let importCode = fs.readFileSync(importDialogPath, 'utf8');

// Replace lucide imports to include Globe
importCode = importCode.replace(
  'import { CheckCircle2, FileSpreadsheet, Upload, X, Loader2, UserCheck, ShieldAlert, Sparkles, Shuffle, Users } from "lucide-react";',
  'import { CheckCircle2, FileSpreadsheet, Upload, X, Loader2, UserCheck, ShieldAlert, Sparkles, Shuffle, Users, Globe } from "lucide-react";'
);

fs.writeFileSync(importDialogPath, importCode, 'utf8');
console.log('Fixed Globe import in ImportLeadsDialog.tsx!');

// ==========================================
// 2. UPGRADE src/components/crm/ClearLeadsDialog.tsx
// ==========================================
const clearDialogPath = 'src/components/crm/ClearLeadsDialog.tsx';
const clearDialogFullCode = `import { useState, useMemo } from "react";
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
import { type Lead } from "@/lib/crm-data";
import { notifyAdminLeadsClearedFn } from "@/lib/server-actions";
import {
  Trash2,
  AlertTriangle,
  Calendar,
  Filter,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";

export type ClearScope =
  | "today"
  | "yesterday"
  | "today_and_yesterday"
  | "older_7_days"
  | "only_new"
  | "only_unresponsive"
  | "all";

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
  const [selectedOption, setSelectedOption] = useState<ClearScope>("all");
  const [adminTargetScope, setAdminTargetScope] = useState<string>("ALL_CRM");
  const [isDeleting, setIsDeleting] = useState(false);

  // Extract list of distinct agents present in current leads
  const distinctAgents = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.agent && l.agent !== "Unassigned") set.add(l.agent);
    });
    return Array.from(set);
  }, [leads]);

  // Filter leads based on agent permission and selected rule
  const targetLeads = useMemo(() => {
    let baseLeads = [...leads];

    // 1. Permission Scope Filtering
    if (!isAdmin && userEmail) {
      // Working Agent: strictly lock to user's assigned leads
      const myEm = userEmail.trim().toLowerCase();
      baseLeads = baseLeads.filter(
        (l) => (l.agent || "").trim().toLowerCase() === myEm
      );
    } else if (isAdmin) {
      // Admin can filter by Admin Pool, specific agent, or All CRM
      if (adminTargetScope === "ADMIN_POOL") {
        baseLeads = baseLeads.filter(
          (l) =>
            (l.agent || "").toLowerCase().includes("garry") ||
            (l.agent || "").toLowerCase().includes("admin") ||
            l.agent === "Unassigned"
        );
      } else if (adminTargetScope !== "ALL_CRM") {
        baseLeads = baseLeads.filter(
          (l) => (l.agent || "").trim().toLowerCase() === adminTargetScope.trim().toLowerCase()
        );
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
            l.status === "cancelled"
          );
        case "all":
        default:
          return true;
      }
    });
  }, [leads, isAdmin, userEmail, adminTargetScope, selectedOption]);

  async function handleExecuteClear() {
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
            .ilike("title", \`%\${em}%\`);
        }
      }

      toast.success(
        \`🗑️ Successfully deleted \${targetLeads.length} lead(s)! Pending emails/reminders cancelled.\`
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
      desc: "Deletes every lead matching the selected agent scope. Use with caution!",
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
                  <span>
                    Select the target agent pool and date range to delete.
                  </span>
                ) : (
                  <span className="text-amber-300 font-semibold">
                    🔒 Working Agent Mode: Only leads assigned to your dashboard will be deleted.
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Admin Scope Selector: All CRM vs Admin Pool vs Specific Agent */}
        {isAdmin && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-2/70 border border-border/80 text-xs">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-violet-400" />
              <div>
                <span className="font-semibold text-foreground">Target Pipeline Scope:</span>
                <p className="text-[10px] text-muted-foreground">Choose which pool to clear</p>
              </div>
            </div>
            <Select value={adminTargetScope} onValueChange={setAdminTargetScope}>
              <SelectTrigger className="h-8 w-48 rounded-xl text-xs bg-surface-1 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_CRM">🌐 Entire CRM Pipeline</SelectItem>
                <SelectItem value="ADMIN_POOL">👑 Admin Pool Only</SelectItem>
                {distinctAgents.map((ag) => (
                  <SelectItem key={ag} value={ag}>
                    👤 {ag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <p className="text-xs font-semibold text-foreground">Choose Deletion Rule:</p>
          <RadioGroup
            value={selectedOption}
            onValueChange={(v) => setSelectedOption(v as ClearScope)}
            className="space-y-2 max-h-56 overflow-y-auto pr-1"
          >
            {options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              const Icon = opt.icon;
              return (
                <Label
                  key={opt.id}
                  htmlFor={opt.id}
                  className={\`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all \${
                    isSelected
                      ? "border-rose-500/60 bg-rose-500/10 shadow-sm"
                      : "border-border/60 bg-surface-2/40 hover:bg-surface-2/80"
                  }\`}
                >
                  <RadioGroupItem value={opt.id} id={opt.id} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={\`text-xs font-bold \${
                          isSelected ? "text-rose-300" : "text-foreground"
                        }\`}
                      >
                        {opt.title}
                      </span>
                      <Icon
                        className={\`size-3.5 \${
                          isSelected ? "text-rose-400" : "text-muted-foreground"
                        }\`}
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
            className={\`text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg \${
              targetLeads.length > 0
                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                : "border-border text-muted-foreground"
            }\`}
          >
            {targetLeads.length} lead{targetLeads.length !== 1 ? "s" : ""}
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
            disabled={isDeleting || targetLeads.length === 0}
            className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Trash2 className="size-3.5" />
            {isDeleting
              ? "Deleting..."
              : \`Delete \${targetLeads.length} Lead\${targetLeads.length !== 1 ? "s" : ""} Now\`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
`;

fs.writeFileSync(clearDialogPath, clearDialogFullCode, 'utf8');
console.log('Upgraded ClearLeadsDialog.tsx with Admin Scope Selector and accurate Date filters!');