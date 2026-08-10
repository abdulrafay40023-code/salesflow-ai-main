// Lazy client — only instantiated in the browser, never during SSR
let _supabase: ReturnType<typeof createClient> | null = null;

import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

function getSupabase() {
  if (typeof window === "undefined") return null;
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// Export a proxy object that lazily delegates to the real client
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      // On server, return a no-op stub for auth.onAuthStateChange
      if (prop === "auth") {
        return {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithOAuth: async () => ({ data: null, error: null }),
          signOut: async () => ({ error: null }),
        };
      }
      return () => Promise.resolve({ data: null, error: null });
    }
    const value = (client as Record<string | symbol, unknown>)[prop as string];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function signInWithGoogle() {
  const client = getSupabase();
  if (!client) return { data: null, error: new Error("Not in browser") };
  const origin = window.location.origin;
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/dashboard` },
  });
  return { data, error };
}

export async function signOutSupabase() {
  const client = getSupabase();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error };
}
