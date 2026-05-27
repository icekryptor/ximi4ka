import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSvcClient } from "@supabase/supabase-js";
import { getUserFromCookies, type LocalUser } from "@/lib/auth/local-jwt";

// Service-role client for device checks (bypasses RLS).
// Lazy + module-scoped so it survives function reuse across requests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let svc: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSvcClient(): any | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!svc) {
    svc = createSvcClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return svc;
}

/**
 * Routes that ALWAYS go through auth check (protected — need a session).
 * Anything outside this list is treated as public and skips auth entirely.
 */
function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/learn") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/tools")
  );
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Fast-path: skip auth check entirely on public routes.
  if (!isProtectedPath(pathname)) {
    return NextResponse.next({ request });
  }

  // ============ LOCAL JWT VERIFICATION (zero network calls) ============
  //
  // This replaces the previous `supabase.auth.getUser()` network roundtrip
  // (was ~2.6s p50, sometimes 90s under load) with local ES256 signature
  // verification against Supabase's JWKS. The JWKS is cached for 10 minutes,
  // so this is microseconds for 99.99% of requests.
  //
  // Tradeoff: if JWT is expired/missing, we miss the auto-refresh path that
  // supabase-js does internally. We compensate by falling through to the
  // network client below (rare path, only on token expiry ~1/hour per user).
  let user: LocalUser | null = await getUserFromCookies(
    (name) => request.cookies.get(name)?.value
  );

  // Build the SSR supabase client lazily — only needed for fallback auth or
  // for the admin-role DB check below.
  let supabaseResponse = NextResponse.next({ request });
  const buildSupabase = () =>
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

  // Fallback path: local verification failed (no cookie, expired, sig bad).
  // Let supabase-js try to refresh the token — this is when it adds value.
  let supabaseRef: ReturnType<typeof buildSupabase> | null = null;
  if (!user) {
    supabaseRef = buildSupabase();
    const { data: { user: fetched } } = await supabaseRef.auth.getUser();
    if (fetched) {
      user = {
        id: fetched.id,
        email: fetched.email,
        role: fetched.role,
        aud: fetched.aud ?? "authenticated",
        app_metadata: fetched.app_metadata,
        user_metadata: fetched.user_metadata,
      };
    }
  }

  // Not logged in → bounce to /login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Device tracking — fire-and-mostly-forget upsert; not on critical path
  const adminSvc = getSvcClient();
  if (adminSvc) {
    const deviceId = request.cookies.get("xim_device_id")?.value;
    if (deviceId) {
      const { data: dev } = (await adminSvc
        .from("user_devices")
        .select("id, last_active_at")
        .eq("user_id", user.id)
        .eq("device_id", deviceId)
        .maybeSingle()) as { data: { id: string; last_active_at: string } | null; error: unknown };

      if (!dev) {
        await adminSvc.from("user_devices").upsert(
          {
            user_id: user.id,
            device_id: deviceId,
            user_agent: request.headers.get("user-agent") ?? null,
            last_active_at: new Date().toISOString(),
          },
          { onConflict: "user_id,device_id" }
        );
      } else {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (new Date(dev.last_active_at).getTime() < oneHourAgo) {
          await adminSvc
            .from("user_devices")
            .update({ last_active_at: new Date().toISOString() })
            .eq("id", dev.id);
        }
      }
    }
  } else {
    console.warn("[middleware] SUPABASE_SERVICE_ROLE_KEY not set — skipping device tracking");
  }

  // Admin routes — verify role (one DB read, no auth roundtrip)
  if (pathname.startsWith("/admin")) {
    const supabase = supabaseRef ?? buildSupabase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}
