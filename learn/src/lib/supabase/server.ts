import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getUserFromCookies, type LocalUser } from "@/lib/auth/local-jwt";

/**
 * Convert our LocalUser (parsed from JWT) into the supabase-js User shape.
 * We only have the fields that live in the JWT payload, but everything our
 * codebase consumes (.id, .email, .aud, .user_metadata, .app_metadata, .role)
 * comes from there. Cast is safe in practice.
 */
function localToSupabaseUser(local: LocalUser): User {
  return {
    id: local.id,
    aud: local.aud,
    role: local.role ?? "authenticated",
    email: local.email,
    app_metadata: local.app_metadata ?? {},
    user_metadata: local.user_metadata ?? {},
    created_at: "",
  } as unknown as User;
}

/**
 * SSR Supabase client. Use this for DB queries (anon/RLS-bound).
 * Wrapped in React `cache()` so the same client is reused across
 * middleware → layout → page → components.
 *
 * DO NOT call `supabase.auth.getUser()` from this client — that hits the
 * Supabase Auth network endpoint (~2-3s p50, 90s under load). Use
 * `getCachedUser()` (below) instead — it verifies the JWT locally.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
});

/**
 * Returns the current user via LOCAL JWT signature verification — zero
 * network calls per page render. The JWKS is cached for 10 minutes by jose.
 *
 * Falls back to the network `auth.getUser()` only when local verification
 * fails (cookie missing, JWT expired, signature mismatch). That lets
 * supabase-js refresh the token in the rare case it's needed.
 *
 * Wrapped in React `cache()` so multiple components in the same render
 * share one verification call.
 *
 * **All server-side code should call this instead of `supabase.auth.getUser()`.**
 */
export const getCachedUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();

  // Local verification — microseconds, no auth pool hit
  const local = await getUserFromCookies((name) => cookieStore.get(name)?.value);
  if (local) return localToSupabaseUser(local);

  // Fallback: rare path (token expired, cookie missing, signature key rotated)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
