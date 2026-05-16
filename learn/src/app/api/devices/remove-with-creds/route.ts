import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const { login, password, deviceIdToRemove } = await request.json();
  if (!login || !password || !deviceIdToRemove) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Resolve kit login to synthetic email
  const email = login.includes("@")
    ? login
    : `${login.toLowerCase()}@kits.ximi4ka.ru`;

  // Re-validate credentials via anon client (stateless — no cookie persistence)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signIn.user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await supabase.auth.signOut();

  // Use service-role client to delete the device if it belongs to this user
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: dev } = await admin
    .from("user_devices")
    .select("id, user_id")
    .eq("id", deviceIdToRemove)
    .single();

  if (!dev || dev.user_id !== signIn.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await admin.from("user_devices").delete().eq("id", deviceIdToRemove);
  return NextResponse.json({ success: true });
}
