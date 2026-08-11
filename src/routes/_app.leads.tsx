import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Filter, RefreshCw, Search, SlidersHorizontal, Users } from "lucide-react";
import { PageHeader } from "@/components/crm/Topbar";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { LeadDetailSheet } from "@/components/crm/LeadDetailSheet";
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
import { statusLabels, type Lead, type LeadStatus } from "@/lib/crm-data";
import { statusTone, useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Nexa CRM" },
      {
        name: "description",
        content:
          "Search, filter, sort and manage every lead: contact details, status, assigned agent, follow-ups and notes.",
      },
      { property: "og:title", content: "Leads — Nexa CRM" },
    ],
  }),
  component: LeadsPage,
});

type SortKey = "name" | "company" | "lastContact" | "nextFollowUp" | "value";

type DbLead = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  assigned_agent_name?: string;
  created_at: string;
  notes?: string[];
  value?: number;
};

function LeadsPage() {
  const { user } = useCrm();

  const [dbLeads, setDbLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [agent, setAgent] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("nextFollowUp");
  const [asc, setAsc] = useState(true);
  const [active, setActive] = useState<Lead | null>(null);

  async function fetchLeads() {
    setLoading(true);
    try {
      const isAdmin = Boolean(user && (user.role === "admin" || user.email === "garryamelia6265@gmail.com"));

      let query = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      // Working agent sees only their own imported leads
      if (!isAdmin) {
        const agentEmail = (user?.email || "").trim();
        const agentName = (user?.name || "").trim();

        const filterClauses: string[] = [];
        if (agentEmail) {
          filterClauses.push(`assigned_agent_name.ilike."${agentEmail}"`);
          filterClauses.push(`agent.ilike."${agentEmail}"`);
        }
        if (agentName) {
          filterClauses.push(`assigned_agent_name.ilike."${agentName}"`);
          filterClauses.push(`agent.ilike."${agentName}"`);
        }

        if (filterClauses.length > 0) {
          query = query.or(filterClauses.join(","));
        } else {
          query = query.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      const { data } = await query;

      if (data) {
        let rawLeads: DbLead[] = data as DbLead[];

        // Double-check isolation on client side
        if (!isAdmin) {
          const myEmail = (user?.email || "").trim().toLowerCase();
          const myName = (user?.name || "").trim().toLowerCase();
          rawLeads = rawLeads.filter((l) => {
            const assigned = (l.assigned_agent_name || l.agent || "").trim().toLowerCase();
            return assigned === myEmail || (myName && assigned === myName);
          });
        }

        const mapped: Lead[] = rawLeads.map((l: DbLead) => ({
          id: l.id,
          name: l.name || "Unnamed",
          company: l.company || "—",
          email: l.email || "—",
          phone: l.phone || "—",
          status: (l.status || "new") as LeadStatus,
          agent: l.assigned_agent_name || "Unassigned",
          lastContact: l.created_at || new Date().toISOString(),
          nextFollowUp: l.created_at || new Date().toISOString(),
          notes: l.notes && l.notes.length ? l.notes : ["Imported lead."],
          value: l.value || 0,
        }));
        setDbLeads(mapped);
      } else {
        setDbLeads([]);
      }
    } catch (e) {
      console.error("Leads fetch error:", e);
    }
    setLoading(false);
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
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av || "").localeCompare(String(bv || ""));
      return asc ? cmp : -cmp;
    });
  }, [dbLeads, query, status, agent, sortKey, asc]);

  const headers: { key: SortKey | null; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "company", label: "Company" },
    { key: null, label: "Email" },
    { key: null, label: "Phone" },
    { key: null, label: "Status" },
    { key: null, label: "Agent" },
    { key: "lastContact", label: "Last Contact" },
    { key: "nextFollowUp", label: "Next Follow-up" },
    { key: null, label: "Notes" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle={`${rows.length} of ${dbLeads.length} leads in your pipeline`}
        action={
          <div className="flex items-center gap-2">
            <Button onClick={fetchLeads} variant="outline" size="sm" className="rounded-xl gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
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
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus | "all")}>
              <SelectTrigger className="h-10 w-40 rounded-xl">
                <Filter className="size-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={agent} onValueChange={setAgent}>
              <SelectTrigger className="h-10 w-44 rounded-xl">
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

            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-10 w-44 rounded-xl">
                <ArrowUpDown className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by name</SelectItem>
                <SelectItem value="company">Sort by company</SelectItem>
                <SelectItem value="lastContact">Sort by last contact</SelectItem>
                <SelectItem value="nextFollowUp">Sort by follow-up</SelectItem>
                <SelectItem value="value">Sort by deal value</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setAsc((s) => !s)}>
              {asc ? "Ascending" : "Descending"}
            </Button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2/60">
                {headers.map((h) => (
                  <TableHead
                    key={h.label}
                    className={`whitespace-nowrap ${h.key ? "cursor-pointer select-none" : ""}`}
                    onClick={() => {
                      if (!h.key) return;
                      if (h.key === sortKey) setAsc((s) => !s);
                      else setSortKey(h.key);
                    }}
                  >
                    {h.label}
                    {h.key === sortKey ? (asc ? " ↑" : " ↓") : ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !dbLeads.length ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="py-16 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-40" />
                    Loading live leads from Supabase database...
                  </TableCell>
                </TableRow>
              ) : rows.map((l) => (
                <TableRow
                  key={l.id}
                  className="cursor-pointer"
                  onClick={() => setActive(l)}
                >
                  <TableCell className="whitespace-nowrap font-medium">{l.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.company}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{l.email}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{l.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-full ${statusTone[l.status]}`}>
                      {statusLabels[l.status] || l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{l.agent}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(l.lastContact).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(l.nextFollowUp).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {l.notes && l.notes[0] ? l.notes[0] : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !rows.length ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="py-16 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No leads in database yet. Click "Import Leads" to add leads.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      <LeadDetailSheet lead={active} onOpenChange={(o) => !o && setActive(null)} />
    </div>
  );
}
