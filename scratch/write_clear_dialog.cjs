const fs = require('fs');

const code = `import { useState, useMemo } from "react";
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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { type Lead } from "@/lib/crm-data";
import { Trash2, AlertTriangle, Calendar, Filter, Sparkles, CheckCircle2, ShieldAlert } from "lucide-react";

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
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter leads based on agent permission and selected rule
  const targetLeads = useMemo(() => {
    // 1. Working Agent can ONLY delete their own assigned leads
    let baseLeads = [...leads];
    if (!isAdmin && userEmail) {
      baseLeads = baseLeads.filter(
        (l) => (l.agent || "").trim().toLowerCase() === userEmail.trim().toLowerCase()
      );
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysAgo = todayStart - 7 * 86400000;

    return baseLeads.filter((l) => {
      const d = new Date(l.source_date || l.lastContact || Date.now()).getTime();

      switch (selectedOption) {
        case "today":
          return d >= todayStart;
        case "yesterday":
          return d >= yesterdayStart && d < todayStart;
        case "today_and_yesterday":
          return d >= yesterdayStart;
        case "older_7_days":
          return d < sevenDaysAgo;
        case "only_new":
          return l.status === "new";
        case "only_unresponsive":
          return l.status === "no_answer" || l.status === "contacted" || l.status === "cancelled";
        case "all":
        default:
          return true;
      }
    });
  }, [leads, isAdmin, userEmail, selectedOption]);

  async function handleExecuteClear() {
    if (!targetLeads.length) {
      toast.info("No leads match the selected rule to delete.");
      return;
    }

    setIsDeleting(true);
    try {
      const targetIds = targetLeads.map((l) => l.id);
      const targetEmails = targetLeads.map((l) => l.email).filter((em) => em && em !== "—");

      // 1. Delete matching leads from Supabase
      const { error: leadsErr } = await supabase.from("leads").delete().in("id", targetIds);
      if (leadsErr) throw leadsErr;

      // 2. Clean up scheduled emails / reminders so NO emails are sent
      if (targetEmails.length > 0) {
        await supabase.from("emails_sent").delete().in("lead_email", targetEmails);
        // Also cancel matching meetings
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
      title: "💥 Delete ALL Leads in Pipeline (Full Wipe)",
      desc: "Deletes every lead matching your scope. Use with caution!",
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
              <DialogTitle className="text-lg font-bold">Clear Leads from Pipeline</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isAdmin ? (
                  <span>Select which date range or status rule to delete across the CRM.</span>
                ) : (
                  <span className="text-amber-300 font-semibold">
                    🔒 Working Agent Mode: Only leads assigned to your dashboard will be deleted.
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scope Notice */}
        {!isAdmin && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <ShieldAlert className="size-4 shrink-0" />
            <span>Admin leads &amp; other agents' leads are protected and will NOT be touched.</span>
          </div>
        )}

        <div className="py-2 space-y-3">
          <p className="text-xs font-semibold text-foreground">Choose Deletion Rule:</p>
          <RadioGroup
            value={selectedOption}
            onValueChange={(v) => setSelectedOption(v as ClearScope)}
            className="space-y-2"
          >
            {options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              const Icon = opt.icon;
              return (
                <Label
                  key={opt.id}
                  htmlFor={opt.id}
                  className={\`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all \${
                    isSelected
                      ? "border-rose-500/60 bg-rose-500/10 shadow-sm"
                      : "border-border/60 bg-surface-2/40 hover:bg-surface-2/80"
                  }\`}
                >
                  <RadioGroupItem value={opt.id} id={opt.id} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={\`text-xs font-bold \${isSelected ? "text-rose-300" : "text-foreground"}\`}>
                        {opt.title}
                      </span>
                      <Icon className={\`size-3.5 \${isSelected ? "text-rose-400" : "text-muted-foreground"}\`} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
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

fs.writeFileSync('src/components/crm/ClearLeadsDialog.tsx', code, 'utf8');
console.log('src/components/crm/ClearLeadsDialog.tsx created successfully!');