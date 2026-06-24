import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Netlify secrets named SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are not exposed to browser code, " +
        "so the frontend must use the NEXT_PUBLIC_ prefixed versions.",
    );
  }

  return createBrowserClient(url, publishableKey);
}
