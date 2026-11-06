import { supabase } from "@/lib/supabase";

export type AdminMember = {
  email: string;
  name: string;
  role: "admin";
  added_by?: string;
  created_at: string;
  is_default: boolean;
};

const STORAGE_KEY = "teals-dynamic-admins-cache";

export const DEFAULT_ADMIN_EMAILS = [
  "garryamelia6265@gmail.com",
  "jennifer.cisternino2027@gmail.com",
  "tzafar04@gmail.com",
  "annusraees@gmail.com",
];

// In-memory set of all recognized admin emails
const activeAdminEmailsSet = new Set<string>(DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()));

// Load cache from localStorage on initialization
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((item: any) => {
          if (item?.email) {
            activeAdminEmailsSet.add(item.email.toLowerCase().trim());
          }
        });
      }
    }
  } catch {}
}

export function isDynamicOrStaticAdmin(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return activeAdminEmailsSet.has(clean);
}

export function getAllAdminEmails(): string[] {
  return Array.from(activeAdminEmailsSet);
}

/**
 * Fetches the full list of Super Admins from the server/Supabase.
 */
export async function fetchDynamicAdmins(): Promise<AdminMember[]> {
  try {
    const res = await fetch("/api/approve-pending-signup", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.admins && Array.isArray(data.admins)) {
        // Update memory set
        DEFAULT_ADMIN_EMAILS.forEach((e) => activeAdminEmailsSet.add(e.toLowerCase()));
        data.admins.forEach((a: AdminMember) => {
          if (a.email) activeAdminEmailsSet.add(a.email.toLowerCase().trim());
        });

        // Update localStorage cache
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.admins));
          } catch {}
        }
        return data.admins;
      }
    }
  } catch (err) {
    console.error("fetchDynamicAdmins API notice:", err);
  }

  // Fallback: Query profiles table directly from Supabase
  try {
    const { data: profs } = await supabase
      .from("profiles")
      .select("email, full_name, created_at, role")
      .eq("role", "admin");

    const fallbackList: AdminMember[] = DEFAULT_ADMIN_EMAILS.map((email) => {
      const name =
        email === "garryamelia6265@gmail.com"
          ? "Garry Amelia"
          : email === "jennifer.cisternino2027@gmail.com"
          ? "Jennifer Cisternino"
          : email === "tzafar04@gmail.com"
          ? "T Zafar"
          : "Annus Raees";
      return {
        email,
        name,
        role: "admin",
        added_by: "System",
        created_at: "2026-01-01T00:00:00.000Z",
        is_default: true,
      };
    });

    if (profs && Array.isArray(profs)) {
      profs.forEach((p) => {
        if (p.email) {
          const key = p.email.toLowerCase().trim();
          activeAdminEmailsSet.add(key);
          if (!fallbackList.some((f) => f.email.toLowerCase() === key)) {
            fallbackList.push({
              email: key,
              name: p.full_name || key.split("@")[0],
              role: "admin",
              added_by: "Admin Panel",
              created_at: p.created_at || new Date().toISOString(),
              is_default: DEFAULT_ADMIN_EMAILS.includes(key),
            });
          }
        }
      });
    }

    return fallbackList;
  } catch {
    return DEFAULT_ADMIN_EMAILS.map((email) => ({
      email,
      name: email.split("@")[0],
      role: "admin",
      added_by: "System",
      created_at: "2026-01-01T00:00:00.000Z",
      is_default: true,
    }));
  }
}

/**
 * Grants Super Admin privileges to an email (even if they haven't visited or signed up yet).
 */
export async function grantAdminAccess({
  email,
  name,
  addedBy,
}: {
  email: string;
  name?: string;
  addedBy?: string;
}): Promise<AdminMember> {
  const cleanEmail = email.toLowerCase().trim();
  const displayName = (name || cleanEmail.split("@")[0]).trim();

  // Optimistically add to local cache
  activeAdminEmailsSet.add(cleanEmail);

  const res = await fetch("/api/approve-pending-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add_admin",
      email: cleanEmail,
      name: displayName,
      added_by: addedBy || "Admin",
    }),
  });

  if (!res.ok) {
    let errMsg = "Failed to grant admin access";
    try {
      const json = await res.json();
      if (json?.error) errMsg = json.error;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await res.json();

  // Broadcast to other tabs & windows
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("teals-crm-admins-sync");
      bc.postMessage({ type: "ADMIN_ADDED", email: cleanEmail, name: displayName });
      bc.close();
    }
  } catch {}

  // Broadcast over Supabase Realtime WebSocket
  try {
    const ch = supabase.channel(`admin-broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, {
      config: { broadcast: { self: true } },
    });
    await ch.subscribe();
    await ch.send({
      type: "broadcast",
      event: "crm_admin_list_updated",
      payload: { email: cleanEmail, name: displayName, action: "add" },
    });
    supabase.removeChannel(ch);
  } catch {}

  return data.admin;
}

/**
 * Revokes Super Admin privileges.
 */
export async function revokeAdminAccess(email: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();

  if (DEFAULT_ADMIN_EMAILS.includes(cleanEmail)) {
    throw new Error("Cannot revoke access for primary system default admin.");
  }

  // Remove from local cache
  activeAdminEmailsSet.delete(cleanEmail);

  const res = await fetch("/api/approve-pending-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "remove_admin",
      email: cleanEmail,
    }),
  });

  if (!res.ok) {
    let errMsg = "Failed to revoke admin access";
    try {
      const json = await res.json();
      if (json?.error) errMsg = json.error;
    } catch {}
    throw new Error(errMsg);
  }

  // Broadcast to other tabs
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("teals-crm-admins-sync");
      bc.postMessage({ type: "ADMIN_REMOVED", email: cleanEmail });
      bc.close();
    }
  } catch {}

  // Broadcast over Supabase Realtime WebSocket
  try {
    const ch = supabase.channel(`admin-broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, {
      config: { broadcast: { self: true } },
    });
    await ch.subscribe();
    await ch.send({
      type: "broadcast",
      event: "crm_admin_list_updated",
      payload: { email: cleanEmail, action: "remove" },
    });
    supabase.removeChannel(ch);
  } catch {}
}
