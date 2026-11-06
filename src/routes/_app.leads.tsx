import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { ArrowUpDown, Filter, RefreshCw, Search, SlidersHorizontal, Users, UserCheck, Calendar, Trash2, PhoneCall, PhoneOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/crm/Topbar";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { LeadDetailSheet } from "@/components/crm/LeadDetailSheet";
import { AiCallDialog } from "@/components/crm/AiCallDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { isAdminEmail, ADMIN_EMAILS, ALL_STATUSES, statusLabels, type Lead, type LeadStatus } from "@/lib/crm-data";
import { detectCountryFromPhone, formatPhoneWithCountryCode, SUPPORTED_COUNTRIES, getCountryByCode, changeCountryOnPhone, parseCountryString } from "@/lib/country-helper";
import { CountryCombobox } from "@/components/crm/CountryCombobox";
import { startVapiPhoneCallFn, getVapiCallStatusFn, stopVapiCallFn, processVapiCallBookingFn, getVapiCallLogsFn, computeCallDurationSecs } from "@/lib/server-actions";
import { ClearLeadsDialog } from "@/components/crm/ClearLeadsDialog";
import { AllCallRecordingsDialog } from "@/components/crm/AllCallRecordingsDialog";
import { Globe, MapPin, Headphones } from "lucide-react";
import { statusTone, useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Teals CRM" },
      {
        name: "description",
        content:
          "Search, filter, sort and manage every lead: contact details, status, assigned agent, follow-ups and notes.",
      },
      { property: "og:title", content: "Leads — Teals CRM" },
    ],
  }),
  component: LeadsPage,
});

const PRIMARY_ADMIN_EMAIL = "garryamelia6265@gmail.com";

type DbLead = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  assigned_agent_name?: string;
  created_at: string;
  last_contact?: string;
  next_follow_up?: string;
  source_date?: string;
  notes?: string[];
  value?: number;
  updated_at?: string;
  booked_at?: string;
  contacted_at?: string;
  won_at?: string;
  country?: string;
  ip_address?: string;
  location?: string;
};

