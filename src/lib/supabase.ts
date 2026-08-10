import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});

export async function signInWithGoogle() {
  if (typeof window === "undefined") return { data: null, error: new Error("Not in browser") };
  const origin = window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/dashboard` },
  });
  return { data, error };
}

export async function signOutSupabase() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

