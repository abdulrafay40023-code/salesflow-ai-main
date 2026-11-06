import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, CheckCircle2, Clock, Mail, Sparkles, User, XCircle, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { confirmMeetingBookingFn, cancelMeetingBookingFn, getAgentBookedSlotsFn } from "@/lib/server-actions";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Schedule a 1-on-1 Strategy Session — AMZ Solutions Hub" },
      { name: "description", content: "Select your preferred date & time for a 1-on-1 strategy session with our senior eCommerce specialist." },
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

  const [bookedMeetingId, setBookedMeetingId] = useState<string | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [sessionCancelled, setSessionCancelled] = useState(false);
  const [confirmedTimeLabel, setConfirmedTimeLabel] = useState("");

  // Check if slot is in the past for today's date
  const now = new Date();
  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();

  function isSlotPastToday(slotVal: string) {
    if (!date || date !== todayDateStr) return false;
    const parts = slotVal.split(":").map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    // If booking late at night (>= 6 PM) and picking a midnight/early AM slot (00:00 - 05:55),
    // it refers to upcoming tonight past midnight, so it is NOT in the past!
    if (now.getHours() >= 18 && h < 6) return false;
    return h * 60 + m <= nowTotalMinutes;
  }

  function isSlotBooked(slotVal: string) {
    if (!date || bookedSlots.length === 0) return false;
    const dateParts = date.split("-").map(Number);
    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];
    const parts = slotVal.split(":").map(Number);
    const hourVal = parts[0] ?? 0;
    const minVal = parts[1] ?? 0;
    if (!year || !month || !day || isNaN(hourVal) || isNaN(minVal)) return false;

    let slotDate = new Date(year, month - 1, day, hourVal, minVal, 0);
    if (slotDate.getTime() < Date.now() && hourVal < 6 && now.getHours() >= 18) {
      slotDate = new Date(year, month - 1, day + 1, hourVal, minVal, 0);
    }
    const slotTimeMs = slotDate.getTime();

    return bookedSlots.some((iso) => {
      const mTime = new Date(iso).getTime();
      return !isNaN(mTime) && mTime === slotTimeMs;
    });
  }


  // Capture client real IP & location when visiting booking page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetEmail = params.get("email") || email;
    if (!targetEmail) return;

    fetch("https://ipwho.is/")
      .then((r) => r.json())
      .then(async (geoData) => {
        const clientIp = geoData?.ip;
        if (!clientIp) return;

        let locParts: string[] = [];
        if (geoData.country) locParts.push(geoData.country);
        if (geoData.region && geoData.region !== geoData.country) locParts.push(geoData.region);
        if (geoData.city && geoData.city !== geoData.region) locParts.push(geoData.city);

        const loc = locParts.length > 0 ? locParts.join(" / ") : "Online";

        const { data: lead } = await supabase
          .from("leads")
          .select("id, notes")
          .ilike("email", targetEmail)
          .maybeSingle();

        if (lead) {
          const existingNotes = Array.isArray(lead.notes) ? lead.notes : [];
          const filteredNotes = existingNotes.filter((n: string) => !n.startsWith("🌐 IP:"));
          const newNote = `🌐 IP: ${clientIp} | Location: ${loc} | Viewed: ${new Date().toISOString()}`;
          await supabase
            .from("leads")
            .update({ notes: [...filteredNotes, newNote] })
            .eq("id", lead.id);
        }
      })
      .catch(() => {});
  }, [email]);

  // Fetch booked slots for the selected agent and date
  useEffect(() => {
    if (!date) return;
    getAgentBookedSlotsFn({ data: { agentEmail, date } })
      .then((res) => {
        if (res?.success && Array.isArray(res.bookedSlots)) {
          setBookedSlots(res.bookedSlots);
        } else {
          setBookedSlots([]);
        }
      })
      .catch(() => setBookedSlots([]));
  }, [date, agentEmail]);

  // Auto pre-fill from query params if available
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    const nameParam = params.get("name");
    const agentParam = params.get("agent");
    const confirmedParam = params.get("confirmed") || params.get("booked");
    if (emailParam) setEmail(emailParam);
    if (nameParam) setName(nameParam);
    if (agentParam) setAgentEmail(agentParam);
    if (confirmedParam === "true" || confirmedParam === "1") {
      setBooked(true);
      setDate(new Date().toISOString().split("T")[0] || "");
      setConfirmedTimeLabel("10:00 AM");
    }
  }, []);

  function handleTimeChange(newTime: string) {
    if (isSlotPastToday(newTime)) {
      toast.error("This time slot has already passed for today. Please choose an upcoming time.");
      return;
    }
    if (isSlotBooked(newTime)) {
      setConflictModalOpen(true);
      return;
    }
    setTime(newTime);
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !date || !time) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (isSlotBooked(time)) {
      setConflictModalOpen(true);
      return;
    }

    // Calculate exact ISO string in user's browser timezone
    const dateParts = date.split("-").map(Number);
    const year = dateParts[0] ?? now.getFullYear();
    const month = dateParts[1] ?? (now.getMonth() + 1);
    const day = dateParts[2] ?? now.getDate();
    const timeParts = time.split(":").map(Number);
    const hourVal = timeParts[0] ?? 0;
    const minVal = timeParts[1] ?? 0;
    let localMeetingDate = new Date(year, month - 1, day, hourVal, minVal, 0);

    // Smart midnight rollover: If booked late at night (>= 6 PM) for midnight/early AM (00:00 - 05:55),
    // automatically roll over to tonight's midnight (+1 day)
    if (localMeetingDate.getTime() < Date.now() && hourVal < 6 && now.getHours() >= 18) {
      localMeetingDate = new Date(year, month - 1, day + 1, hourVal, minVal, 0);
    }

    if (localMeetingDate.getTime() < Date.now() - 60000) {
      toast.error("The selected time slot has already passed. Please select an upcoming time.");
      return;
    }

    setLoading(true);
    try {
      // Format time as 12-hour AM/PM for emails & confirmation UI
      const timeSplit = time.split(":");
      const hourStr = timeSplit[0] ?? "0";
      const minStr = timeSplit[1] ?? "00";
      const hour = parseInt(hourStr, 10);
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const formattedTime = `${displayHour.toString().padStart(2, "0")}:${minStr} ${period}`;
      setConfirmedTimeLabel(formattedTime);

      const scheduledIso = localMeetingDate.toISOString();
      const effectiveYear = localMeetingDate.getFullYear();
      const effectiveMonth = String(localMeetingDate.getMonth() + 1).padStart(2, "0");
      const effectiveDay = String(localMeetingDate.getDate()).padStart(2, "0");
      const effectiveDateStr = `${effectiveYear}-${effectiveMonth}-${effectiveDay}`;

      const res = await confirmMeetingBookingFn({
        data: {
          leadEmail: email,
          leadName: name || email.split("@")[0] || "",
          date: effectiveDateStr,
          time: formattedTime,
          scheduledIso,
          agentEmail: agentEmail || "garryamelia6265@gmail.com",
        },
      });

      if (res.success) {
        setBooked(true);
        setSessionCancelled(false);
        if (res.meetingId) setBookedMeetingId(res.meetingId);
        toast.success("Meeting booked & confirmation emails sent!");

        // Trigger reminder check immediately (handles meetings starting within 5m)
        fetch("/api/check-reminders", { method: "POST" }).catch(() => {});

        const diffMs = localMeetingDate.getTime() - Date.now();

        // If meeting starts in > 24h, schedule trigger at exactly 24h prior
        const msUntil24h = diffMs - 24 * 60 * 60 * 1000;
        if (msUntil24h > 0 && msUntil24h <= 48 * 60 * 60 * 1000) {
          setTimeout(() => {
            fetch("/api/check-reminders", { method: "POST" }).catch(() => {});
          }, msUntil24h);
        }

        // If meeting starts in > 1h, schedule trigger at exactly 1h prior
        const msUntil1h = diffMs - 60 * 60 * 1000;
        if (msUntil1h > 0 && msUntil1h <= 48 * 60 * 60 * 1000) {
          setTimeout(() => {
            fetch("/api/check-reminders", { method: "POST" }).catch(() => {});
          }, msUntil1h);
        }

        // If meeting starts in > 5m, schedule trigger at exactly 5m prior
        const msUntil5m = diffMs - 5 * 60 * 1000;
        if (msUntil5m > 0 && msUntil5m <= 48 * 60 * 60 * 1000) {
          setTimeout(() => {
            fetch("/api/check-reminders", { method: "POST" }).catch(() => {});
          }, msUntil5m);
        }

        // Schedule trigger at exact meeting start time
        if (diffMs > 0 && diffMs <= 48 * 60 * 60 * 1000) {
          setTimeout(() => {
            fetch("/api/check-reminders", { method: "POST" }).catch(() => {});
          }, diffMs);
        }
      } else {
        toast.error(res.error || "Failed to book meeting");
      }
    } catch (err: any) {
      toast.error(err?.message || "Booking failed");
    }
    setLoading(false);
  }

  async function handleCancelCurrentSession() {
    try {
      const payload: { meetingId?: string; leadEmail?: string; cancelledBy?: "client" | "agent" } = {
        leadEmail: email,
        cancelledBy: "client",
      };
      if (bookedMeetingId) payload.meetingId = bookedMeetingId;
      await cancelMeetingBookingFn({
        data: payload,
      });
      setSessionCancelled(true);
      setManageModalOpen(false);
      toast.success("Your meeting session has been cancelled.");
    } catch (e: any) {
      toast.error("Failed to cancel meeting session: " + e.message);
    }
  }

  function handleBookAnotherSession() {
    setManageModalOpen(false);
    setBooked(false);
    setSessionCancelled(false);
    setBookedMeetingId(null);
  }

  function handleCloseToMailbox() {
    const userEmail = (email || "").toLowerCase().trim();
    if (userEmail.endsWith("@gmail.com") || userEmail.endsWith("@googlemail.com")) {
      window.location.href = "https://mail.google.com";
    } else if (userEmail.endsWith("@outlook.com") || userEmail.endsWith("@hotmail.com") || userEmail.endsWith("@live.com")) {
      window.location.href = "https://outlook.live.com";
    } else if (userEmail.endsWith("@yahoo.com")) {
      window.location.href = "https://mail.yahoo.com";
    } else {
      window.location.href = "https://mail.google.com";
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-4.5" />
            </span>
            <span className="font-display text-xl font-bold">AMZ Solutions Hub</span>
          </div>

          {booked && (
            <button
              type="button"
              onClick={handleCloseToMailbox}
              className="flex items-center justify-center size-8 rounded-lg bg-accent/50 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-border transition-colors"
              title="Close and return to mailbox"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {booked ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            {sessionCancelled ? (
              <>
                <div className="grid size-16 place-items-center rounded-full bg-rose-500/20 text-rose-500">
                  <XCircle className="size-10" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Meeting Session Cancelled</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Your scheduled session for <span className="font-semibold text-foreground">{email}</span> has been cancelled. All upcoming reminder emails have been stopped.
                </p>
              </>
            ) : (
              <>
                <div className="grid size-16 place-items-center rounded-full bg-emerald-500/20 text-emerald-500">
                  <CheckCircle2 className="size-10" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Meeting Confirmed!</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  A confirmation email has been sent to <span className="font-semibold text-foreground">{email}</span> and our senior strategy team.
                </p>
              </>
            )}

            <div className="rounded-xl border border-border bg-accent/40 p-4 text-xs space-y-1 w-full max-w-sm text-left">
              <p>🗓️ <strong>Date:</strong> {date}</p>
              <p>⏰ <strong>Time:</strong> {confirmedTimeLabel || time}</p>
              <p>📧 <strong>Notifications:</strong> {sessionCancelled ? "Cancelled — all future email reminders stopped" : "24h, 1h, 5m & meeting-start email reminders active"}</p>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button
                variant="outline"
                className="rounded-xl w-full sm:w-auto"
                onClick={() => setManageModalOpen(true)}
              >
                Book Another Session
              </Button>
            </div>

            {/* Website Link & Button */}
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground text-center">
              <span>Need more information? Visit our Website</span>
              <a
                href="https://www.amzsolutionshub.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                <span>AMZ Solutions Hub</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
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
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className="flex h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {TIME_SLOTS.map((s) => {
                        const isTaken = isSlotBooked(s.value);
                        const isPast = isSlotPastToday(s.value);
                        const isDisabled = isTaken || isPast;
                        return (
                          <option
                            key={s.value}
                            value={s.value}
                            disabled={isDisabled}
                            className={isTaken ? "text-rose-500 bg-rose-50 font-medium" : isPast ? "text-slate-400 opacity-50" : ""}
                          >
                            {s.label} {isTaken ? "🚫 (Already Booked)" : isPast ? "⏱ (Passed Today)" : ""}
                          </option>
                        );
                      })}
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

      {/* Double-Booking Conflict Alert Modal */}
      <Dialog open={conflictModalOpen} onOpenChange={setConflictModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-rose-500/30">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 mb-2">
              <XCircle className="h-6 w-6 text-rose-500" />
            </div>
            <DialogTitle className="font-display text-lg text-center text-rose-500">
              Time Slot Already Booked
            </DialogTitle>
            <DialogDescription className="text-sm text-center text-slate-300">
              This time slot is already booked for this agent. Please select a different time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className="rounded-xl px-6"
              onClick={() => setConflictModalOpen(false)}
            >
              Choose Another Time Slot
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* "Book Another Session" Modal with Cancel Option & Book Option */}
      <Dialog open={manageModalOpen} onOpenChange={setManageModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Manage Your Meeting Session</DialogTitle>
            <DialogDescription className="text-xs">
              What would you like to do with your booking?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Option A: Cancel Current Session */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
              <p className="text-xs font-bold text-rose-500">Option A: Cancel my current session</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cancels your currently booked meeting slot and stops all future 24h, 1h, and 5m reminder emails.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="w-full rounded-xl mt-1 text-xs font-semibold"
                onClick={handleCancelCurrentSession}
              >
                🚫 Cancel My Current Session
              </Button>
            </div>

            {/* Option B: Book Another Session */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-bold text-primary">Option B: Book another session</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Keep your current booking active and proceed to schedule an additional new meeting slot.
              </p>
              <Button
                variant="default"
                size="sm"
                className="w-full rounded-xl mt-1 text-xs font-semibold"
                onClick={handleBookAnotherSession}
              >
                📅 Book Another Session →
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
