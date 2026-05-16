// learn/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const KIT_EMAIL_DOMAIN = "@kits.ximi4ka.ru";

function loginToEmail(input: string): string {
  if (input.includes("@")) return input;
  if (/^ximi-[A-Z0-9]{6}$/i.test(input)) return `${input.toLowerCase()}${KIT_EMAIL_DOMAIN}`;
  return input;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { login, password, device_id } = body as { login: string; password: string; device_id: string };
  if (!login || !password || !device_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const email = loginToEmail(login);

  // 1) Authenticate
  const supabase = await createServerClient();
  const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signErr || !signIn.user || !signIn.session) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }
  const userId = signIn.user.id;

  // 2) Service-role admin client for cross-user operations.
  // If SUPABASE_SERVICE_ROLE_KEY is missing, gracefully skip kit-activation + device tracking
  // so existing email/password users still work. Kit-login users will fail explicitly below.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    if (email.endsWith(KIT_EMAIL_DOMAIN)) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Сервис временно недоступен (admin key)" },
        { status: 503 }
      );
    }
    // Regular email/password login: skip device check, return success
    return NextResponse.json({ success: true, redirect: "/dashboard" });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // 3) Check kit credential and activate if first login
  if (email.endsWith(KIT_EMAIL_DOMAIN)) {
    const { data: cred } = await admin
      .from("kit_credentials")
      .select("id, batch_id, is_disabled, activated_at, kit_batches(module_id, duration_days)")
      .eq("supabase_user_id", userId)
      .single();

    if (cred?.is_disabled) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Этот код заблокирован. Обратитесь в поддержку." },
        { status: 403 }
      );
    }

    if (cred && !cred.activated_at) {
      const batch = (cred as any).kit_batches;
      const expiresAt = new Date(Date.now() + batch.duration_days * 24 * 60 * 60 * 1000);
      await admin.from("user_modules").upsert({
        user_id: userId,
        module_id: batch.module_id,
        expires_at: expiresAt.toISOString(),
        source: "kit",
      });
      await admin
        .from("kit_credentials")
        .update({ activated_at: new Date().toISOString(), last_login_at: new Date().toISOString() })
        .eq("id", cred.id);
    } else if (cred) {
      await admin
        .from("kit_credentials")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", cred.id);
    }
  }

  // 4) Device limit check
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activeDevices } = await admin
    .from("user_devices")
    .select("id, device_id, user_agent, last_active_at")
    .eq("user_id", userId)
    .gte("last_active_at", thirtyDaysAgo);

  const known = activeDevices?.find((d) => d.device_id === device_id);
  if (!known && (activeDevices?.length ?? 0) >= 3) {
    // Sign out the just-created session and return device list
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error: "DEVICE_LIMIT_EXCEEDED",
        devices: activeDevices,
      },
      { status: 409 }
    );
  }

  // 5) Upsert device
  await admin.from("user_devices").upsert(
    {
      user_id: userId,
      device_id,
      user_agent: request.headers.get("user-agent") ?? null,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id" }
  );

  return NextResponse.json({ success: true, redirect: "/dashboard" });
}
