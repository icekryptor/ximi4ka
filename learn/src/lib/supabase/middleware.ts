import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSvcClient } from "@supabase/supabase-js";

// Service-role client for device checks (bypasses RLS)
// Instantiated lazily — if key is missing we skip device enforcement gracefully
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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes
  const isLearnRoute = request.nextUrl.pathname.startsWith("/learn");
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isAdmin = request.nextUrl.pathname.startsWith("/admin");
  const isProfile = request.nextUrl.pathname.startsWith("/profile");
  const isCheckout = request.nextUrl.pathname.startsWith("/checkout");
  const isTools = request.nextUrl.pathname.startsWith("/tools");

  const isProtected = isLearnRoute || isDashboard || isAdmin || isProfile || isCheckout || isTools;

  // Device enforcement — only on protected routes, only when user is authenticated
  if (user && isProtected) {
    const adminSvc = getSvcClient();
    if (!adminSvc) {
      // SUPABASE_SERVICE_ROLE_KEY not set — skip device check gracefully
      console.warn("[middleware] SUPABASE_SERVICE_ROLE_KEY not set — skipping device enforcement");
    } else {
      const deviceId = request.cookies.get("xim_device_id")?.value;
      if (deviceId) {
        const { data: dev } = (await adminSvc
          .from("user_devices")
          .select("id, last_active_at")
          .eq("user_id", user.id)
          .eq("device_id", deviceId)
          .maybeSingle()) as { data: { id: string; last_active_at: string } | null; error: unknown };

        if (!dev) {
          // Device was removed — force logout and redirect
          await supabase.auth.signOut();
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("error", "device_removed");
          return NextResponse.redirect(url);
        }

        // Throttled last_active_at update: only write if older than 1 hour
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (new Date(dev.last_active_at).getTime() < oneHourAgo) {
          await adminSvc
            .from("user_devices")
            .update({ last_active_at: new Date().toISOString() })
            .eq("id", dev.id);
        }
      }
    }
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Admin routes — check role (via profile metadata)
  if (isAdmin && user) {
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