function LeadsPage() {
  const { user } = useCrm();

  const [dbLeads, setDbLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [agent, setAgent] = useState<string>("all");
  const [asc, setAsc] = useState(false); // Default: Newest First
  const [active, setActive] = useState<Lead | null>(null);
  const [approvedAgents, setApprovedAgents] = useState<{ name: string; email: string }[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkTargetAgent, setBulkTargetAgent] = useState<string>(PRIMARY_ADMIN_EMAIL);
  const [isBatchAssigning, setIsBatchAssigning] = useState(false);
  const [callingLead, setCallingLead] = useState<Lead | null>(null);

  // ⚡ 1-Click Power Dialer State & History (LeadId -> CallState & History list)
  type CallHistoryItem = { callId: string; duration: number; status: "completed" | "no_answer"; timestamp: number };
  
  const [activeCalls, setActiveCalls] = useState<
    Record<string, { callId: string; status: "dialing" | "ringing" | "connected" | "ended"; duration: number; startTime?: number }>
  >({});
  const activeCallsRef = useRef<
    Record<string, { callId: string; status: "dialing" | "ringing" | "connected" | "ended"; duration: number; startTime?: number }>
  >({});

  const [callHistoryMap, setCallHistoryMap] = useState<Record<string, CallHistoryItem[]>>({});
  const callHistoryMapRef = useRef<Record<string, CallHistoryItem[]>>({});

  const activePollersRef = useRef<Record<string, any>>({});
  const activeTimersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    return () => {
      Object.values(activePollersRef.current).forEach((p) => clearInterval(p));
      Object.values(activeTimersRef.current).forEach((t) => clearInterval(t));
    };
  }, []);

  function formatDuration(sec: number) {
    if (!sec || sec < 0) return "0:00";
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleStartInlineCall(lead: Lead) {
    const leadId = lead.id;
    const existing = activeCallsRef.current[leadId];
    if (existing?.status === "ringing" || existing?.status === "connected") {
      return;
    }

    const initCall = { callId: "", status: "ringing" as const, duration: 0 };
    activeCallsRef.current[leadId] = initCall;
    setActiveCalls((prev) => ({ ...prev, [leadId]: initCall }));

    toast.info(`📞 Dialing ${lead.name} (${lead.phone})...`);

    try {
      const res = await startVapiPhoneCallFn({
        data: {
          leadId: lead.id,
          leadName: lead.name,
          phoneNumber: lead.phone,
          leadEmail: lead.email !== "—" ? lead.email : undefined,
          agentEmail: lead.agent !== "Unassigned" ? lead.agent : user?.email || PRIMARY_ADMIN_EMAIL,
        },
      });

      if (!res?.success || !res.callId) {
        throw new Error(res?.error || "Failed to initiate outbound call");
      }

      const callId = res.callId;
      const dialStartTime = Date.now();
      const ringingCall = { callId, status: "ringing" as const, duration: 0 };
      activeCallsRef.current[leadId] = ringingCall;
      setActiveCalls((prev) => ({ ...prev, [leadId]: ringingCall }));

      let pollCount = 0;
      activePollersRef.current[leadId] = setInterval(async () => {
        pollCount++;
        try {
          // ⏱️ 45-Second Max Ringing Timeout Check
          const curRing = activeCallsRef.current[leadId];
          if (curRing?.status === "ringing") {
            const ringElapsed = Math.floor((Date.now() - dialStartTime) / 1000);
            if (ringElapsed >= 45) {
              clearInterval(activePollersRef.current[leadId]);
              delete activePollersRef.current[leadId];

              if (activeTimersRef.current[leadId]) {
                clearInterval(activeTimersRef.current[leadId]);
                delete activeTimersRef.current[leadId];
              }

              if (callId) {
                stopVapiCallFn({ data: { callId } }).catch(() => {});
              }

              const prevHistory = callHistoryMapRef.current[leadId] || [];
              const filteredHistory = prevHistory.filter((h) => h.callId !== callId);
              const updatedHistory = [
                ...filteredHistory,
                { callId: callId || `no-ans-${Date.now()}`, duration: 0, status: "no_answer" as const, timestamp: Date.now() },
              ];
              callHistoryMapRef.current[leadId] = updatedHistory;
              setCallHistoryMap((prev) => ({ ...prev, [leadId]: updatedHistory }));

              const endedCall = { callId, status: "ended" as const, duration: 0 };
              activeCallsRef.current[leadId] = endedCall;
              setActiveCalls((prev) => ({ ...prev, [leadId]: endedCall }));

              toast.info(`📞 45s Ringing: No answer from ${lead.name} (Status: No Answer).`);

              await supabase.from("leads").update({ status: "no_answer" }).eq("id", lead.id);
              fetchLeads();

              setTimeout(() => {
                delete activeCallsRef.current[leadId];
                setActiveCalls((prev) => {
                  const copy = { ...prev };
                  delete copy[leadId];
                  return copy;
                });
              }, 3000);
              return;
            }
          }

          const statusRes = await getVapiCallStatusFn({ data: { callId } });
          if (!statusRes?.success) return;

          // 1. Client answered (Status in-progress)
          if (statusRes.status === "in-progress") {
            const current = activeCallsRef.current[leadId];
            if (current && current.status !== "connected") {
              const startTime = Date.now();
              const connectedCall = { callId, status: "connected" as const, duration: 0, startTime };
              activeCallsRef.current[leadId] = connectedCall;
              setActiveCalls((prev) => ({ ...prev, [leadId]: connectedCall }));

              // Live second-by-second timer based on actual timestamp
              if (activeTimersRef.current[leadId]) clearInterval(activeTimersRef.current[leadId]);
              activeTimersRef.current[leadId] = setInterval(() => {
                const cur = activeCallsRef.current[leadId];
                if (cur && cur.status === "connected" && cur.startTime) {
                  const elapsed = Math.floor((Date.now() - cur.startTime) / 1000);
                  activeCallsRef.current[leadId] = { ...cur, duration: elapsed };
                  setActiveCalls((prev) => ({
                    ...prev,
                    [leadId]: { ...cur, duration: elapsed },
                  }));
                }
              }, 1000);
            }
          }

          // 2. Call Ended or No Answer
          const isEnded = statusRes.status === "ended" || Boolean(statusRes.endedReason) || pollCount > 200;
          if (isEnded) {
            clearInterval(activePollersRef.current[leadId]);
            delete activePollersRef.current[leadId];

            if (activeTimersRef.current[leadId]) {
              clearInterval(activeTimersRef.current[leadId]);
              delete activeTimersRef.current[leadId];
            }

            const current = activeCallsRef.current[leadId];
            let finalDuration = 0;
            if (statusRes.duration && statusRes.duration > 0) {
              finalDuration = Math.round(statusRes.duration);
            } else if (current?.startTime) {
              finalDuration = Math.floor((Date.now() - current.startTime) / 1000);
            } else if (current?.duration) {
              finalDuration = current.duration;
            }

            const endedReason = statusRes.endedReason || "";
            const hasTranscript = Boolean(statusRes.transcript && statusRes.transcript.trim().length > 10);
            const isNoAnswer =
              finalDuration === 0 &&
              !hasTranscript &&
              (endedReason === "customer-did-not-answer" ||
                endedReason === "customer-busy" ||
                endedReason === "no-answer");

            const itemStatus: "completed" | "no_answer" = isNoAnswer ? "no_answer" : "completed";

            // Add newest call to top of history list
            const prevHistory = callHistoryMapRef.current[leadId] || [];
            const filteredHistory = prevHistory.filter((h) => h.callId !== callId);
            const updatedHistory = [
              { callId, duration: finalDuration, status: itemStatus, timestamp: Date.now() },
              ...filteredHistory,
            ];
            callHistoryMapRef.current[leadId] = updatedHistory;
            setCallHistoryMap((prev) => ({ ...prev, [leadId]: updatedHistory }));

            const endedCall = { callId, status: "ended" as const, duration: finalDuration };
            activeCallsRef.current[leadId] = endedCall;
            setActiveCalls((prev) => ({ ...prev, [leadId]: endedCall }));

            // Trigger backend booking process & email extraction
            try {
              const bookRes = await processVapiCallBookingFn({
                data: {
                  callId,
                  leadId: lead.id,
                  leadEmail: lead.email !== "—" ? lead.email : undefined,
                },
              });

              if (bookRes?.booked) {
                toast.success(
                  `🎉 Demo Booked with ${lead.name}! Meeting confirmed${
                    bookRes.clientEmail ? ` & sent to ${bookRes.clientEmail}` : ""
                  }`
                );
              } else if (isNoAnswer) {
                toast.info(`📞 No answer from ${lead.name} (Status: No Answer).`);
              } else {
                toast.info(`📞 Call with ${lead.name} completed (${formatDuration(finalDuration)}).`);
              }
            } catch (bErr) {
              console.error("Auto booking check error:", bErr);
            }

            // Sync Leads Table from Supabase
            fetchLeads();

            setTimeout(() => {
              const cur = activeCallsRef.current[leadId];
              if (cur?.status === "ended" && cur.callId === callId) {
                delete activeCallsRef.current[leadId];
                setActiveCalls((prev) => {
                  const copy = { ...prev };
                  delete copy[leadId];
                  return copy;
                });
              }
            }, 3000);
          }
        } catch (e) {
          console.error("Poller error:", e);
        }
      }, 1500);
    } catch (err: any) {
      console.error("Inline call error:", err);
      toast.error(`Call failed: ${err.message || "Unknown error"}`);
      delete activeCallsRef.current[leadId];
      setActiveCalls((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
    }
  }

  async function handleHangupInlineCall(leadId: string) {
    const callState = activeCallsRef.current[leadId];
    if (!callState) return;

    if (activePollersRef.current[leadId]) {
      clearInterval(activePollersRef.current[leadId]);
      delete activePollersRef.current[leadId];
    }
    if (activeTimersRef.current[leadId]) {
      clearInterval(activeTimersRef.current[leadId]);
      delete activeTimersRef.current[leadId];
    }

    if (callState.callId) {
      stopVapiCallFn({ data: { callId: callState.callId } }).catch(() => {});
    }

    let finalDur = 0;
    if (callState.startTime) {
      finalDur = Math.floor((Date.now() - callState.startTime) / 1000);
    } else if (callState.duration) {
      finalDur = callState.duration;
    }

    const itemStatus: "completed" | "no_answer" = finalDur > 0 ? "completed" : "no_answer";

    const prevHistory = callHistoryMapRef.current[leadId] || [];
    const filteredHistory = prevHistory.filter((h) => h.callId !== callState.callId);
    const updatedHistory = [
      ...filteredHistory,
      { callId: callState.callId, duration: finalDur, status: itemStatus, timestamp: Date.now() },
    ];
    callHistoryMapRef.current[leadId] = updatedHistory;
    setCallHistoryMap((prev) => ({ ...prev, [leadId]: updatedHistory }));

    const endedCall = { ...callState, status: "ended" as const, duration: finalDur };
    activeCallsRef.current[leadId] = endedCall;
    setActiveCalls((prev) => ({ ...prev, [leadId]: endedCall }));

    toast.info("Call disconnected.");
    fetchLeads();

    setTimeout(() => {
      delete activeCallsRef.current[leadId];
      setActiveCalls((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
    }, 3000);
  }
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [isRecordingsDialogOpen, setIsRecordingsDialogOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  useEffect(() => {
    if (isAdmin) {
      supabase
        .from("profiles")
        .select("*")
        .then(({ data }) => {
          if (data) {
            const approved = data
              .filter((p: any) => {
                if (isAdminEmail(p.email)) return false;
                if (p.avatar_url) {
                  try {
                    return JSON.parse(p.avatar_url).approved === true;
                  } catch {}
                }
                return false;
              })
              .map((p: any) => ({
                name: p.full_name || p.email.split("@")[0],
                email: p.email,
              }));
            setApprovedAgents(approved);
          }
        });
    }
  }, [isAdmin]);

  async function handleReassignLead(leadId: string, leadName: string, newAgentEmail: string) {
    try {
      // Set assigned_at to now when admin assigns to a Working Agent (not admin pool).
      // This is the authoritative timestamp for "Assigned Leads" reporting.
      const isAssigningToAgent = !isAdminEmail(newAgentEmail);
      const { error } = await supabase
        .from("leads")
        .update({
          assigned_agent_name: newAgentEmail,
          assigned_at: isAssigningToAgent ? new Date().toISOString() : null,
        })
        .eq("id", leadId);

      if (error) {
        toast.error("Failed to reassign lead: " + error.message);
        return;
      }

      if (!isAdminEmail(newAgentEmail)) {
        await supabase.from("emails_sent").insert({
          lead_email: newAgentEmail,
          subject: `Admin assigned lead "${leadName}" to you`,
          status: "unread",
          sequence_type: "lead_assignment",
          type: "lead_assignment",
          sent_at: new Date().toISOString(),
        });
      }

      toast.success(`Lead "${leadName}" assigned to ${newAgentEmail}!`);
      fetchLeads();
    } catch (err: any) {
      toast.error("Reassign error: " + err.message);
    }
  }

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    // Build the update payload: always update status, plus set event timestamps
    // for reporting. contacted_at is set when status first enters contacted/replied.
    // booked_at is set when status becomes booked.
    // won_at is set when status becomes won.
    const nowIso = new Date().toISOString();

    // Use a typed update object to avoid TS4111 index signature errors
    type LeadUpdate = {
      status: LeadStatus;
      contacted_at?: string;
      booked_at?: string;
      won_at?: string;
    };
    const updatePayload: LeadUpdate = { status: newStatus };

    if (newStatus === "contacted" || newStatus === "replied") {
      // Only set contacted_at if not already set (first contact event)
      const existing = dbLeads.find((l) => l.id === leadId);
      if (!existing || !(existing as any).contacted_at) {
        updatePayload.contacted_at = nowIso;
      }
    } else if (newStatus === "booked") {
      updatePayload.booked_at = nowIso;
    } else if (newStatus === "won") {
      updatePayload.won_at = nowIso;
    }

    const { error } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", leadId);

    if (error) {
      toast.error("Failed to update status: " + error.message);
      return;
    }

    // Optimistically update UI without altering lead date
    setDbLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus, updated_at: nowIso, lastContact: nowIso } : l))
    );
    toast.success(`Status updated to ${statusLabels[newStatus]}`);
  }

  
  async function handleCountryChange(leadId: string, newCountryCode: string) {
    const targetLead = dbLeads.find((l) => l.id === leadId);
    if (!targetLead) return;

    const newCountry = getCountryByCode(newCountryCode);
    const updatedPhone = changeCountryOnPhone(targetLead.phone, newCountryCode);

    // Optimistically update state
    setDbLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              country: newCountry.name,
              country_code: newCountry.code,
              country_flag: newCountry.flag,
              phone: updatedPhone,
            }
          : l
      )
    );

    try {
      const { error } = await supabase
        .from("leads")
        .update({ phone: updatedPhone })
        .eq("id", leadId);

      if (error) {
        toast.error("Failed to update country in database: " + error.message);
      } else {
        toast.success(`Updated ${targetLead.name || "lead"} to ${newCountry.flag} ${newCountry.name}`);
      }
    } catch (err: any) {
      toast.error("Error updating country: " + err?.message);
    }
  }

  async function handleBulkAssignLeads() {
    if (!selectedLeadIds.length) return;
    setIsBatchAssigning(true);
    try {
      // Set assigned_at to now when admin bulk-assigns to a Working Agent.
      const isAssigningToAgent = !isAdminEmail(bulkTargetAgent);
      const { error } = await supabase
        .from("leads")
        .update({
          assigned_agent_name: bulkTargetAgent,
          assigned_at: isAssigningToAgent ? new Date().toISOString() : null,
        })
        .in("id", selectedLeadIds);

      if (error) {
        toast.error("Failed bulk assign: " + error.message);
        setIsBatchAssigning(false);
        return;
      }

      if (!isAdminEmail(bulkTargetAgent)) {
        await supabase.from("emails_sent").insert({
          lead_email: bulkTargetAgent,
          subject: `Admin assigned ${selectedLeadIds.length} new leads to you`,
          status: "unread",
          sequence_type: "lead_assignment",
          type: "lead_assignment",
          sent_at: new Date().toISOString(),
        });
      }

      toast.success(`Assigned ${selectedLeadIds.length} leads to ${bulkTargetAgent}!`);
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (e: any) {
      toast.error("Bulk assign error: " + e.message);
    }
    setIsBatchAssigning(false);
  }

  async function handleClearAllLeads() {
    if (!window.confirm("⚠️ Are you sure you want to delete ALL leads? This action cannot be undone.")) return;
    setLoading(true);
    try {
      await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("emails_sent").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("meetings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      toast.success("✅ All leads and activity cleared successfully!");
      fetchLeads();
    } catch (e: any) {
      toast.error("Failed to clear leads: " + e.message);
    }
    setLoading(false);
  }

  async function fetchLeads() {
    setLoading(true);
    try {
      // 1. Resolve current user immediately (from state or localStorage fallback)
      let currentUser = user;
      if (!currentUser && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("teals-crm-session");
          if (raw) currentUser = JSON.parse(raw);
        } catch (e) {}
      }

      const isAdminUser = Boolean(
        (currentUser && (currentUser.role === "admin" || isAdminEmail(currentUser.email))) ||
        !currentUser
      );

      let q = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdminUser && currentUser?.email) {
        q = q.eq("assigned_agent_name", currentUser.email.trim());
      }

      const { data } = await q;

      if (data) {
        let rawLeads: DbLead[] = data as DbLead[];

        if (!isAdminUser && currentUser?.email) {
          const myEmail = currentUser.email.trim().toLowerCase();
          rawLeads = rawLeads.filter((l) => {
            const assigned = (l.assigned_agent_name || "").trim().toLowerCase();
            return assigned === myEmail;
          });
        }

        const mapped: Lead[] = rawLeads.map((l: DbLead) => {
          // Normalize status — booked is valid (auto-set by booking system), else default new
          const rawStatus = (l.status || "new").toLowerCase().replace(/ /g, "_") as LeadStatus;
          let validStatus: LeadStatus = ALL_STATUSES.includes(rawStatus) ? rawStatus : "new";

          // Auto-mark as "no_answer" if 24 hours have passed since import without reply or booking
          const createdAtTime = new Date(l.created_at || 0).getTime();
          const isOlderThan24h = createdAtTime > 0 && (Date.now() - createdAtTime) >= 24 * 60 * 60 * 1000;
          if (validStatus === "new" && isOlderThan24h) {
            validStatus = "no_answer";
            supabase.from("leads").update({ status: "no_answer" }).eq("id", l.id).then(() => {});
          }

          const leadDate = l.source_date || l.last_contact || l.created_at || new Date().toISOString();
          let countryInfo = detectCountryFromPhone(l.phone);
          const formattedPhone = l.phone && l.phone !== "—" ? formatPhoneWithCountryCode(l.phone) : (l.phone || "—");

          // Extract IP & Location from notes if captured
          let extractedIp: string | undefined = undefined;
          let extractedLocation: string | undefined = undefined;
          if (Array.isArray(l.notes)) {
            const ipNote = l.notes.find((n: string) => n.startsWith("🌐 IP:"));
            if (ipNote) {
              const match = ipNote.match(/🌐 IP:\s*([^|]+)\s*\|\s*Location:\s*([^|]+)/i);
              if (match) {
                extractedIp = match[1]?.trim();
                extractedLocation = match[2]?.trim();
              }
            }
          }

          // ⚡ Smart Auto Country: If phone is International/Missing, detect country from IP Geolocation!
          if ((!countryInfo || countryInfo.code === "UN" || countryInfo.name === "International") && extractedLocation) {
            const parts = extractedLocation.split("/").map((p) => p.trim());
            for (const part of parts) {
              const parsed = parseCountryString(part);
              if (parsed && parsed.code !== "UN") {
                countryInfo = parsed;
                break;
              }
            }
            if (countryInfo.code === "UN" || countryInfo.name === "International") {
              const parsedWhole = parseCountryString(extractedLocation);
              if (parsedWhole && parsedWhole.code !== "UN") {
                countryInfo = parsedWhole;
              }
            }
          }

          const cleanNotes = l.notes && l.notes.length 
            ? l.notes.filter((n: string) => !n.startsWith("🌐 IP:")) 
            : ["Imported lead."];

          return {
            id: l.id,
            name: l.name || "Unnamed",
            company: l.company || "—",
            email: l.email || "—",
            phone: formattedPhone,
            country: countryInfo.name,
            country_code: countryInfo.code,
            country_flag: countryInfo.flag,
            ip_address: extractedIp,
            location: extractedLocation,
            status: validStatus,
            agent: l.assigned_agent_name || "Unassigned",
            lastContact: leadDate,
            nextFollowUp: l.next_follow_up || l.created_at || new Date().toISOString(),
            notes: cleanNotes.length > 0 ? cleanNotes : ["Imported lead."],
            value: l.value || 0,
            source_date: leadDate,
            updated_at: l.updated_at || l.booked_at || l.contacted_at || l.won_at || (validStatus !== "new" ? leadDate : undefined),
            imported_by: l.imported_by,
            assigned_at: l.assigned_at,
          };
        });
        setDbLeads(mapped);
        loadHistoricalCalls(mapped);
      } else {
        setDbLeads([]);
      }
    } catch (e) {
      console.error("Leads fetch error:", e);
    }
    setLoading(false);
  }

  async function loadHistoricalCalls(currentLeads?: Lead[]) {
    try {
      const targetLeads = currentLeads || dbLeads;
      if (!targetLeads || targetLeads.length === 0) return;

      const res = await getVapiCallLogsFn();
      if (res?.success && Array.isArray(res.calls)) {
        const newHistoryMap: Record<string, CallHistoryItem[]> = { ...callHistoryMapRef.current };

        // Filter out deleted calls
        const validCalls = res.calls.filter(
          (c: any) => c && c.endedReason !== "call-deleted" && c.status !== "deleted"
        );

        targetLeads.forEach((lead) => {
          const leadPhoneClean = (lead.phone || "").replace(/[^\d]/g, "");
          const leadEmailClean = (lead.email || "").trim().toLowerCase();

          const matchedCalls = validCalls.filter((c: any) => {
            const customerNum = (c?.customer?.number || "").replace(/[^\d]/g, "");
            if (leadPhoneClean && customerNum) {
              if (
                customerNum.endsWith(leadPhoneClean) ||
                leadPhoneClean.endsWith(customerNum) ||
                customerNum.includes(leadPhoneClean) ||
                leadPhoneClean.includes(customerNum)
              ) {
                return true;
              }
            }

            if (leadEmailClean && leadEmailClean.length > 4 && leadEmailClean !== "—") {
              const transcript = (c?.transcript || "").toLowerCase();
              const summary = (c?.analysis?.summary || "").toLowerCase();
              const emailExtracted = (c?.analysis?.structuredData?.clientEmail || "").toLowerCase();
              if (
                emailExtracted.includes(leadEmailClean) ||
                transcript.includes(leadEmailClean) ||
                summary.includes(leadEmailClean)
              ) {
                return true;
              }
            }
            return false;
          });

          if (matchedCalls.length > 0) {
            const historyItems: CallHistoryItem[] = matchedCalls.map((c: any) => {
              let dur = computeCallDurationSecs(c);

              const hasTrans = Boolean((c.transcript || c.summary) && (c.transcript?.length > 10 || c.summary?.length > 10));
              const isNoAns = dur === 0 && !hasTrans && (c.endedReason === "customer-did-not-answer" || c.endedReason === "customer-busy" || c.endedReason === "no-answer");
              const status: "completed" | "no_answer" = isNoAns ? "no_answer" : "completed";
              const timestamp = new Date(c.startedAt || c.createdAt || Date.now()).getTime();
              return {
                callId: c.id,
                duration: dur,
                status,
                timestamp,
              };
            });

            // Sort newest call first (at the top)
            historyItems.sort((a, b) => b.timestamp - a.timestamp);
            newHistoryMap[lead.id] = historyItems;
          }
        });

        callHistoryMapRef.current = newHistoryMap;
        setCallHistoryMap(newHistoryMap);
      }
    } catch (e) {
      console.error("Failed to load historical calls:", e);
    }
  }

  useEffect(() => {
    fetchLeads();

    const sub = supabase
      .channel("leads-page-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLeads())
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [user?.email, user?.role, user?.name]);

  const agentOptions = useMemo(
    () => Array.from(new Set(dbLeads.map((l) => l.agent).filter(Boolean))),
    [dbLeads],
  );

  // Dynamic status counts for filter dropdown (all 5 statuses including booked)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: dbLeads.length,
      new: 0,
      no_answer: 0,
      contacted: 0,
      booked: 0,
      won: 0,
    };
    dbLeads.forEach((l) => {
      if (counts[l.status] !== undefined) {
        counts[l.status]++;
      }
    });
    return counts;
  }, [dbLeads]);

  // Filter and Sort strictly by Date (Default: Newest First)
  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = dbLeads.filter((l) => {
      const matches =
        !q ||
        [l.name, l.company, l.email, l.phone, l.agent].some((v) =>
          (v || "").toLowerCase().includes(q),
        );
      return matches && (status === "all" || l.status === status) && (agent === "all" || l.agent === agent);
    });

    // Smart Status & Date Sorting:
    // 1. "New" fresh leads always stay at the TOP (ready to call).
    // 2. Status-changed leads (Booked, Contacted, Won, No Answer) automatically move to the BOTTOM.
    // 3. Among status-changed leads, sorted chronologically so earlier handled leads appear first, and most recently handled goes to the bottom.
    return [...filtered].sort((a, b) => {
      const aIsNew = a.status === "new";
      const bIsNew = b.status === "new";

      if (aIsNew && !bIsNew) return -1; // a (New) stays on top
      if (!aIsNew && bIsNew) return 1;  // b (New) stays on top

      if (aIsNew && bIsNew) {
        // Both New: Sort by lead creation / import date (Newest First by default)
        const timeA = new Date(a.source_date || a.lastContact).getTime() || 0;
        const timeB = new Date(b.source_date || b.lastContact).getTime() || 0;
        return asc ? timeA - timeB : timeB - timeA;
      }

      // Both are processed / status changed:
      // Sort chronologically by status update time (earlier handled leads first, newly handled at the bottom)
      const updateA = new Date(a.updated_at || a.lastContact || a.source_date).getTime() || 0;
      const updateB = new Date(b.updated_at || b.lastContact || b.source_date).getTime() || 0;
      return updateA - updateB;
    });
  }, [dbLeads, query, status, agent, asc]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle={`${rows.length} of ${dbLeads.length} leads in your pipeline`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && dbLeads.length > 0 && (
              <Button
                onClick={() => setIsClearDialogOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 bg-rose-600/10 text-rose-300 border-rose-500/30 hover:bg-rose-600/20 hover:text-white transition-all shadow-sm active:scale-95"
                title="Clear leads by date or rule"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Leads ({dbLeads.length})
              </Button>
            )}
            <Button onClick={fetchLeads} variant="outline" size="sm" className="rounded-xl gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
                onClick={() => setIsRecordingsDialogOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 bg-violet-600/10 text-violet-300 border-violet-500/30 hover:bg-violet-600/20 hover:text-white"
              >
                <Headphones className="h-3.5 w-3.5" />
                All Call Recordings
              </Button>
              <ImportLeadsDialog onImportDone={fetchLeads} />
          </div>
        }
      />

      <div className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, company, email or agent…"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Status Filter with dynamic counts */}
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus | "all")}>
              <SelectTrigger className="h-10 w-full sm:w-52 rounded-xl">
                <Filter className="size-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All statuses ({statusCounts.all || 0})
                </SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]} ({statusCounts[s] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Agent Filter (for Admins) */}
            <Select value={agent} onValueChange={setAgent}>
              <SelectTrigger className="h-10 w-full sm:w-44 rounded-xl">
                <SlidersHorizontal className="size-4" />
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agentOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Sorting Toggle (Newest First / Oldest First) */}
            <Button
              variant="outline"
              className="h-10 w-full sm:w-auto justify-center rounded-xl gap-2 font-medium"
              onClick={() => setAsc((s) => !s)}
              title="Toggle Date Sorting Order"
            >
              <ArrowUpDown className="size-4" />
              <span>Date: {asc ? "Oldest First" : "Newest First"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Assignment Bar for Admin */}
      {isAdmin && selectedLeadIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/40 bg-violet-950/40 p-4 shadow-xl backdrop-blur animate-fade-in">
          <div className="flex items-center gap-3">
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 text-xs px-3 py-1 font-bold rounded-full">
              {selectedLeadIds.length} leads selected
            </Badge>
            <span className="text-xs text-slate-300 font-medium">Assign selected leads to agent:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={bulkTargetAgent} onValueChange={setBulkTargetAgent}>
              <SelectTrigger className="w-full sm:w-56 rounded-xl bg-slate-900 text-xs font-semibold border-slate-700">
                <SelectValue placeholder="Choose target agent..." />
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
              onClick={handleBulkAssignLeads}
              disabled={isBatchAssigning}
              className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold gap-1.5 px-4 shadow-md"
            >
              <UserCheck className="size-4" />
              {isBatchAssigning ? "Assigning..." : `Assign ${selectedLeadIds.length} Leads →`}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs text-slate-400 hover:text-white"
              onClick={() => setSelectedLeadIds([])}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="panel overflow-hidden">
        {/* 📱 Mobile Lead Card List (Hidden on Desktop md+) */}
        <div className="md:hidden divide-y divide-border/60">
          {isAdmin && rows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2/60 text-xs">
              <label className="flex items-center gap-2 font-medium text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded accent-violet-600 size-4 cursor-pointer"
                  checked={rows.length > 0 && selectedLeadIds.length === rows.length}
                  onChange={() => {
                    if (selectedLeadIds.length === rows.length) {
                      setSelectedLeadIds([]);
                    } else {
                      setSelectedLeadIds(rows.map((r) => r.id));
                    }
                  }}
                />
                Select all ({rows.length})
              </label>
              <span className="text-[11px] text-muted-foreground">Tap any card for details</span>
            </div>
          )}

          {loading && !dbLeads.length ? (
            <div className="py-16 text-center text-muted-foreground px-4">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-40" />
              Loading live leads from Supabase database...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground px-4">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No leads found matching your filter criteria.
            </div>
          ) : (
            rows.map((l) => {
              const call = activeCalls[l.id];
              const hasHistory = (callHistoryMap[l.id] || []).length > 0;
              const d = l.source_date || l.lastContact;
              const dateObj = d ? new Date(d) : null;
              const formattedDate =
                dateObj && !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                  : d || "—";

              return (
                <div
                  key={l.id}
                  onClick={() => setActive(l)}
                  className={`p-3.5 space-y-2.5 transition-colors active:bg-accent/30 ${
                    selectedLeadIds.includes(l.id) ? "bg-violet-500/10" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          className="rounded accent-violet-600 size-4 mt-0.5 shrink-0 cursor-pointer"
                          checked={selectedLeadIds.includes(l.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => {
                            setSelectedLeadIds((prev) =>
                              prev.includes(l.id) ? prev.filter((id) => id !== l.id) : [...prev, l.id]
                            );
                          }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {l.company || "—"} • <span className="text-[11px]">{formattedDate}</span>
                        </p>
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <Select
                        value={l.status}
                        onValueChange={(v) => handleStatusChange(l.id, v as LeadStatus)}
                      >
                        <SelectTrigger
                          className={`h-7 w-auto min-w-[115px] rounded-full border text-[11px] font-semibold px-2.5 py-0.5 gap-1 ${
                            statusTone[l.status] || "bg-slate-500/12 text-slate-400"
                          }`}
                          style={{ boxShadow: "none" }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {statusLabels[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Email & Phone Row */}
                  <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground bg-surface-2/40 rounded-xl p-2.5 border border-border/50">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-mono text-[11px] truncate">{l.email || "—"}</span>
                      {l.ip_address && (
                        <span className="font-mono text-[10px] text-emerald-400 shrink-0 flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {l.location || l.ip_address}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                      <span className="font-mono text-[11px] text-foreground/90">{l.phone || "—"}</span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <CountryCombobox
                          value={l.country_code || "US"}
                          onValueChange={(val) => handleCountryChange(l.id, val)}
                          className="h-6 text-[11px] min-w-[110px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions Row: Agent + AI Call */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 pt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="min-w-0 flex-1">
                      {isAdmin ? (
                        <Select
                          value={l.agent === "Unassigned" ? PRIMARY_ADMIN_EMAIL : l.agent}
                          onValueChange={(v) => handleReassignLead(l.id, l.name, v)}
                        >
                          <SelectTrigger className="h-7 text-[11px] rounded-xl border-dashed bg-surface-2/80 w-full max-w-[190px]">
                            <SelectValue placeholder="Assign agent..." />
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
                      ) : (
                        <span className="text-xs text-muted-foreground truncate block">Agent: {l.agent}</span>
                      )}
                    </div>

                    {l.phone && l.phone.trim().length > 3 && l.phone !== "—" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!call || call.status === "ended" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartInlineCall(l)}
                            className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-semibold bg-violet-600/10 hover:bg-violet-600 hover:text-white text-violet-400 border-violet-500/30"
                          >
                            <PhoneCall className="size-3.5" />
                            <span>{hasHistory ? "Redial" : "Call"}</span>
                          </Button>
                        ) : call.status === "ringing" ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-bold bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse pointer-events-none"
                            >
                              <PhoneCall className="size-3.5 animate-bounce" />
                              <span>Ringing...</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleHangupInlineCall(l.id)}
                              className="h-7 w-7 rounded-xl text-rose-400"
                            >
                              <PhoneOff className="size-3.5" />
                            </Button>
                          </div>
                        ) : call.status === "connected" ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-bold bg-emerald-500/15 text-emerald-300 border-emerald-500/40 pointer-events-none"
                            >
                              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                              <span>In Call {formatDuration(call.duration)}</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleHangupInlineCall(l.id)}
                              className="h-7 w-7 rounded-xl text-rose-400"
                            >
                              <PhoneOff className="size-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2/60">
                {isAdmin && (
                  <TableHead className="w-10 px-3">
                    <input
                      type="checkbox"
                      className="rounded accent-violet-600 size-4 cursor-pointer"
                      checked={rows.length > 0 && selectedLeadIds.length === rows.length}
                      onChange={() => {
                        if (selectedLeadIds.length === rows.length) {
                          setSelectedLeadIds([]);
                        } else {
                          setSelectedLeadIds(rows.map((r) => r.id));
                        }
                      }}
                    />
                  </TableHead>
                )}
                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">Company</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
                <TableHead className="whitespace-nowrap">Phone</TableHead>
                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Globe className="size-3.5 text-muted-foreground" />
                    <span>Country</span>
                  </div>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span>IP Address</span>
                  </div>
                </TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Agent</TableHead>
                <TableHead className="whitespace-nowrap text-center">AI Call</TableHead>
                <TableHead
                  className="whitespace-nowrap cursor-pointer select-none"
                  onClick={() => setAsc((s) => !s)}
                  title="Click to toggle Date Sort (Newest / Oldest)"
                >
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span>Lead Date</span>
                    <ArrowUpDown className="size-3 text-muted-foreground ml-0.5" />
                    <span className="text-[10px] text-primary font-bold">({asc ? "Oldest" : "Newest"})</span>
                  </div>
                </TableHead>
                <TableHead className="whitespace-nowrap">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !dbLeads.length ? (
                <TableRow>
                  <TableCell colSpan={10 + (isAdmin ? 1 : 0)} className="py-16 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-40" />
                    Loading live leads from Supabase database...
                  </TableCell>
                </TableRow>
              ) : rows.map((l) => (
                <TableRow
                  key={l.id}
                  className={`cursor-pointer ${selectedLeadIds.includes(l.id) ? "bg-violet-500/10" : ""}`}
                  onClick={() => setActive(l)}
                >
                  {isAdmin && (
                    <TableCell className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded accent-violet-600 size-4 cursor-pointer"
                        checked={selectedLeadIds.includes(l.id)}
                        onChange={() => {
                          setSelectedLeadIds((prev) =>
                            prev.includes(l.id) ? prev.filter((id) => id !== l.id) : [...prev, l.id]
                          );
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap font-medium">{l.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.company}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground font-mono text-xs">{l.email}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground font-mono text-xs">{l.phone}</TableCell>

                  {/* Country Flag & Name */}
                  <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <CountryCombobox
                      value={l.country_code || "US"}
                      onValueChange={(val) => handleCountryChange(l.id, val)}
                      className="min-w-[135px]"
                    />
                  </TableCell>

                  {/* IP Address & Real-time Location */}
                  <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {l.ip_address ? (
                      <div className="space-y-0.5">
                        <div className="font-mono text-[11px] font-bold text-foreground flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          {l.ip_address}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium">{l.location || "Online"}</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 italic">
                        <span className="size-1.5 rounded-full bg-slate-500/50"></span>
                        Pending open
                      </div>
                    )}
                  </TableCell>

                  {/* Status Dropdown (Always editable with all 5 statuses) */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={l.status}
                      onValueChange={(v) => handleStatusChange(l.id, v as LeadStatus)}
                    >
                      <SelectTrigger
                        className={`h-7 w-auto min-w-[130px] rounded-full border text-xs font-semibold px-2.5 py-0.5 gap-1 ${statusTone[l.status] || "bg-slate-500/12 text-slate-400"}`}
                        style={{ boxShadow: "none" }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {statusLabels[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {isAdmin ? (
                      <Select
                        value={l.agent === "Unassigned" ? PRIMARY_ADMIN_EMAIL : l.agent}
                        onValueChange={(v) => handleReassignLead(l.id, l.name, v)}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-xl border-dashed bg-surface-2/80">
                          <SelectValue placeholder="Assign agent..." />
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
                    ) : (
                      l.agent
                    )}
                  </TableCell>

                  {/* ⚡ 1-Click AI Call Action Button & Stacked Call History */}
                  <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {l.phone && l.phone.trim().length > 3 && l.phone !== "—" ? (
                      <div className="flex items-center gap-2">
                        {/* Call Action Button */}
                        {(() => {
                          const call = activeCalls[l.id];
                          if (!call || call.status === "ended") {
                            const hasHistory = (callHistoryMap[l.id] || []).length > 0;
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartInlineCall(l)}
                                className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-semibold bg-violet-600/10 hover:bg-violet-600 hover:text-white text-violet-400 border-violet-500/30 transition-all active:scale-95 shadow-sm shrink-0"
                                title={hasHistory ? "Click to redial this lead" : "Click to start 1-click AI outbound call"}
                              >
                                <PhoneCall className="size-3.5" />
                                <span>{hasHistory ? "Redial" : "Call"}</span>
                              </Button>
                            );
                          }

                          if (call.status === "ringing") {
                            return (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-bold bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse pointer-events-none"
                                >
                                  <PhoneCall className="size-3.5 animate-bounce" />
                                  <span>Ringing...</span>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleHangupInlineCall(l.id)}
                                  className="h-7 w-7 rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                                  title="Cancel / Hang up"
                                >
                                  <PhoneOff className="size-3.5" />
                                </Button>
                              </div>
                            );
                          }

                          if (call.status === "connected") {
                            return (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-xl px-2.5 gap-1.5 text-xs font-bold bg-emerald-500/15 text-emerald-300 border-emerald-500/40 pointer-events-none shadow-sm shadow-emerald-950/40"
                                >
                                  <span className="size-2 rounded-full bg-emerald-400 animate-ping"></span>
                                  <span>In Call {formatDuration(call.duration)}</span>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleHangupInlineCall(l.id)}
                                  className="h-7 w-7 rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                                  title="Hang up call"
                                >
                                  <PhoneOff className="size-3.5" />
                                </Button>
                              </div>
                            );
                          }

                          return null;
                        })()}

                        {/* Stack of Previous Call History Badges */}
                        {(callHistoryMap[l.id] || []).length > 0 && (
                          <div className="flex flex-col gap-1">
                            {(callHistoryMap[l.id] || []).map((h, idx) => (
                              <div
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border shadow-xs ${
                                  h.status === "no_answer" || h.duration === 0
                                    ? "bg-amber-950/40 text-amber-300 border-amber-500/30"
                                    : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                                }`}
                                title={`Call #${(callHistoryMap[l.id] || []).length - idx}: ${h.status === "no_answer" || h.duration === 0 ? "No Answer" : formatDuration(h.duration)}`}
                              >
                                {h.status === "no_answer" || h.duration === 0 ? (
                                  <>
                                    <PhoneOff className="size-3 text-amber-400 shrink-0" />
                                    <span>No Answer</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                                    <span>Ended ({formatDuration(h.duration)})</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs select-none">—</span>
                    )}
                  </TableCell>

                  {/* Lead Date Column (Always Visible, Unaffected by status changes) */}
                  <TableCell className="whitespace-nowrap text-muted-foreground font-medium text-xs">
                    {(() => {
                      const d = l.source_date || l.lastContact;
                      if (!d) return "—";
                      const dateObj = new Date(d);
                      return isNaN(dateObj.getTime())
                        ? d
                        : dateObj.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
                    })()}
                  </TableCell>

                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {l.notes && l.notes[0] ? l.notes[0] : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !rows.length ? (
                <TableRow>
                  <TableCell colSpan={10 + (isAdmin ? 1 : 0)} className="py-16 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No leads found matching your filter criteria.
                  </TableCell>
                </TableRow>
              ) : null}

            </TableBody>
          </Table>
        </div>
      </div>

      <LeadDetailSheet lead={active} onOpenChange={(o) => !o && setActive(null)} />

      <AiCallDialog
        open={isCallDialogOpen}
        onOpenChange={setIsCallDialogOpen}
        lead={callingLead}
        onCallComplete={() => fetchLeads()}
      />

      <AllCallRecordingsDialog
        open={isRecordingsDialogOpen}
        onOpenChange={setIsRecordingsDialogOpen}
      />

      <ClearLeadsDialog
        open={isClearDialogOpen}
        onOpenChange={setIsClearDialogOpen}
        leads={dbLeads}
        isAdmin={isAdmin}
        userEmail={user?.email}
        onCleared={fetchLeads}
      />
    </div>
  );
}
