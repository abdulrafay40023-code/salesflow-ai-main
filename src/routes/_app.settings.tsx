import { createFileRoute } from "@tanstack/react-router";
import { Bell, Bot, Mail, Shield, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/crm/Topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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
        .select("id,email,full_name,role,created_at")
        .order("created_at", { ascending: true });
      if (data) setTeamMembers(data as DbProfile[]);
    } catch (e) {
      console.error("Team fetch error", e);
    }
    setLoadingTeam(false);
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

        {/* ── TEAM MEMBERS (live from Supabase profiles) ── */}
        <TabsContent value="team" className="mt-5">
          <div className="panel divide-y divide-border">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="font-display text-lg font-bold">Team Members</h2>
                <p className="text-sm text-muted-foreground">
                  {loadingTeam ? "Loading..." : `${teamMembers.length} member${teamMembers.length !== 1 ? "s" : ""} in your workspace`}
                </p>
              </div>
              {isAdmin && (
                <Button className="rounded-xl" onClick={() => toast.info("Invite feature coming soon")}>
                  Invite member
                </Button>
              )}
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
                return (
                  <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-muted text-xs">
                          {memberInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{m.full_name || m.email}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {memberIsAdmin && (
                        <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-500">
                          Admin
                        </span>
                      )}
                    </div>
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
      </Tabs>
    </div>
  );
}
