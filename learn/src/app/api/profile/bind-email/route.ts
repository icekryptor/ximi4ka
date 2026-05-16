import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await request.json();
  if (
    !email ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: "Введите корректный email" }, { status: 400 });
  }
  if (email.endsWith("@kits.ximi4ka.ru")) {
    return NextResponse.json({ error: "Этот домен зарезервирован" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Check email isn't taken by another user
  const { data: existing } = await admin.auth.admin.listUsers();
  const taken = existing.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (taken && taken.id !== user.id) {
    return NextResponse.json({ error: "Email уже используется" }, { status: 409 });
  }

  // Trigger email change — Supabase sends confirmation link to new email
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    message:
      "Подтверди письмо на новой почте — после этого вход будет по ней",
  });
}
