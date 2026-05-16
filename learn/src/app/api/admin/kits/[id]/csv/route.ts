import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (prof?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const { data: creds } = await supabase
    .from("kit_credentials")
    .select("login, password_plain, activated_at")
    .eq("batch_id", id)
    .is("activated_at", null);

  const rows = ["Логин,Пароль,QR-ссылка"];
  for (const c of creds ?? []) {
    if (!c.password_plain) continue;
    const qr = `https://learn.ximi4ka.ru/kit-login?l=${encodeURIComponent(c.login)}&p=${encodeURIComponent(c.password_plain)}`;
    rows.push(`${c.login},${c.password_plain},${qr}`);
  }

  return new NextResponse(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="batch-${id}-unactivated.csv"`,
    },
  });
}
