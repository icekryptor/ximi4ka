import { NextRequest, NextResponse } from "next/server";
import { getCachedUser } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCachedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Verify ownership before deleting
  const { data: dev } = await admin
    .from("user_devices")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (!dev || dev.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await admin.from("user_devices").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
