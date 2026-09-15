import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Copy,
  Globe,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/crm/Topbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCrm } from "@/lib/crm-store";
import { isAdminEmail } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import {
  fetchPendingSignups,
  approvePendingSignup,
  removePendingOrApprovedSignup,
  type PendingSignup,
} from "@/lib/pending-signups";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Teals CRM" },
      { name: "description", content: "Manage your profile, team members, and Meta Lead Ads integration." },
      { property: "og:title", content: "Settings — Teals CRM" },
    ],
  }),
  component: SettingsPage,
});

type DbProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

function SettingsPage() {
  const { user } = useCrm();
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  const [teamMembers, setTeamMembers] = useState<DbProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingSignup[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  async function fetchTeam() {
    setLoadingTeam(true);
    try {
      // Fetch approved/active profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,email,full_name,avatar_url,role,created_at")
        .order("created_at", { ascending: true });
      if (profiles) {
        const approvedOnly = (profiles as DbProfile[]).filter((p: any) => {
          if (p.role === "admin" || isAdminEmail(p.email)) return true;
          if (p.avatar_url) {
            try {
              const meta = JSON.parse(p.avatar_url);
              return meta.approved === true;
            } catch {}
          }
          return false;
        });
        setTeamMembers(approvedOnly);
      }

      // Fetch pending signups queue
      if (isAdmin) {
        const reqs = await fetchPendingSignups();
        setPendingRequests(reqs);
      }
    } catch (err) {
      console.error("Failed to load team:", err);
    } finally {
      setLoadingTeam(false);
    }
  }

  // Handle Approve button click
  async function handleApprovePendingRequest(req: PendingSignup) {
    try {
      await approvePendingSignup(req);
      toast.success(`Approved ${req.name} (${req.email})! Profile created in CRM.`);
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to approve user: " + err.message);
    }
  }

  // Handle Reject button click
  async function handleRejectPendingRequest(req: PendingSignup) {
    try {
      await removePendingOrApprovedSignup(req.email);
      toast.success(`Rejected access request for ${req.name} (${req.email}).`);
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to reject user: " + err.message);
    }
  }

  // Handle Role Change
  async function handleRoleChange(m: DbProfile, newRole: string) {
    if (isAdminEmail(m.email)) {
      toast.error("Admin role cannot be changed.");
      return;
    }
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", m.id);
    if (error) {
      toast.error("Failed to update role: " + error.message);
    } else {
      toast.success(`Updated ${m.full_name || m.email}'s role to ${newRole}.`);
      fetchTeam();
    }
  }

  // Handle Remove member
  async function handleRemoveMember(m: DbProfile) {
    if (isAdminEmail(m.email)) {
      toast.error("Admin cannot be removed.");
      return;
    }
    try {
      await removePendingOrApprovedSignup(m.email);
      toast.success(`Removed ${m.full_name || m.email} from CRM.`);
      fetchTeam();
    } catch (err: any) {
      toast.error("Failed to remove member: " + err.message);
    }
  }

  useEffect(() => {
    fetchTeam();
  }, []);

  const initials = (user?.name ?? "NX")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your workspace, team and integrations." />

      <Tabs defaultValue="profile">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          {[
            ["profile", "Profile", UserRound],
            ["team", "Team Members", Users],
            ["meta", "Meta Lead Ads", Globe],
          ]
            .filter(([v]) => isAdmin || v === "profile")
            .map(([v, label, Icon]) => {
              const I = Icon as typeof UserRound;
              return (
                <TabsTrigger key={v as string} value={v as string} className="rounded-lg">
                  <I className="size-4" /> {label as string}
                </TabsTrigger>
              );
            })}
        </TabsList>

        {/* ── PROFILE ──────────────────────────────── */}
        <TabsContent value="profile" className="mt-5">
          <div className="panel max-w-2xl p-6">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="size-16">
                <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-display text-lg font-bold">{user?.name}</p>
                {isAdmin && (
                  <p className="text-sm text-muted-foreground">Admin · Teals CRM</p>
                )}
              </div>
            </div>
            <Separator className="my-6" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input className="rounded-xl" defaultValue={user?.name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input className="rounded-xl" defaultValue={user?.email ?? ""} readOnly />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email signature</Label>
                <Textarea
                  className="min-h-24 rounded-xl"
                  defaultValue={user?.name ?? ""}
                  placeholder="Add your email signature..."
                />
              </div>
            </div>
            <Button className="mt-6 rounded-xl" onClick={() => toast.success("Profile saved")}>
              Save changes
            </Button>
          </div>
        </TabsContent>

        {/* ── TEAM MEMBERS (live from Supabase profiles with Approval & Removal) ── */}
        <TabsContent value="team" className="mt-5">
          <div className="space-y-4">

            {/* ── PENDING APPROVAL REQUESTS ── */}
            {isAdmin && pendingRequests.length > 0 && (
              <div className="panel divide-y divide-border">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <h2 className="font-display text-lg font-bold flex items-center gap-2">
                      🟡 Pending Approval Requests
                      <span className="rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5">{pendingRequests.length}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground">New agents waiting for your approval to access the CRM</p>
                  </div>
                </div>
                {pendingRequests.map((req) => {
                  const reqInitials = req.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={req.id} className="flex flex-wrap items-center justify-between gap-4 p-5 bg-amber-500/5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs font-bold">{reqInitials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{req.name}</p>
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">Pending Approval</span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{req.email}</p>
                          {req.phone && <p className="text-[11px] text-muted-foreground/80 mt-0.5">📞 {req.phone}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            Requested: {(() => {
                              const d = req.created_at || (req as any).sent_at;
                              if (!d) return "Recently";
                              const parsed = new Date(d);
                              return isNaN(parsed.getTime()) ? "Recently" : parsed.toLocaleString();
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprovePendingRequest(req)}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 shadow-sm"
                        >
                          ✅ Approve Access
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectPendingRequest(req)}
                          className="rounded-xl text-xs font-semibold px-3 py-1.5"
                        >
                          ❌ Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── APPROVED / ACTIVE MEMBERS ── */}
            <div className="panel divide-y divide-border">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="font-display text-lg font-bold">Active Team Members</h2>
                  <p className="text-sm text-muted-foreground">
                    {loadingTeam ? "Loading..." : `${teamMembers.length} member${teamMembers.length !== 1 ? "s" : ""} with CRM access`}
                  </p>
                </div>
              </div>

              {loadingTeam ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading team...</div>
              ) : teamMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-muted-foreground">
                  <Users className="h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">No team members yet</p>
                  <p className="text-xs">Members appear here once you approve their access request</p>
                </div>
              ) : (
                teamMembers.map((m) => {
                  const memberInitials = (m.full_name || m.email)
                    .split(" ")
                    .map((p: string) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const memberIsAdmin = isAdminEmail(m.email) || m.role === "admin";

                  let phone = "";
                  let isApproved = memberIsAdmin;
                  if ((m as any).avatar_url) {
                    try {
                      const parsed = JSON.parse((m as any).avatar_url);
                      phone = parsed.phone || "";
                      if (typeof parsed.approved === "boolean" && !memberIsAdmin) {
                        isApproved = parsed.approved;
                      }
                    } catch {}
                  }

                  return (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{memberInitials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{m.full_name || m.email.split("@")[0]}</p>
                            <Badge variant={memberIsAdmin ? "default" : "secondary"} className="rounded-full text-[10px] capitalize">
                              {memberIsAdmin ? "Admin" : m.role || "Agent"}
                            </Badge>
                            {isApproved && (
                              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.2 text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="size-3" /> Approved
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                          {phone && <p className="text-[11px] text-muted-foreground/80 mt-0.5">📞 {phone}</p>}
                        </div>
                      </div>

                      {isAdmin && !memberIsAdmin && (
                        <div className="flex shrink-0 items-center gap-2">
                          <select
                            value={m.role || "agent"}
                            onChange={(e) => handleRoleChange(m, e.target.value)}
                            className="h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="agent">Agent</option>
                            <option value="manager">Manager</option>
                          </select>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemoveMember(m)}
                            className="rounded-xl text-xs h-8 px-3"
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── META LEAD ADS INTEGRATION ───────────── */}
        <TabsContent value="meta" className="mt-5">
          <div className="panel max-w-3xl space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="size-5 text-blue-400" />
                  <h3 className="font-display text-lg font-bold">Facebook & Instagram Lead Ads</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect Meta Developer Lead Ads webhook to auto-import leads into Admin Dashboard pool.
                </p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                🟢 Webhook Endpoint Ready
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Webhook Callback URL (Vercel Serverless Endpoint)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value="https://salesflow-ai-main.vercel.app/api/meta-webhook"
                    className="rounded-xl bg-surface-2 font-mono text-xs text-blue-300"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl shrink-0 gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText("https://salesflow-ai-main.vercel.app/api/meta-webhook");
                      toast.success("Copied Meta Webhook URL to clipboard!");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Meta Verification Token (`hub.verify_token`)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value="salesflow_meta_secret_token"
                    className="rounded-xl bg-surface-2 font-mono text-xs text-emerald-300"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl shrink-0 gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText("salesflow_meta_secret_token");
                      toast.success("Copied verify token!");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy Token
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 space-y-2">
              <p className="text-xs font-bold text-blue-300">📌 How to connect Meta Lead Ads:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                <li>Go to <strong>Meta for Developers</strong> → App Dashboard → Add Webhooks product.</li>
                <li>Select <strong>Page</strong> object → Subscribe to <code>leadgen</code> fields.</li>
                <li>Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> provided above.</li>
                <li>When leads submit your Meta Lead Form, they will instantly land in <strong>Admin Dashboard</strong> as New Leads!</li>
              </ol>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
