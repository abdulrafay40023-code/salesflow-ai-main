import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Phone,
  Mail as MailIcon,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/crm/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { FollowUp } from "@/lib/crm-data";
import { useCrm } from "@/lib/crm-store";

export const Route = createFileRoute("/_app/follow-ups")({
  head: () => ({
    meta: [
      { title: "Follow-ups & Meetings — Nexa CRM" },
      {
        name: "description",
        content:
          "Schedule follow-ups and meetings, pick date and time, and track reminders due today, tomorrow and this week.",
      },
      { property: "og:title", content: "Follow-ups & Meetings — Nexa CRM" },
      {
        property: "og:description",
        content: "Never miss a reminder: upcoming and completed follow-ups in one place.",
      },
    ],
  }),
  component: FollowUpsPage,
});

const typeIcon = { call: Phone, meeting: Users, email: MailIcon };

function dayBucket(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.floor((d.getTime() - startOfToday) / 86400000);
  if (diff < 0) return "past";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "later";
}

function ReminderCard({ f, onToggle }: { f: FollowUp; onToggle: () => void }) {
  const Icon = typeIcon[f.type];
  const bucket = dayBucket(f.datetime);
  const tone =
    bucket === "today"
      ? "border-warning/40 bg-warning/8"
      : bucket === "tomorrow"
        ? "border-info/40 bg-info/8"
        : "border-border bg-card";

  return (
    <div
      className={`rounded-2xl border p-4 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] ${tone}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{f.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {f.leadName} · {f.company}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 rounded-full capitalize">
          {f.type}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock3 className="size-3.5" />
          {new Date(f.datetime).toLocaleString([], {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span>{f.agent}</span>
      </div>

      <Button
        variant={f.completed ? "secondary" : "outline"}
        size="sm"
        className="mt-4 w-full rounded-xl"
        onClick={onToggle}
      >
        <CheckCircle2 className="size-4" />
        {f.completed ? "Completed" : "Mark complete"}
      </Button>
    </div>
  );
}

function FollowUpsPage() {
  const { visibleFollowUps, toggleFollowUp, addFollowUp, visibleLeads, user } = useCrm();
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState(visibleLeads[0]?.id ?? "");
  const [type, setType] = useState<FollowUp["type"]>("call");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");

  const buckets = useMemo(() => {
    const open = visibleFollowUps.filter((f) => !f.completed);
    return {
      today: open.filter((f) => dayBucket(f.datetime) === "today"),
      tomorrow: open.filter((f) => dayBucket(f.datetime) === "tomorrow"),
      week: open.filter((f) => dayBucket(f.datetime) === "week"),
      later: open.filter((f) => dayBucket(f.datetime) === "later"),
      completed: visibleFollowUps.filter((f) => f.completed),
    };
  }, [visibleFollowUps]);

  function schedule() {
    const lead = visibleLeads.find((l) => l.id === leadId);
    if (!lead) return;
    addFollowUp({
      leadId: lead.id,
      leadName: lead.name,
      company: lead.company,
      type,
      title: title.trim() || `${type === "meeting" ? "Meeting" : "Follow-up"} with ${lead.name}`,
      datetime: new Date(`${date}T${time}`).toISOString(),
      agent: user?.role === "agent" ? user.name : lead.agent,
      completed: false,
    });
    toast.success("Follow-up scheduled");
    setOpen(false);
    setTitle("");
  }

  const sections = [
    ["Due today", buckets.today],
    ["Tomorrow", buckets.tomorrow],
    ["This week", buckets.week],
    ["Later", buckets.later],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        subtitle="Schedule calls and meetings, and stay ahead of every reminder."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">
                <CalendarPlus className="size-4" /> Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Schedule a follow-up</DialogTitle>
                <DialogDescription>Pick a lead, type, date and time.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Lead</Label>
                  <Select value={leadId} onValueChange={setLeadId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select a lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleLeads.slice(0, 25).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} — {l.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as FollowUp["type"])}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    className="rounded-xl"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Pricing follow-up"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      className="rounded-xl"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      className="rounded-xl"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button className="rounded-xl" onClick={schedule}>
                  Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Due today", buckets.today.length, "warning"],
          ["Tomorrow", buckets.tomorrow.length, "info"],
          ["This week", buckets.week.length, "primary"],
          ["Completed", buckets.completed.length, "success"],
        ].map(([label, count, tone]) => (
          <div key={label as string} className="panel p-5">
            <p className="text-sm text-muted-foreground">{label as string}</p>
            <p className={`mt-2 font-display text-3xl font-bold text-${tone as string}`}>
              {count as number}
            </p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="rounded-xl">
          <TabsTrigger value="upcoming" className="rounded-lg">
            Upcoming reminders
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg">
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-5 space-y-8">
          {sections.map(([label, items]) =>
            items.length ? (
              <section key={label}>
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <CalendarClock className="size-4 text-primary" /> {label}
                  <Badge variant="secondary" className="rounded-full">
                    {items.length}
                  </Badge>
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((f) => (
                    <ReminderCard key={f.id} f={f} onToggle={() => toggleFollowUp(f.id)} />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {buckets.completed.map((f) => (
              <ReminderCard key={f.id} f={f} onToggle={() => toggleFollowUp(f.id)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
