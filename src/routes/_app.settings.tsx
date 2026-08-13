import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Bot,
  CheckCircle2,
  Copy,
  Globe,
  Mail,
  Shield,
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCrm } from "@/lib/crm-store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Teals CRM" },
      { name: "description", content: "Manage your profile, team members, roles, notifications, email and AI settings." },
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
  const isAdmin = Boolean(user && (user.role === "admin" || user.email === "garryamelia6265@gmail.com"));

  const [teamMembers, setTeamMembers] = useState<DbProfile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  async function fetchTeam() {
    setLoadingTeam(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,avatar_url,role,created_at")
        .order("created_at", { ascending: true });
      if (data) setTeamMembers(data as DbProfile[]);
    } catch (e) {
      console.error("Team fetch error", e);
    }
    setLoadingTeam(false);
  }

  async function handleApproveMember(m: DbProfile) {
    let phone = "";
    if ((m as any).avatar_url) {
      try {
        const parsed = JSON.parse((m as any).avatar_url);
        phone = parsed.phone || "";
      } catch {}
    }
    const meta = JSON.stringify({ phone, approved: true, status: "approved" });
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: meta, role: "agent" })
      .eq("id", m.id);

    if (error) {
      toast.error("Failed to approve agent: " + error.message);
    } else {
      toast.success(`Approved ${m.full_name || m.email}! Access granted.`);
      fetchTeam();
    }
  }

  async function handleRemoveMember(m: DbProfile) {
    if (m.email === "garryamelia6265@gmail.com") {
      toast.error("Main Admin cannot be removed.");
      return;
    }
    const { error } = await supabase.from("profiles").delete().eq("id", m.id);
    if (error) {
      toast.error("Failed to remove member: " + error.message);
    } else {
      toast.success(`Removed ${m.full_name || m.email} from CRM.`);
      fetchTeam();
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
      <PageHeader title="Settings" subtitle="Manage your workspace, team and automation preferences." />

      <Tabs defaultValue="profile">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          {[
            ["profile", "Profile", UserRound],
            ["team", "Team Members", Users],
            ["roles", "Roles & Permissions", Shield],
            ["meta", "Meta Lead Ads", Globe],
            ["notifications", "Notifications", Bell],
            ["email", "Email Settings", Mail],
            ["ai", "AI Settings", Bot],
          ]
            .filter(([v]) => isAdmin || v === "profile")
            .map(([v, label, Icon]) => {

              const I = Icon as typeof Bell;
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
                {/* Only show "Admin" for admin, nothing for regular users */}
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
          <div className="panel divide-y divide-border">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="font-display text-lg font-bold">Team Members & Approvals</h2>
                <p className="text-sm text-muted-foreground">
                  {loadingTeam ? "Loading..." : `${teamMembers.length} member${teamMembers.length !== 1 ? "s" : ""} registered`}
                </p>
              </div>
            </div>

            {loadingTeam ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading team...</div>
            ) : teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-muted-foreground">
                <Users className="h-8 w-8 opacity-30" />
                <p className="text-sm font-medium">No team members yet</p>
                <p className="text-xs">Members appear here when they sign in with Google</p>
              </div>
            ) : (
              teamMembers.map((m) => {
                const memberInitials = (m.full_name || m.email)
                  .split(" ")
                  .map((p: string) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const memberIsAdmin = m.email === "garryamelia6265@gmail.com";

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
                        <AvatarFallback className="bg-muted text-xs font-bold">
                          {memberInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{m.full_name || m.email}</p>
                          {memberIsAdmin ? (
                            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold text-violet-400">
                              Admin
                            </span>
                          ) : isApproved ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              Approved
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                              Pending Approval
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                        {phone && <p className="text-[11px] text-muted-foreground/80 mt-0.5">📞 {phone}</p>}
                      </div>
                    </div>

                    {isAdmin && !memberIsAdmin && (
                      <div className="flex shrink-0 items-center gap-2">
                        {!isApproved && (
                          <Button
                            size="sm"
                            onClick={() => handleApproveMember(m)}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 shadow-sm"
                          >
                            ✅ Approve Access
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveMember(m)}
                          className="rounded-xl text-xs font-semibold px-3 py-1.5"
                        >
                          🗑️ Remove
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ── ROLES & PERMISSIONS ──────────────────── */}
        <TabsContent value="roles" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                name: "Admin",
                desc: "Full access to all leads, reports, settings and admin panel",
                permissions: [true, true, true, true],
              },
              {
                name: "Team Member",
                desc: "Access to leads and follow-ups assigned to them",
                permissions: [true, true, false, true],
              },
            ].map((r) => (
              <div key={r.name} className="panel p-5">
                <h3 className="font-display text-base font-bold">{r.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                <div className="mt-5 space-y-3">
                  {["View all leads", "Edit leads", "Manage team", "View reports"].map((p, i) => (
                    <div key={p} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{p}</span>
                      <Switch checked={r.permissions[i]} readOnly />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── NOTIFICATIONS ────────────────────────── */}
        <TabsContent value="notifications" className="mt-5">
          <div className="panel max-w-2xl divide-y divide-border">
            {[
              ["New lead added", "Get notified the moment a lead is imported", true],
              ["Meeting reminders", "30 minutes before every scheduled meeting", true],
              ["Follow-up due", "Daily digest of follow-ups due today", true],
              ["Email replies", "When a lead replies to an automated email", true],
              ["Weekly report", "Monday morning performance summary", false],
            ].map(([title, desc, on]) => (
              <div
                key={title as string}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{title as string}</p>
                  <p className="text-xs text-muted-foreground">{desc as string}</p>
                </div>
                <Switch defaultChecked={on as boolean} />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── EMAIL SETTINGS ────────────────────────── */}
        <TabsContent value="email" className="mt-5">
          <div className="panel max-w-2xl space-y-5 p-6">
            <div className="space-y-2">
              <Label>Reply-to address</Label>
              <Input className="rounded-xl" defaultValue={user?.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Daily send limit per agent</Label>
              <Input className="rounded-xl" type="number" defaultValue={50} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-semibold">Track opens and clicks</p>
                <p className="text-xs text-muted-foreground">Adds a tracking pixel to outbound mail</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Button className="rounded-xl" onClick={() => toast.success("Email settings saved")}>
              Save settings
            </Button>
          </div>
        </TabsContent>

        {/* ── AI SETTINGS ──────────────────────────── */}
        <TabsContent value="ai" className="mt-5">
          <div className="panel max-w-2xl space-y-6 p-6">
            <div className="flex items-center justify-between rounded-xl border border-border bg-accent/30 p-4">
              <div>
                <p className="text-sm font-semibold">AI automation</p>
                <p className="text-xs text-muted-foreground">
                  Draft emails, score leads and suggest next steps
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-3">
              <Label>Automation aggressiveness</Label>
              <Slider defaultValue={[60]} max={100} step={10} />
              <p className="text-xs text-muted-foreground">
                Higher values send more proactive follow-ups without approval.
              </p>
            </div>
            <div className="space-y-3">
              <Label>Tone of voice</Label>
              <Textarea
                className="min-h-24 rounded-xl"
                defaultValue="Warm, concise and consultative. Never pushy. Always reference the lead's industry."
              />
            </div>
            {[
              ["Auto-assign new leads", true],
              ["Suggest meeting times", true],
              ["Summarise call notes", false],
            ].map(([t, on]) => (
              <div key={t as string} className="flex items-center justify-between">
                <span className="text-sm">{t as string}</span>
                <Switch defaultChecked={on as boolean} />
              </div>
            ))}
            <Button className="rounded-xl" onClick={() => toast.success("AI settings saved")}>
              Save AI settings
            </Button>
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

