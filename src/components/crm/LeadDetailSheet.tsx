import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Building2, Mail, Phone, StickyNote, UserRound } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { agents, statusLabels, type Lead, type LeadStatus } from "@/lib/crm-data";
import { statusTone, useCrm } from "@/lib/crm-store";

export function LeadDetailSheet({
  lead,
  onOpenChange,
}: {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateLead, addNote } = useCrm();
  const [note, setNote] = useState("");

  if (!lead) return null;

  return (
    <Sheet open={!!lead} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{lead.name}</SheetTitle>
          <SheetDescription>
            {lead.company} · Deal value ${lead.value.toLocaleString()}
          </SheetDescription>
          <Badge variant="outline" className={`mt-1 w-fit rounded-full ${statusTone[lead.status]}`}>
            {statusLabels[lead.status]}
          </Badge>
        </SheetHeader>

        <Tabs defaultValue="details" className="px-4 pb-8">
          <TabsList className="grid w-full grid-cols-3 rounded-xl">
            <TabsTrigger value="details" className="rounded-lg">
              Details
            </TabsTrigger>
            <TabsTrigger value="edit" className="rounded-lg">
              Edit
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-lg">
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-5 space-y-4">
            {[
              [Mail, "Email", lead.email],
              [Phone, "Phone", lead.phone],
              [Building2, "Company", lead.company],
              [UserRound, "Assigned agent", lead.agent],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Mail;
              return (
                <div key={label as string} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
                    <I className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label as string}</p>
                    <p className="truncate text-sm font-medium">{value as string}</p>
                  </div>
                </div>
              );
            })}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Last contact</p>
                <p className="text-sm font-medium">
                  {new Date(lead.lastContact).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Next follow-up</p>
                <p className="text-sm font-medium">
                  {new Date(lead.nextFollowUp).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={lead.status}
                onValueChange={async (v) => {
                  updateLead(lead.id, { status: v as LeadStatus });
                  try {
                    await supabase.from("leads").update({ status: v }).eq("id", lead.id);
                    toast.success(`Lead status updated to ${statusLabels[v as LeadStatus] ?? v}`);
                  } catch (e) {
                    console.error("Supabase lead status update error:", e);
                  }
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned agent</Label>
              <Select
                value={lead.agent}
                onValueChange={(v) => {
                  updateLead(lead.id, { agent: v });
                  toast.success("Lead reassigned");
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                className="rounded-xl"
                defaultValue={lead.email}
                onBlur={(e) => updateLead(lead.id, { email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                className="rounded-xl"
                defaultValue={lead.phone}
                onBlur={(e) => updateLead(lead.id, { phone: e.target.value })}
              />
            </div>
            <Button className="w-full rounded-xl" onClick={() => toast.success("Lead saved")}>
              Save changes
            </Button>
          </TabsContent>

          <TabsContent value="notes" className="mt-5 space-y-4">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this lead…"
              className="min-h-24 rounded-xl"
            />
            <Button
              className="rounded-xl"
              disabled={!note.trim()}
              onClick={() => {
                addNote(lead.id, note.trim());
                setNote("");
                toast.success("Note added");
              }}
            >
              <StickyNote className="size-4" /> Add note
            </Button>
            <div className="space-y-2">
              {lead.notes.map((n, i) => (
                <p key={i} className="rounded-xl border border-border bg-surface-2/60 p-3 text-sm">
                  {n}
                </p>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
