import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, CheckCircle2, Clock, Mail, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { confirmMeetingBookingFn } from "@/lib/server-actions";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Schedule a Sales Meeting — Nexa CRM" },
      { name: "description", content: "Select your preferred date & time for a meeting with our sales team." },
    ],
  }),
  component: BookingPage,
});

function generate24HourTimeSlots() {
  const slots: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 5) {
      const hStr = hour.toString().padStart(2, "0");
      const mStr = min.toString().padStart(2, "0");
      const value = `${hStr}:${mStr}`;

      const period = hour >= 12 ? "PM" : "AM";
      let displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12;
      const displayHStr = displayHour.toString().padStart(2, "0");

      let tag = "";
      if (hour === 0 && min === 0) tag = " (Midnight)";
      else if (hour === 12 && min === 0) tag = " (Noon)";

      const label = `${displayHStr}:${mStr} ${period}${tag}`;
      slots.push({ value, label });
    }
  }
  return slots;
}

const TIME_SLOTS = generate24HourTimeSlots();

function BookingPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [agentEmail, setAgentEmail] = useState("garryamelia6265@gmail.com");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);

  const [confirmedTimeLabel, setConfirmedTimeLabel] = useState("");

  // Auto pre-fill from query params if available
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    const nameParam = params.get("name");
    const agentParam = params.get("agent");
    if (emailParam) setEmail(emailParam);
    if (nameParam) setName(nameParam);
    if (agentParam) setAgentEmail(agentParam);
  }, []);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !date || !time) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      // Format time as 12-hour AM/PM for emails & confirmation UI
      const [hourStr, minStr] = time.split(":");
      const hour = parseInt(hourStr, 10);
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const formattedTime = `${displayHour.toString().padStart(2, "0")}:${minStr} ${period}`;
      setConfirmedTimeLabel(formattedTime);

      const res = await confirmMeetingBookingFn({
        data: {
          leadEmail: email,
          leadName: name || email.split("@")[0],
          date: date,
          time: formattedTime,
          rawTime: time,
          agentEmail: agentEmail,
        },
      });

      if (res.success) {
        setBooked(true);
        toast.success("Meeting booked & confirmation emails sent!");
      } else {
        toast.error(res.error || "Failed to book meeting");
      }
    } catch (err: any) {
      toast.error(err?.message || "Booking failed");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-4.5" />
          </span>
          <span className="font-display text-xl font-bold">Nexa CRM</span>
        </div>

        {booked ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="grid size-16 place-items-center rounded-full bg-emerald-500/20 text-emerald-500">
              <CheckCircle2 className="size-10" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Meeting Confirmed!</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              A confirmation email has been sent to <span className="font-semibold text-foreground">{email}</span> and your assigned sales representative.
            </p>
            <div className="rounded-xl border border-border bg-accent/40 p-4 text-xs space-y-1 w-full max-w-sm text-left">
              <p>🗓️ <strong>Date:</strong> {date}</p>
              <p>⏰ <strong>Time:</strong> {confirmedTimeLabel || time}</p>
              <p>📧 <strong>Notifications:</strong> 1-day & 1-hour email reminders active</p>
            </div>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setBooked(false)}>
              Book Another Session
            </Button>
          </div>
        ) : (
          <form onSubmit={handleBook} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Schedule Your Sales Meeting</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Choose any date and 24-hour time slot for your meeting with our team.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Your Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Select Date *</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="date"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="pl-9 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Select Time Slot (24h AM/PM) *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="flex h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {TIME_SLOTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-base font-semibold">
              {loading ? "Confirming Meeting..." : "Confirm & Send Reminders 🚀"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
